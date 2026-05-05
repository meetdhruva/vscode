/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { ConfigKey } from '../../../../platform/configuration/common/configurationService';
import { getAsterInlineCompletionsEnabled, getAsterInlineCompletionsModelId, getAsterInlineCompletionsVendor, isAsterInlineCompletionsConfigurationChange } from '../asterInlineCompletionConfiguration';
import { selectAsterInlineCompletionModel } from '../asterInlineCompletionModelSelection';
import { buildAsterInlineCompletionPrompt, isAsterInlineCompletionEnabledForLanguage, sanitizeAsterInlineCompletion } from '../asterInlineCompletionPrompt';

describe('Aster inline completion prompt helpers', () => {
	it('builds a cursor prompt without provider-specific auth assumptions', () => {
		const prompt = buildAsterInlineCompletionPrompt({
			fileName: '/workspace/src/index.ts',
			languageId: 'typescript',
			prefix: 'function greet(name: string) {\n\treturn ',
			suffix: '\n}\n',
		});

		expect(prompt).toContain('Complete the code at <cursor>.');
		expect(prompt).toContain('Language: typescript');
		expect(prompt).toContain('return <cursor>');
		expect(prompt).not.toContain('Copilot');
	});

	it('strips markdown fences and cursor echoes from model output', () => {
		const completion = sanitizeAsterInlineCompletion('```ts\n<cursor>name.toUpperCase();\n```');
		expect(completion).toBe('name.toUpperCase();');
	});

	it('keeps completions disabled for languages explicitly opted out', () => {
		expect(isAsterInlineCompletionEnabledForLanguage({ '*': true, markdown: false }, 'markdown')).toBe(false);
		expect(isAsterInlineCompletionEnabledForLanguage({ '*': true, markdown: false }, 'typescript')).toBe(true);
		expect(isAsterInlineCompletionEnabledForLanguage({}, 'typescript')).toBe(false);
	});

	it('selects configured BYOK vendors without falling back to Copilot', async () => {
		const calls: unknown[] = [];
		const model = await selectAsterInlineCompletionModel(async selector => {
			calls.push(selector);
			return [{ vendor: 'openai', id: 'gpt-test' }];
		}, 'OpenAI', 'gpt-test');

		expect(calls).toEqual([{ vendor: 'openai', id: 'gpt-test' }]);
		expect(model?.id).toBe('gpt-test');
	});

	it('selects the first BYOK model and skips Copilot when no vendor is configured', async () => {
		const model = await selectAsterInlineCompletionModel(async selector => {
			expect(selector).toBeUndefined();
			return [
				{ vendor: 'copilot', id: 'hosted' },
				{ vendor: 'customoai', id: 'local-model' },
			];
		}, '', '');

		expect(model).toEqual({ vendor: 'customoai', id: 'local-model' });
	});

	it('prefers Aster inline completion setting aliases over compatibility keys', () => {
		const configurationService = createConfigurationService({
			'aster.ai.inlineCompletions.enabled': true,
			'aster.ai.inlineCompletions.vendor': 'customoai',
			'aster.ai.inlineCompletions.modelId': 'local-model',
		});

		expect(getAsterInlineCompletionsEnabled(configurationService)).toBe(true);
		expect(getAsterInlineCompletionsVendor(configurationService)).toBe('customoai');
		expect(getAsterInlineCompletionsModelId(configurationService)).toBe('local-model');
	});

	it('falls back to compatibility inline completion settings when aliases are unset', () => {
		const configurationService = createConfigurationService({});

		expect(getAsterInlineCompletionsEnabled(configurationService)).toBe(false);
		expect(getAsterInlineCompletionsVendor(configurationService)).toBe('openai');
		expect(getAsterInlineCompletionsModelId(configurationService)).toBe('gpt-test');
	});

	it('ignores contributed alias defaults when aliases are not explicitly configured', () => {
		const configurationService = createConfigurationService({}, {
			'aster.ai.inlineCompletions.enabled': false,
			'aster.ai.inlineCompletions.vendor': '',
			'aster.ai.inlineCompletions.modelId': '',
		}, {
			enabled: true,
			vendor: 'openrouter',
			modelId: 'openrouter-model',
		});

		expect(getAsterInlineCompletionsEnabled(configurationService)).toBe(true);
		expect(getAsterInlineCompletionsVendor(configurationService)).toBe('openrouter');
		expect(getAsterInlineCompletionsModelId(configurationService)).toBe('openrouter-model');
	});

	it('detects both Aster alias and compatibility setting changes', () => {
		expect(isAsterInlineCompletionsConfigurationChange(createConfigurationChangeEvent('aster.ai.inlineCompletions.enabled'))).toBe(true);
		expect(isAsterInlineCompletionsConfigurationChange(createConfigurationChangeEvent('github.copilot.aster.inlineCompletions.enabled'))).toBe(true);
		expect(isAsterInlineCompletionsConfigurationChange(createConfigurationChangeEvent('github.copilot.enable'))).toBe(false);
	});
});

function createConfigurationService(
	nonExtensionConfig: Record<string, unknown>,
	nonExtensionDefaults: Record<string, unknown> = {},
	legacyConfig = { enabled: false, vendor: 'openai', modelId: 'gpt-test' },
) {
	return {
		getNonExtensionConfig: <T>(key: string): T | undefined => nonExtensionConfig[key] as T | undefined,
		inspectNonExtensionConfig: <T>(key: string) => ({
			defaultValue: nonExtensionDefaults[key] as T | undefined,
			...(Object.hasOwn(nonExtensionConfig, key) ? { globalValue: nonExtensionConfig[key] as T } : {}),
		}),
		getConfig: <T>(key: { fullyQualifiedId: string }): T => {
			if (key === ConfigKey.AsterInlineCompletionsEnabled) {
				return legacyConfig.enabled as T;
			}
			if (key === ConfigKey.AsterInlineCompletionsVendor) {
				return legacyConfig.vendor as T;
			}
			if (key === ConfigKey.AsterInlineCompletionsModelId) {
				return legacyConfig.modelId as T;
			}
			throw new Error(`Unexpected config key: ${key.fullyQualifiedId}`);
		},
	} as any;
}

function createConfigurationChangeEvent(changedKey: string) {
	return {
		affectsConfiguration: (section: string) => changedKey === section || changedKey.startsWith(`${section}.`),
	} as any;
}
