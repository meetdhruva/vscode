/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const failures = [];

const product = readJson('product.json');

const approvedMicrosoftAuthoredBuiltInExtensions = [
	// Add entries only after explicit Aster legal/product approval.
	// {
	// 	name: 'ms-vscode.js-debug',
	// 	version: '1.117.0',
	// 	sha256: '...',
	// 	repo: 'https://github.com/microsoft/vscode-js-debug',
	// 	decision: 'ship',
	// 	reason: 'Required JavaScript debugging extension; license and branding reviewed for Aster release.',
	// 	owner: 'release/legal/product',
	// 	reviewedOn: 'YYYY-MM-DD',
	// },
];

checkWebviewAssetHost();
checkWebviewRuntimeFallbacks();
checkBundledExtensionPolicy();
checkReleaseInfrastructurePolicy();

if (failures.length) {
	console.error('Aster release-readiness check failed:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log('Aster release-readiness check passed');

function readJson(relativePath) {
	return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function readText(relativePath) {
	return readFileSync(join(root, relativePath), 'utf8');
}

function fail(message) {
	failures.push(message);
}

function checkWebviewAssetHost() {
	const template = product.webviewContentExternalBaseUrlTemplate;
	if (typeof template !== 'string' || !template) {
		fail('product.webviewContentExternalBaseUrlTemplate: missing HTTPS webview asset host template');
		return;
	}

	if (!template.startsWith('https://')) {
		fail(`product.webviewContentExternalBaseUrlTemplate: expected HTTPS URL, found ${JSON.stringify(template)}`);
	}

	for (const token of ['{{uuid}}', '{{quality}}', '{{commit}}']) {
		if (!template.includes(token)) {
			fail(`product.webviewContentExternalBaseUrlTemplate: missing required token ${token}`);
		}
	}

	const forbiddenPatterns = [
		{ label: 'placeholder .invalid host', pattern: /\.invalid(?:\/|$)/i },
		{ label: 'VS Code CDN host', pattern: /vscode-cdn\.net/i },
		{ label: 'Microsoft-hosted Azure storage', pattern: /web\.core\.windows\.net/i },
		{ label: 'Visual Studio Marketplace asset host', pattern: /gallerycdn\.vsassets\.io|vscode-unpkg\.net/i },
	];

	for (const { label, pattern } of forbiddenPatterns) {
		if (pattern.test(template)) {
			fail(`product.webviewContentExternalBaseUrlTemplate: contains ${label}`);
		}
	}
}

function checkWebviewRuntimeFallbacks() {
	const placeholders = [
		{
			file: 'src/vs/base/common/asterWebviewDefaults.ts',
			label: 'central webview host defaults',
			pattern: /aster-webview\.invalid/i,
		},
		{
			file: 'src/vs/workbench/contrib/webview/common/webview.ts',
			label: 'webview resource host',
			pattern: /aster-webview\.invalid/i,
		},
		{
			file: 'src/vs/workbench/services/environment/browser/environmentService.ts',
			label: 'browser webview asset fallback',
			pattern: /aster-webview\.invalid/i,
		},
		{
			file: 'src/vs/server/node/webClientServer.ts',
			label: 'server webview CSP',
			pattern: /aster-webview\.invalid/i,
		},
	];

	for (const { file, label, pattern } of placeholders) {
		if (pattern.test(readText(file))) {
			fail(`${file}: contains placeholder ${label}`);
		}
	}
}

function checkBundledExtensionPolicy() {
	const bundledExtensions = Array.isArray(product.builtInExtensions) ? product.builtInExtensions : [];
	const pendingPolicyExtensions = bundledExtensions.filter(extension => {
		if (!isMicrosoftAuthoredBuiltInExtension(extension)) {
			return false;
		}
		return !approvedMicrosoftAuthoredBuiltInExtensions.some(approval => isMatchingBuiltInExtensionApproval(extension, approval));
	});

	if (pendingPolicyExtensions.length) {
		fail(`product.builtInExtensions: Microsoft-authored bundled extension policy is unresolved for ${pendingPolicyExtensions.map(extension => extension.name).join(', ')}`);
	}

	for (const approval of approvedMicrosoftAuthoredBuiltInExtensions) {
		if (!bundledExtensions.some(extension => isMatchingBuiltInExtensionApproval(extension, approval))) {
			fail(`product.builtInExtensions: stale Microsoft-authored bundled extension approval for ${approval.name}@${approval.version}:${approval.sha256}`);
		}
	}
}

function isMicrosoftAuthoredBuiltInExtension(extension) {
	const name = typeof extension.name === 'string' ? extension.name : '';
	const repo = typeof extension.repo === 'string' ? extension.repo : '';
	const publisherName = typeof extension.metadata?.publisherId?.publisherName === 'string' ? extension.metadata.publisherId.publisherName : '';
	const publisherDisplayName = typeof extension.metadata?.publisherDisplayName === 'string' ? extension.metadata.publisherDisplayName : '';
	const publisherIdDisplayName = typeof extension.metadata?.publisherId?.displayName === 'string' ? extension.metadata.publisherId.displayName : '';
	return name.startsWith('ms-vscode.')
		|| /github\.com\/microsoft\//i.test(repo)
		|| /^ms-vscode$/i.test(publisherName)
		|| /^Microsoft$/i.test(publisherDisplayName)
		|| /^Microsoft$/i.test(publisherIdDisplayName);
}

function isMatchingBuiltInExtensionApproval(extension, approval) {
	return extension.name === approval.name
		&& extension.version === approval.version
		&& extension.sha256 === approval.sha256
		&& extension.repo === approval.repo;
}

function checkReleaseInfrastructurePolicy() {
	const scannedFiles = [
		{
			file: 'build/azure-pipelines/common/sign.ts',
			patterns: [
				{ label: 'ESRP signing service', pattern: /ESRP|api\.esrp\.microsoft\.com/i },
				{ label: 'Microsoft timestamp service', pattern: /rfc3161\.gtm\.corp\.microsoft\.com/i },
				{ label: 'VS Code signing metadata', pattern: /OpusName['"], parameterValue: ['"]VS Code/i },
				{ label: 'Microsoft signing owner metadata', pattern: /['"]-o['"], ['"]Microsoft['"]|https:\/\/www\.microsoft\.com/i },
			],
		},
		{
			file: 'build/azure-pipelines/common/publish.ts',
			patterns: [
				{ label: 'ESRP release service', pattern: /ESRPReleaseService|api\.esrp\.microsoft\.com/i },
				{ label: 'Microsoft identity authority', pattern: /login\.microsoftonline\.com/i },
				{ label: 'Microsoft release owners', pattern: /@microsoft\.com/i },
				{ label: 'VS Code release metadata', pattern: /title: ['"]VS Code['"]|name: ['"]VS Code['"]|description: ['"]VS Code['"]/i },
			],
		},
		{
			file: 'build/azure-pipelines/distro/download-distro.yml',
			patterns: [
				{ label: 'Microsoft Azure Key Vault', pattern: /AzureKeyVault|vscode-build-secrets/i },
				{ label: 'Microsoft vscode-distro source', pattern: /microsoft\/vscode-distro|microsoft-vscode-distro/i },
			],
		},
		{
			file: 'build/azure-pipelines/product-build.yml',
			patterns: [
				{ label: 'Microsoft download endpoint', pattern: /vscode\.download\.prss\.microsoft\.com/i },
				{ label: 'Microsoft ESRP variables', pattern: /VSCODE_ESRP_|ESRP_CLIENT_ID|ESRP_TENANT_ID/i },
				{ label: 'Microsoft vscode-distro source', pattern: /microsoft\/vscode-distro/i },
			],
		},
		{
			file: 'build/azure-pipelines/product-publish.yml',
			patterns: [
				{ label: 'Microsoft Azure Key Vault', pattern: /AzureKeyVault|vscode-build-secrets|vscode-esrp/i },
				{ label: 'Microsoft ESRP release credentials', pattern: /ESRP_CLIENT_ID|ESRP_TENANT_ID/i },
			],
		},
	];

	for (const { file, patterns } of scannedFiles) {
		const content = readText(file);
		const matches = patterns.filter(({ pattern }) => pattern.test(content)).map(({ label }) => label);
		if (matches.length) {
			fail(`${file}: contains inherited Microsoft release infrastructure (${matches.join(', ')})`);
		}
	}
}
