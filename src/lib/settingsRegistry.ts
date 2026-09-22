export type SettingsCategory = 'timeline' | 'playback' | 'shortcuts' | 'accessibility' | 'ai'
export type SettingsScope = 'project' | 'user' | 'session'

export interface SettingDefinition {
  id: string
  category: SettingsCategory
  label: string
  description: string
  aliases: string[]
  controlType: 'select' | 'toggle' | 'radio' | 'read-only'
  defaultValue: string | number | boolean
  scope: SettingsScope
  persistent: boolean
  requiresReload: boolean
  capability: 'web-and-desktop'
  runtimeBinding: string
  testId: string
  sourceRefs: { editor: string; url: string; evidence: string }[]
}

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  {
    id: 'project.frameRate', category: 'timeline', label: 'Project frame rate',
    description: 'Defines the project timebase used by frame stepping and ruler ticks.', aliases: ['fps', 'timebase', 'frames'],
    controlType: 'select', defaultValue: 30, scope: 'project', persistent: false, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.projectFps', testId: 'setting-project-fps',
    sourceRefs: [{ editor: 'OpenShot', url: 'https://www.openshot.org/files/user-guide/preferences.html', evidence: 'Default profiles include project frame rate.' }],
  },
  {
    id: 'timeline.dropFrameTimecode', category: 'timeline', label: 'Drop-frame timecode',
    description: 'Uses SMPTE clock-aligned display at 29.97 or 59.94 fps without changing timing.', aliases: ['smpte', 'timecode', '29.97', '59.94'],
    controlType: 'toggle', defaultValue: false, scope: 'project', persistent: false, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.dropFrameTimecode', testId: 'setting-drop-frame', sourceRefs: [],
  },
  {
    id: 'playback.previewQuality', category: 'playback', label: 'Preview quality',
    description: 'Changes the real compositing canvas resolution to reduce preview workload.', aliases: ['resolution', 'low', 'medium', 'high', 'ultra', 'performance'],
    controlType: 'radio', defaultValue: 'high', scope: 'user', persistent: true, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.previewQuality', testId: 'setting-preview-quality',
    sourceRefs: [{ editor: 'OpenShot', url: 'https://www.openshot.org/files/user-guide/preferences.html', evidence: 'Optimized preview resolution is an explicit preview preference.' }],
  },
  {
    id: 'accessibility.reduceMotion', category: 'accessibility', label: 'Reduce motion',
    description: 'Minimizes nonessential interface animation.', aliases: ['animation', 'accessibility', 'motion'],
    controlType: 'toggle', defaultValue: false, scope: 'user', persistent: true, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'document.of-reduced-motion', testId: 'setting-reduced-motion', sourceRefs: [],
  },
  {
    id: 'ai.provider', category: 'ai', label: 'AI provider', description: 'Selects the service used for AI requests.',
    aliases: ['OpenRouter', 'OpenAI', 'Anthropic', 'Gemini', 'Mistral', 'Groq', 'Together', 'DeepSeek', 'xAI', 'custom endpoint'],
    controlType: 'select', defaultValue: 'openrouter', scope: 'session', persistent: false, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'ai.session.provider', testId: 'setting-ai-provider', sourceRefs: [],
  },
  {
    id: 'ai.model', category: 'ai', label: 'Model ID', description: 'The provider model identifier used for requests.', aliases: ['model name'],
    controlType: 'select', defaultValue: 'openai/gpt-4o-mini', scope: 'session', persistent: false, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'ai.session.model', testId: 'setting-ai-model', sourceRefs: [],
  },
  {
    id: 'ai.apiKey', category: 'ai', label: 'API key', description: 'Provider credential retained only until this tab closes.', aliases: ['credential', 'token', 'BYOK'],
    controlType: 'read-only', defaultValue: '', scope: 'session', persistent: false, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'ai.session.apiKey', testId: 'setting-ai-api-key', sourceRefs: [],
  },
  ...[
    ['shortcut.hideClip', 'Hide / unhide selected clip', 'H'],
    ['shortcut.selectTool', 'Select tool', 'V'],
    ['shortcut.bladeTool', 'Blade tool', 'B'],
    ['shortcut.undo', 'Undo', 'Ctrl / Cmd + Z'],
  ].map(([id, label, shortcut]): SettingDefinition => ({
    id, category: 'shortcuts', label, description: shortcut, aliases: ['keyboard', 'key', shortcut], controlType: 'read-only',
    defaultValue: shortcut, scope: 'session', persistent: false, requiresReload: false, capability: 'web-and-desktop',
    runtimeBinding: id, testId: `setting-${id.replace(/\./g, '-')}`, sourceRefs: [],
  })),
]

export const SETTINGS_CATEGORIES = [...new Set(SETTINGS_REGISTRY.map((item) => item.category))] as SettingsCategory[]

export function searchSettings(query: string): SettingDefinition[] {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return []
  return SETTINGS_REGISTRY.filter((item) => [item.label, item.description, item.category, item.id, ...item.aliases].some((value) => value.toLocaleLowerCase().includes(term)))
}
