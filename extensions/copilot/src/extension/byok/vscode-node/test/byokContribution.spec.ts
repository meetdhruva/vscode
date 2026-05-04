/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from 'vitest';

const vscodeMock = vi.hoisted(() => ({
	registerLanguageModelChatProvider: vi.fn(() => ({ dispose: vi.fn() })),
	executeCommand: vi.fn(),
}));

vi.mock('vscode', () => ({
	lm: {
		registerLanguageModelChatProvider: vscodeMock.registerLanguageModelChatProvider,
	},
}));

vi.mock('../anthropicProvider', () => ({ AnthropicLMProvider: class { static readonly providerName = 'Anthropic'; } }));
vi.mock('../azureProvider', () => ({ AzureBYOKModelProvider: class { static readonly providerName = 'Azure'; } }));
vi.mock('../customOAIProvider', () => ({ CustomOAIBYOKModelProvider: class { static readonly providerName = 'CustomOAI'; } }));
vi.mock('../geminiNativeProvider', () => ({ GeminiNativeBYOKLMProvider: class { static readonly providerName = 'Gemini'; } }));
vi.mock('../ollamaProvider', () => ({ OllamaLMProvider: class { static readonly providerName = 'Ollama'; } }));
vi.mock('../openAIProvider', () => ({ OAIBYOKLMProvider: class { static readonly providerName = 'OpenAI'; } }));
vi.mock('../openRouterProvider', () => ({ OpenRouterLMProvider: class { static readonly providerName = 'OpenRouter'; } }));
vi.mock('../xAIProvider', () => ({ XAIBYOKLMProvider: class { static readonly providerName = 'xAI'; } }));

import { BYOKContrib } from '../byokContribution';

describe('BYOKContrib', () => {
	it('registers BYOK language model providers without Copilot auth when known-model fetch fails', async () => {
		const fetcherService = {
			fetch: vi.fn().mockRejectedValue(new Error('offline')),
		};
		const logService = createMockLogService();
		const extensionContext = createMockExtensionContext();
		const instantiationService = {
			createInstance: vi.fn((ctor: { providerName?: string; name: string }) => ({
				id: ctor.providerName ?? ctor.name,
			})),
		};

		const contribution = new BYOKContrib(
			fetcherService as any,
			logService as any,
			extensionContext as any,
			instantiationService as any,
		);

		await vi.waitFor(() => {
			expect(vscodeMock.registerLanguageModelChatProvider).toHaveBeenCalledTimes(8);
		});

		expect(fetcherService.fetch).toHaveBeenCalledWith(
			'https://main.vscode-cdn.net/extensions/copilotChat.json',
			{ method: 'GET', callSite: 'byok-known-models' }
		);
		expect(logService.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch known models list'));
		const registeredProviderNames = (vscodeMock.registerLanguageModelChatProvider.mock.calls as unknown as Array<[string, unknown]>).map(call => call[0]);
		expect(registeredProviderNames).toEqual([
			'ollama',
			'anthropic',
			'gemini',
			'xai',
			'openai',
			'openrouter',
			'azure',
			'customoai',
		]);

		contribution.dispose();
	});
});

function createMockLogService() {
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

function createMockExtensionContext() {
	const state = new Map<string, unknown>();
	const secrets = new Map<string, string>();
	return {
		globalState: {
			get: vi.fn((key: string, defaultValue?: unknown) => state.get(key) ?? defaultValue),
			update: vi.fn(async (key: string, value: unknown) => {
				if (value === undefined) {
					state.delete(key);
				} else {
					state.set(key, value);
				}
			}),
		},
		secrets: {
			get: vi.fn(async (key: string) => secrets.get(key)),
			store: vi.fn(async (key: string, value: string) => {
				secrets.set(key, value);
			}),
			delete: vi.fn(async (key: string) => {
				secrets.delete(key);
			}),
		},
	};
}
