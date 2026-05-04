# Aster AI

Aster AI is the provider-neutral AI extension bundled with Aster Editor.

This fork is being reshaped from the open-source VS Code and upstream AI extension codebases so users can use built-in chat and language model features with their own model providers instead of requiring a single-vendor hosted subscription. The current MVP focuses on bring-your-own-key providers, including OpenAI-compatible endpoints, OpenAI, OpenRouter, Anthropic, Gemini, xAI, Azure OpenAI, and Ollama.

## Bring Your Own Key

The bundled BYOK provider support stores API keys through VS Code secret storage and registers language model providers at startup. OpenAI-compatible providers can be configured with a base URL, model ID, display name, token limits, streaming support, vision support, tool-calling support, and optional custom headers.

See [Aster AI Provider MVP](../../docs/aster-ai-provider-mvp.md) for the current implementation scope and remaining release blockers.

## Current Limits

This extension still contains upstream compatibility command IDs and internal module names that use `github.copilot` or `copilot` prefixes. Those are retained temporarily to keep the fork easy to rebase while provider-neutral behavior is moved behind Aster-facing product surfaces.

Background agent integrations that depend on upstream hosted services are hidden in Aster until they can be replaced or clearly separated from provider-neutral BYOK flows.

## Data and Telemetry

Public Aster builds should not send upstream telemetry by default. The telemetry and experimentation cleanup is tracked separately from this branding shell so it can be reviewed with focused tests and endpoint scans.

## License

Copyright notices from upstream source files are preserved for provenance.

Licensed under the [MIT](LICENSE.txt) license.
