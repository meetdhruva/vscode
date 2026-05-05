/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export const asterBYOKLanguageModelVendors = [
	'customoai',
	'openai',
	'openrouter',
	'ollama',
	'anthropic',
	'gemini',
	'xai',
	'azure',
] as const;

const asterBYOKLanguageModelVendorSet = new Set<string>(asterBYOKLanguageModelVendors);

export function isAsterBYOKLanguageModelVendor(vendor: string | undefined): boolean {
	return typeof vendor === 'string' && asterBYOKLanguageModelVendorSet.has(vendor.toLowerCase());
}

export async function selectAsterBYOKChatModel(): Promise<vscode.LanguageModelChat | undefined> {
	for (const vendor of asterBYOKLanguageModelVendors) {
		let models: readonly vscode.LanguageModelChat[];
		try {
			models = await vscode.lm.selectChatModels({ vendor });
		} catch {
			continue;
		}

		const model = models.find(model => isAsterBYOKLanguageModelVendor(model.vendor));
		if (model) {
			return model;
		}
	}

	return undefined;
}

export async function hasAsterBYOKChatModel(): Promise<boolean> {
	return !!await selectAsterBYOKChatModel();
}
