/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockedExtensionService, IBlockedExtensionService } from '../../../../platform/chat/common/blockedExtensionService';
import { DisposableStore } from '../../../../util/vs/base/common/lifecycle';
import { SyncDescriptor } from '../../../../util/vs/platform/instantiation/common/descriptors';
import { createExtensionUnitTestingServices } from '../../../test/node/services';
import { assertAzureAuthenticationConfigured, AzureBYOKModelProvider, azureMicrosoftAuthentication, isAzureMicrosoftAuthenticationEnabled, resolveAzureUrl } from '../azureProvider';

describe('AzureBYOKModelProvider', () => {
	const disposables = new DisposableStore();

	beforeEach(() => {
		const testingServiceCollection = createExtensionUnitTestingServices();

		// Add IBlockedExtensionService which is required by CopilotLanguageModelWrapper
		testingServiceCollection.define(IBlockedExtensionService, new SyncDescriptor(BlockedExtensionService));
	});

	afterEach(() => {
		disposables.clear();
		vi.restoreAllMocks();
	});

	describe('resolveAzureUrl', () => {
		it('should handle Azure AI Foundry (models.ai.azure.com) URLs', () => {
			const url = 'https://my-endpoint.models.ai.azure.com';
			const result = resolveAzureUrl('gpt-4', url);
			expect(result).toBe('https://my-endpoint.models.ai.azure.com/v1/chat/completions');
		});

		it('should handle Azure ML (inference.ml.azure.com) URLs', () => {
			const url = 'https://my-endpoint.inference.ml.azure.com';
			const result = resolveAzureUrl('gpt-4', url);
			expect(result).toBe('https://my-endpoint.inference.ml.azure.com/v1/chat/completions');
		});

		it('should handle Azure OpenAI (openai.azure.com) URLs with deployment name', () => {
			const url = 'https://my-resource.openai.azure.com';
			const result = resolveAzureUrl('gpt-4-deployment', url);
			expect(result).toBe('https://my-resource.openai.azure.com/openai/deployments/gpt-4-deployment/chat/completions?api-version=2025-01-01-preview');
		});

		it('should return URL unchanged if it already has explicit API path', () => {
			const url = 'https://my-endpoint.example.com/v1/chat/completions';
			const result = resolveAzureUrl('gpt-4', url);
			expect(result).toBe(url);
		});

		it('should remove trailing slash before processing', () => {
			const url = 'https://my-endpoint.models.ai.azure.com/';
			const result = resolveAzureUrl('gpt-4', url);
			expect(result).toBe('https://my-endpoint.models.ai.azure.com/v1/chat/completions');
		});

		it('should remove /v1 suffix before processing', () => {
			const url = 'https://my-endpoint.models.ai.azure.com/v1';
			const result = resolveAzureUrl('gpt-4', url);
			expect(result).toBe('https://my-endpoint.models.ai.azure.com/v1/chat/completions');
		});

		it('should throw error for unrecognized Azure URL', () => {
			const url = 'https://unknown.example.com';
			expect(() => resolveAzureUrl('gpt-4', url)).toThrow('Unrecognized Azure deployment URL');
		});
	});

	describe('authentication mode', () => {
		it('keeps Microsoft authentication disabled unless explicitly enabled', () => {
			expect(isAzureMicrosoftAuthenticationEnabled(undefined)).toBe(false);
			expect(isAzureMicrosoftAuthenticationEnabled({ useMicrosoftAuthentication: false })).toBe(false);
			expect(isAzureMicrosoftAuthenticationEnabled({})).toBe(false);
			expect(isAzureMicrosoftAuthenticationEnabled({ useMicrosoftAuthentication: true })).toBe(true);
		});

		it('fails closed when neither API key nor explicit Microsoft authentication is configured', () => {
			expect(() => assertAzureAuthenticationConfigured(undefined)).toThrow('Azure BYOK requires an API key by default');
			expect(() => assertAzureAuthenticationConfigured({})).toThrow('Azure BYOK requires an API key by default');
		});

		it('allows requests with an API key or explicit Microsoft authentication opt-in', () => {
			expect(() => assertAzureAuthenticationConfigured({ apiKey: 'azure-key' })).not.toThrow();
			expect(() => assertAzureAuthenticationConfigured({ useMicrosoftAuthentication: true })).not.toThrow();
		});

		it('does not request Microsoft authentication when API key and explicit opt-in are missing', async () => {
			const getSession = vi.spyOn(azureMicrosoftAuthentication, 'getSession');

			await expect(AzureBYOKModelProvider.prototype.provideLanguageModelChatResponse.call(
				{},
				createAzureModel({}),
				[],
				{} as any,
				{ report: vi.fn() } as any,
				{} as any,
			)).rejects.toThrow('Azure BYOK requires an API key by default');

			expect(getSession).not.toHaveBeenCalled();
		});
	});

});

function createAzureModel(configuration: Record<string, unknown>) {
	return {
		id: 'gpt-4-deployment',
		name: 'Azure GPT-4',
		vendor: 'Azure',
		family: 'gpt-4',
		version: '1',
		maxInputTokens: 128000,
		maxOutputTokens: 16000,
		url: 'https://my-resource.openai.azure.com',
		configuration,
		capabilities: {},
	};
}
