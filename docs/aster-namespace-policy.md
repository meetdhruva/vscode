# Aster Namespace Policy

This policy explains how the Aster fork handles inherited `github.copilot` and `copilot` identifiers. It is intentionally conservative: identifiers are product contracts, not just names in source text. Mechanical replacement can break user settings, keybindings, persisted state, command references, extension API calls, telemetry continuity, and upstream mergeability.

## Why Some Inherited IDs Remain

Some `github.copilot` and `copilot` identifiers must remain because they are stable compatibility surfaces:

- User settings already stored in `settings.json`, profiles, workspace files, Settings Sync, or policy-managed configuration.
- Command IDs referenced by keybindings, menus, walkthroughs, extensions, docs, tests, or external automation.
- Context keys and when-clauses that coordinate VS Code UI, menu visibility, keybindings, and extension behavior.
- Storage keys, secret keys, database names, URI schemes, file-system schemes, chat participant IDs, tool IDs, and other persisted identifiers.
- Telemetry, diagnostics, and log event names where historical dashboards or compliance evidence depend on continuity.
- Upstream compatibility strings that reduce conflict risk when pulling VS Code or Copilot extension changes.

Keeping an inherited ID does not mean the user-facing Aster brand is incomplete. It means the ID is treated as a compatibility contract until there is an explicit alias or migration.

## Current Inventory Summary

The current inherited namespace surface falls into these groups:

- Configuration: `github.copilot.*` remains the registered extension configuration prefix in `ConfigKey` and `IConfigurationService`. Aster-owned public aliases can be contributed outside that prefix when explicit alias handling is implemented.
- Commands and menus: `extensions/copilot/package.json` still contributes many `github.copilot.*` command IDs, menu contexts, keybindings, and command palette entries. Treat command IDs as public automation and keybinding contracts.
- Chat identities: chat participant IDs, provider IDs, language model vendor IDs, and tool prefixes still include `copilot` compatibility values in workbench and extension code. These affect persisted chat state, view placement, provider routing, and extension API behavior.
- Settings and context keys: when-clauses such as `github.copilot.*` and `config.github.copilot.*` coordinate UI visibility and should not be renamed without dual registration.
- Storage and session keys: CLI/session state, pending session IDs, worktree prefixes, and experimentation keys include `github.copilot`, `copilot`, or `exp.github.copilot` values. These require idempotent migration before any removal.
- File-system conventions: paths such as `.github/copilot-instructions.md`, `.copilot/skills`, and `~/.copilot/...` must remain readable until Aster alternatives have dual-read or migration support.
- Telemetry and diagnostics: event names, output channels, and diagnostic identifiers may retain compatibility names when continuity is required for support or compliance evidence.

The first implemented alias set is `aster.ai.inlineCompletions.*`, which is documented as the primary namespace while `github.copilot.aster.inlineCompletions.*` remains a compatibility fallback.

## When To Add Aster Aliases

Add an Aster alias when a surface is user-facing, newly documented, or likely to be copied into user configuration.

Use an Aster alias for:

- New public settings, especially settings documented in Aster setup guides.
- Commands users run from the Command Palette, bind to keys, or call from tasks/automation.
- URI schemes or file-system schemes that appear in user-visible links or logs.
- Context keys only when they are part of a supported extension integration contract.
- Storage keys for new Aster-owned data that is not intentionally shared with an inherited Copilot feature.

Do not add an alias just to reduce source-code matches. Internal helper names, private test fixtures, copied upstream constants, comments that describe upstream behavior, and migration-only legacy keys can keep inherited names if users do not configure or depend on them directly.

## Migration Rules

Renaming a public or persisted identifier requires a migration plan before the old ID is removed.

1. Classify the identifier.
   Decide whether it is public, persisted, external integration, telemetry/compliance, or private implementation detail.

2. Prefer additive aliases first.
   New Aster IDs should usually be added alongside existing IDs. Existing `github.copilot` IDs should continue to work during at least one release cycle, and longer for settings, commands, or storage that users can reasonably keep forever.

3. Read old and new values.
   If both IDs exist, define precedence. The Aster ID should normally win, but old values must still be honored when the Aster ID is unset.

4. Write the new ID.
   New UI flows and commands should write the Aster ID. If a legacy feature still reads the old ID, dual-write only when required and document why.

5. Make migrations idempotent.
   Migrations must be safe to run more than once, must not overwrite an explicitly configured Aster value, and must preserve language, workspace, profile, and remote scopes when those scopes matter.

6. Keep deprecation discoverable.
   Mark old settings or commands as deprecated only after aliases exist. Deprecation text should name the Aster replacement and any behavior differences.

7. Test both paths.
   Add tests for old-only, new-only, both-configured, and unset cases. For commands, test old command compatibility and new command registration. For storage, test migration from real legacy keys where possible.

8. Remove only with approval.
   Deleting an inherited public ID requires a release note, compatibility sign-off, and a search proving no Aster docs, package metadata, tests, or product flows still reference the old ID as the primary path.

## Naming Guidance

Use `github.copilot.aster.*` only as a compatibility namespace when existing extension configuration plumbing or already-shipped user settings require it. For new Aster-owned user settings, prefer `aster.ai.*`; for example, `aster.ai.inlineCompletions.*` is the primary settings namespace and `github.copilot.aster.inlineCompletions.*` remains a compatibility fallback.

Prefer lower-case provider IDs that match VS Code language model provider vendors, such as `customoai`, `openai`, `ollama`, `anthropic`, `gemini`, `xai`, `openrouter`, and `azure`.

User-facing labels should say Aster or Aster AI. Internal compatibility IDs may still say Copilot.

## Compliance Checklist

For each namespace change, record:

- The inherited ID and proposed Aster ID.
- Whether the ID is public, persisted, or private.
- Alias behavior and precedence.
- Migration behavior and scopes.
- Deprecation or removal timeline.
- Tests or compliance scans that cover the decision.

The release compliance scan should flag new user-facing `github.copilot` IDs unless they are documented compatibility IDs or have Aster aliases.
