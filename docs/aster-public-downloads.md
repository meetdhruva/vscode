# Aster Public Downloads

This repo uses GitHub Releases as the first public download surface for built installables.

## VSCodium Pattern Reviewed

VSCodium builds platform artifacts in GitHub Actions and publishes the final files to GitHub Releases:

- Per-platform workflows such as [`publish-stable-linux.yml`](https://github.com/VSCodium/vscodium/blob/master/.github/workflows/publish-stable-linux.yml), [`publish-stable-windows.yml`](https://github.com/VSCodium/vscodium/blob/master/.github/workflows/publish-stable-windows.yml), and [`publish-stable-macos.yml`](https://github.com/VSCodium/vscodium/blob/master/.github/workflows/publish-stable-macos.yml) build and prepare `assets/`.
- [`release.sh`](https://github.com/VSCodium/vscodium/blob/master/release.sh) creates the GitHub Release when needed and uploads each file plus `.sha1` and `.sha256` checksum sidecars.
- Public users download installers and archives from [`VSCodium/vscodium` releases](https://github.com/VSCodium/vscodium/releases).

Aster uses GitHub-hosted Actions for this public download path. There is no Azure release-upload stage and no self-hosted runner requirement.

## GitHub Actions Flow

`.github/workflows/aster-public-downloads.yml` provides a manual VSCodium-style path: give it a workflow `run_id`, `artifact_pattern`, release repository, and release tag, and it downloads matching GitHub Actions artifacts with `gh run download` before invoking `scripts/aster/publish-github-release-assets.mjs`.

For a self-contained GitHub build, `.github/workflows/aster-linux-installables.yml` builds Linux x64 archive, deb, and rpm installables, scans the unpacked app with `npm run aster:check-release-artifacts -- --allow-external-blockers`, uploads a `vscode_client_linux_x64_installables` workflow artifact, and can publish the same files to a GitHub Release in one run.

For a combined public release, `.github/workflows/aster-platform-installables.yml` builds Linux x64, Windows x64, and macOS arm64 artifacts on GitHub-hosted runners only, downloads those workflow artifacts into one publish job, and uploads them to a single GitHub Release. Its default manual-dispatch path publishes a non-prerelease release and then verifies that GitHub's `/releases/latest` endpoint exposes Linux, Windows, and macOS downloads.

The publisher creates or reuses the GitHub Release, uploads releasable files, adds checksum sidecars, updates the release notes with direct download links, and uploads `aster-release-assets.json` for programmatic consumers:

- Windows: `.exe`, `.msi`, `.zip`
- macOS: `.dmg`, `.zip`
- Linux: `.deb`, `.rpm`, `.snap`, `.tar.gz`, `.tar.xz`, `.zip`, AppImage
- Server, web, and CLI archives emitted as GitHub Actions artifacts

## Required Secret

Configure a repository secret named `ASTER_GITHUB_RELEASE_TOKEN` when publishing to a different repository or when the default `GITHUB_TOKEN` permissions are insufficient. Publishing to the same repository can use the workflow's `contents:write` permission.

Do not store the token in the repository. Record the credential owner and rotation evidence in `docs/aster-release-infrastructure.json` under `serviceConnections` and `releaseStorage` when release infrastructure is configured.

## Release Gates

Public GitHub release upload is separate from the inherited Microsoft publish path:

- `VSCODE_PUBLISH` controls the inherited product publish stage.
- `VSCODE_PUBLISH` requires `ASTER_RELEASE_INFRA_CONFIRMED`.
- GitHub Actions public-download workflows run `npm run aster:check-release-artifacts` before upload/publish.
- GitHub Linux installable builds set `VSCODE_DISABLE_CDN_SOURCE_MAPS=1` so packaged JavaScript does not point public Aster artifacts at Microsoft's source map CDN.

The release-readiness guardrail should keep failing until Aster-owned signing, package, storage, and approval systems replace inherited Microsoft infrastructure. GitHub Release uploads solve public artifact download, not code signing, package repository metadata, update services, or store publishing by themselves.
