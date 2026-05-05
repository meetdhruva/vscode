/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const allowExternalBlockers = process.argv.includes('--allow-external-blockers');
const failures = [];

const product = readJson('product.json');
const brandClearance = readJson('docs/aster-brand-clearance.json');
const webviewHostReadiness = readJson('docs/aster-webview-host.json');
const releaseInfrastructure = readJson('docs/aster-release-infrastructure.json');
const asterAiExtension = readJson('extensions/copilot/package.json');
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
checkReleaseInfrastructureManifest();
checkReleasePipelineSelectionPolicy();
checkBrandClearancePolicy();

if (failures.length) {
	const blockingFailures = allowExternalBlockers ? failures.filter(failure => !failure.external) : failures;
	if (!blockingFailures.length) {
		console.log(`Aster release-readiness guardrails passed (${failures.length} external blocker(s) remain)`);
		process.exit(0);
	}
	console.error('Aster release-readiness check failed:');
	for (const failure of blockingFailures) {
		console.error(`- ${failure.message}`);
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

function fail(message, options = {}) {
	failures.push({ message, external: options.external === true });
}

function failExternal(message) {
	fail(message, { external: true });
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
		checkWebviewBaseHost('product.webviewContentExternalBaseUrlTemplate host', baseHost, { externalForbidden: true });
		checkWebviewHostDomainApproval('product.webviewContentExternalBaseUrlTemplate host', baseHost);
		checkWebviewHostManifest(baseHost);
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
			failExternal(`product.webviewContentExternalBaseUrlTemplate: contains ${label}`);
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
		checkWebviewBaseHost(`${defaultsFile}: defaultAsterWebviewResourceBaseHost`, defaultBaseHost, { externalForbidden: true });
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

	const webviewCommon = readText('src/vs/workbench/contrib/webview/common/webview.ts');
	if (!webviewCommon.includes('import { defaultAsterWebviewResourceBaseHost } from \'../../../../base/common/asterWebviewDefaults.js\';') || !webviewCommon.includes('export const webviewResourceBaseHost = defaultAsterWebviewResourceBaseHost;')) {
		fail('src/vs/workbench/contrib/webview/common/webview.ts: webview resource host must derive from defaultAsterWebviewResourceBaseHost');
	}

	const environmentService = readText('src/vs/workbench/services/environment/browser/environmentService.ts');
	if (!environmentService.includes('import { defaultAsterWebviewContentExternalBaseUrlTemplate } from \'../../../../base/common/asterWebviewDefaults.js\';') || !environmentService.includes('|| defaultAsterWebviewContentExternalBaseUrlTemplate')) {
		fail('src/vs/workbench/services/environment/browser/environmentService.ts: browser webview fallback must derive from defaultAsterWebviewContentExternalBaseUrlTemplate');
	}

	const webClientServer = readText('src/vs/server/node/webClientServer.ts');
	if (!webClientServer.includes('import { defaultAsterWebviewFrameSource } from \'../../base/common/asterWebviewDefaults.js\';') || !webClientServer.includes('${defaultAsterWebviewFrameSource}')) {
		fail('src/vs/server/node/webClientServer.ts: server webview CSP must derive from defaultAsterWebviewFrameSource');
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
			failExternal(`${file}: contains placeholder ${label}`);
		}
	}
}

function getWebviewTemplateBaseHost(template) {
	if (typeof template !== 'string') {
		return undefined;
	}
	return template.match(webviewContentExternalBaseUrlTemplatePattern)?.[1];
}

function checkWebviewBaseHost(label, baseHost, options = {}) {
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
			fail(`${label}: contains ${forbiddenLabel}`, { external: options.externalForbidden === true });
		}
	}
}

function checkWebviewHostDomainApproval(label, baseHost) {
	const approvedPublicDomains = Array.isArray(brandClearance.approvedPublicDomains) ? brandClearance.approvedPublicDomains : [];
	if (!approvedPublicDomains.some(domain => typeof domain === 'string' && isHostUnderDomain(baseHost, domain))) {
		fail(`${label}: must be equal to or under an approvedPublicDomains entry in docs/aster-brand-clearance.json`, { external: approvedPublicDomains.length === 0 || brandClearance.status !== 'cleared' });
	}
}

