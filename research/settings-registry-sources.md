# Settings registry source notes

Reviewed 2026-09-22. These sources inform organization and terminology; OmniFrame exposes only entries with an implemented runtime binding.

- [Kdenlive timeline configuration](https://docs.kdenlive.org/en/getting_started/configure_kdenlive/configuration_timeline.html) — documents timeline-specific preferences such as thumbnails, channel display, seeking behavior, autoscroll, wheel direction, and track height. These are evidence candidates, not claims that OmniFrame implements them.
- [OpenShot preferences](https://www.openshot.org/files/user-guide/preferences.html) — documents General, Timeline, Preview, Autosave, and Recovery categories, category reset, preview resolution, and project profile/frame rate. This supports separating project timebase from user preview quality.
- [Adobe Premiere timeline preferences](https://helpx.adobe.com/premiere/desktop/get-started/preferences-and-settings/timeline-preferences.html) — confirms distinct application preference domains and separate keyboard customization.

## Applied decision

`src/lib/settingsRegistry.ts` contains only settings already wired to observable behavior. Each item declares scope, persistence, capability, runtime binding, test identity, aliases, defaults, and source references. Desktop-only/native settings are intentionally absent until capability detection and a real Tauri binding exist.
