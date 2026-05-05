# Aster Public Downloads

This repo uses GitHub Releases as the first public download surface for built installables.

## VSCodium Pattern Reviewed

VSCodium builds platform artifacts in GitHub Actions and publishes the final files to GitHub Releases:

- Per-platform workflows such as [`publish-stable-linux.yml`](https://github.com/VSCodium/vscodium/blob/master/.github/workflows/publish-stable-linux.yml), [`publish-stable-windows.yml`](https://github.com/VSCodium/vscodium/blob/master/.github/workflows/publish-stable-windows.yml), and [`publish-stable-macos.yml`](https://github.com/VSCodium/vscodium/blob/master/.github/workflows/publish-stable-macos.yml) build and prepare `assets/`.
- [`release.sh`](https://github.com/VSCodium/vscodium/blob/master/release.sh) creates the GitHub Release when needed and uploads each file plus `.sha1` and `.sha256` checksum sidecars.
- Public users download installers and archives from [`VSCodium/vscodium` releases](https://github.com/VSCodium/vscodium/releases).

Aster keeps the existing Azure product-build pipeline instead of copying VSCodium's full build orchestration. The shared idea is the public delivery surface: release-ready CI artifacts become GitHub Release assets with checksum sidecars.

## Pipeline Flow

`build/azure-pipelines/product-build.yml` has an opt-in `PublicDownloads` stage controlled by:

- `ASTER_PUBLIC_GITHUB_RELEASE: true`
- `ASTER_GITHUB_RELEASE_REPOSITORY: <owner>/<repo>`
- `ASTER_GITHUB_RELEASE_TAG: <tag>` or a tag build / generated fallback
- `ASTER_GITHUB_RELEASE_NAME: <optional display name>`

The stage runs `build/azure-pipelines/common/publish-github-release-assets.yml`, which downloads `vscode_*` pipeline artifacts from the current build and runs `build/azure-pipelines/common/publish-github-release-assets.mjs`.

For GitHub-hosted artifacts, `.github/workflows/aster-public-downloads.yml` provides a manual VSCodium-style path: give it a workflow `run_id`, `artifact_pattern`, release repository, and release tag, and it downloads matching artifacts with `gh run download` before invoking the same publisher script.

For a self-contained GitHub build, `.github/workflows/aster-linux-installables.yml` builds Linux x64 archive, deb, and rpm installables, scans the unpacked app with `npm run aster:check-release-artifacts`, uploads a `vscode_client_linux_x64_installables` workflow artifact, and can publish the same files to a GitHub Release in one run.

The publisher creates or reuses the GitHub Release, uploads releasable files, adds checksum sidecars, updates the release notes with direct download links, and uploads `aster-release-assets.json` for programmatic consumers:

- Windows: `.exe`, `.msi`, `.zip`
- macOS: `.dmg`, `.zip`
- Linux: `.deb`, `.rpm`, `.snap`, `.tar.gz`, `.tar.xz`, `.zip`, AppImage
- Server, web, and CLI archives already emitted as `vscode_*` pipeline artifacts

## Required Secret

Configure `ASTER_GITHUB_RELEASE_TOKEN` as a secret Azure Pipeline variable. It must have `contents:write` access to `ASTER_GITHUB_RELEASE_REPOSITORY`.

For the manual GitHub Actions workflow, configure a repository secret named `ASTER_GITHUB_RELEASE_TOKEN` when publishing to a different repository or when the default `GITHUB_TOKEN` permissions are insufficient. Publishing to the same repository can use the workflow's `contents:write` permission.

Do not store the token in the repository. Record the credential owner and rotation evidence in `docs/aster-release-infrastructure.json` under `serviceConnections` and `releaseStorage` when release infrastructure is configured.

## Release Gates

Public GitHub release upload is separate from the inherited Microsoft publish path:

- `ASTER_PUBLIC_GITHUB_RELEASE` controls GitHub Release downloads.
- `VSCODE_PUBLISH` controls the inherited product publish stage.
- `VSCODE_PUBLISH` requires `ASTER_RELEASE_INFRA_CONFIRMED`; `ASTER_PUBLIC_GITHUB_RELEASE` does not, because it publishes the CI artifacts that already exist in the current build rather than invoking the inherited Microsoft publish service.
- `build/azure-pipelines/common/aster-release-artifact-scan.yml` runs before either path can publish public artifacts.
- GitHub Linux installable builds set `VSCODE_DISABLE_CDN_SOURCE_MAPS=1` so packaged JavaScript does not point public Aster artifacts at Microsoft's source map CDN.

The release-readiness guardrail should keep failing until Aster-owned signing, package, storage, and approval systems replace inherited Microsoft infrastructure. GitHub Release uploads solve public artifact download, not code signing, package repository metadata, update services, or store publishing by themselves.
