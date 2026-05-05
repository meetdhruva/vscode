/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { CopilotLanguageModelWrapper } from '../../../conversation/vscode-node/languageModelAccess';
import { ModelSupportedEndpoint } from '../../../../platform/endpoint/common/endpointProvider';
import { OpenAIEndpoint } from '../../node/openAIEndpoint';
import { CustomOAIBYOKModelProvider, resolveCustomOAIUrl } from '../customOAIProvider';

describe('CustomOAIBYOKModelProvider', () => {
	describe('resolveCustomOAIUrl', () => {
		it('resolves OpenAI-compatible base URLs to chat completions', () => {
			expect(resolveCustomOAIUrl('gpt-test', 'https://compat.example.com')).toBe('https://compat.example.com/v1/chat/completions');
			expect(resolveCustomOAIUrl('gpt-test', 'https://compat.example.com/')).toBe('https://compat.example.com/v1/chat/completions');
			expect(resolveCustomOAIUrl('gpt-test', 'https://compat.example.com/v2')).toBe('https://compat.example.com/v2/chat/completions');
		});

		it('preserves explicit OpenAI-compatible API paths', () => {
			expect(resolveCustomOAIUrl('gpt-test', 'https://compat.example.com/v1/chat/completions')).toBe('https://compat.example.com/v1/chat/completions');
			expect(resolveCustomOAIUrl('gpt-test', 'https://compat.example.com/v1/responses')).toBe('https://compat.example.com/v1/responses');
		});
	});

	it('uses configured model URL and API key without Copilot auth or model discovery', async () => {
		const fetcherService = createFetcherService();
		const byokStorageService = createBYOKStorageService();
		const wrapper = {
			provideLanguageModelResponse: vi.fn().mockResolvedValue(undefined),
			provideTokenCount: vi.fn().mockResolvedValue(0),
		};
		const endpoint = {};
		const instantiationService = {
			createInstance: vi.fn((ctor: new (...args: any[]) => unknown, ...args: unknown[]) => {
				if (ctor === CopilotLanguageModelWrapper) {
					return wrapper;
				}
				if (ctor === OpenAIEndpoint) {
					return endpoint;
				}
				throw new Error(`Unexpected createInstance call for ${ctor.name}`);
			}),
		};
		const provider = new CustomOAIBYOKModelProvider(
			byokStorageService as any,
			createLogService() as any,
			fetcherService as any,
			instantiationService as any,
			createConfigurationService() as any,
			{} as any,
			createExtensionContext() as any
		);
		const configuration = {
			apiKey: 'sk-custom-provider',
			models: [{
				id: 'mock-openai-compatible',
				name: 'Mock OpenAI Compatible',
				url: 'https://compat.example.com/v2',
				toolCalling: true,
				vision: true,
				maxInputTokens: 32000,
				maxOutputTokens: 4096,
				requestHeaders: { 'x-custom-route': 'test-route' },
			}]
		};

		const tokenSource = new vscode.CancellationTokenSource();
		const models = await provider.provideLanguageModelChatInformation({
			silent: false,
			configuration,
		}, tokenSource.token);

		expect(models).toHaveLength(1);
		expect(models[0]).toMatchObject({
			id: 'mock-openai-compatible',
			name: 'Mock OpenAI Compatible',
			maxInputTokens: 32000,
			maxOutputTokens: 4096,
			url: 'https://compat.example.com/v2',
			apiKey: 'sk-custom-provider',
			configuration,
			capabilities: {
				toolCalling: true,
				imageInput: true,
			}
		});
		expect(fetcherService.fetch).not.toHaveBeenCalled();
		expect(byokStorageService.getAPIKey).not.toHaveBeenCalled();

		const progress = { report: vi.fn() };
		await provider.provideLanguageModelChatResponse(
			models[0],
			[],
			{ requestInitiator: 'test' } as any,
			progress as any,
			tokenSource.token
		);

		const openAIEndpointCall = instantiationService.createInstance.mock.calls.find(call => call[0] === OpenAIEndpoint);
		expect(openAIEndpointCall).toBeDefined();
		expect(openAIEndpointCall?.[1]).toMatchObject({
			id: 'mock-openai-compatible',
			name: 'Mock OpenAI Compatible',
			vendor: 'CustomOAI',
			requestHeaders: { 'x-custom-route': 'test-route' },
			capabilities: {
				limits: {
					max_prompt_tokens: 32000,
					max_output_tokens: 4096,
					max_context_window_tokens: 36096,
				},
				supports: {
					tool_calls: true,
					vision: true,
				}
			}
		});
		expect(openAIEndpointCall?.[2]).toBe('sk-custom-provider');
		expect(openAIEndpointCall?.[3]).toBe('https://compat.example.com/v2/chat/completions');
		expect(wrapper.provideLanguageModelResponse).toHaveBeenCalledWith(
			endpoint,
			[],
			{ requestInitiator: 'test' },
			'test',
			progress,
			tokenSource.token
		);
	});

	it('marks explicit Responses API URLs as supported for OpenAI-compatible models', async () => {
		const instantiationService = createCapturingInstantiationService();
		const provider = new CustomOAIBYOKModelProvider(
			createBYOKStorageService() as any,
			createLogService() as any,
			createFetcherService() as any,
			instantiationService.service as any,
			createConfigurationService() as any,
			{} as any,
			createExtensionContext() as any
		);
		const tokenSource = new vscode.CancellationTokenSource();
		const [model] = await provider.provideLanguageModelChatInformation({
			silent: false,
			configuration: {
				apiKey: 'sk-responses',
				models: [{
					id: 'responses-model',
					name: 'Responses Model',
					url: 'https://compat.example.com/v1/responses',
					toolCalling: false,
					vision: false,
					maxInputTokens: 1000,
					maxOutputTokens: 500,
				}]
			},
		}, tokenSource.token);

		await provider.provideLanguageModelChatResponse(
			model,
			[],
			{ requestInitiator: 'test' } as any,
			{ report: vi.fn() } as any,
			tokenSource.token
		);

		expect(instantiationService.openAIEndpointCall?.[1]).toMatchObject({
			id: 'responses-model',
			supported_endpoints: [
				ModelSupportedEndpoint.ChatCompletions,
				ModelSupportedEndpoint.Responses,
			],
		});
		expect(instantiationService.openAIEndpointCall?.[3]).toBe('https://compat.example.com/v1/responses');
	});
});

