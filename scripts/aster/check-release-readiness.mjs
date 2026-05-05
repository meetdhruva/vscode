/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const failures = [];

const product = readJson('product.json');
const webviewPreloadPathTemplate = '/{{quality}}/{{commit}}/out/vs/workbench/contrib/webview/browser/pre/';
const webviewContentExternalBaseUrlTemplatePattern = /^https:\/\/\{\{uuid\}\}\.([^/?#]+)\/\{\{quality\}\}\/\{\{commit\}\}\/out\/vs\/workbench\/contrib\/webview\/browser\/pre\/$/;

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
		const count = countOccurrences(template, token);
		if (!count) {
			fail(`product.webviewContentExternalBaseUrlTemplate: missing required token ${token}`);
		} else if (count > 1) {
			fail(`product.webviewContentExternalBaseUrlTemplate: expected token ${token} exactly once`);
		}
	}

	const baseHost = getWebviewTemplateBaseHost(template);
	if (!baseHost) {
		fail(`product.webviewContentExternalBaseUrlTemplate: expected shape https://{{uuid}}.<host>${webviewPreloadPathTemplate}`);
	} else {
		checkWebviewBaseHost('product.webviewContentExternalBaseUrlTemplate host', baseHost);
	}

	const forbiddenPatterns = [
		{ label: 'placeholder .invalid host', pattern: /\.invalid(?:\/|$)/i },
		{ label: 'localhost-like host', pattern: /\/\/(?:\{\{uuid\}\}\.)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/|$)|\.local(?:domain)?(?:\/|$)/i },
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
	const defaultsFile = 'src/vs/base/common/asterWebviewDefaults.ts';
	const defaultsContent = readText(defaultsFile);
	const productBaseHost = getWebviewTemplateBaseHost(product.webviewContentExternalBaseUrlTemplate);
	const defaultHostMatch = defaultsContent.match(/defaultAsterWebviewResourceBaseHost\s*=\s*['"]([^'"]+)['"]/);
	const defaultBaseHost = defaultHostMatch?.[1];

	if (!defaultBaseHost) {
		fail(`${defaultsFile}: missing defaultAsterWebviewResourceBaseHost`);
	} else {
		checkWebviewBaseHost(`${defaultsFile}: defaultAsterWebviewResourceBaseHost`, defaultBaseHost);
		if (productBaseHost && defaultBaseHost !== productBaseHost) {
			fail(`${defaultsFile}: default host ${defaultBaseHost} does not match product webview host ${productBaseHost}`);
		}
	}

	if (!defaultsContent.includes(`defaultAsterWebviewContentExternalBaseUrlTemplate = \`https://{{uuid}}.\${defaultAsterWebviewResourceBaseHost}${webviewPreloadPathTemplate}\`;`)) {
		fail(`${defaultsFile}: default webview URL template must derive from defaultAsterWebviewResourceBaseHost and keep ${webviewPreloadPathTemplate}`);
	}

	if (!defaultsContent.includes('defaultAsterWebviewFrameSource = `https://*.${defaultAsterWebviewResourceBaseHost}`;')) {
		fail(`${defaultsFile}: default webview frame source must derive from defaultAsterWebviewResourceBaseHost`);
	}

	const placeholders = [
		{
			file: defaultsFile,
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

function getWebviewTemplateBaseHost(template) {
	if (typeof template !== 'string') {
		return undefined;
	}
	return template.match(webviewContentExternalBaseUrlTemplatePattern)?.[1];
}

function checkWebviewBaseHost(label, baseHost) {
	if (!/^[a-z0-9.-]+$/i.test(baseHost)) {
		fail(`${label}: expected a DNS host suffix, found ${JSON.stringify(baseHost)}`);
	}
	if (!baseHost.includes('.') || baseHost.startsWith('.') || baseHost.endsWith('.') || baseHost.includes('..')) {
		fail(`${label}: expected a public DNS host suffix, found ${JSON.stringify(baseHost)}`);
	}
	for (const hostLabel of baseHost.split('.')) {
		if (!hostLabel || hostLabel.startsWith('-') || hostLabel.endsWith('-')) {
			fail(`${label}: invalid DNS label in ${JSON.stringify(baseHost)}`);
			break;
		}
	}

	const forbiddenBaseHostPatterns = [
		{ label: 'placeholder .invalid host', pattern: /(?:^|\.)invalid$/i },
		{ label: 'localhost-like host', pattern: /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0)$|(?:^|\.)local(?:domain)?$/i },
		{ label: 'VS Code CDN host', pattern: /(?:^|\.)vscode-cdn\.net$/i },
		{ label: 'Microsoft-hosted Azure storage', pattern: /(?:^|\.)web\.core\.windows\.net$/i },
		{ label: 'Visual Studio Marketplace asset host', pattern: /(?:^|\.)gallerycdn\.vsassets\.io$|(?:^|\.)vscode-unpkg\.net$/i },
	];

	for (const { label: forbiddenLabel, pattern } of forbiddenBaseHostPatterns) {
		if (pattern.test(baseHost)) {
			fail(`${label}: contains ${forbiddenLabel}`);
		}
	}
}

function countOccurrences(value, search) {
	return value.split(search).length - 1;
}

function checkBundledExtensionPolicy() {
	if (!Array.isArray(product.builtInExtensions)) {
		fail('product.builtInExtensions: expected an explicit array, use [] when no marketplace extensions are bundled');
		return;
	}

	const bundledExtensions = product.builtInExtensions;
	const pendingPolicyExtensions = bundledExtensions.filter(extension => {
		if (!isMicrosoftAuthoredBuiltInExtension(extension)) {
			return false;
		}
		return !approvedMicrosoftAuthoredBuiltInExtensions.some(approval => isMatchingBuiltInExtensionApproval(extension, approval));
	});

	if (pendingPolicyExtensions.length) {
		fail(`product.builtInExtensions: unapproved Microsoft-authored bundled extension present for ${pendingPolicyExtensions.map(extension => extension.name).join(', ')}`);
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
	const releaseInfraPatterns = [
		{ label: 'Microsoft ESRP signing or release service', pattern: /ESRPReleaseService|api\.esrp\.microsoft\.com|VSCODE_ESRP_|ESRP_CLIENT_ID|ESRP_TENANT_ID|Install ESRP Tooling|Find ESRP CLI/i },
		{ label: 'Microsoft timestamp service', pattern: /rfc3161\.gtm\.corp\.microsoft\.com/i },
		{ label: 'Microsoft Azure Key Vault or ESRP secrets', pattern: /AzureKeyVault|vscode-build-secrets|vscode-esrp/i },
		{ label: 'Microsoft identity authority', pattern: /login\.microsoftonline\.com/i },
		{ label: 'Microsoft release owners', pattern: /@microsoft\.com/i },
		{ label: 'Microsoft download endpoint', pattern: /vscode\.download\.prss\.microsoft\.com/i },
		{ label: 'Microsoft vscode-distro source', pattern: /microsoft\/vscode-distro|microsoft-vscode-distro/i },
		{ label: 'VS Code release metadata', pattern: /OpusName['"], parameterValue: ['"]VS Code|title: ['"]VS Code['"]|name: ['"]VS Code['"]|description: ['"]VS Code['"]/i },
		{ label: 'Microsoft signing owner metadata', pattern: /['"]-o['"], ['"]Microsoft['"]|https:\/\/www\.microsoft\.com/i },
	];

	const scannedFiles = listFiles('build/azure-pipelines')
		.filter(file => /\.(?:ts|js|mjs|yml|yaml|ps1|sh|json)$/i.test(file))
		.sort();

	for (const file of scannedFiles) {
		const content = readText(file);
		const matches = releaseInfraPatterns.filter(({ pattern }) => pattern.test(content)).map(({ label }) => label);
		if (matches.length) {
			fail(`${file}: contains inherited Microsoft release infrastructure (${matches.join(', ')})`);
		}
	}
}

function listFiles(relativePath) {
	const absolutePath = join(root, relativePath);
	const entries = readdirSync(absolutePath, { withFileTypes: true });
	const result = [];

	for (const entry of entries) {
		const entryRelativePath = `${relativePath}/${entry.name}`;
		const entryAbsolutePath = join(root, entryRelativePath);
		if (entry.isDirectory()) {
			result.push(...listFiles(entryRelativePath));
		} else if (entry.isFile() || statSync(entryAbsolutePath).isFile()) {
			result.push(entryRelativePath);
		}
	}

	return result;
}
