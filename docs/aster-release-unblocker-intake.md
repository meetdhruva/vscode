# Aster Release Unblocker Intake

Use this intake when collecting the external decisions required before Aster can publish signed public builds. Do not paste private keys, passwords, tokens, certificates, or app-specific secrets into this repository. Record durable references to secured systems, approval tickets, storage locations, probe output, and release evidence instead.

`npm run aster:check-release-readiness` must keep failing until every section below is complete and the corresponding manifest is updated.

## Webview Asset Host

Owner: issue #26, `docs/aster-webview-host.json`

Required inputs:

- Aster-owned public domain approved in `docs/aster-brand-clearance.json`.
- Bare webview host suffix, for example `<webview-assets.example.org>`, without wildcard or protocol.
- Production template in the exact form `https://{{uuid}}.<host>/{{quality}}/{{commit}}/out/vs/workbench/contrib/webview/browser/pre/`.
- Wildcard DNS evidence for `*.<host>`.
- Wildcard TLS evidence for `*.<host>`.
- Asset deployment evidence for each released `quality` and `commit`.
- CSP coverage evidence for `https://*.<host>`.
- Probe result from `npm run aster:probe-webview-host -- --host <host> --quality <quality> --commit <commit> --uuid <test-uuid>`.
- Artifact scan result from `npm run aster:check-release-artifacts -- <unpacked artifact paths...>`.

Repository updates after inputs are real:

- Replace `aster-webview.invalid` in `product.webviewContentExternalBaseUrlTemplate`.
- Replace central fallback values in `src/vs/base/common/asterWebviewDefaults.ts`.
- Set `docs/aster-webview-host.json` to `configured` with owner, date, host, template, approved domain, and evidence.

## Release Infrastructure

Owner: issue #27, `docs/aster-release-infrastructure.json`

Required inputs:

- Windows code-signing certificate ownership and timestamping policy.
- Apple Developer Team ID, Developer ID certificates, installer certificate, notarization credentials, and profiles if needed.
- Linux package-signing keys for Debian, RPM, archives, and update repository metadata.
- Release storage for installers, archives, symbols, checksums, update metadata, and webview preload assets.
- GitHub Release download repository, tag policy, and `ASTER_GITHUB_RELEASE_TOKEN` secret ownership for GitHub Actions public downloads when the default `GITHUB_TOKEN` is not sufficient.
- CI service connections with least-privilege access to signing, storage, package repositories, and approvals.
- Release approver group and incident contacts outside Microsoft domains.
- Distro source decision or replacement plan for inherited `microsoft/vscode-distro` usage.
- Public publisher metadata for package managers, stores, update services, and support URLs.
- Production-equivalent dry-run release evidence.
- Artifact scan evidence over unpacked desktop, server, web, and extension outputs.

Repository updates after inputs are real:

- Keep Microsoft ESRP, Key Vault, storage, identity, release owner, and distro references out of Aster GitHub Actions release workflows and scripts.
- Configure the GitHub Actions release repository/tag workflow inputs and the secret `ASTER_GITHUB_RELEASE_TOKEN` for public release downloads when the default `GITHUB_TOKEN` is not sufficient.
- Set every `ownedInputs` flag in `docs/aster-release-infrastructure.json` to `true` with matching evidence.
- Set `status` to `configured` and `releaseInfraConfirmedAllowed` to `true` only after the strict release-readiness check passes.

## Brand And Legal Clearance

Owner: issue #28, `docs/aster-brand-clearance.json`

Required inputs:

- Trademark review for `Aster`, `Aster Editor`, command-line names, package names, and store-facing names.
- Approved public domains and website URLs.
- Original icon and brand assets for desktop, server, web, package managers, and stores.
- Approved store/package metadata.
- Approved VS Code compatibility wording.
- Approved upstream attribution wording.
- Named decision owner and clearance date.

Repository updates after inputs are real:

- Update `docs/aster-brand-clearance.json` with approved domains, owner, date, true approval flags, and evidence references.
- Ensure approved names match `product.json`.
- Ensure approved Aster AI extension metadata matches `extensions/copilot/package.json`.

## Final Verification

After all manifests are configured:

```sh
npm run aster:check-byok-activation
npm run aster:check-compliance
npm run aster:check-runtime-assets
npm run aster:check-release-readiness
npm run aster:check-release-artifacts -- <unpacked artifact paths...>
```

Only close issues #26, #27, and #28 after these commands pass with real evidence and no release-blocking placeholders.
