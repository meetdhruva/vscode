/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, '../../..');
const options = parseArgs(process.argv.slice(2));
const env = process.env;
const dryRun = options.dryRun === true;
const assetsRoot = resolve(root, options.assetsRoot ?? env.PIPELINE_WORKSPACE ?? env.BUILD_ARTIFACTSTAGINGDIRECTORY ?? '.');
const repository = normalizeRepository(firstNonEmpty(options.repo, env.ASTER_GITHUB_RELEASE_REPOSITORY, env.GITHUB_REPOSITORY, getRepositoryFromBuildEnv(env)));
const token = firstNonEmpty(env.ASTER_GITHUB_RELEASE_TOKEN, env.GITHUB_TOKEN, env.GH_TOKEN);
const product = await readJsonIfExists(resolve(root, 'product.json'));
const packageJson = await readJsonIfExists(resolve(root, 'package.json'));
const tag = firstNonEmpty(options.tag, env.ASTER_GITHUB_RELEASE_TAG, getDefaultTag(env, packageJson));
const releaseName = firstNonEmpty(options.releaseName, env.ASTER_GITHUB_RELEASE_NAME, `${product?.nameLong ?? product?.nameShort ?? 'Aster'} ${tag}`);
const prerelease = options.prerelease ?? (env.VSCODE_QUALITY !== undefined && env.VSCODE_QUALITY !== 'stable');

if (!repository) {
	fail('Missing GitHub release repository. Set ASTER_GITHUB_RELEASE_REPOSITORY or pass --repo owner/repo.');
}

if (!tag) {
	fail('Missing GitHub release tag. Set ASTER_GITHUB_RELEASE_TAG, pass --tag, run from a tag ref, or provide package.json version.');
}

if (!dryRun && !token) {
	fail('Missing GitHub token. Set ASTER_GITHUB_RELEASE_TOKEN with contents:write access to the release repository.');
}

const assets = await collectAssets(assetsRoot);

if (!assets.length) {
	fail(`No releasable artifacts found under ${assetsRoot}. Expected files such as .zip, .tar.gz, .deb, .rpm, .dmg, .exe, .msi, .snap, or AppImage.`);
}

assertUniqueAssetNames(assets);

console.log(`GitHub release repository: ${repository}`);
console.log(`GitHub release tag: ${tag}`);
console.log(`Release name: ${releaseName}`);
console.log(`Assets root: ${assetsRoot}`);
console.log(`Found ${assets.length} releasable artifact(s):`);

for (const asset of assets) {
	asset.sha1 = await hashFile(asset.path, 'sha1');
	asset.sha256 = await hashFile(asset.path, 'sha256');
	console.log(`- ${asset.name} (${asset.size} bytes)`);
}

const body = options.notes ?? getDefaultReleaseBody(env, { repository, tag, assets });
const manifest = getReleaseManifest(env, { repository, tag, releaseName, assets });

if (dryRun) {
	console.log('Dry run only; no GitHub release was created or modified.');
	process.exit(0);
}

const release = await getOrCreateRelease({ repository, tag, releaseName, body, prerelease, token });
const existingAssets = await getReleaseAssets({ repository, releaseId: release.id, token });

for (const asset of assets) {
	for (const name of [asset.name, `${asset.name}.sha1`, `${asset.name}.sha256`]) {
		await deleteExistingAsset({ repository, existingAssets, name, token });
	}

	console.log(`Uploading ${asset.name}`);
	await uploadAsset({
		uploadUrl: release.upload_url,
		name: asset.name,
		contentType: getContentType(asset.name),
		contentLength: asset.size,
		body: () => createReadStream(asset.path),
		token,
	});

	await uploadTextAsset({
		uploadUrl: release.upload_url,
		name: `${asset.name}.sha1`,
		text: `${asset.sha1}  ${asset.name}\n`,
		token,
	});

	await uploadTextAsset({
		uploadUrl: release.upload_url,
		name: `${asset.name}.sha256`,
		text: `${asset.sha256}  ${asset.name}\n`,
		token,
	});
}

