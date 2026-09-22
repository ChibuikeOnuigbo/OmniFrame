# Bring-your-own-key AI provider settings audit

Date: 2026-09-22

## Implemented

- Session-only provider, model, endpoint, and masked API-key controls in the compact Settings overlay.
- Provider adapters: OpenRouter, OpenAI, Anthropic, Google Gemini, Mistral, Groq, Together AI, DeepSeek, xAI, and custom OpenAI-compatible HTTPS endpoints.
- Protocol-aware request construction for OpenAI-compatible chat completions, Anthropic Messages, and Gemini generateContent.
- Custom endpoint validation requires HTTPS and documents `/chat/completions` compatibility.
- Credential is held in React memory only and is not written to localStorage, project state, logs, diagnostics, or the settings registry default.
- UI explicitly tells users to enter only a provider-issued API key, never code, prompts, passwords, or recovery codes.
- Browser security disclosure recommends restricted keys and spending limits.

## Deliberate limitations

- A browser BYOK key is visible to the current page and sent directly to the selected provider. It is not represented as secure secret storage.
- Provider model catalogs are not hardcoded because they change frequently; the exact provider model ID is user-entered.
- Providers may reject browser-origin requests due to CORS. OmniFrame reports the failure rather than claiming a connection succeeded.
- No API key was used or stored during QA. The browser test proves local validation before any network request.
- Native keychain persistence is SKIPPED: no keychain bridge exists in the current Tauri shell and Cargo is unavailable.

## Verification

- `npm run typecheck`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- `node qa/context-menu-e2e.mjs`: 50 PASS, including AI warning, custom endpoint disclosure, no-key validation, and zero runtime errors.
