/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
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
});