function isHostUnderDomain(host, domain) {
	const normalizedHost = host.toLowerCase();
	const normalizedDomain = domain.toLowerCase();
	return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function checkWebviewHostManifest(productBaseHost) {
	const webviewHostPending = webviewHostReadiness.status !== 'configured';
	const failWebviewInput = message => fail(message, { external: webviewHostPending });
	const requiredEvidence = [
		'dnsWildcard',
		'tlsWildcard',
		'assetDeployment',
		'cspCoverage',
		'probeResults',
		'artifactScanResults',
	];

	if (webviewHostReadiness.status !== 'configured') {
		failWebviewInput(`docs/aster-webview-host.json: status is ${JSON.stringify(webviewHostReadiness.status)}, expected "configured" before public release`);
	}

	if (typeof webviewHostReadiness.host !== 'string' || !webviewHostReadiness.host) {
		failWebviewInput('docs/aster-webview-host.json: missing configured host');
	} else {
		checkWebviewBaseHost('docs/aster-webview-host.json: host', webviewHostReadiness.host, { externalForbidden: webviewHostPending });
		if (webviewHostReadiness.host !== productBaseHost) {
			fail(`docs/aster-webview-host.json: host must match product.webviewContentExternalBaseUrlTemplate host ${productBaseHost}`, { external: webviewHostPending });
		}
	}

	if (webviewHostReadiness.assetPath !== webviewPreloadPathTemplate) {
		fail(`docs/aster-webview-host.json: assetPath must be ${webviewPreloadPathTemplate}`);
	}

	if (typeof webviewHostReadiness.template !== 'string' || !webviewHostReadiness.template) {
		failWebviewInput('docs/aster-webview-host.json: missing template');
	} else {
		if (webviewHostReadiness.template !== product.webviewContentExternalBaseUrlTemplate) {
			fail('docs/aster-webview-host.json: template must match product.webviewContentExternalBaseUrlTemplate', { external: webviewHostPending });
		}
		if (typeof webviewHostReadiness.host === 'string' && webviewHostReadiness.template !== `https://{{uuid}}.${webviewHostReadiness.host}${webviewPreloadPathTemplate}`) {
			fail('docs/aster-webview-host.json: template must derive from host and the required webview preload path', { external: webviewHostPending });
		}
	}

	if (typeof webviewHostReadiness.approvedPublicDomain !== 'string' || !webviewHostReadiness.approvedPublicDomain) {
		failWebviewInput('docs/aster-webview-host.json: missing approvedPublicDomain');
	} else {
		checkApprovedPublicDomain('docs/aster-webview-host.json: approvedPublicDomain', webviewHostReadiness.approvedPublicDomain);
		if (typeof webviewHostReadiness.host === 'string' && !isHostUnderDomain(webviewHostReadiness.host, webviewHostReadiness.approvedPublicDomain)) {
			fail('docs/aster-webview-host.json: host must be equal to or under approvedPublicDomain', { external: webviewHostPending });
		}
		if (!Array.isArray(brandClearance.approvedPublicDomains) || !brandClearance.approvedPublicDomains.includes(webviewHostReadiness.approvedPublicDomain)) {
			fail('docs/aster-webview-host.json: approvedPublicDomain must be listed in docs/aster-brand-clearance.json approvedPublicDomains', { external: webviewHostPending || brandClearance.status !== 'cleared' });
		}
	}

	checkOwnerAndDate('docs/aster-webview-host.json', webviewHostReadiness, failWebviewInput);

	for (const key of requiredEvidence) {
		if (!hasEvidence(webviewHostReadiness.evidence?.[key])) {
			failWebviewInput(`docs/aster-webview-host.json: missing evidence.${key}`);
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

	const scannedFiles = [
		'.github/workflows/aster-public-downloads.yml',
		'.github/workflows/aster-linux-installables.yml',
		'scripts/aster/publish-github-release-assets.mjs',
	];

	for (const file of scannedFiles) {
		const content = readText(file);
		const matches = releaseInfraPatterns.filter(({ pattern }) => pattern.test(content)).map(({ label }) => label);
		if (matches.length) {
			failExternal(`${file}: contains inherited Microsoft release infrastructure (${matches.join(', ')})`);
		}
	}
}

function checkReleaseInfrastructureManifest() {
	const releaseInfraPending = releaseInfrastructure.status !== 'configured';
	const failReleaseInput = message => fail(message, { external: releaseInfraPending });
	const requiredInputs = [
		'windowsSigning',
		'appleSigning',
		'linuxPackageSigning',
		'releaseStorage',
		'updateMetadata',
		'serviceConnections',
		'releaseApprovers',
		'distroSource',
		'publisherMetadata',
		'incidentContacts',
	];
	const requiredEvidence = [
		...requiredInputs,
		'dryRunRelease',
		'artifactScanResults',
	];

	if (releaseInfrastructure.status !== 'configured') {
		failReleaseInput(`docs/aster-release-infrastructure.json: status is ${JSON.stringify(releaseInfrastructure.status)}, expected "configured" before public release`);
	}

	if (releaseInfrastructure.releaseInfraConfirmedAllowed !== true) {
		failReleaseInput('docs/aster-release-infrastructure.json: releaseInfraConfirmedAllowed must be true before ASTER_RELEASE_INFRA_CONFIRMED can be used');
	}

	checkOwnerAndDate('docs/aster-release-infrastructure.json', releaseInfrastructure, failReleaseInput);

	for (const key of requiredInputs) {
		if (releaseInfrastructure.ownedInputs?.[key] !== true) {
			failReleaseInput(`docs/aster-release-infrastructure.json: ownedInputs.${key} must be true`);
		}
	}

	for (const key of requiredEvidence) {
		if (!hasEvidence(releaseInfrastructure.evidence?.[key])) {
			failReleaseInput(`docs/aster-release-infrastructure.json: missing evidence.${key}`);
		}
	}
}

function checkReleasePipelineSelectionPolicy() {
	const productBuild = readText('build/azure-pipelines/product-build.yml');
	const productPublish = readText('build/azure-pipelines/product-publish.yml');
	const productRelease = readText('build/azure-pipelines/product-release.yml');
	const publicReleaseScript = readText('scripts/aster/publish-github-release-assets.mjs');
	const publicDownloadsWorkflow = readText('.github/workflows/aster-public-downloads.yml');
	const linuxInstallablesWorkflow = readText('.github/workflows/aster-linux-installables.yml');

	if (!/- name: VSCODE_PUBLISH\s+displayName: "Publish release artifacts"\s+type: boolean\s+default: false/m.test(productBuild)) {
		fail('build/azure-pipelines/product-build.yml: VSCODE_PUBLISH must default to false for Aster until release infrastructure is owned');
	}

	if (!/- name: ASTER_RELEASE_INFRA_CONFIRMED\s+displayName: "Aster release infrastructure confirmed"\s+type: boolean\s+default: false/m.test(productBuild)) {
		fail('build/azure-pipelines/product-build.yml: missing default-false ASTER_RELEASE_INFRA_CONFIRMED parameter');
	}

	if (!/value: \$\{\{ and\(eq\(parameters\.VSCODE_PUBLISH, true\), eq\(parameters\.ASTER_RELEASE_INFRA_CONFIRMED, true\), eq\(variables\.VSCODE_CIBUILD, false\)\) \}\}/.test(productBuild)) {
		fail('build/azure-pipelines/product-build.yml: VSCODE_PUBLISH variable must require ASTER_RELEASE_INFRA_CONFIRMED');
	}

	if (!/template: build\/azure-pipelines\/product-publish\.yml@self[\s\S]*ASTER_RELEASE_INFRA_CONFIRMED: \$\{\{ parameters\.ASTER_RELEASE_INFRA_CONFIRMED \}\}/.test(productBuild)) {
		fail('build/azure-pipelines/product-build.yml: product-publish.yml invocation must pass ASTER_RELEASE_INFRA_CONFIRMED');
	}

	if (!/template: build\/azure-pipelines\/product-release\.yml@self[\s\S]*ASTER_RELEASE_INFRA_CONFIRMED: \$\{\{ parameters\.ASTER_RELEASE_INFRA_CONFIRMED \}\}/.test(productBuild)) {
		fail('build/azure-pipelines/product-build.yml: product-release.yml invocation must pass ASTER_RELEASE_INFRA_CONFIRMED');
	}

	if (!/- name: ASTER_RELEASE_INFRA_CONFIRMED\s+type: boolean\s+default: false/.test(productPublish) || !/displayName: Block inherited publish path/.test(productPublish)) {
		fail('build/azure-pipelines/product-publish.yml: direct template use must fail fast without ASTER_RELEASE_INFRA_CONFIRMED');
	}

	if (!/- name: ASTER_RELEASE_INFRA_CONFIRMED\s+type: boolean\s+default: false/.test(productRelease) || !/displayName: Block inherited release path/.test(productRelease)) {
		fail('build/azure-pipelines/product-release.yml: direct template use must fail fast without ASTER_RELEASE_INFRA_CONFIRMED');
	}

	if (!/gh run download "\$RUN_ID"/.test(publicDownloadsWorkflow) || !/scripts\/aster\/publish-github-release-assets\.mjs/.test(publicDownloadsWorkflow)) {
		fail('.github/workflows/aster-public-downloads.yml: must download GitHub Actions artifacts and invoke the shared GitHub release asset publisher');
	}

	if (!/vscode-linux-\$\{VSCODE_ARCH\}-min-ci/.test(linuxInstallablesWorkflow) || !/vscode-linux-\$\{VSCODE_ARCH\}-build-deb/.test(linuxInstallablesWorkflow) || !/vscode-linux-\$\{VSCODE_ARCH\}-build-rpm/.test(linuxInstallablesWorkflow)) {
		fail('.github/workflows/aster-linux-installables.yml: must build Linux archive, deb, and rpm installables');
	}

	if (!/aster:check-release-artifacts/.test(linuxInstallablesWorkflow) || !/vscode_client_linux_x64_installables/.test(linuxInstallablesWorkflow) || !/scripts\/aster\/publish-github-release-assets\.mjs/.test(linuxInstallablesWorkflow)) {
		fail('.github/workflows/aster-linux-installables.yml: must scan, upload, and optionally publish Linux installables');
	}

	const vscodeGulpfile = readText('build/gulpfile.vscode.ts');
	if (!/VSCODE_DISABLE_CDN_SOURCE_MAPS/.test(vscodeGulpfile) || countOccurrences(vscodeGulpfile, 'useCdnSourceMapsForPackagingTasks ? `${sourceMappingURLBase}/core` : undefined') < 3) {
		fail('build/gulpfile.vscode.ts: public artifact builds must be able to disable Microsoft CDN source map links for desktop, server, and web bundles');
	}

	if (!/releases\/tags/.test(publicReleaseScript) || !/releases\/assets/.test(publicReleaseScript) || !/\.sha1/.test(publicReleaseScript) || !/\.sha256/.test(publicReleaseScript) || !/aster-release-assets\.json/.test(publicReleaseScript)) {
		fail('scripts/aster/publish-github-release-assets.mjs: must create or reuse GitHub Releases and upload assets with checksum sidecars and a release asset manifest');
	}

	if (!/## Downloads/.test(publicReleaseScript) || !/getAssetDownloadUrl/.test(publicReleaseScript)) {
		fail('scripts/aster/publish-github-release-assets.mjs: must write public download links into the GitHub Release notes');
	}
}

function checkBrandClearancePolicy() {
	const brandClearancePending = brandClearance.status !== 'cleared';
	const failBrandInput = message => fail(message, { external: brandClearancePending });
	const requiredApprovals = [
		'trademarkReview',
		'productNames',
		'commandAndPackageNames',
		'publicDomains',
		'originalIconAssets',
		'storeMetadata',
		'vsCodeCompatibilityWording',
		'upstreamAttribution',
	];

	if (brandClearance.status !== 'cleared') {
		failBrandInput(`docs/aster-brand-clearance.json: brand clearance status is ${JSON.stringify(brandClearance.status)}, expected "cleared" before public release`);
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(brandClearance.clearedOn ?? '')) {
		failBrandInput('docs/aster-brand-clearance.json: missing clearedOn date in YYYY-MM-DD format');
	} else if (!isValidIsoDate(brandClearance.clearedOn)) {
		fail('docs/aster-brand-clearance.json: clearedOn must be a valid calendar date');
	}

	if (typeof brandClearance.decisionOwner !== 'string' || !brandClearance.decisionOwner || /pending|todo|tbd/i.test(brandClearance.decisionOwner)) {
		failBrandInput('docs/aster-brand-clearance.json: missing non-placeholder decisionOwner');
	}

	if (!Array.isArray(brandClearance.approvedPublicDomains) || brandClearance.approvedPublicDomains.length === 0) {
		failBrandInput('docs/aster-brand-clearance.json: approvedPublicDomains must list secured Aster-owned public domains');
	} else {
		for (const [index, domain] of brandClearance.approvedPublicDomains.entries()) {
			checkApprovedPublicDomain(`docs/aster-brand-clearance.json: approvedPublicDomains[${index}]`, domain);
		}
	}

	for (const approval of requiredApprovals) {
		if (brandClearance.approvals?.[approval] !== true) {
			failBrandInput(`docs/aster-brand-clearance.json: missing approval ${approval}`);
		} else if (!hasApprovalEvidence(approval)) {
			fail(`docs/aster-brand-clearance.json: missing approvalEvidence.${approval}`);
		}
	}

	const approvedProductNames = brandClearance.approvedProductNames ?? {};
	for (const key of ['nameShort', 'nameLong', 'applicationName', 'serverApplicationName', 'tunnelApplicationName', 'win32DirName', 'win32NameVersion', 'win32RegValueName', 'win32AppUserModelId', 'darwinBundleIdentifier', 'linuxIconName', 'urlProtocol']) {
		if (approvedProductNames[key] !== product[key]) {
			fail(`docs/aster-brand-clearance.json: approvedProductNames.${key} must match product.${key}`);
		}
	}

	const approvedAsterAiExtension = brandClearance.approvedAsterAiExtension ?? {};
	for (const key of ['name', 'displayName', 'publisher', 'description']) {
		if (approvedAsterAiExtension[key] !== asterAiExtension[key]) {
			fail(`docs/aster-brand-clearance.json: approvedAsterAiExtension.${key} must match extensions/copilot/package.json ${key}`);
		}
	}
}

function checkApprovedPublicDomain(label, domain) {
	if (typeof domain !== 'string' || !domain) {
		fail(`${label}: expected a public DNS domain`);
		return;
	}
	if (domain !== domain.trim() || domain.startsWith('*.')) {
		fail(`${label}: expected a bare secured domain, found ${JSON.stringify(domain)}`);
		return;
	}
	checkWebviewBaseHost(label, domain);
	if (/(?:^|\.)example\.(?:com|org|net)$/i.test(domain) || /(?:^|\.)microsoft\.com$|(?:^|\.)visualstudio\.com$|(?:^|\.)vscode\.dev$|(?:^|\.)github\.io$/i.test(domain)) {
		fail(`${label}: expected an Aster-owned public domain, found ${JSON.stringify(domain)}`);
	}
}

function hasApprovalEvidence(approval) {
	return hasEvidence(brandClearance.approvalEvidence?.[approval]);
}

function hasEvidence(evidence) {
	return Array.isArray(evidence) && evidence.some(item => typeof item === 'string' && item.trim() && !/pending|todo|tbd/i.test(item));
}

function checkOwnerAndDate(file, manifest, failInput) {
	if (typeof manifest.decisionOwner !== 'string' || !manifest.decisionOwner || /pending|todo|tbd/i.test(manifest.decisionOwner)) {
		failInput(`${file}: missing non-placeholder decisionOwner`);
	}

	if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.configuredOn ?? '')) {
		failInput(`${file}: missing configuredOn date in YYYY-MM-DD format`);
	} else if (!isValidIsoDate(manifest.configuredOn)) {
		fail(`${file}: configuredOn must be a valid calendar date`);
	}
}

function isValidIsoDate(value) {
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year
		&& date.getUTCMonth() === month - 1
		&& date.getUTCDate() === day;
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
