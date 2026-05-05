# Aster Bundled Extension Policy

## Decision

Aster does not bundle Microsoft-authored marketplace extensions by default.

The initial Aster product metadata removes these inherited built-in extension entries:

- `ms-vscode.js-debug-companion`
- `ms-vscode.js-debug`
- `ms-vscode.vscode-js-profile-table`

This avoids shipping Microsoft-authored marketplace artifacts and publisher metadata without an explicit Aster legal/product approval. The product keeps `builtInExtensions` as an explicit empty array because build and packaging scripts iterate that field directly.

The tradeoff is that JavaScript and Node debugging helpers, npm debug CodeLens/actions, auto attach, and JavaScript profile table support are no longer bundled by default. Users can still install compatible debugging and profiling extensions from the configured extension gallery when those extensions are available and appropriate for their use.

## Future Exceptions

Any future Microsoft-authored built-in extension must have an explicit approval before it can be added to `product.json`.

The approval must be pinned in `scripts/aster/check-release-readiness.mjs` with:

- extension name
- version
- SHA-256
- repository URL
- decision owner
- review date
- reason

Changing any of those pinned artifact fields requires a fresh review. The release-readiness check fails when a Microsoft-authored built-in extension appears without a matching approval.

## Build Behavior

The built-in extension download and packaging flow reads `product.builtInExtensions` and `product.webBuiltInExtensions` directly. An empty `product.builtInExtensions` list is valid: the downloader has no desktop marketplace extensions to fetch, still creates `.build/builtInExtensions` for cache and packaging tasks, the package stream has no desktop marketplace extensions to include, and the built-in dependency cache key is computed from an empty list.
