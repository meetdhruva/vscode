# Aster Webview Host Readiness

This document captures the deployment checks required before replacing `aster-webview.invalid`.

## Required Shape

`product.webviewContentExternalBaseUrlTemplate` must use this exact structure:

```text
https://{{uuid}}.<host>/{{quality}}/{{commit}}/out/vs/workbench/contrib/webview/browser/pre/
```

The `{{uuid}}` token must be the leftmost host label. The `{{quality}}` and `{{commit}}` tokens must stay in the path before the webview preload asset directory. The URL must not include a query string or fragment.

## Host Requirements

- Aster-controlled public DNS suffix.
- Wildcard DNS and TLS for `*.<host>`.
- Production asset hosting for each released `quality` and `commit`.
- CSP coverage for `https://*.<host>`.
- No `.invalid`, localhost-like, VS Code CDN, Microsoft Azure storage, or Visual Studio Marketplace asset infrastructure.

## Asset Probe

After DNS, TLS, and publishing are configured, verify the release commit with a test UUID subdomain:

```text
https://<test-uuid>.<host>/<quality>/<commit>/out/vs/workbench/contrib/webview/browser/pre/index.html
https://<test-uuid>.<host>/<quality>/<commit>/out/vs/workbench/contrib/webview/browser/pre/fake.html
https://<test-uuid>.<host>/<quality>/<commit>/out/vs/workbench/contrib/webview/browser/pre/service-worker.js
```

Each URL must return the assets for the exact commit being released. Packaged desktop, server, web, and extension artifacts should then be scanned with `npm run aster:check-release-artifacts -- <unpacked artifact paths...>` for `aster-webview.invalid`, `vscode-cdn.net`, `web.core.windows.net`, `gallerycdn.vsassets.io`, and `vscode-unpkg.net`.
