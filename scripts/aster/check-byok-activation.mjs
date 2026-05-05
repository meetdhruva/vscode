/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const failures = [];

const packageJson = readJson('extensions/copilot/package.json');
const contextKeysContribution = readText('extensions/copilot/src/extension/contextKeys/vscode-node/contextKeys.contribution.ts');
const conversationFeature = readText('extensions/copilot/src/extension/conversation/vscode-node/conversationFeature.ts');
const gitCommitMessageGenerator = readText('extensions/copilot/src/extension/prompt/node/gitCommitMessageGenerator.ts');
const chatManagementContribution = readText('src/vs/workbench/contrib/chat/browser/chatManagement/chatManagement.contribution.ts');
const chatModelsWidget = readText('src/vs/workbench/contrib/chat/browser/chatManagement/chatModelsWidget.ts');

checkConversationActivation();
checkContextKeys();
checkPackageJsonMenus();
checkBYOKFeatureImplementations();
checkModelManagement();

if (failures.length) {
	console.error('Aster BYOK activation check failed:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log('Aster BYOK activation check passed');

function readJson(relativePath) {
	return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function readText(relativePath) {
	return readFileSync(join(root, relativePath), 'utf8');
}

function fail(message) {
	failures.push(message);
}

function checkConversationActivation() {
	if (!conversationFeature.includes('hasAsterBYOKChatModel')) {
		fail('ConversationFeature must import/use hasAsterBYOKChatModel');
	}
	if (!conversationFeature.includes('vscode.lm.onDidChangeChatModels')) {
		fail('ConversationFeature must listen for BYOK model changes');
	}
	if (!conversationFeature.includes('const chatEnabled = hasCopilotToken || hasBYOKModel;')) {
		fail('ConversationFeature enablement must allow either a Copilot token or a BYOK model');
	}
	if (!conversationFeature.includes('!this.authenticationService.copilotToken || this.authenticationService.copilotToken.isNoAuthUser')) {
		fail('ConversationFeature must not register Copilot-authenticated semantic search without a Copilot token');
	}
}

function checkContextKeys() {
	for (const key of ['aster.ai.byok.providersAvailable', 'aster.ai.byok.configured']) {
		if (!contextKeysContribution.includes(key)) {
			fail(`ContextKeysContribution must set ${key}`);
		}
	}
	if (!contextKeysContribution.includes('lm.onDidChangeChatModels')) {
		fail('ContextKeysContribution must update BYOK contexts when language models change');
	}
	if (!contextKeysContribution.includes('const hasBYOKModel = await hasAsterBYOKChatModel();')) {
		fail('ContextKeysContribution must consider configured BYOK models before reporting Aster chat activation failure');
	}
}

function checkPackageJsonMenus() {
	const byokReadyExpression = '(chatSetupCompleted || aster.ai-chat.activated)';
	const requiredMenuEntries = [
		['editor/context', 'github.copilot.chat.fix'],
		['editor/context', 'github.copilot.chat.explain'],
		['editor/context', 'github.copilot.chat.review'],
		['scm/inputBox', 'github.copilot.git.generateCommitMessage'],
		['scm/resourceState/context', 'github.copilot.git.resolveMergeConflicts'],
		['editor/content', 'github.copilot.git.resolveMergeConflicts'],
	];

	for (const [menu, command] of requiredMenuEntries) {
		const entry = findMenuEntry(menu, command);
		if (!entry) {
			fail(`extensions/copilot/package.json: missing ${command} in ${menu}`);
			continue;
		}
		if (!entry.when?.includes(byokReadyExpression)) {
			fail(`extensions/copilot/package.json: ${command} in ${menu} must allow ${byokReadyExpression}`);
		}
	}

	for (const command of [
		'github.copilot.chat.completions.disable',
		'github.copilot.chat.completions.enable',
		'github.copilot.chat.completions.toggle',
	]) {
		const contribution = packageJson.contributes.commands.find(entry => entry.command === command);
		if (!contribution?.enablement?.includes('github.copilot.activated')) {
			fail(`extensions/copilot/package.json: hosted completion command ${command} must stay gated on github.copilot.activated`);
		}
	}
}

function checkBYOKFeatureImplementations() {
	if (!gitCommitMessageGenerator.includes('selectAsterBYOKChatModel')) {
		fail('GitCommitMessageGenerator must select an Aster BYOK model before falling back to Copilot endpoints');
	}
	if (!gitCommitMessageGenerator.includes('model.sendRequest')) {
		fail('GitCommitMessageGenerator must generate commit messages through the selected BYOK language model');
	}
	if (!gitCommitMessageGenerator.includes('getChatEndpoint(\'copilot-fast\')')) {
		fail('GitCommitMessageGenerator must retain the Copilot endpoint fallback for Copilot-authenticated users');
	}
}

function findMenuEntry(menu, command) {
	return packageJson.contributes.menus?.[menu]?.find(entry => entry.command === command);
}

function checkModelManagement() {
	if (!chatManagementContribution.includes('ContextKeyExpr.has(\'aster.ai.byok.providersAvailable\')')) {
		fail('chatManagement.contribution.ts must allow Aster BYOK providers to open model management without Copilot entitlement');
	}
	if (!chatModelsWidget.includes('\'aster.ai.byok.providersAvailable\'')) {
		fail('chatModelsWidget.ts must enable Add Models when Aster BYOK providers are available');
	}
}
