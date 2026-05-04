/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const MAX_PROMPT_PREFIX_CHARS = 8_000;
const MAX_PROMPT_SUFFIX_CHARS = 4_000;
const MAX_COMPLETION_CHARS = 4_000;
const MAX_COMPLETION_LINES = 20;

export interface AsterInlineCompletionPromptContext {
	readonly languageId: string;
	readonly fileName: string;
	readonly prefix: string;
	readonly suffix: string;
}

export function buildAsterInlineCompletionPrompt(context: AsterInlineCompletionPromptContext): string {
	const prefix = tail(context.prefix, MAX_PROMPT_PREFIX_CHARS);
	const suffix = head(context.suffix, MAX_PROMPT_SUFFIX_CHARS);

	return [
		'You are Aster inline completions, a code completion engine.',
		'Complete the code at <cursor>.',
		'Return only the exact text to insert at <cursor>.',
		'Do not use markdown fences, explanations, labels, or surrounding quotes.',
		'Do not repeat text that already appears before or after <cursor>.',
		'Prefer a short completion, usually one line or a small block.',
		`File: ${context.fileName}`,
		`Language: ${context.languageId}`,
		'<code>',
		`${prefix}<cursor>${suffix}`,
		'</code>',
	].join('\n');
}

export function sanitizeAsterInlineCompletion(rawCompletion: string): string | undefined {
	let completion = rawCompletion.replace(/\r\n/g, '\n');
	completion = stripMarkdownFence(completion);
	completion = completion.replace(/^\s*<cursor>\s*/i, '');
	completion = completion.replace(/^\n+/, '').replace(/\s+$/, '');

	if (!completion.trim()) {
		return undefined;
	}

	const lines = completion.split('\n').slice(0, MAX_COMPLETION_LINES);
	completion = lines.join('\n');

	if (completion.length > MAX_COMPLETION_CHARS) {
		completion = completion.slice(0, MAX_COMPLETION_CHARS);
	}

	return completion || undefined;
}

export function isAsterInlineCompletionEnabledForLanguage(enabledLanguages: Readonly<Record<string, boolean>>, languageId: string): boolean {
	return enabledLanguages[languageId] ?? enabledLanguages['*'] ?? false;
}

function stripMarkdownFence(value: string): string {
	const trimmed = value.trim();
	const match = trimmed.match(/^```[a-zA-Z0-9_.+-]*\n([\s\S]*?)\n?```$/);
	return match ? match[1] : value;
}

function tail(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}
	return value.slice(value.length - maxLength);
}

function head(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}
	return value.slice(0, maxLength);
}
