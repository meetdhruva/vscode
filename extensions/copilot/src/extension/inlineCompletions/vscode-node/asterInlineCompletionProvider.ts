/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ConfigKey, IConfigurationService } from '../../../platform/configuration/common/configurationService';
import { ILogService } from '../../../platform/log/common/logService';
import { isNotebookCellOrNotebookChatInput } from '../../../util/common/notebooks';
import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { autorun } from '../../../util/vs/base/common/observableInternal';
import { LanguageModelChatMessage } from '../../../vscodeTypes';
import { IExtensionContribution } from '../../common/contributions';
import { selectAsterInlineCompletionModel } from './asterInlineCompletionModelSelection';
import { buildAsterInlineCompletionPrompt, isAsterInlineCompletionEnabledForLanguage, sanitizeAsterInlineCompletion } from './asterInlineCompletionPrompt';

const ASTER_INLINE_COMPLETIONS_GROUP_ID = 'aster-inline-completions';
const MAX_RESPONSE_CHARS = 8_000;

export class AsterInlineCompletionsContribution extends Disposable implements IExtensionContribution {
	public readonly id = 'aster-inline-completions';

	constructor(
		@IConfigurationService configurationService: IConfigurationService,
		@ILogService logService: ILogService,
	) {
		super();

		this._register(autorun(reader => {
			const enabled = configurationService.getConfigObservable(ConfigKey.AsterInlineCompletionsEnabled).read(reader);
			if (!enabled) {
				return;
			}

			const provider = new AsterInlineCompletionProvider(configurationService, logService);
			reader.store.add(provider);
			reader.store.add(vscode.languages.registerInlineCompletionItemProvider(
				'*',
				provider,
				{
					displayName: 'Aster BYOK Completions',
					debounceDelayMs: 0,
					yieldTo: ['nes'],
					excludes: ['github.copilot', 'completions'],
					groupId: ASTER_INLINE_COMPLETIONS_GROUP_ID,
				}
			));
		}));
	}
}

export class AsterInlineCompletionProvider extends Disposable implements vscode.InlineCompletionItemProvider {

	constructor(
		private readonly _configurationService: IConfigurationService,
		private readonly _logService: ILogService,
	) {
		super();
	}

	async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionItem[]> {
		if (!this._shouldProvide(document, context)) {
			return [];
		}

		const model = await this._selectModel();
		if (!model || token.isCancellationRequested) {
			return [];
		}

		const prompt = buildAsterInlineCompletionPrompt({
			languageId: document.languageId,
			fileName: document.fileName,
			...getPromptWindow(document, position),
		});

		try {
			const response = await model.sendRequest(
				[LanguageModelChatMessage.User(prompt)],
				{
					justification: 'Aster uses your configured BYOK language model to suggest inline code completions.',
					modelOptions: {
						temperature: 0.1,
						max_tokens: 96,
						stop: ['</code>'],
					}
				},
				token
			);

			let rawCompletion = '';
			for await (const part of response.text) {
				rawCompletion += part;
				if (token.isCancellationRequested || rawCompletion.length >= MAX_RESPONSE_CHARS) {
					break;
				}
			}

			if (token.isCancellationRequested) {
				return [];
			}

			const completion = sanitizeAsterInlineCompletion(rawCompletion);
			if (!completion) {
				return [];
			}

			return [new vscode.InlineCompletionItem(completion, new vscode.Range(position, position))];
		} catch (error) {
			this._logService.trace(`Aster inline completions request failed: ${String(error)}`);
			return [];
		}
	}

	private _shouldProvide(document: vscode.TextDocument, context: vscode.InlineCompletionContext): boolean {
		if (context.selectedCompletionInfo) {
			return false;
		}

		if (!['file', 'untitled'].includes(document.uri.scheme) && !isNotebookCellOrNotebookChatInput(document.uri)) {
			return false;
		}

		if (!isAsterInlineCompletionEnabledForLanguage(this._configurationService.getConfig(ConfigKey.Enable), document.languageId)) {
			return false;
		}

		return this._configurationService.getConfig(ConfigKey.AsterInlineCompletionsEnabled);
	}

	private async _selectModel(): Promise<vscode.LanguageModelChat | undefined> {
		return selectAsterInlineCompletionModel(
			selector => vscode.lm.selectChatModels(selector),
			this._configurationService.getConfig(ConfigKey.AsterInlineCompletionsVendor),
			this._configurationService.getConfig(ConfigKey.AsterInlineCompletionsModelId),
		);
	}
}

function getPromptWindow(document: vscode.TextDocument, position: vscode.Position): { prefix: string; suffix: string } {
	const prefixStartLine = Math.max(0, position.line - 80);
	const suffixEndLine = Math.min(document.lineCount - 1, position.line + 40);
	const suffixEndPosition = new vscode.Position(suffixEndLine, document.lineAt(suffixEndLine).text.length);

	return {
		prefix: document.getText(new vscode.Range(new vscode.Position(prefixStartLine, 0), position)),
		suffix: document.getText(new vscode.Range(position, suffixEndPosition)),
	};
}
