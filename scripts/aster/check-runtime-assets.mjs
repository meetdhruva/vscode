/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const scriptPath = resolve(import.meta.dirname, 'check-runtime-assets.mjs');
const scannedFiles = [
	'product.json',
	'src/vs/server/node/webClientServer.ts',
	'src/vs/workbench/services/environment/browser/environmentService.ts',
	'src/vs/workbench/contrib/webview/common/webview.ts',
	'extensions/copilot/package.json',
	'extensions/copilot/src/platform/embeddings/common/embeddingsIndex.ts',
];

const forbiddenPatterns = [
	/vscode-cdn\.net/i,
	/vscodewalkthroughs/i,
	/web\.core\.windows\.net/i,
];

const failures = [];

for (const file of listFilesToScan()) {
	const content = readFileSync(file, 'utf8');
	for (const pattern of forbiddenPatterns) {
		if (pattern.test(content)) {
			failures.push(`${relativeToRoot(file)}: ${pattern}`);
		}
	}
}

if (failures.length) {
	console.error('Aster runtime asset scan failed:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log('Aster runtime asset scan passed');

function listFilesToScan() {
	const files = new Set(scannedFiles.map(file => resolve(root, file)));
	for (const arg of process.argv.slice(2)) {
		for (const file of collectFiles(resolve(root, arg))) {
			files.add(file);
		}
	}
	return [...files].sort();
}

function collectFiles(path) {
	const stat = statSync(path);
	if (stat.isFile()) {
		return shouldScanFile(path) ? [path] : [];
	}
	if (!stat.isDirectory()) {
		return [];
	}

	const files = [];
	for (const entry of readdirSync(path)) {
		if (entry === '.git' || entry === 'node_modules' || entry === 'dist' || entry === 'out') {
			continue;
		}
		files.push(...collectFiles(resolve(path, entry)));
	}
	return files;
}

function shouldScanFile(path) {
	if (path === scriptPath) {
		return false;
	}
	return ['.html', '.js', '.json', '.mjs', '.ts'].includes(extname(path));
}

function relativeToRoot(path) {
	return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}
