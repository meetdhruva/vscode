/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const includeSourceMaps = takeFlag('--include-source-maps');
const artifactPaths = args.map(arg => resolve(root, arg));

const textExtensions = new Set([
	'.bash',
	'.bat',
	'.cmd',
	'.css',
	'.desktop',
	'.html',
	'.ini',
	'.js',
	'.json',
	'.mjs',
	'.cjs',
	'.md',
	'.plist',
	'.ps1',
	'.service',
	'.sh',
	'.svg',
	'.toml',
	'.txt',
	'.xml',
	'.yml',
	'.yaml',
]);

const forbiddenPatterns = [
	{ label: 'placeholder webview host', pattern: /aster-webview\.invalid/i },
	{ label: 'VS Code CDN host', pattern: /vscode-cdn\.net/i },
	{ label: 'Microsoft Azure static web host', pattern: /web\.core\.windows\.net/i },
	{ label: 'Visual Studio Marketplace asset host', pattern: /gallerycdn\.vsassets\.io|vscode-unpkg\.net/i },
	{ label: 'Microsoft download endpoint', pattern: /vscode\.download\.prss\.microsoft\.com/i },
	{ label: 'Microsoft ESRP endpoint', pattern: /api\.esrp\.microsoft\.com/i },
	{ label: 'Microsoft ESRP release service', pattern: /ESRPReleaseService/i },
	{ label: 'Microsoft ESRP environment names', pattern: /VSCODE_ESRP_|ESRP_CLIENT_ID|ESRP_TENANT_ID/i },
	{ label: 'Microsoft timestamp service', pattern: /rfc3161\.gtm\.corp\.microsoft\.com/i },
	{ label: 'Microsoft release secret names', pattern: /vscode-build-secrets|vscode-esrp/i },
	{ label: 'Microsoft distro source', pattern: /microsoft\/vscode-distro|microsoft-vscode-distro/i },
	{ label: 'GitHub Copilot user-facing brand', pattern: /\bGitHub Copilot\b/i },
	{ label: 'Copilot Chat user-facing brand', pattern: /\bCopilot Chat\b/i },
];

if (artifactPaths.length === 0) {
	console.error('Usage: npm run aster:check-release-artifacts -- <unpacked artifact path> [more paths...] [--include-source-maps]');
	process.exit(2);
}

const failures = [];
const files = [];
const visitedDirectories = new Set();
let scannedFileCount = 0;

for (const artifactPath of artifactPaths) {
	if (!existsSync(artifactPath)) {
		failures.push(`${relativeToRoot(artifactPath)}: path does not exist`);
		continue;
	}
	files.push(...collectFiles(artifactPath));
}

for (const file of files.sort()) {
	let isBinary;
	try {
		isBinary = looksBinaryFile(file);
	} catch (error) {
		failures.push(`${relativeToRoot(file)}: cannot read file (${formatError(error)})`);
		continue;
	}
	if (isBinary) {
		continue;
	}
	scannedFileCount++;

	let text;
	try {
		text = readFileSync(file, 'utf8');
	} catch (error) {
		failures.push(`${relativeToRoot(file)}: cannot read file (${formatError(error)})`);
		continue;
	}
	for (const { label, pattern } of forbiddenPatterns) {
		const match = pattern.exec(text);
		if (match) {
			const location = getLineColumn(text, match.index);
			failures.push(`${relativeToRoot(file)}:${location.line}:${location.column}: ${label}`);
		}
	}
}

if (failures.length) {
	console.error('Aster release artifact scan failed:');
	for (const failure of failures.slice(0, 200)) {
		console.error(`- ${failure}`);
	}
	if (failures.length > 200) {
		console.error(`- ... ${failures.length - 200} more failure(s) omitted`);
	}
	process.exit(1);
}

console.log(`Aster release artifact scan passed (${scannedFileCount} file(s) scanned)`);

function takeFlag(flag) {
	const index = args.indexOf(flag);
	if (index === -1) {
		return false;
	}
	args.splice(index, 1);
	return true;
}

function collectFiles(path) {
	let stat;
	try {
		stat = lstatSync(path);
	} catch (error) {
		failures.push(`${relativeToRoot(path)}: cannot inspect path (${formatError(error)})`);
		return [];
	}
	if (stat.isSymbolicLink()) {
		return collectSymlink(path);
	}
	if (stat.isFile()) {
		return shouldScanFile(path) ? [path] : [];
	}
	if (!stat.isDirectory()) {
		return [];
	}
	return collectDirectory(path);
}

function collectSymlink(path) {
	let target;
	let targetStat;
	try {
		target = realpathSync(path);
		targetStat = statSync(path);
	} catch (error) {
		failures.push(`${relativeToRoot(path)}: cannot resolve symlink (${formatError(error)})`);
		return [];
	}
	if (targetStat.isFile()) {
		return shouldScanFile(path) ? [path] : [];
	}
	if (targetStat.isDirectory()) {
		return collectDirectory(target);
	}
	return [];
}

function collectDirectory(path) {
	let realPath;
	try {
		realPath = realpathSync(path);
	} catch (error) {
		failures.push(`${relativeToRoot(path)}: cannot resolve directory (${formatError(error)})`);
		return [];
	}
	if (visitedDirectories.has(realPath)) {
		return [];
	}
	visitedDirectories.add(realPath);

	const files = [];
	let entries;
	try {
		entries = readdirSync(path);
	} catch (error) {
		failures.push(`${relativeToRoot(path)}: cannot read directory (${formatError(error)})`);
		return files;
	}
	for (const entry of entries) {
		if (entry === '.git') {
			continue;
		}
		files.push(...collectFiles(resolve(path, entry)));
	}
	return files;
}

function shouldScanFile(path) {
	const extension = extname(path).toLowerCase();
	if (extension === '.map' && !includeSourceMaps) {
		return false;
	}
	if (!extension) {
		return true;
	}
	return textExtensions.has(extension) || (includeSourceMaps && extension === '.map');
}

function looksBinaryFile(path) {
	const file = openSync(path, 'r');
	try {
		const buffer = Buffer.alloc(4096);
		const bytesRead = readSync(file, buffer, 0, buffer.length, 0);
		for (let i = 0; i < bytesRead; i++) {
			if (buffer[i] === 0) {
				return true;
			}
		}
		return false;
	} finally {
		closeSync(file);
	}
}

function relativeToRoot(path) {
	return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

function getLineColumn(text, index) {
	const prefix = text.slice(0, index);
	const line = prefix.split('\n').length;
	const previousNewline = prefix.lastIndexOf('\n');
	return { line, column: index - previousNewline };
}

function formatError(error) {
	return error?.code ?? error?.message ?? String(error);
}