await deleteExistingAsset({ repository, existingAssets, name: 'aster-release-assets.json', token });
await uploadTextAsset({
	uploadUrl: release.upload_url,
	name: 'aster-release-assets.json',
	text: `${JSON.stringify(manifest, undefined, '\t')}\n`,
	contentType: 'application/json; charset=utf-8',
	token,
});

console.log(`Published ${assets.length} public release asset(s) to https://github.com/${repository}/releases/tag/${encodeURIComponent(tag)}`);

function parseArgs(args) {
	const parsed = {};
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		switch (arg) {
			case '--assets-root':
				parsed.assetsRoot = takeValue(args, ++index, arg);
				break;
			case '--repo':
				parsed.repo = takeValue(args, ++index, arg);
				break;
			case '--tag':
				parsed.tag = takeValue(args, ++index, arg);
				break;
			case '--release-name':
				parsed.releaseName = takeValue(args, ++index, arg);
				break;
			case '--notes':
				parsed.notes = takeValue(args, ++index, arg);
				break;
			case '--dry-run':
				parsed.dryRun = true;
				break;
			case '--prerelease':
				parsed.prerelease = true;
				break;
			case '--no-prerelease':
				parsed.prerelease = false;
				break;
			default:
				fail(`Unknown argument: ${arg}`);
		}
	}
	return parsed;
}

function takeValue(args, index, flag) {
	const value = args[index];
	if (!value || value.startsWith('--')) {
		fail(`Missing value for ${flag}`);
	}
	return value;
}

function firstNonEmpty(...values) {
	return values.find(value => typeof value === 'string' && value.length > 0);
}

async function readJsonIfExists(path) {
	try {
		return JSON.parse(await readFile(path, 'utf8'));
	} catch (error) {
		if (error?.code === 'ENOENT') {
			return undefined;
		}
		throw error;
	}
}

function normalizeRepository(value) {
	if (!value) {
		return undefined;
	}
	const normalized = value.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
	if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)) {
		fail(`Invalid GitHub repository ${JSON.stringify(value)}. Expected owner/repo.`);
	}
	return normalized;
}

function getRepositoryFromBuildEnv(buildEnv) {
	if (buildEnv.BUILD_REPOSITORY_URI?.startsWith('https://github.com/')) {
		return buildEnv.BUILD_REPOSITORY_URI.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
	}
	if (buildEnv.BUILD_REPOSITORY_NAME?.includes('/')) {
		return buildEnv.BUILD_REPOSITORY_NAME;
	}
	return undefined;
}

function getDefaultTag(buildEnv, packageJson) {
	for (const ref of [buildEnv.BUILD_SOURCEBRANCH, buildEnv.GITHUB_REF]) {
		if (ref?.startsWith('refs/tags/')) {
			return ref.slice('refs/tags/'.length);
		}
	}

	if (!packageJson?.version) {
		return undefined;
	}

	const buildId = buildEnv.BUILD_BUILDID ?? buildEnv.GITHUB_RUN_NUMBER;
	return buildId ? `v${packageJson.version}-${buildId}` : `v${packageJson.version}`;
}

function getDefaultReleaseBody(buildEnv, { repository, tag, assets }) {
	const lines = [
		'Automated public installer release from CI/CD artifacts.',
		'',
		'Each uploaded artifact has SHA-1 and SHA-256 checksum sidecars.',
	];

	if (buildEnv.BUILD_BUILDNUMBER || buildEnv.BUILD_SOURCEVERSION) {
		lines.push('');
	}
	if (buildEnv.BUILD_BUILDNUMBER) {
		lines.push(`Azure Pipeline build: ${buildEnv.BUILD_BUILDNUMBER}`);
	}
	if (buildEnv.BUILD_SOURCEVERSION) {
		lines.push(`Source commit: ${buildEnv.BUILD_SOURCEVERSION}`);
	}

	lines.push('', '## Downloads', '', '| File | Size | SHA-256 |', '| --- | ---: | --- |');

	for (const asset of assets) {
		lines.push(`| [${asset.name}](${getAssetDownloadUrl(repository, tag, asset.name)}) | ${asset.size} | \`${asset.sha256}\` |`);
	}

	return lines.join('\n');
}

