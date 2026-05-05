# Aster BYOK Setup

Aster can use bring-your-own-key language model providers for chat and, when enabled, inline completions. BYOK means the account, API key, quota, billing, retention terms, and provider-side data controls are owned by the user or organization configuring the provider.

## Safety Notes

- A GitHub Copilot subscription is not required for Aster BYOK chat providers.
- Provider keys are user-owned. Use provider configuration or secret prompts; do not commit keys to workspace settings, dotfiles, examples, or issue reports.
- Requests go to the provider you configure. Review that provider's data retention, training, regional, and logging terms before using it with private code.
- Azure API key auth is the default BYOK path. Microsoft authentication for Azure is explicit opt-in with `useMicrosoftAuthentication: true`; Aster should not request a Microsoft auth session unless that option is enabled.
- Custom endpoint model configuration is user-supplied. Set realistic context limits and tool/vision support so Aster does not send requests the model cannot handle.
- Inline completions are off by default. Enabling them sends local editor context around the cursor to the configured BYOK language model.

## Configure A Model Provider

Open the language model provider configuration UI from Aster settings or the command palette, add a provider group, and enter the fields for the provider you want to use. Provider identifiers are lower-case in Aster settings:

| Provider | Vendor ID | Required configuration |
| --- | --- | --- |
| OpenAI | `openai` | API key |
| OpenAI Compatible | `customoai` | API key if required by the endpoint, plus one or more model definitions |
| Ollama | `ollama` | Ollama server URL |
| Azure | `azure` | API key by default, plus one or more model definitions; Microsoft auth is opt-in |
| Anthropic | `anthropic` | API key |
| Gemini | `gemini` | API key |
| xAI | `xai` | API key |
| OpenRouter | `openrouter` | API key |

