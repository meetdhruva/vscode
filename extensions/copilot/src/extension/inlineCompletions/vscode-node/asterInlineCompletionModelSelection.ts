/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const ASTER_INLINE_COMPLETION_BYOK_VENDORS = new Set([
	'anthropic',
	'azure',
	'customoai',
	'gemini',
	'ollama',
	'openai',
	'openrouter',
	'xai',
]);

export interface AsterLanguageModelChatSelector {
	readonly vendor?: string;
	readonly family?: string;
	readonly version?: string;
	readonly id?: string;
}

export interface AsterLanguageModelChat {
	readonly vendor: string;
	readonly id: string;
}

export type SelectAsterChatModels<T extends AsterLanguageModelChat> = (selector?: AsterLanguageModelChatSelector) => Thenable<T[]> | Promise<T[]>;

export async function selectAsterInlineCompletionModel<T extends AsterLanguageModelChat>(
	selectChatModels: SelectAsterChatModels<T>,
	vendor: string,
	modelId: string,
): Promise<T | undefined> {
	const normalizedVendor = vendor.trim().toLowerCase();
	const normalizedModelId = modelId.trim();

	if (normalizedVendor) {
		return (await selectChatModels({
			vendor: normalizedVendor,
			...(normalizedModelId ? { id: normalizedModelId } : {}),
		}))[0];
	}

	const models = await selectChatModels();
	return models.find(model =>
		ASTER_INLINE_COMPLETION_BYOK_VENDORS.has(model.vendor.toLowerCase())
		&& (!normalizedModelId || model.id === normalizedModelId)
	);
}