function getReleaseManifest(buildEnv, { repository, tag, releaseName, assets }) {
	return {
		schemaVersion: 1,
		repository,
		tag,
		releaseName,
		quality: buildEnv.VSCODE_QUALITY ?? null,
		sourceVersion: buildEnv.BUILD_SOURCEVERSION ?? buildEnv.GITHUB_SHA ?? null,
		buildNumber: buildEnv.BUILD_BUILDNUMBER ?? buildEnv.GITHUB_RUN_NUMBER ?? null,
		assets: assets.map(asset => ({
			name: asset.name,
			size: asset.size,
			sha1: asset.sha1,
			sha256: asset.sha256,
			downloadUrl: getAssetDownloadUrl(repository, tag, asset.name),
		})),
	};
}

function getAssetDownloadUrl(repository, tag, name) {
	return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}

async function collectAssets(searchRoot) {
	const files = await listFiles(searchRoot);
	const assets = [];

	for (const path of files.sort()) {
		const name = basename(path);
		const relativePath = normalizePath(relative(searchRoot, path));
		if (shouldSkipPath(relativePath) || !isReleaseAssetName(name)) {
			continue;
		}

		const fileStat = await stat(path);
		if (fileStat.size === 0) {
			fail(`${relativePath}: release asset is empty`);
		}

		assets.push({ path, name, relativePath, size: fileStat.size });
	}

	return assets;
}

async function listFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...await listFiles(path));
		} else if (entry.isFile()) {
			files.push(path);
		}
	}
	return files;
}

function normalizePath(path) {
	return path.split(sep).join('/');
}

function shouldSkipPath(path) {
	return path.split('/').some(part => {
		return part === '.git'
			|| part === 'node_modules'
			|| part.startsWith('crash-dump-')
			|| part.startsWith('logs-')
			|| part.startsWith('node-modules-')
			|| part.startsWith('screenshots-')
			|| part.startsWith('artifacts_processed_')
			|| part.startsWith('unsigned_');
	});
}

function isReleaseAssetName(name) {
	const lowerName = name.toLowerCase();
	return lowerName.endsWith('.zip')
		|| lowerName.endsWith('.tar.gz')
		|| lowerName.endsWith('.tgz')
		|| lowerName.endsWith('.tar.xz')
		|| lowerName.endsWith('.deb')
		|| lowerName.endsWith('.rpm')
		|| lowerName.endsWith('.snap')
		|| lowerName.endsWith('.dmg')
		|| lowerName.endsWith('.exe')
		|| lowerName.endsWith('.msi')
		|| lowerName.endsWith('.appimage');
}

function assertUniqueAssetNames(assets) {
	const pathsByName = new Map();
	for (const asset of assets) {
		const existingPath = pathsByName.get(asset.name);
		if (existingPath) {
			fail(`Duplicate release asset name ${asset.name}: ${existingPath} and ${asset.relativePath}`);
		}
		pathsByName.set(asset.name, asset.relativePath);
	}
}

function hashFile(path, algorithm) {
	return new Promise((resolveHash, reject) => {
		const hash = createHash(algorithm);
		const stream = createReadStream(path);
		stream.on('data', chunk => hash.update(chunk));
		stream.on('error', reject);
		stream.on('end', () => resolveHash(hash.digest('hex')));
	});
}

