/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { hasAsterBYOKChatModel, selectAsterBYOKChatModel } from '../byokLanguageModels';

suite('Aster BYOK language models', function () {
	let sandbox: sinon.SinonSandbox;

	setup(() => {
		sandbox = sinon.createSandbox();
	});

	teardown(() => {
		sandbox.restore();
	});

	test('selects an allowed BYOK language model and ignores unavailable vendors', async function () {
		const model = createLanguageModel('openai');
		const selectChatModels = sandbox.stub(vscode.lm, 'selectChatModels');
		selectChatModels.callsFake(async selector => {
			if (selector?.vendor === 'customoai') {
				throw new Error('provider unavailable');
			}
			if (selector?.vendor === 'openai') {
				return [model];
			}
			return [];
		});

		assert.strictEqual(await selectAsterBYOKChatModel(), model);
		assert.strictEqual(await hasAsterBYOKChatModel(), true);
		assert.ok(selectChatModels.calledWithMatch({ vendor: 'customoai' }));
		assert.ok(selectChatModels.calledWithMatch({ vendor: 'openai' }));
	});

	test('does not treat Copilot language models as Aster BYOK models', async function () {
		const selectChatModels = sandbox.stub(vscode.lm, 'selectChatModels').resolves([createLanguageModel('copilot')]);

		assert.strictEqual(await selectAsterBYOKChatModel(), undefined);
		assert.strictEqual(await hasAsterBYOKChatModel(), false);
		assert.ok(selectChatModels.called);
	});
});

function createLanguageModel(vendor: string): vscode.LanguageModelChat {
	return {
		id: `${vendor}-model`,
		name: `${vendor} model`,
		vendor,
		family: `${vendor}-family`,
		version: '1.0.0',
		maxInputTokens: 128000,
		capabilities: {
			supportsToolCalling: true,
			supportsImageToText: false,
		},
		sendRequest: async () => { throw new Error('not implemented'); },
		countTokens: async () => 0,
	};
}
