# Aster AI Provider MVP

This fork is being shaped as Aster Editor: a Code - OSS based editor with provider-neutral AI features. The first MVP is intentionally narrow: make OpenAI-compatible bring-your-own-key chat available without requiring a GitHub Copilot subscription or entitlement.

## Working Brand

`Aster` is the working product name. It is short, code-adjacent, and fits the same noun/symbol category as Cursor. It points to `AST` as in Abstract Syntax Tree and to `*` as a common programming wildcard/operator symbol.

Names rejected during the initial conflict check:

- `Caret`: existing editor and AI products.
- `Glyph`: existing local AI assistant/editor-adjacent products.
- `Quill`: existing editor and AI products.
- `Token`: existing code editor.
- `Hone`: existing AI code editor.
- `Kern`: existing AI/security/developer tools.
- `Codara`: existing AI-native software development platform.
- `Locus`: existing AI extension/engineering-tool conflicts found during the subagent branding pass.

This is not a trademark clearance. Final branding still needs a dedicated legal/trademark review, original icon assets, package metadata review, and public-facing website/domain decisions. Release-facing blockers are tracked in [Aster Release Readiness Checklist](./aster-release-checklist.md), and inherited Copilot identifiers are governed by [Aster Namespace Policy](./aster-namespace-policy.md).

## Trunk-Based Delivery

`main` is the only long-lived development branch. Work should land through short-lived branches named `tb/<issue-number>-<short-slug>`, rebased on `main`, and squash-merged after focused verification.

Initial GitHub milestone:

- `MVP: Provider-neutral AI chat`

Initial issues:

- `#1` Research and select fork brand name.
- `#2` MVP: Copilot-free OpenAI-compatible chat.
- `#3` Configure fork distribution for Open VSX.

## MVP Scope

Included:

- Register BYOK language model providers without requiring a GitHub Copilot token.
- Expose the existing `customoai` OpenAI-compatible provider in stable builds.
- Document user-facing BYOK setup for OpenAI, OpenAI-compatible endpoints, Ollama, Azure, Anthropic, Gemini, xAI, and OpenRouter in [Aster BYOK Setup](./aster-byok-setup.md).
- Keep the known-models CDN fetch best-effort so local/custom providers can still register when the fetch fails.
- Configure Open VSX as the default extension gallery.
- Stop auto-enabling `GitHub.copilot-chat` from product metadata.
- Apply first-pass Aster product identity metadata in `product.json`.
- Add an off-by-default Aster inline completion provider backed by configured BYOK language models through the VS Code Language Model API.
- Document namespace compatibility and migration rules in [Aster Namespace Policy](./aster-namespace-policy.md).

Not included yet:

- Full Copilot Chat rebrand across commands, views, localization, telemetry event names, and settings.
- Full agent/tool-call conformance tests against mock OpenAI-compatible providers.
- Replacement of all Microsoft-hosted service URLs and bundled Microsoft extension metadata.
- Final trademark, icon, installer, signing, and release packaging work.

## Verification For This Slice

Run from the repository root:

```bash
npm --prefix extensions/copilot run compile
./extensions/copilot/node_modules/.bin/tsc --noEmit --project extensions/copilot/tsconfig.json
node -e "JSON.parse(require('fs').readFileSync('product.json','utf8')); console.log('product.json valid')"
git diff --check
```

The upstream `npm --prefix extensions/copilot run typecheck` script currently invokes `npx tsgo`. In this environment, npm cannot resolve a `tsgo` package from the public registry, so the local `tsc` command above is the fallback check for this MVP branch.
