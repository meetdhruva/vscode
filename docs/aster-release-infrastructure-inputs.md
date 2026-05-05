# Aster Release Infrastructure Inputs

This document lists the external inputs required before Aster can produce public signed builds. It is not a substitute for credentials or service ownership; it exists so the release pipeline cannot silently inherit Microsoft infrastructure.

## Required Ownership

- Windows code-signing certificate and timestamping policy owned by Aster.
- Apple Developer Team ID, Developer ID Application certificate, installer certificate, provisioning profiles if needed, notarization credentials, and app-specific passwords or API keys owned by Aster.
- Linux package-signing keys for Debian, RPM, archive, and update repository metadata.
- Release storage buckets or object containers for installers, archives, symbols, checksums, update metadata, and webview preload assets.
- CI service connections with least-privilege access to signing, storage, package repositories, and release approval systems.
- Release approver group and incident/contact ownership outside Microsoft domains.
- Distro source or replacement plan for any private mixins previously provided by `microsoft/vscode-distro`.
- Public publisher metadata for product names, descriptions, support URLs, and store/package manager identities.

## Guardrail Scope

`npm run aster:check-release-readiness` scans `build/azure-pipelines` release files for inherited Microsoft-owned release infrastructure, including:

- ESRP signing or release service references.
- Microsoft Key Vault names and ESRP secret names.
- Microsoft identity authority and release owner email domains.
- Microsoft download endpoints.
- `microsoft/vscode-distro` references.
- VS Code release metadata and Microsoft signing owner metadata.

The check is expected to fail until these references are replaced with Aster-owned infrastructure. A passing source scan is necessary but not sufficient for a public release; final release validation must also inspect packaged desktop, server, web, and extension artifacts.

## Pipeline Gate

The inherited Azure product pipeline defaults release publishing off for Aster. `build/azure-pipelines/product-build.yml` requires both `VSCODE_PUBLISH: true` and `ASTER_RELEASE_INFRA_CONFIRMED: true` before the publish stage can be selected. `build/azure-pipelines/product-publish.yml` and `build/azure-pipelines/product-release.yml` also fail early when invoked directly without `ASTER_RELEASE_INFRA_CONFIRMED: true`.

This gate is a safety interlock only. Do not set it to true until the ownership inputs above are real, tested, and documented.

## Replacement Pattern

When the real infrastructure exists, replace inherited references with Aster-owned names and credentials rather than masking failures. Use descriptive environment variables and service connections such as:

- `ASTER_WINDOWS_SIGNING_CERTIFICATE`
- `ASTER_APPLE_TEAM_ID`
- `ASTER_APPLE_NOTARIZATION_KEY_ID`
- `ASTER_LINUX_PACKAGE_SIGNING_KEY`
- `ASTER_RELEASE_STORAGE_ACCOUNT`
- `ASTER_RELEASE_APPROVERS`
- `ASTER_DISTRO_SOURCE`

Do not add placeholder credentials, fake hostnames, or broad allowlists to make release-readiness pass. The release gate should only pass when the repository points at real Aster-owned infrastructure and the external systems are configured.