function createCapturingInstantiationService() {
	const wrapper = {
		provideLanguageModelResponse: vi.fn().mockResolvedValue(undefined),
		provideTokenCount: vi.fn().mockResolvedValue(0),
	};
	const endpoint = {};
	const state: { openAIEndpointCall?: unknown[] } = {};
	const service = {
		createInstance: vi.fn((ctor: new (...args: any[]) => unknown, ...args: unknown[]) => {
			if (ctor === CopilotLanguageModelWrapper) {
				return wrapper;
			}
			if (ctor === OpenAIEndpoint) {
				state.openAIEndpointCall = [ctor, ...args];
				return endpoint;
			}
			throw new Error(`Unexpected createInstance call for ${ctor.name}`);
		}),
	};
	return {
		service,
		get openAIEndpointCall() {
			return state.openAIEndpointCall;
		},
	};
}

function createBYOKStorageService() {
	return {
		getAPIKey: vi.fn().mockResolvedValue(undefined),
		storeAPIKey: vi.fn().mockResolvedValue(undefined),
		deleteAPIKey: vi.fn().mockResolvedValue(undefined),
		getStoredModelConfigs: vi.fn().mockResolvedValue({}),
		saveModelConfig: vi.fn().mockResolvedValue(undefined),
		removeModelConfig: vi.fn().mockResolvedValue(undefined),
	};
}

function createConfigurationService() {
	return {
		getConfig: vi.fn().mockReturnValue({}),
		setConfig: vi.fn().mockResolvedValue(undefined),
		isConfigured: vi.fn().mockReturnValue(false),
	};
}

function createExtensionContext() {
	return {
		globalState: {
			get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
			update: vi.fn().mockResolvedValue(undefined),
		},
		secrets: {
			get: vi.fn().mockResolvedValue(undefined),
			store: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
		},
	};
}

function createFetcherService() {
	return {
		fetch: vi.fn().mockRejectedValue(new Error('Model discovery should not run for configured CustomOAI models')),
	};
}

function createLogService() {
	const logService = {
		trace: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		show: vi.fn(),
		createSubLogger: vi.fn(),
		withExtraTarget: vi.fn(),
	};
	logService.createSubLogger.mockReturnValue(logService);
	logService.withExtraTarget.mockReturnValue(logService);
	return logService;
}