async function getOrCreateRelease({ repository, tag, releaseName, body, prerelease, token }) {
	const existingRelease = await githubRequest({
		token,
		method: 'GET',
		path: `/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
		allowNotFound: true,
	});

	if (existingRelease) {
		console.log(`Using existing release ${tag}`);
		return updateRelease({ repository, releaseId: existingRelease.id, releaseName, body, prerelease, token });
	}

	console.log(`Creating release ${tag}`);
	return githubRequest({
		token,
		method: 'POST',
		path: `/repos/${repository}/releases`,
		body: {
			tag_name: tag,
			name: releaseName,
			body,
			prerelease,
		},
	});
}

async function updateRelease({ repository, releaseId, releaseName, body, prerelease, token }) {
	return githubRequest({
		token,
		method: 'PATCH',
		path: `/repos/${repository}/releases/${releaseId}`,
		body: {
			name: releaseName,
			body,
			prerelease,
		},
	});
}

async function getReleaseAssets({ repository, releaseId, token }) {
	const assets = [];
	let page = 1;
	while (true) {
		const pageAssets = await githubRequest({
			token,
			method: 'GET',
			path: `/repos/${repository}/releases/${releaseId}/assets?per_page=100&page=${page}`,
		});
		assets.push(...pageAssets);
		if (pageAssets.length < 100) {
			return assets;
		}
		page++;
	}
}

async function deleteReleaseAsset({ repository, assetId, token }) {
	await githubRequest({
		token,
		method: 'DELETE',
		path: `/repos/${repository}/releases/assets/${assetId}`,
	});
}

async function deleteExistingAsset({ repository, existingAssets, name, token }) {
	const existingAsset = existingAssets.find(candidate => candidate.name === name);
	if (!existingAsset) {
		return;
	}

	console.log(`Deleting existing release asset ${name}`);
	await deleteReleaseAsset({ repository, assetId: existingAsset.id, token });
}

async function uploadTextAsset({ uploadUrl, name, text, contentType = 'text/plain; charset=utf-8', token }) {
	const body = Buffer.from(text, 'utf8');
	await uploadAsset({
		uploadUrl,
		name,
		contentType,
		contentLength: body.length,
		body,
		token,
	});
}

async function uploadAsset({ uploadUrl, name, contentType, contentLength, body, token }) {
	const url = `${uploadUrl.replace(/\{.*$/, '')}?name=${encodeURIComponent(name)}`;
	await retry(async () => {
		const uploadBody = typeof body === 'function' ? body() : body;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Accept': 'application/vnd.github+json',
				'Authorization': `Bearer ${token}`,
				'Content-Type': contentType,
				'Content-Length': String(contentLength),
				'X-GitHub-Api-Version': '2022-11-28',
			},
			body: uploadBody,
			duplex: 'half',
		});

		if (!response.ok) {
			throw new Error(`GitHub asset upload failed with ${response.status}: ${await response.text()}`);
		}
	});
}

async function githubRequest({ token, method, path, body, allowNotFound = false }) {
	const url = path.startsWith('https://') ? path : `https://api.github.com${path}`;
	const response = await fetch(url, {
		method,
		headers: {
			'Accept': 'application/vnd.github+json',
			'Authorization': `Bearer ${token}`,
			'Content-Type': 'application/json',
			'X-GitHub-Api-Version': '2022-11-28',
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});

	if (allowNotFound && response.status === 404) {
		return undefined;
	}

	if (response.status === 204) {
		return undefined;
	}

	if (!response.ok) {
		throw new Error(`GitHub API ${method} ${path} failed with ${response.status}: ${await response.text()}`);
	}

	return response.json();
}

async function retry(task) {
	let lastError;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			return await task();
		} catch (error) {
			lastError = error;
			if (attempt < 3) {
				await new Promise(resolve => setTimeout(resolve, attempt * 5000));
			}
		}
	}
	throw lastError;
}

function getContentType(name) {
	const lowerName = name.toLowerCase();
	if (lowerName.endsWith('.zip')) {
		return 'application/zip';
	}
	if (lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz')) {
		return 'application/gzip';
	}
	if (lowerName.endsWith('.tar.xz')) {
		return 'application/x-xz';
	}
	if (lowerName.endsWith('.deb')) {
		return 'application/vnd.debian.binary-package';
	}
	if (lowerName.endsWith('.rpm')) {
		return 'application/x-rpm';
	}
	if (lowerName.endsWith('.dmg')) {
		return 'application/x-apple-diskimage';
	}
	if (lowerName.endsWith('.exe') || lowerName.endsWith('.msi')) {
		return 'application/octet-stream';
	}
	return 'application/octet-stream';
}

function fail(message) {
	console.error(message);
	process.exit(1);
}
