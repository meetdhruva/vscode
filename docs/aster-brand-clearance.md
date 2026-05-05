# Aster Brand Clearance

`Aster` is a working name until legal/product review clears it for public release.

Release readiness reads `docs/aster-brand-clearance.json` and fails until the manifest is updated with real clearance evidence. The manifest must not be changed to `cleared` until all required approvals are true and the approved product names match `product.json`.

## Required Evidence

- Trademark review for `Aster`, `Aster Editor`, command-line names, package names, and store-facing names.
- Secured public domains and website URLs.
- Original icon and brand assets for desktop, server, web, package managers, and stores.
- Store/package metadata approval.
- Review of public wording around VS Code compatibility.
- Upstream attribution review.
- Named decision owner and clearance date.

## Manifest Rules

- `status` must stay `pending` until clearance is complete.
- `approvedPublicDomains` must list secured Aster-owned domains.
- `approvedProductNames` must match `product.json`.
- `approvedAsterAiExtension` must match `extensions/copilot/package.json`.
- Every `approvals` entry must be `true`.
- `decisionOwner` and `clearedOn` must refer to the real decision, not a placeholder.
