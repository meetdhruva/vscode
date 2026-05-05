# Aster Release Readiness Checklist

This checklist tracks release-facing productization items that cannot be validated by ordinary compile and hygiene checks.

## Blocking Before Public Release

- Replace the placeholder webview asset host.
  `product.webviewContentExternalBaseUrlTemplate` and the centralized TypeScript defaults in `src/vs/base/common/asterWebviewDefaults.ts` currently use the placeholder `aster-webview.invalid`. Pick an Aster-controlled HTTPS wildcard host, publish the webview preload assets for every released commit and quality, then update product metadata and the central defaults. The production template must keep the exact `https://{{uuid}}.<host>/{{quality}}/{{commit}}/out/vs/workbench/contrib/webview/browser/pre/` shape so each webview gets an isolated origin and each released build can load matching assets. The host must have production DNS/TLS and CSP coverage for `https://*.<host>` and must not be `.invalid`, localhost-like, VS Code CDN, Microsoft Azure storage, or Visual Studio Marketplace asset infrastructure. Use [Aster Webview Host Readiness](./aster-webview-host-readiness.md) as the deployment and validation checklist.

  Keep webview placeholder and fallback values centralized in the two intentional places: `product.json` for the product asset template and `src/vs/base/common/asterWebviewDefaults.ts` for runtime fallback/CSP constants. The workbench webview host, browser fallback URL, and server CSP should derive from those defaults instead of introducing new literal hosts. If another runtime surface needs the webview host, add it through the central defaults and extend `scripts/aster/check-release-readiness.mjs` to scan that surface.

- Replace Microsoft-owned signing and release credentials.
  The Azure release pipeline still references Microsoft ESRP, Azure subscriptions, Key Vaults, publisher names, release owners, distro mixins, and VS Code release metadata. Aster needs its own Windows code-signing certificate, Apple Developer Team ID/certificates/profiles/notarization credentials, Linux package signing keys, publishing storage, release approvers, distro source or replacement plan, and service connections before signed installers can be produced. The release-readiness check scans release pipeline files for inherited Microsoft release infrastructure and should keep failing until those inputs are replaced with Aster-owned infrastructure. Use [Aster Release Infrastructure Inputs](./aster-release-infrastructure-inputs.md) as the implementation checklist.

- Complete trademark and name clearance.
  `Aster` is a working name only. Public release needs trademark clearance, approved product names for app/package/store metadata, original icon assets, domain and website decisions, and legal review of any remaining "VS Code" compatibility wording. Use [Aster Brand Clearance](./aster-brand-clearance.md) and `docs/aster-brand-clearance.json` as the release-blocking evidence manifest.

- Apply the namespace rebrand policy.
  The Aster AI extension manifest is rebranded, but command IDs, settings keys, context keys, storage keys, telemetry event names, and compatibility strings still use `github.copilot`/`copilot` namespaces. Use [Aster Namespace Policy](./aster-namespace-policy.md) to decide which IDs must remain for migration compatibility, which need Aster aliases, and which can be renamed before release.

## Resolved Product Policies

- Microsoft-authored marketplace extensions are not bundled by default.
  Aster removed `ms-vscode.js-debug-companion`, `ms-vscode.js-debug`, and `ms-vscode.vscode-js-profile-table` from `product.json` instead of shipping them without approval. See [Aster Bundled Extension Policy](./aster-bundled-extension-policy.md). Future exceptions must be explicitly approved and pinned to the exact extension name, version, SHA-256, and repository URL in the release-readiness check.

## Guardrails To Keep Green

- `npm run aster:check-runtime-assets` should stay fast and focused on runtime asset endpoints.
- `npm run aster:check-compliance` should cover release-facing branding, product metadata, gallery configuration, hosted service endpoints, and known user-visible prompt surfaces.
- `npm run aster:probe-webview-host -- --host <host> --quality <quality> --commit <commit> --uuid <test-uuid>` should pass against the release webview host before replacing the placeholder.
- `npm run aster:check-release-artifacts -- <unpacked artifact paths...>` should run against unpacked desktop, server, web, and extension artifacts before publishing. Use `--include-source-maps` when source maps are shipped.
- Publishing builds should run `build/azure-pipelines/common/aster-release-artifact-scan.yml` after desktop/server/web artifacts are assembled and before artifact publication. The step is gated by `VSCODE_PUBLISH` so ordinary non-publish product builds do not fail on release-only external inputs.
- `npm run aster:check-release-readiness` should fail while placeholder webview hosts remain, brand clearance is pending, unapproved Microsoft-authored built-in extensions are present, artifact-scan pipeline hooks are missing, or inherited Microsoft release/signing infrastructure remains wired into release pipeline files.
- Run the Aster checks in CI before compile-heavy jobs so productization regressions fail quickly.

## Pitfalls

- Do not treat copyright headers, copied upstream source comments, dependency names, or developer-only scripts as release branding failures.
- Do not replace all `github.copilot.*` identifiers mechanically; many are persisted IDs or compatibility surfaces and need aliases or migrations.
- Do not ship `.invalid` or localhost-like hosts as a "self-hosted" answer. The release scan must require a production Aster-owned host.
- Do not rely on source scans alone. The final release scan must run against unpacked desktop, server, web, and extension artifacts.
