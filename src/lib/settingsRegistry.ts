export type SettingsCategory = 'timeline' | 'playback' | 'shortcuts' | 'contextMenu' | 'cursor' | 'accessibility' | 'ai'
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

export interface EditableShortcut {
  id: string
  label: string
  defaultKey: string
}

/**
 * Single source of truth for the keyboard shortcuts the Shortcuts settings
 * category lets you rebind. The Settings search index and the Shortcuts
 * panel previously carried their own hard-coded lists, so searching for
 * "split" reported a different default binding than the panel showed.
 */
export const EDITABLE_SHORTCUTS: EditableShortcut[] = [
  { id: 'split', label: 'Split at Playhead', defaultKey: 'B' },
  { id: 'marker', label: 'Add Marker', defaultKey: 'M' },
  { id: 'hide', label: 'Hide / Unhide Clip', defaultKey: 'H' },
  { id: 'selectTool', label: 'Select Tool', defaultKey: 'V' },
  { id: 'bladeTool', label: 'Blade Tool', defaultKey: 'B' },
  { id: 'delete', label: 'Delete Clip', defaultKey: 'Delete' },
  { id: 'duplicate', label: 'Duplicate Clip', defaultKey: 'Ctrl+D' },
  { id: 'cut', label: 'Cut Clip', defaultKey: 'Ctrl+X' },
  { id: 'copy', label: 'Copy Clip', defaultKey: 'Ctrl+C' },
  { id: 'paste', label: 'Paste Clip', defaultKey: 'Ctrl+V' },
  { id: 'undo', label: 'Undo', defaultKey: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', defaultKey: 'Ctrl+Shift+Z' },
  { id: 'playPause', label: 'Play / Pause', defaultKey: 'Space' },
  { id: 'omniframe', label: 'OmniFrame Mask Tab', defaultKey: 'Alt+O' },
  { id: 'threed', label: 'Toggle 3D Mode', defaultKey: '3' },
]

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  {
    id: 'project.frameRate', category: 'timeline', label: 'Project frame rate',
    description: 'Defines the project timebase used by frame stepping and ruler ticks.', aliases: ['fps', 'timebase', 'frames'],
    controlType: 'select', defaultValue: 30, scope: 'project', persistent: false, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.projectFps', testId: 'setting-project-fps',
    sourceRefs: [{ editor: 'OpenShot', url: 'https://www.openshot.org/files/user-guide/preferences.html', evidence: 'Default profiles include project frame rate.' }],
  },
  {
    id: 'timeline.dropFrameTimecode', category: 'timeline', label: 'Drop frame timecode',
    description: 'Uses SMPTE clock aligned display at 29.97 or 59.94 fps without changing timing.', aliases: ['smpte', 'timecode', '29.97', '59.94'],
    controlType: 'toggle', defaultValue: false, scope: 'project', persistent: false, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.dropFrameTimecode', testId: 'setting-drop-frame', sourceRefs: [],
  },
  {
    id: 'playback.previewQuality', category: 'playback', label: 'Preview quality',
    description: 'Changes the real compositing canvas resolution to reduce preview workload.', aliases: ['resolution', 'low', 'medium', 'high', 'pixelated', 'performance'],
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
    id: 'ai.audioIsolationModel', category: 'ai', label: 'Audio isolation model',
    description: 'Selects the neural model architecture for voice and instrumental stem separation.',
    aliases: ['voice isolation', 'vocal removal', 'omni-voicetarget', 'htdemucs', 'roformer', 'audio stem', 'karaoke'],
    controlType: 'select', defaultValue: 'omni-voicetarget', scope: 'user', persistent: true, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.audioIsolationModel', testId: 'setting-audio-isolation-model',
    sourceRefs: [{ editor: 'OmniFrame', url: 'https://huggingface.co/AEmotionStudio/roformer-models', evidence: 'BS-RoFormer & HTDemucs SOTA separation benchmark.' }],
  },
  {
    id: 'ai.apiKey', category: 'ai', label: 'API key', description: 'Provider credential retained only until this tab closes.', aliases: ['credential', 'token', 'BYOK'],
    controlType: 'read-only', defaultValue: '', scope: 'session', persistent: false, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'ai.session.apiKey', testId: 'setting-ai-api-key', sourceRefs: [],
  },
  ...EDITABLE_SHORTCUTS.map((shortcut): SettingDefinition => ({
    id: `shortcut.${shortcut.id}`, category: 'shortcuts', label: shortcut.label,
    description: `Rebindable shortcut, defaults to ${shortcut.defaultKey}.`,
    aliases: ['keyboard', 'key', 'shortcut', shortcut.defaultKey, shortcut.label],
    controlType: 'read-only', defaultValue: shortcut.defaultKey, scope: 'session', persistent: false,
    requiresReload: false, capability: 'web-and-desktop', runtimeBinding: `shortcut.${shortcut.id}`,
    testId: `setting-shortcut-${shortcut.id}`, sourceRefs: [],
  })),
  {
    id: 'contextMenu.customization', category: 'contextMenu', label: 'Context menu customization',
    description: 'Toggle actions and submenus displayed in clip and track right-click menus.', aliases: ['context menu', 'right click', 'actions'],
    controlType: 'toggle', defaultValue: true, scope: 'user', persistent: true, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.contextMenuEnabledCommands', testId: 'setting-context-menu', sourceRefs: [],
  },
  {
    id: 'cursor.customizer', category: 'cursor', label: 'Custom Mac cursor & pointer events',
    description: 'Vector cursor follower with Pro Precision (compact NLE-style) and gamified packs, + drag and ? help badges.',
    aliases: ['cursor', 'mouse', 'pointer', 'mac cursor', 'drag plus', 'help question', 'pointer events'],
    controlType: 'toggle', defaultValue: true, scope: 'user', persistent: true, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.cursorConfig.enabled', testId: 'setting-cursor-enabled', sourceRefs: [],
  },
]

export const SETTINGS_CATEGORIES = [...new Set(SETTINGS_REGISTRY.map((item) => item.category))] as SettingsCategory[]

export function searchSettings(query: string): SettingDefinition[] {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return []
  return SETTINGS_REGISTRY.filter((item) => [item.label, item.description, item.category, item.id, ...item.aliases].some((value) => value.toLocaleLowerCase().includes(term)))
}
