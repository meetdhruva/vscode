/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';

const failures = [];
const args = parseArgs(process.argv.slice(2));

if (args.help) {
	printUsage();
	process.exit(0);
}

const host = normalizeHost(args.host);
const quality = args.quality;
const commit = args.commit;
const uuid = args.uuid ?? randomUUID();
const timeoutMs = Number(args.timeoutMs ?? 15_000);

if (!host) {
	fail('missing --host');
} else {
	checkHost(host);
}

if (!quality) {
	fail('missing --quality');
}

if (!commit) {
	fail('missing --commit');
}

if (!/^[a-z0-9-]+$/i.test(uuid)) {
	fail(`--uuid must be a DNS label, found ${JSON.stringify(uuid)}`);
}

if (!Number.isInteger(timeoutMs) || timeoutMs < 1000) {
	fail(`--timeout-ms must be an integer >= 1000, found ${JSON.stringify(args.timeoutMs)}`);
}

if (failures.length) {
	printFailures();
	printUsage();
	process.exit(2);
}

const assets = [
	'index.html',
	'fake.html',
	'service-worker.js',
];

for (const asset of assets) {
	const url = `https://${uuid}.${host}/${quality}/${commit}/out/vs/workbench/contrib/webview/browser/pre/${asset}`;
	try {
		const response = await fetch(url, {
			redirect: 'follow',
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!response.ok) {
			fail(`${url}: expected HTTP 2xx, got ${response.status}`);
			continue;
		}
		const body = await response.arrayBuffer();
		if (body.byteLength === 0) {
			fail(`${url}: response body is empty`);
			continue;
		}
		console.log(`${url}: ok (${response.status}, ${body.byteLength} bytes)`);
	} catch (error) {
		fail(`${url}: ${error?.message ?? String(error)}`);
	}
}

if (failures.length) {
	printFailures();
	process.exit(1);
}

console.log('Aster webview host probe passed');

function parseArgs(argv) {
	const result = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--help' || arg === '-h') {
			result.help = true;
			continue;
		}
		if (!arg.startsWith('--')) {
			fail(`unexpected argument ${JSON.stringify(arg)}`);
			continue;
		}
		const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
		const value = argv[i + 1];
		if (!value || value.startsWith('--')) {
			fail(`missing value for ${arg}`);
			continue;
		}
		result[key] = value;
		i++;
	}
	return result;
}

function normalizeHost(value) {
	if (typeof value !== 'string') {
		return undefined;
	}
	return value.replace(/^https:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
}

function checkHost(value) {
	if (value.startsWith('*.')) {
		fail(`--host must be the bare webview host suffix, not a wildcard: ${JSON.stringify(value)}`);
	}
	if (!/^[a-z0-9.-]+$/i.test(value) || !value.includes('.') || value.startsWith('.') || value.endsWith('.') || value.includes('..')) {
		fail(`--host must be a public DNS suffix, found ${JSON.stringify(value)}`);
	}
	for (const label of value.split('.')) {
		if (!label || label.startsWith('-') || label.endsWith('-')) {
			fail(`--host contains an invalid DNS label: ${JSON.stringify(value)}`);
			break;
		}
	}
	const forbidden = [
		{ label: 'placeholder .invalid host', pattern: /(?:^|\.)invalid$/i },
		{ label: 'localhost-like host', pattern: /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0)$|(?:^|\.)local(?:domain)?$/i },
		{ label: 'VS Code CDN host', pattern: /(?:^|\.)vscode-cdn\.net$/i },
		{ label: 'Microsoft-hosted Azure storage', pattern: /(?:^|\.)web\.core\.windows\.net$/i },
		{ label: 'Visual Studio Marketplace asset host', pattern: /(?:^|\.)gallerycdn\.vsassets\.io$|(?:^|\.)vscode-unpkg\.net$/i },
	];
	for (const { label, pattern } of forbidden) {
		if (pattern.test(value)) {
			fail(`--host contains ${label}: ${JSON.stringify(value)}`);
		}
	}
}

function fail(message) {
	failures.push(message);
}

function printFailures() {
	console.error('Aster webview host probe failed:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
}

function printUsage() {
	console.error('Usage: npm run aster:probe-webview-host -- --host <host> --quality <quality> --commit <commit> [--uuid <dns-label>] [--timeout-ms <ms>]');
}
