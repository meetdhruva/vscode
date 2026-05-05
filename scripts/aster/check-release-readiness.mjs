/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const failures = [];

const product = readJson('product.json');

checkWebviewAssetHost();
checkWebviewRuntimeFallbacks();

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