After configuring a provider, select the model in Aster chat. For inline completions, use the settings in [Inline Completions](#inline-completions).

## OpenAI

Use the OpenAI provider for the public OpenAI API.

```json
{
  "apiKey": "sk-..."
}
```

Aster discovers models from:

```text
https://api.openai.com/v1/models
```

Requests use OpenAI-compatible chat or responses endpoints based on model capabilities.

## OpenAI-Compatible Endpoints

Use the OpenAI Compatible provider for local gateways, hosted OpenAI-compatible APIs, or proxy services that are not already represented by a built-in provider.

```json
{
  "apiKey": "provider-key-if-required",
  "models": [
    {
      "id": "model-id-used-by-the-endpoint",
      "name": "Display Name",
      "url": "https://llm.example.com",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    }
  ]
}
```

Base URL rules:

- `https://llm.example.com` resolves to `https://llm.example.com/v1/chat/completions`.
- `https://llm.example.com/v1` resolves to `https://llm.example.com/v1/chat/completions`.
- Explicit API paths are respected. Use `https://llm.example.com/v1/responses` or `https://llm.example.com/v1/chat/completions` when the endpoint requires an exact path.

Optional model fields:

```json
{
  "thinking": false,
  "streaming": true,
  "zeroDataRetentionEnabled": false,
  "editTools": ["find-replace", "multi-find-replace", "apply-patch", "code-rewrite"],
  "requestHeaders": {
    "X-Custom-Header": "value"
  }
}
```

Do not use `requestHeaders` for API keys or auth headers. Configure the key through the provider `apiKey` field so it is handled as a secret.

## Ollama

Start Ollama and pull the models you want Aster to discover.

```bash
ollama pull qwen2.5-coder:7b
ollama serve
```

Configure the Ollama provider with the server URL:

```json
{
  "url": "http://localhost:11434"
}
```

Aster queries:

```text
http://localhost:11434/api/tags
http://localhost:11434/api/show
```

Use a reachable URL if Ollama runs on another machine or inside a container, for example:

```json
{
  "url": "http://host.docker.internal:11434"
}
```

## Azure

Azure BYOK supports Azure AI Foundry, Azure ML inference, and Azure OpenAI deployment URLs. API key auth is the default.

Azure AI Foundry or Azure ML example:

```json
{
  "apiKey": "azure-api-key",
  "useMicrosoftAuthentication": false,
  "models": [
    {
      "id": "model-id",
      "name": "Azure Model",
      "url": "https://my-endpoint.models.ai.azure.com",
      "toolCalling": true,
      "vision": false,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    }
  ]
}
```

That base URL resolves to:

```text
https://my-endpoint.models.ai.azure.com/v1/chat/completions
```

Azure OpenAI deployment example:

```json
{
  "apiKey": "azure-openai-api-key",
  "useMicrosoftAuthentication": false,
  "models": [
    {
      "id": "deployment-name",
      "name": "Azure OpenAI Deployment",
      "url": "https://my-resource.openai.azure.com",
      "toolCalling": true,
      "vision": true,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    }
  ]
}
```

That base URL resolves to:

```text
https://my-resource.openai.azure.com/openai/deployments/deployment-name/chat/completions?api-version=2025-01-01-preview
```

To use Microsoft authentication instead of an API key, opt in explicitly:

```json
{
  "useMicrosoftAuthentication": true,
  "models": [
    {
      "id": "deployment-name",
      "name": "Azure OpenAI Deployment",
      "url": "https://my-resource.openai.azure.com",
      "toolCalling": true,
      "vision": true,
      "maxInputTokens": 128000,
      "maxOutputTokens": 16000
    }
  ]
}
```

Only enable Microsoft authentication when you want Aster to request an Azure/Microsoft auth session for this provider.

## Anthropic

Configure the Anthropic provider with an Anthropic API key:

```json
{
  "apiKey": "sk-ant-..."
}
```

Aster discovers available Anthropic models through the Anthropic API for the configured key. The model list and exact model IDs are controlled by Anthropic and the account entitlements.

## Gemini

Configure the Gemini provider with a Google Gemini API key:

```json
{
  "apiKey": "AIza..."
}
```

Aster discovers Gemini models available to that key. Use the model picker after configuration to confirm which Gemini models are exposed.

## xAI

Configure the xAI provider with an xAI API key:

```json
{
  "apiKey": "xai-..."
}
```

Aster discovers models from:

```text
https://api.x.ai/v1/language-models
```

## OpenRouter

Configure the OpenRouter provider with an OpenRouter API key:

```json
{
  "apiKey": "sk-or-..."
}
```

Aster discovers tool-capable model metadata from:

```text
https://openrouter.ai/api/v1/models?supported_parameters=tools
```

OpenRouter model IDs include the upstream provider prefix, for example `openai/...` or `anthropic/...`. Use the exact ID shown by the model picker for chat and inline-completion settings.

## Inline Completions

Aster inline completions are off by default and use the VS Code language model API with configured BYOK providers. They do not use GitHub Copilot hosted completions or Copilot proxy authentication.

Enable inline completions after at least one BYOK model is configured:

```json
{
  "github.copilot.aster.inlineCompletions.enabled": true,
  "github.copilot.aster.inlineCompletions.vendor": "customoai",
  "github.copilot.aster.inlineCompletions.modelId": "model-id-used-by-the-endpoint"
}
```

The `vendor` value can be one of:

```text
customoai, openai, openrouter, ollama, anthropic, gemini, xai, azure
```

Leave `vendor` empty to use the first available non-Copilot BYOK model. Leave `modelId` empty to use the first available model for the selected vendor.

Inline completions also require editor inline suggestions to be enabled:

```json
{
  "editor.inlineSuggest.enabled": true
}
```

Language-level auto-triggering still follows the existing completion language setting:

```json
{
  "github.copilot.enable": {
    "*": true,
    "plaintext": false,
    "markdown": false,
    "scminput": false
  }
}
```

## Troubleshooting

- No models appear: verify the API key, provider quota, provider account access, and that the provider's model discovery endpoint is reachable.
- Custom model returns endpoint errors: use an explicit `/chat/completions` or `/responses` URL if the provider does not follow the default OpenAI-compatible path.
- Ollama models do not appear: confirm `ollama serve` is running and that the configured URL is reachable from Aster.
- Azure errors before a request is sent: configure an API key or explicitly set `useMicrosoftAuthentication: true`.
- Inline completions do not appear: enable `github.copilot.aster.inlineCompletions.enabled`, choose a BYOK `vendor`, confirm `editor.inlineSuggest.enabled`, and verify that the chosen model can answer normal chat requests first.
