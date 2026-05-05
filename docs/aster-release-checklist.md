# Aster Release Readiness Checklist

This checklist tracks release-facing productization items that cannot be validated by ordinary compile and hygiene checks.

## Blocking Before Public Release

- Replace the placeholder webview asset host.
  `product.webviewContentExternalBaseUrlTemplate`, `webviewResourceBaseHost`, browser fallback CSP, and server CSP currently use the placeholder `aster-webview.invalid`. Pick an Aster-controlled HTTPS wildcard host, publish the webview preload assets for every released commit and quality, and update `scripts/aster/check-release-readiness.mjs` to require that approved host.

- Decide the bundled Microsoft-authored extension policy.
  `product.json` still bundles `ms-vscode.js-debug-companion`, `ms-vscode.js-debug`, and `ms-vscode.vscode-js-profile-table` with Microsoft publisher metadata. Either get an explicit legal/product approval to ship them unchanged, replace them with approved alternatives, or remove the metadata/bundle entries. The compliance check should encode the chosen policy instead of broadly banning all Microsoft copyright or dependency references.

- Replace Microsoft-owned signing and release credentials.
  The Azure release pipeline still references Microsoft ESRP, Azure subscriptions, Key Vaults, publisher names, release owners, and VS Code release metadata. Aster needs its own Windows code-signing certificate, Apple Developer Team ID/certificates/profiles/notarization credentials, Linux package signing keys, publishing storage, release approvers, and service connections before signed installers can be produced.

- Complete trademark and name clearance.
  `Aster` is a working name only. Public release needs trademark clearance, approved product names for app/package/store metadata, original icon assets, domain and website decisions, and legal review of any remaining "VS Code" compatibility wording.

- Finish the namespace rebrand policy.
  The Aster AI extension manifest is rebranded, but command IDs, settings keys, context keys, storage keys, telemetry event names, and compatibility strings still use `github.copilot`/`copilot` namespaces. Decide which IDs must remain for migration compatibility, which need Aster aliases, and which can be renamed before release.

## Guardrails To Keep Green

- `npm run aster:check-runtime-assets` should stay fast and focused on runtime asset endpoints.
- `npm run aster:check-compliance` should cover release-facing branding, product metadata, gallery configuration, hosted service endpoints, and known user-visible prompt surfaces.
- `npm run aster:check-release-readiness` should fail while placeholder webview hosts remain. Extend it as signing, publishing, and artifact-hosting inputs move into Aster-owned configuration.
- Run the Aster checks in CI before compile-heavy jobs so productization regressions fail quickly.

## Pitfalls

- Do not treat copyright headers, copied upstream source comments, dependency names, or developer-only scripts as release branding failures.
- Do not replace all `github.copilot.*` identifiers mechanically; many are persisted IDs or compatibility surfaces and need aliases or migrations.
- Do not ship `.invalid` or localhost-like hosts as a "self-hosted" answer. The release scan must require a production Aster-owned host.
- Do not rely on source scans alone. The final release scan should also run against packaged desktop, server, web, and extension artifacts.
