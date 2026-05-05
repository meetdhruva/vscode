/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { IAuthenticationService } from '../../../../platform/authentication/common/authentication';
import { StaticGitHubAuthenticationService } from '../../../../platform/authentication/common/staticGitHubAuthenticationService';
import { IEndpointProvider } from '../../../../platform/endpoint/common/endpointProvider';
import { Diff } from '../../../../platform/git/common/gitDiffService';
import { ITestingServicesAccessor } from '../../../../platform/test/node/services';
import { SyncDescriptor } from '../../../../util/vs/platform/instantiation/common/descriptors';
import { IInstantiationService } from '../../../../util/vs/platform/instantiation/common/instantiation';
import { createExtensionTestingServices } from '../../../test/vscode-node/services';
import { GitCommitMessageGenerator } from '../gitCommitMessageGenerator';

suite('GitCommitMessageGenerator', function () {
	let accessor: ITestingServicesAccessor;
	let sandbox: sinon.SinonSandbox;

	setup(() => {
		sandbox = sinon.createSandbox();
		const testingServiceCollection = createExtensionTestingServices();
		testingServiceCollection.define(IAuthenticationService, new SyncDescriptor(StaticGitHubAuthenticationService, [() => undefined]));
		testingServiceCollection.define(IEndpointProvider, {
			_serviceBrand: undefined,
			getChatEndpoint: async () => {
				throw new Error('Copilot endpoint should not be used when an Aster BYOK model is available');
			}
		} as unknown as IEndpointProvider);
		accessor = testingServiceCollection.createTestingAccessor();
	});

	teardown(() => {
		sandbox.restore();
	});

	test('generates commit messages with a configured Aster BYOK model without a Copilot endpoint', async function () {
		const request = sandbox.stub().resolves({
			text: streamText(['```text\nfeat: add BYOK chat activation\n```']),
			stream: streamText([]),
		});
		sandbox.stub(vscode.lm, 'selectChatModels').callsFake(async selector => {
			if (selector?.vendor !== 'customoai') {
				return [];
			}

			return [{
				id: 'local-model',
				name: 'Local Model',
				vendor: 'customoai',
				family: 'local-model',
				version: '1.0.0',
				maxInputTokens: 128000,
				capabilities: {
					supportsToolCalling: true,
					supportsImageToText: false,
				},
				sendRequest: request,
				countTokens: async () => 0,
			} satisfies vscode.LanguageModelChat];
		});

		const generator = accessor.get(IInstantiationService).createInstance(GitCommitMessageGenerator);
		const tokenSource = new vscode.CancellationTokenSource();
		try {
			const commitMessage = await generator.generateGitCommitMessage(
				'vscode',
				'main',
				[{
					uri: vscode.Uri.file('/workspace/vscode/src/example.ts'),
					diff: 'diff --git a/src/example.ts b/src/example.ts\n+export const byok = true;\n',
				} as Diff],
				{ repository: ['chore: update docs'], user: ['feat: add provider'] },
				0,
				tokenSource.token,
			);

			assert.strictEqual(commitMessage, 'feat: add BYOK chat activation');
			assert.strictEqual(request.callCount, 1);
			const [messages, options] = request.firstCall.args;
			assert.ok(JSON.stringify(messages).includes('Code changes'));
			assert.strictEqual(options.justification, 'Aster uses your configured BYOK language model to generate a git commit message.');
			assert.strictEqual(options.modelOptions.max_tokens, 180);
		} finally {
			tokenSource.dispose();
		}
	});
});

async function* streamText(parts: string[]): AsyncIterable<string> {
	for (const part of parts) {
		yield part;
	}
}
