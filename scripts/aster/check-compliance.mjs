/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const failures = [];

const asterRepo = 'https://github.com/meetdhruva/vscode';
const asterDocs = `${asterRepo}/blob/main/docs/aster-ai-provider-mvp.md`;

const product = readJson('product.json');
const rootPackage = readJson('package.json');
const copilotPackage = readJson('extensions/copilot/package.json');
const copilotNls = readJson('extensions/copilot/package.nls.json');

checkRootPackage();
checkProductIdentity();
checkDefaultChatAgent();
checkExtensionGallery();
checkCopilotManifest();
checkNamespacePolicy();
checkBrandingSurfaces();
checkPromptBrandingSurfaces();
checkDisallowedEndpoints();

if (failures.length) {
	console.error('Aster compliance check failed:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log('Aster compliance check passed');

function readJson(relativePath) {
	return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function readText(relativePath) {
	return readFileSync(join(root, relativePath), 'utf8');
}

function fail(message) {
	failures.push(message);
}

function assertEqual(label, actual, expected) {
	if (actual !== expected) {
		fail(`${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
	}
}

function assertEmptyArray(label, actual) {
	if (!Array.isArray(actual) || actual.length !== 0) {
		fail(`${label}: expected an empty array, found ${JSON.stringify(actual)}`);
	}
}

function assertAbsent(label, object, field) {
	if (Object.hasOwn(object, field)) {
		fail(`${label}.${field}: must be absent from distributable metadata`);
	}
}

function assertPresent(label, object, field) {
	if (!Object.hasOwn(object, field)) {
		fail(`${label}.${field}: must be present`);
	}
}

function checkRootPackage() {
	assertEqual('package.repository.url', rootPackage.repository?.url, `${asterRepo}.git`);
	assertEqual('package.bugs.url', rootPackage.bugs?.url, `${asterRepo}/issues`);
}

function checkProductIdentity() {
	const expectedFields = {
		nameShort: 'Aster',
		nameLong: 'Aster Editor',
		applicationName: 'aster',
		dataFolderName: '.aster',
		sharedDataFolderName: '.aster-shared',
		serverApplicationName: 'aster-server',
		serverDataFolderName: '.aster-server',
		tunnelApplicationName: 'aster-tunnel',
		win32DirName: 'Aster',
		win32NameVersion: 'Aster',
		win32RegValueName: 'Aster',
		win32AppUserModelId: 'MeetDhruva.Aster',
		win32ShellNameShort: '&Aster',
		linuxIconName: 'aster',
		urlProtocol: 'aster',
		licenseUrl: `${asterRepo}/blob/main/LICENSE.txt`,
		serverLicenseUrl: `${asterRepo}/blob/main/LICENSE.txt`,
		reportIssueUrl: `${asterRepo}/issues/new`,
	};

	for (const [field, expected] of Object.entries(expectedFields)) {
		assertEqual(`product.${field}`, product[field], expected);
	}
}

function checkDefaultChatAgent() {
	const agent = product.defaultChatAgent;
	if (!agent || typeof agent !== 'object') {
		fail('product.defaultChatAgent: missing Aster chat agent configuration');
		return;
	}

	const expectedFields = {
		extensionId: 'aster.ai',
		chatExtensionId: 'aster.ai-chat',
		chatExtensionOutputId: 'aster.ai-chat.Aster AI.log',
		chatExtensionOutputExtensionStateCommand: 'aster.ai.debug.extensionState',
		providerExtensionId: '',
		providerUriSetting: 'aster.enterprise.uri',
		entitlementUrl: '',
		entitlementSignupLimitedUrl: '',
		chatQuotaExceededContext: 'aster.ai.chat.quotaExceeded',
		completionsQuotaExceededContext: 'aster.ai.completions.quotaExceeded',
		walkthroughCommand: 'aster.ai.open.walkthrough',
		completionsMenuCommand: 'aster.ai.toggleStatusMenu',
		chatRefreshTokenCommand: 'aster.ai.refreshToken',
		generateCommitMessageCommand: 'aster.ai.git.generateCommitMessage',
		resolveMergeConflictsCommand: 'aster.ai.git.resolveMergeConflicts',
		completionsAdvancedSetting: 'aster.ai.advanced',
		completionsEnablementSetting: 'aster.ai.enable',
		nextEditSuggestionsSetting: 'aster.ai.nextEditSuggestions.enabled',
		tokenEntitlementUrl: '',
		mcpRegistryDataUrl: '',
	};

	for (const [field, expected] of Object.entries(expectedFields)) {
		assertEqual(`product.defaultChatAgent.${field}`, agent[field], expected);
	}

	for (const field of [
		'documentationUrl',
		'termsStatementUrl',
		'privacyStatementUrl',
		'skusDocumentationUrl',
		'publicCodeMatchesUrl',
		'manageSettingsUrl',
		'managePlanUrl',
		'manageOverageUrl',
		'upgradePlanUrl',
		'signUpUrl',
	]) {
		assertEqual(`product.defaultChatAgent.${field}`, agent[field], asterDocs);
	}

	assertEmptyArray('product.defaultChatAgent.providerScopes', agent.providerScopes);
	assertEqual('product.defaultChatAgent.provider.default.id', agent.provider?.default?.id, 'aster');
	assertEqual('product.defaultChatAgent.provider.default.name', agent.provider?.default?.name, 'Aster');
}

function checkExtensionGallery() {
	const expectedGallery = {
		serviceUrl: 'https://open-vsx.org/vscode/gallery',
		itemUrl: 'https://open-vsx.org/vscode/item',
		resourceUrlTemplate: 'https://open-vsx.org/api/{publisher}/{name}/{version}/file/{path}',
		controlUrl: '',
		nlsBaseUrl: '',
	};

	for (const [field, expected] of Object.entries(expectedGallery)) {
		assertEqual(`product.extensionsGallery.${field}`, product.extensionsGallery?.[field], expected);
	}
}

function checkCopilotManifest() {
	const expectedFields = {
		name: 'ai-chat',
		displayName: 'Aster AI',
		description: 'Provider-neutral AI chat and coding features for Aster',
		publisher: 'aster',
		homepage: asterRepo,
		qna: `${asterRepo}/issues`,
	};

	for (const [field, expected] of Object.entries(expectedFields)) {
		assertEqual(`extensions/copilot/package.json.${field}`, copilotPackage[field], expected);
	}

	assertEqual('extensions/copilot/package.json.repository.url', copilotPackage.repository?.url, asterRepo);
	assertEqual('extensions/copilot/package.json.bugs.url', copilotPackage.bugs?.url, `${asterRepo}/issues`);

	for (const field of ['internalAIKey', 'internalLargeStorageAriaKey', 'ariaKey']) {
		assertAbsent('extensions/copilot/package.json', copilotPackage, field);
	}
}

function checkNamespacePolicy() {
	const properties = getConfigurationProperties();
	if (!properties || typeof properties !== 'object') {
		fail('extensions/copilot/package.json.contributes.configuration.properties: missing configuration properties');
		return;
	}

	for (const setting of [
		'aster.ai.inlineCompletions.enabled',
		'aster.ai.inlineCompletions.vendor',
		'aster.ai.inlineCompletions.modelId',
		'github.copilot.aster.inlineCompletions.enabled',
		'github.copilot.aster.inlineCompletions.vendor',
		'github.copilot.aster.inlineCompletions.modelId',
	]) {
		assertPresent('extensions/copilot/package.json.contributes.configuration.properties', properties, setting);
	}

	const namespacePolicy = readText('docs/aster-namespace-policy.md');
	for (const requiredText of [
		'aster.ai.inlineCompletions.*',
		'github.copilot.aster.inlineCompletions.*',
		'compatibility fallback',
	]) {
		if (!namespacePolicy.includes(requiredText)) {
			fail(`docs/aster-namespace-policy.md: missing namespace policy text ${JSON.stringify(requiredText)}`);
		}
	}
}

function getConfigurationProperties() {
	const configuration = copilotPackage.contributes?.configuration;
	if (Array.isArray(configuration)) {
		return Object.assign({}, ...configuration.map(section => section.properties ?? {}));
	}
	return configuration?.properties;
}

function checkBrandingSurfaces() {
	const brandPatterns = [
		{ name: 'GitHub Copilot brand', pattern: /\bGitHub Copilot\b/i },
		{ name: 'Copilot Chat brand', pattern: /\bCopilot Chat\b/i },
		{ name: 'Microsoft product brand', pattern: /\bMicrosoft\b/i },
	];

	const productBrandingSurface = {
		nameShort: product.nameShort,
		nameLong: product.nameLong,
		applicationName: product.applicationName,
		reportIssueUrl: product.reportIssueUrl,
		defaultChatAgent: product.defaultChatAgent,
	};
	const extensionBrandingSurface = {
		name: copilotPackage.name,
		displayName: copilotPackage.displayName,
		description: copilotPackage.description,
		publisher: copilotPackage.publisher,
		homepage: copilotPackage.homepage,
		repository: copilotPackage.repository,
		bugs: copilotPackage.bugs,
		qna: copilotPackage.qna,
	};

	scanJsonStrings('product branding surface', productBrandingSurface, brandPatterns);
	scanJsonStrings('Aster AI extension manifest surface', extensionBrandingSurface, brandPatterns);
	scanJsonStrings('Aster AI localized user-facing strings', copilotNls, brandPatterns);
}

function checkPromptBrandingSurfaces() {
	const promptBrandPatterns = [
		{ name: 'GitHub Copilot prompt identity', pattern: /\bGitHub Copilot\b/i },
		{ name: 'Copilot Chat user-facing brand', pattern: /\bCopilot Chat\b/i },
		{ name: 'Microsoft content policy prompt', pattern: /Microsoft content policies/i },
	];

	for (const file of [
		'extensions/copilot/src/extension/prompts/node/base/copilotIdentity.tsx',
		'extensions/copilot/src/extension/prompts/node/base/safetyRules.tsx',
		'extensions/copilot/src/extension/prompts/node/agent/familyHPrompts.tsx',
		'extensions/copilot/src/extension/prompts/node/agent/minimaxPrompts.tsx',
		'extensions/copilot/src/extension/conversation/vscode-node/chatParticipants.ts',
		'extensions/copilot/src/extension/intents/node/hookResultProcessor.ts',
		'extensions/copilot/src/extension/intents/node/toolCallingLoop.ts',
		'extensions/copilot/src/extension/log/vscode-node/loggingActions.ts',
	]) {
		scanText(file, readText(file), promptBrandPatterns);
	}
}

function checkDisallowedEndpoints() {
	const endpointPatterns = [
		{ name: 'Microsoft runtime asset endpoint', pattern: /vscode-cdn\.net|vscodewalkthroughs|web\.core\.windows\.net/i },
		{ name: 'Visual Studio Marketplace endpoint', pattern: /marketplace\.visualstudio\.com|gallerycdn\.vsassets\.io|vscode-unpkg\.net|az764295\.vo\.msecnd\.net|vscode\.blob\.core\.windows\.net/i },
		{ name: 'GitHub Copilot hosted service endpoint', pattern: /api\.github\.com\/copilot|api\.githubcopilot\.com|copilot-telemetry\.githubusercontent\.com|copilot-proxy\.githubusercontent\.com/i },
		{ name: 'Microsoft telemetry endpoint', pattern: /mobile\.events\.data\.microsoft\.com|dc\.services\.visualstudio\.com|events\.data\.microsoft\.com|default\.exp-tas\.com/i },
	];

	for (const file of [
		'product.json',
		'package.json',
		'extensions/copilot/package.json',
		'extensions/copilot/package.nls.json',
		'extensions/copilot/src/extension/log/vscode-node/loggingActions.ts',
	]) {
		scanText(file, readText(file), endpointPatterns);
	}
}

function scanJsonStrings(label, value, patterns, path = label) {
	if (typeof value === 'string') {
		scanText(path, value, patterns);
		return;
	}

	if (Array.isArray(value)) {
		value.forEach((entry, index) => scanJsonStrings(label, entry, patterns, `${path}[${index}]`));
		return;
	}

	if (value && typeof value === 'object') {
		for (const [key, entry] of Object.entries(value)) {
			scanJsonStrings(label, entry, patterns, `${path}.${key}`);
		}
	}
}

function scanText(label, text, patterns) {
	for (const { name, pattern } of patterns) {
		if (pattern.test(text)) {
			fail(`${label}: contains ${name} (${pattern})`);
		}
	}
}
