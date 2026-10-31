export type SettingsCategory = 'timeline' | 'playback' | 'shortcuts' | 'contextMenu' | 'cursor' | 'accessibility' | 'ai' | 'dockers' | 'appearance'
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
  { id: 'omniframe', label: 'OmniFrame Tab', defaultKey: 'Alt+O' },
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
    id: 'ui.hideOverflowX', category: 'accessibility', label: 'Hide horizontal overflow',
    description: 'Default on: horizontal tab/chip strips hide their scrollbar and scroll with edge arrows (hover to scroll), the mouse wheel, or dragging. Turn off to restore native horizontal scrollbars everywhere.',
    aliases: ['overflow', 'scrollbar', 'horizontal scroll', 'scroll arrows', 'overflow x'],
    controlType: 'toggle', defaultValue: true, scope: 'user', persistent: true, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.hideOverflowX', testId: 'toggle-hide-overflow-x',
    sourceRefs: [{ editor: 'CapCut', url: 'https://www.capcut.com/', evidence: 'CapCut panels navigate sections from a horizontal strip without visible scrollbars.' }],
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
  {
    id: 'dockers.leftTabs',
    category: 'dockers',
    label: 'Dockers — sidebar panels',
    description: 'Choose which panels appear on the left rail; review the active workspace mode and what it shows, then customize. Hidden panels can be re-enabled at any time.',
    aliases: ['docker', 'panels', 'sidebar', 'workspace', 'rails', 'show hide panels'],
    controlType: 'toggle',
    defaultValue: true,
    scope: 'user',
    persistent: true,
    requiresReload: false,
    capability: 'web-and-desktop',
    runtimeBinding: 'dockerPrefs.leftTabs',
    testId: 'setting-dockers-left-tabs',
    sourceRefs: [],
  },
  {
    id: 'dockers.rightSubtools',
    category: 'dockers',
    label: 'Dockers — right sub-tools',
    description: 'Choose which sub-tools (Masking, Smart Patch, RotoMask) appear on the right panel icon dock. Sub-tools are shared across modes and can be opened or closed as needed.',
    aliases: ['docker', 'subtools', 'masking', 'right panel', 'tools dock'],
    controlType: 'toggle',
    defaultValue: true,
    scope: 'user',
    persistent: true,
    requiresReload: false,
    capability: 'web-and-desktop',
    runtimeBinding: 'dockerPrefs.rightSubtools',
    testId: 'setting-dockers-right-subtools',
    sourceRefs: [],
  },
  {
    id: 'ui.style', category: 'appearance', label: 'UI style',
    description: 'Five interface styles (OmniFrame, Clean Cut, Workshop, Pro Blue, Daylight) that regroup corners, density and panel depth — structure, not just colour.',
    aliases: ['ui style', 'theme', 'look', 'interface', 'appearance', 'dark', 'light', 'capcut style', 'krita style'],
    controlType: 'radio', defaultValue: 'omniframe', scope: 'user', persistent: true, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.uiStyle', testId: 'ui-style-omniframe',
    sourceRefs: [{ editor: 'Krita', url: 'https://docs.krita.org/en/user_manual/workspace.html', evidence: 'Docker/workspace theming ships as part of the workspace system.' }, { editor: 'CapCut', url: 'https://www.capcut.com/', evidence: 'Rounded card grids and pill controls define the consumer look.' }],
  },
  {
    id: 'ui.palette', category: 'appearance', label: 'Accent palette',
    description: 'Violet, Amber or Teal accent for primary actions and selection across every style.',
    aliases: ['palette', 'accent', 'color', 'colour', 'brand'],
    controlType: 'radio', defaultValue: 'violet', scope: 'user', persistent: true, requiresReload: false,
    capability: 'web-and-desktop', runtimeBinding: 'editor.uiPalette', testId: 'ui-palette-violet',
    sourceRefs: [],
  },
]
export const SETTINGS_CATEGORIES = [...new Set(SETTINGS_REGISTRY.map((item) => item.category))] as SettingsCategory[]

export function searchSettings(query: string): SettingDefinition[] {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return []
  return SETTINGS_REGISTRY.filter((item) => [item.label, item.description, item.category, item.id, ...item.aliases].some((value) => value.toLocaleLowerCase().includes(term)))
}
