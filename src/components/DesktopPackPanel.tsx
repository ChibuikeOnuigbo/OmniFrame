import { useMemo, useState } from 'react'
import { AppWindow, Box, ChevronRight, Clapperboard, Folder, FolderOpen, Heart, Layers, MousePointer2, Search, Smartphone, Sparkles } from 'lucide-react'
import { useEditor } from '../store'
import type { ClipEffect, CursorPack, Primitive3D } from '../types'
import { PACK_ASSETS, PACK_BUNDLES, PACK_H, PACK_W, packAssetUrl, type PackAssetDef, type PackBundleDef, type PackSection } from '../lib/desktopPack'
import { PackBrowserModal } from './PackBrowserModal'
import { previewClipEffect, previewEffectLayer } from '../lib/visualPreviewActions'
import { HScrollStrip } from './HScrollStrip'

/**
 * Desktop Pack: the screen-life toolkit organised like a file library —
 * six sections on a horizontal segmented strip (CapCut pattern), each
 * section filed into collapsible folders (Explorer/ChatGPT-sidebar pattern:
 * chevron, folder name, item count, indented contents) with a search box
 * on top (ChatGPT pattern) so nothing competes for attention all at once.
 */

const SECTIONS: { id: PackSection; label: string; icon: typeof AppWindow }[] = [
  { id: 'windows', label: 'Desktop & Windows', icon: AppWindow },
  { id: 'apps', label: 'Apps & Devices', icon: Smartphone },
  { id: 'scenes', label: 'Scene Recipes', icon: Clapperboard },
  { id: 'cursors', label: 'Cursors', icon: MousePointer2 },
  { id: 'overlays', label: 'Overlays', icon: Layers },
  { id: 'edits', label: 'Edit Presets', icon: Sparkles },
  { id: 'threed', label: '3D Tools', icon: Box },
]

const GROUP_ORDER: Record<string, string[]> = {
  windows: ['Packs', 'Desktops', 'Browsers', 'App Windows', 'Devices & Social'],
  apps: ['Music', 'Files & Browsers', 'Phones', 'Creators', 'Code & Design', 'Productivity', 'Chat & Mail'],
  scenes: ['Intros & Titles', 'Motion Presets', 'Studio & Podcast', 'Looks & Teaching', 'Social Versions'],
  cursors: ['Pointers', 'Clicks & Marks', 'Editor Cursor'],
  overlays: ['Frames & Bars', 'Light & Focus'],
  edits: ['Looks', 'Fixes'],
  threed: ['Primitives', 'Scene'],
}

const CURSOR_PACKS: { id: CursorPack; label: string }[] = [
  { id: 'pro-precision', label: 'Pro Precision' },
  { id: 'mac-sonoma-pro', label: 'Mac Sonoma Pro' },
  { id: 'mac-gamified', label: 'Mac Gamified' },
  { id: 'cyber-violet', label: 'Cyber Violet' },
  { id: 'neo-stealth', label: 'Neo Stealth' },
]

const EDIT_PRESETS: { id: string; label: string; desc: string; group: string; effect: ClipEffect }[] = [
  { id: 'tutorial-pop', label: 'Tutorial Pop', desc: 'Contrast + saturation for screen recordings', group: 'Looks', effect: { contrast: 1.18, saturation: 1.2, brightness: 1.02 } },
  { id: 'warm-cast', label: 'Warm Cast', desc: 'Warm sepia cast', group: 'Looks', effect: { sepia: 0.35, saturation: 1.1, brightness: 1.03 } },
  { id: 'mono-doc', label: 'Mono Doc', desc: 'Black & white document look', group: 'Looks', effect: { grayscale: 1, contrast: 1.3 } },
  { id: 'night-screen', label: 'Night Screen', desc: 'Dark UI / night-mode grade', group: 'Looks', effect: { brightness: 0.82, contrast: 1.15, saturation: 0.9 } },
  { id: 'screen-clean', label: 'Clean Screen', desc: 'Gentle lift for UI captures', group: 'Fixes', effect: { contrast: 1.08, saturation: 1.05, brightness: 1.03 } },
  { id: 'soft-blur', label: 'Soft Blur', desc: 'Dreamy soft focus', group: 'Fixes', effect: { blur: 6, brightness: 1.05 } },
]

const PRIMITIVES: { type: Primitive3D; label: string; color: string }[] = [
  { type: 'cube', label: 'Cube', color: '#6d5efc' },
  { type: 'sphere', label: 'Sphere', color: '#2dd4bf' },
  { type: 'torus', label: 'Torus', color: '#f59e0b' },
  { type: 'diamond', label: 'Diamond', color: '#38bdf8' },
  { type: 'plane', label: 'Plane', color: '#94a3b8' },
  { type: 'wheel', label: 'Wheel', color: '#f472b6' },
]


/** CoAnimator-style scene recipes: one click builds a real, editable scene
 * from existing editor functions (frame capture, pack overlays, text clips,
 * effects, splits, sequence settings). Nothing is baked in — every result
 * stays a normal clip the user can move, trim or delete. */
async function captureClipFrameDataUrl(clipId: string): Promise<string | null> {
  const s = useEditor.getState()
  const clip = s.clips.find((c) => c.id === clipId)
  if (!clip) return null
  const asset = s.assets.find((a) => a.id === clip.assetId)
  if (!asset) return null
  if (asset.kind === 'image') return asset.url
  if (asset.kind !== 'video') return null
  const at = clip.inPoint + Math.max(0, Math.min(clip.duration - 0.05, s.playhead - clip.start))
  return await new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.src = asset.url
    const done = (url: string | null) => { video.remove(); resolve(url) }
    video.onloadedmetadata = () => { video.currentTime = Math.min(at, Math.max(0, video.duration - 0.05)) }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 1280; canvas.height = 720
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1280, 720)
        const vw = video.videoWidth || 1280, vh = video.videoHeight || 720
        const scale = Math.min(1280 / vw, 720 / vh)
        ctx.drawImage(video, (1280 - vw * scale) / 2, (720 - vh * scale) / 2, vw * scale, vh * scale)
        done(canvas.toDataURL('image/png'))
      } catch { done(null) }
    }
    video.onerror = () => done(null)
    window.setTimeout(() => done(null), 8000)
  })
}

interface SceneRecipe { id: string; label: string; desc: string; group: string; needsClip: boolean; run: () => Promise<string> }

const SCENE_RECIPES: SceneRecipe[] = [
  {
    id: 'freeze-pop', label: 'Freeze-Pop Intro', desc: 'Freeze the frame at the playhead, sticker frame + name title on top', group: 'Intros & Titles', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const url = await captureClipFrameDataUrl(clip.id)
      if (!url) return 'Could not capture a frame from that clip'
      const st = useEditor.getState()
      const assetId = `freeze-${Date.now().toString(36)}`
      st.addAsset({ id: assetId, name: 'Freeze frame (demo)', kind: 'image', url, duration: 1.5, width: 1280, height: 720, size: url.length })
      const trackId = st.createTrack('video', 'above', clip.trackId)
      st.addClipToTrack(trackId, assetId, st.playhead)
      const frameDef = PACK_ASSETS.find((a) => a.id === 'pip-frame')
      if (frameDef) addPackClip(frameDef)
      st.addTextTitleClip('YOUR NAME', 1.5)
      return 'Freeze-pop built: frozen frame, sticker frame and name title at the playhead'
    },
  },
  {
    id: 'cinematic-cast', label: 'Cinematic Cast Intro', desc: 'Letterbox bars, warm cinematic grade and a title card', group: 'Intros & Titles', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      s.setClipEffect(clip.id, { contrast: 1.16, saturation: 1.08, sepia: 0.14, brightness: 0.98 })
      const letterbox = PACK_ASSETS.find((a) => a.id === 'letterbox')
      if (letterbox) addPackClip(letterbox)
      s.addTextTitleClip('EPISODE ONE', 3)
      return 'Cinematic intro applied: grade on the clip, letterbox + title above'
    },
  },
  {
    id: 'spotlight-tutorial', label: 'Spotlight Tutorial', desc: 'Spotlight dim + look-here box, screen-clean grade on the clip', group: 'Looks & Teaching', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      s.setClipEffect(clip.id, { contrast: 1.18, saturation: 1.2, brightness: 1.02 })
      const spot = PACK_ASSETS.find((a) => a.id === 'spotlight')
      if (spot) addPackClip(spot)
      const box = PACK_ASSETS.find((a) => a.id === 'highlight-box')
      if (box) addPackClip(box)
      return 'Spotlight look built — move the highlight box to the detail that matters'
    },
  },
  {
    id: 'punch-in', label: 'Punch-In Cut', desc: 'Split all tracks at the playhead and scale the selected clip to 118%', group: 'Looks & Teaching', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      s.splitAt(s.playhead)
      const st = useEditor.getState()
      const mid = st.clips.filter((c) => c.trackId === clip.trackId && c.start >= s.playhead - 0.01).sort((a, b) => a.start - b.start)[0]
      if (mid) st.setClipTransform(mid.id, { scale: 1.18 })
      return 'Punch-in cut made at the playhead (all tracks split)'
    },
  },
  {
    id: 'caption-burst', label: 'Caption Burst', desc: 'Four editable caption titles spread across the selected clip', group: 'Social Versions', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const lines = ['HOOK — watch this', 'Step one (demo caption)', 'Step two (demo caption)', 'Follow for part two']
      const seg = clip.duration / lines.length
      lines.forEach((line, i) => {
        useEditor.getState().setPlayhead(clip.start + i * seg)
        useEditor.getState().addTextTitleClip(line, Math.max(1, seg))
      })
      useEditor.getState().setPlayhead(clip.start)
      return 'Four editable captions added — rewrite them in the Text panel'
    },
  },
  {
    id: 'vertical-version', label: 'Vertical 9:16 Version', desc: 'Switch the sequence to 1080×1920 for Shorts/Reels', group: 'Social Versions', needsClip: false,
    run: async () => {
      useEditor.getState().setSequenceAspectRatio('9:16')
      return 'Sequence is now 9:16 — reframe clips with Transform, then export'
    },
  },
  {
    id: 'ken-burns', label: 'Ken Burns Drift', desc: 'Slow 100% → 125% zoom keyframed across the selected clip', group: 'Looks & Teaching', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      s.setClipKeyframe(clip.id, 'scale_x', 0, 1, 'bezier')
      s.setClipKeyframe(clip.id, 'scale_x', Math.max(0.1, clip.duration), 1.25, 'bezier')
      s.setClipKeyframe(clip.id, 'scale_y', 0, 1, 'bezier')
      s.setClipKeyframe(clip.id, 'scale_y', Math.max(0.1, clip.duration), 1.25, 'bezier')
      return 'Ken Burns drift keyframed — adjust the curve in the Graph Editor'
    },
  },
  {
    id: 'light-layer-warm', label: 'Light Layer (Warm)', desc: 'Warm point-light adjustment layer over the scene (Gold Motion-style light)', group: 'Looks & Teaching', needsClip: false,
    run: async () => {
      const s = useEditor.getState()
      s.addAdjustmentLayer({
        name: 'Light · Warm Point',
        effects: { lightType: 'point', lightColor: '#ffd9a0', lightIntensity: 0.8, lightFalloff: 0.5, lightX: 0.5, lightY: 0.35 },
      })
      return 'Warm light layer added — tune color, intensity, falloff in Color & Adjustments'
    },
  },
  {
    id: 'on-air', label: 'On-Air Backdrop', desc: 'Post-card backdrop + ON AIR title over the selected clip', group: 'Intros & Titles', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const card = PACK_ASSETS.find((a) => a.id === 'post-card')
      if (card) addPackClip(card)
      s.addTextTitleClip('ON AIR', 4)
      return 'On-air backdrop added — move the card and title behind your subject track if needed'
    },
  },
  {
    id: 'podcast-studio-cut', label: 'Podcast Studio Cut', desc: 'Studio window + progress bar + episode title for podcast edits', group: 'Studio & Podcast', needsClip: false,
    run: async () => {
      const studio = PACK_ASSETS.find((a) => a.id === 'podcast-studio-window')
      if (studio) addPackClip(studio)
      const bar = PACK_ASSETS.find((a) => a.id === 'progress-bar')
      if (bar) addPackClip(bar)
      useEditor.getState().addTextTitleClip('DEMO PODCAST — EPISODE 1', 4)
      return 'Podcast studio scene built — swap in your episode title and artwork'
    },
  },
  // Motion Presets (Jitter study): named one-click animations written as
  // ordinary keyframes on the selected clip, so they stay fully editable
  // in the Graph Editor. Spring feels use the Curve Engine's physical
  // easings ('back' overshoot), the same family as Remotion's spring().
  {
    id: 'motion-fade-rise', label: 'Fade + Rise In', desc: 'Fade in while rising 36px over 0.45s (ease-out)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      s.setClipKeyframe(clip.id, 'opacity', 0, 0, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0.45, t.opacity, 'ease-out')
      s.setClipKeyframe(clip.id, 'position_y', 0, t.y + 36, 'ease-out')
      s.setClipKeyframe(clip.id, 'position_y', 0.45, t.y, 'ease-out')
      return 'Fade + Rise In keyframed — tune it in the Graph Editor'
    },
  },
  {
    id: 'motion-pop-in', label: 'Pop In (Spring)', desc: 'Scale up from 55% with a spring overshoot (back easing)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      s.setClipKeyframe(clip.id, 'scale_x', 0, t.scale * 0.55, 'back')
      s.setClipKeyframe(clip.id, 'scale_x', 0.5, t.scale, 'back')
      s.setClipKeyframe(clip.id, 'scale_y', 0, t.scale * 0.55, 'back')
      s.setClipKeyframe(clip.id, 'scale_y', 0.5, t.scale, 'back')
      s.setClipKeyframe(clip.id, 'opacity', 0, 0, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0.5, t.opacity, 'ease-out')
      return 'Pop In keyframed with a spring (back) ease — tune it in the Graph Editor'
    },
  },
  {
    id: 'motion-slide-in', label: 'Slide In (Left)', desc: 'Slide in from 160px left while fading in (ease-out)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      s.setClipKeyframe(clip.id, 'position_x', 0, t.x - 160, 'ease-out')
      s.setClipKeyframe(clip.id, 'position_x', 0.45, t.x, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0, 0, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0.45, t.opacity, 'ease-out')
      return 'Slide In keyframed — tune it in the Graph Editor'
    },
  },
  {
    id: 'motion-spin-in', label: 'Spin In', desc: 'Rotate in from −16° while fading in (ease-out)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      s.setClipKeyframe(clip.id, 'rotation_z', 0, t.rotation - 16, 'ease-out')
      s.setClipKeyframe(clip.id, 'rotation_z', 0.5, t.rotation, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0, 0, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0.5, t.opacity, 'ease-out')
      return 'Spin In keyframed — tune it in the Graph Editor'
    },
  },
  {
    id: 'motion-pulse', label: 'Pulse Beat', desc: 'One scale pulse to 107% and back at the clip start', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      s.setClipKeyframe(clip.id, 'scale_x', 0, t.scale, 'ease-in-out')
      s.setClipKeyframe(clip.id, 'scale_x', 0.26, t.scale * 1.07, 'ease-in-out')
      s.setClipKeyframe(clip.id, 'scale_x', 0.52, t.scale, 'ease-in-out')
      s.setClipKeyframe(clip.id, 'scale_y', 0, t.scale, 'ease-in-out')
      s.setClipKeyframe(clip.id, 'scale_y', 0.26, t.scale * 1.07, 'ease-in-out')
      s.setClipKeyframe(clip.id, 'scale_y', 0.52, t.scale, 'ease-in-out')
      return 'Pulse Beat keyframed — copy the keys to repeat it'
    },
  },
  {
    id: 'motion-drop-out', label: 'Drop Out (Exit)', desc: 'Final 0.4s: sink 56px while fading out (ease-in)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      const end = Math.max(0.1, clip.duration)
      const start = Math.max(0, end - 0.4)
      s.setClipKeyframe(clip.id, 'opacity', start, t.opacity, 'ease-in')
      s.setClipKeyframe(clip.id, 'opacity', end, 0, 'ease-in')
      s.setClipKeyframe(clip.id, 'position_y', start, t.y, 'ease-in')
      s.setClipKeyframe(clip.id, 'position_y', end, t.y + 56, 'ease-in')
      return 'Drop Out keyframed at the clip end — tune it in the Graph Editor'
    },
  },
  {
    id: 'motion-flip-in', label: 'Flip In (3D)', desc: 'Flip in around the Y axis from −80° (3-axis rotation, ease-out)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      const base = t.rotationY ?? 0
      s.setClipKeyframe(clip.id, 'rotation_y', 0, base - 80, 'ease-out')
      s.setClipKeyframe(clip.id, 'rotation_y', 0.55, base, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0, 0, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0.4, t.opacity, 'ease-out')
      return 'Flip In (3D) keyframed on Rotation Y — tune it in the Graph Editor'
    },
  },
  {
    id: 'motion-tumble-in', label: 'Tumble In (3D)', desc: 'Tumble in around the X axis from +70° (3-axis rotation, ease-out)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      const base = t.rotationX ?? 0
      s.setClipKeyframe(clip.id, 'rotation_x', 0, base + 70, 'ease-out')
      s.setClipKeyframe(clip.id, 'rotation_x', 0.55, base, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0, 0, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0.4, t.opacity, 'ease-out')
      return 'Tumble In (3D) keyframed on Rotation X — tune it in the Graph Editor'
    },
  },
  {
    id: 'motion-swing-in', label: 'Swing In', desc: 'Pendulum swing −14° → +8° → −4° → rest over 0.72s (ease-out)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      s.setClipKeyframe(clip.id, 'rotation_z', 0, t.rotation - 14, 'ease-out')
      s.setClipKeyframe(clip.id, 'rotation_z', 0.28, t.rotation + 8, 'ease-out')
      s.setClipKeyframe(clip.id, 'rotation_z', 0.52, t.rotation - 4, 'ease-out')
      s.setClipKeyframe(clip.id, 'rotation_z', 0.72, t.rotation, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0, 0, 'ease-out')
      s.setClipKeyframe(clip.id, 'opacity', 0.25, t.opacity, 'ease-out')
      return 'Swing In keyframed — tune the pendulum in the Graph Editor'
    },
  },
  {
    id: 'motion-impact-shake', label: 'Impact Shake', desc: 'Hard decaying shake over 0.5s (AMV beat-hit style, linear keys)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      const steps = 10
      for (let i = 0; i <= steps; i++) {
        const time = (i / steps) * 0.5
        const mag = 14 * Math.pow(1 - i / steps, 1.3)
        const sign = i % 2 === 0 ? 1 : -1
        s.setClipKeyframe(clip.id, 'position_x', time, t.x + mag * sign, 'linear')
        s.setClipKeyframe(clip.id, 'position_y', time, t.y + mag * 0.6 * -sign, 'linear')
        s.setClipKeyframe(clip.id, 'rotation_z', time, t.rotation + 1.2 * (mag / 14) * sign, 'linear')
      }
      return 'Impact Shake keyframed (decaying oscillation) — trim or stretch the keys to retime it'
    },
  },
  {
    id: 'motion-oscillate', label: 'Oscillate Shake', desc: 'Smooth sustained shake, ±7px over 1.2s (Alight-style oscillate)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      const keys = 16
      for (let i = 0; i <= keys; i++) {
        const time = (i / keys) * 1.2
        const phase = Math.sin((i / keys) * Math.PI * 2 * 1.5)
        const fade = i === 0 || i === keys ? 0 : 1
        s.setClipKeyframe(clip.id, 'position_x', time, t.x + 7 * phase * fade, 'linear')
        s.setClipKeyframe(clip.id, 'position_y', time, t.y + 3.5 * Math.cos((i / keys) * Math.PI * 2 * 1.5) * fade, 'linear')
      }
      return 'Oscillate Shake keyframed (sine-sampled) — copy the keys to extend it'
    },
  },
  {
    id: 'motion-zoom-punch', label: 'Zoom Punch', desc: 'Fast punch-in to 115% on the beat (back easing, 0.15s)', group: 'Motion Presets', needsClip: true,
    run: async () => {
      const s = useEditor.getState()
      const clip = s.clips.find((c) => c.id === s.selectedClipId)
      if (!clip) return 'Select a clip first'
      const t = clip.transform
      s.setClipKeyframe(clip.id, 'scale_x', 0, t.scale, 'back')
      s.setClipKeyframe(clip.id, 'scale_x', 0.15, t.scale * 1.15, 'back')
      s.setClipKeyframe(clip.id, 'scale_y', 0, t.scale, 'back')
      s.setClipKeyframe(clip.id, 'scale_y', 0.15, t.scale * 1.15, 'back')
      return 'Zoom Punch keyframed — drop it on a beat hit'
    },
  },
]

function ensurePackAsset(def: PackAssetDef): string {
  const state = useEditor.getState()
  const assetId = `pack-${def.id}`
  if (!state.assets.some((a) => a.id === assetId)) {
    const url = packAssetUrl(def.id)
    state.addAsset({
      id: assetId,
      name: def.name,
      kind: 'image',
      url,
      duration: 5,
      width: PACK_W,
      height: PACK_H,
      size: url.length,
    })
  }
  return assetId
}

/** A pack track with no clip overlapping the playhead window, else a new top track. */
function freePackTrack(): string {
  const s = useEditor.getState()
  const t0 = s.playhead
  const t1 = t0 + 5
  const candidate = s.tracks.find(
    (tk) =>
      tk.type === 'video' &&
      s.clips.some((c) => c.trackId === tk.id && c.assetId.startsWith('pack-')) &&
      !s.clips.some((c) => c.trackId === tk.id && c.start < t1 && c.start + c.duration > t0),
  )
  return candidate?.id ?? s.createTrack('video')
}

function addPackClip(def: PackAssetDef, trackId?: string): string | undefined {
  useEditor.getState().recordPackUse(def.id, def.section, def.group)
  const state = useEditor.getState()
  const assetId = ensurePackAsset(def)
  const target = trackId ?? freePackTrack()
  const before = new Set(state.clips.map((c) => c.id))
  state.addClipToTrack(target, assetId, state.playhead)
  const created = useEditor.getState().clips.find((c) => !before.has(c.id) && c.assetId === assetId)
  if (created) state.selectClip(created.id)
  return created?.id
}

/** Stack assets as layers at the playhead: desktops go below, each next layer on its own track above. */
function stackPackAssets(defs: PackAssetDef[]) {
  let lastId: string | undefined
  defs.forEach((def, i) => {
    const state = useEditor.getState()
    if (i === 0 && def.id.startsWith('desktop-')) {
      const firstVideo = state.tracks.find((t) => t.type === 'video')
      const bgTrack = firstVideo ? state.createTrack('video', 'below', firstVideo.id) : state.createTrack('video')
      lastId = addPackClip(def, bgTrack)
    } else {
      lastId = addPackClip(def, state.createTrack('video'))
    }
  })
  if (lastId) useEditor.getState().selectClip(lastId)
}

function addFakeDesktop(os: 'mac' | 'win') {
  const defs = ['desktop', 'chrome', 'cursor'].map((kind) =>
    PACK_ASSETS.find((a) => a.id === `${kind}-${os}`)!,
  )
  stackPackAssets(defs)
}

function addBundle(bundle: PackBundleDef) {
  const defs = bundle.items
    .map((id) => PACK_ASSETS.find((a) => a.id === id))
    .filter((d): d is PackAssetDef => Boolean(d))
  stackPackAssets(defs)
}

function AssetCard({ def }: { def: PackAssetDef }) {
  const liked = useEditor((st) => st.packLikes.includes(def.id))
  const togglePackLike = useEditor((st) => st.togglePackLike)
  return (
    <div className="relative">
    <button
      type="button"
      data-testid={`pack-asset-${def.id}`}
      title={`${def.name} — add as an overlay clip at the playhead`}
      aria-label={`Add ${def.name} overlay clip`}
      onClick={() => addPackClip(def)}
      className="group min-w-0 overflow-hidden rounded-lg border border-ink-800 bg-ink-900 text-left transition-colors hover:border-brand/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className="relative block aspect-video w-full overflow-hidden bg-[repeating-conic-gradient(#161a23_0%_25%,#0c0e13_0%_50%)] bg-[length:16px_16px]">
        <img src={packAssetUrl(def.id)} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      </span>
      <span className="block truncate px-2 pt-1.5 text-[11px] font-medium text-ink-100" title={def.name}>{def.name}</span>
      <span className="block px-2 pb-2 text-[10px] leading-snug text-ink-500">{def.desc}</span>
    </button>
    <button
      type="button"
      data-testid={`pack-like-${def.id}`}
      aria-pressed={liked}
      aria-label={liked ? `Unlike ${def.name}` : `Like ${def.name} — teach the library your taste`}
      title={liked ? 'Liked — the library learns from this' : 'Like — teach the library your taste'}
      onClick={(e) => { e.stopPropagation(); togglePackLike(def.id) }}
      className={`absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full backdrop-blur transition-colors ${liked ? 'bg-rose-500 text-white' : 'bg-black/45 text-white/80 hover:bg-black/70'}`}
    >
      <Heart size={12} fill={liked ? 'currentColor' : 'none'} />
    </button>
    </div>
  )
}

/** Collapsible folder row (Explorer tree / ChatGPT sidebar pattern). */
export function PackFolder({
  folderKey,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  folderKey: string
  title: string
  count: number
  open: boolean
  onToggle: (key: string, open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div data-testid={`pack-folder-${folderKey}`} className="overflow-hidden rounded-lg border border-ink-800/80 bg-ink-950/40">
      <button
        type="button"
        data-testid={`pack-folder-toggle-${folderKey}`}
        aria-expanded={open}
        onClick={() => onToggle(folderKey, !open)}
        className="flex min-h-8 w-full items-center gap-1.5 px-2 text-left transition-colors hover:bg-ink-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <ChevronRight size={12} className={`shrink-0 text-ink-500 transition-transform ${open ? 'rotate-90' : ''}`} />
        {open ? <FolderOpen size={13} className="shrink-0 text-amber-300" /> : <Folder size={13} className="shrink-0 text-amber-200/70" />}
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink-200">{title}</span>
        <span className="shrink-0 rounded-full bg-ink-800 px-1.5 py-px text-[9px] tabular-nums text-ink-400">{count}</span>
      </button>
      {open && <div className="ml-[15px] border-l border-ink-800 py-1.5 pl-2 pr-1.5">{children}</div>}
    </div>
  )
}

export function DesktopPackPanel() {
  const [browserOpen, setBrowserOpen] = useState(false)
  const [section, setSection] = useState<PackSection>('windows')
  const [recipeNote, setRecipeNote] = useState('')
  const [briefNote, setBriefNote] = useState('')
  const [briefTitle, setBriefTitle] = useState('Demo launch')
  const [briefCaptions, setBriefCaptions] = useState('Hook — watch this\nShow the main step\nFinish with the result')
  const [briefFormat, setBriefFormat] = useState<'16:9' | '9:16' | '1:1'>('16:9')
  const [briefBackdrop, setBriefBackdrop] = useState('post-card')
  const [briefStyle, setBriefStyle] = useState<'clean' | 'cinematic' | 'tutorial'>('clean')
  const [briefDuration, setBriefDuration] = useState(6)
  const [query, setQuery] = useState('')
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const cursorConfig = useEditor((s) => s.cursorConfig)
  const setCursorConfig = useEditor((s) => s.setCursorConfig)
  const selectedClip = useEditor((s) => s.clips.find((c) => c.id === s.selectedClipId) || null)
  const addScene3DObject = useEditor((s) => s.addScene3DObject)
  const sceneCount = useEditor((s) => s.scene3DObjects.length)
  const setIs3DMode = useEditor((s) => s.setIs3DMode)
  const setLeftTab = useEditor((s) => s.setLeftTab)

  const searching = query.trim().length > 0
  const needle = query.trim().toLowerCase()
  const matches = (name: string, desc: string, group: string) =>
    !searching || `${name} ${desc} ${group}`.toLowerCase().includes(needle)

  // Explorer order: folders follow GROUP_ORDER; items inside a folder are
  // filed A–Z by display name, like File Explorer's default name sort.
  const packLikes = useEditor((st) => st.packLikes)
  const packTaste = useEditor((st) => st.packTaste)
  const togglePackLike = useEditor((st) => st.togglePackLike)
  const [forYou, setForYou] = useState(false)
  const tasteScore = (a: PackAssetDef) =>
    (packLikes.includes(a.id) ? 100 : 0) +
    (packTaste[`asset:${a.id}`] || 0) * 4 +
    (packTaste[`group:${a.group}`] || 0) * 2 +
    (packTaste[`section:${a.section}`] || 0)
  const sectionAssets = useMemo(
    () => PACK_ASSETS.filter((a) => a.section === section).sort((a, b) =>
      forYou ? tasteScore(b) - tasteScore(a) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, forYou, packLikes, packTaste],
  )
  const groups = useMemo(() => {
    const order = GROUP_ORDER[section] || []
    const present = section === 'scenes'
      ? [...new Set(SCENE_RECIPES.map((r) => r.group))]
      : [...new Set(sectionAssets.map((a) => a.group))]
    return [...order.filter((g) => present.includes(g)), ...present.filter((g) => !order.includes(g))]
  }, [section, sectionAssets])

  const isOpen = (key: string, isFirst: boolean) => searching || (openMap[key] ?? isFirst)
  const toggleFolder = (key: string, open: boolean) => setOpenMap((m) => ({ ...m, [key]: open }))

  const applyEditPreset = (preset: (typeof EDIT_PRESETS)[number]) => {
    if (selectedClip && selectedClip.kind !== 'adjustment') {
      previewClipEffect(selectedClip.id, preset.label, preset.effect)
    } else {
      previewEffectLayer(preset.label, preset.effect)
    }
  }

  /** Add a pack asset in 5-second editable segments so longer brief scenes stay covered. */
  const addPackForDuration = (def: PackAssetDef, start: number, duration: number): string | undefined => {
    let firstId: string | undefined
    for (let offset = 0; offset < duration; offset += 5) {
      const state = useEditor.getState()
      state.setPlayhead(start + offset)
      const id = addPackClip(def)
      if (id) {
        useEditor.getState().trimClip(id, 'right', start + Math.min(duration, offset + 5))
        firstId ??= id
      }
    }
    return firstId
  }

  /**
   * Scene Brief Builder: the CoAnimator workflow adapted without AI framing.
   * A short structured brief becomes ordinary editable clips using only real
   * editor actions — sequence settings, pack assets, title clips, trims and
   * transform keyframes. Nothing is generated as a locked render.
   */
  const buildSceneBrief = () => {
    const state = useEditor.getState()
    const start = Math.max(0, state.playhead)
    const duration = Math.max(3, Math.min(12, Math.round(briefDuration || 6)))
    const title = briefTitle.trim() || 'Demo scene'
    const captions = briefCaptions
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6)
    const captionLines = captions.length ? captions : ['Hook — watch this', 'Show the main step', 'Finish with the result']
    const before = state.clips.length

    state.setSequenceAspectRatio(briefFormat)
    let backdropId: string | undefined
    if (briefBackdrop !== 'none') {
      const backdrop = PACK_ASSETS.find((asset) => asset.id === briefBackdrop)
      if (backdrop) backdropId = addPackForDuration(backdrop, start, duration)
    }
    if (briefStyle === 'cinematic') {
      const letterbox = PACK_ASSETS.find((asset) => asset.id === 'letterbox')
      if (letterbox) addPackForDuration(letterbox, start, duration)
    }
    if (briefStyle === 'tutorial') {
      const spotlight = PACK_ASSETS.find((asset) => asset.id === 'spotlight')
      const highlight = PACK_ASSETS.find((asset) => asset.id === 'highlight-box')
      if (spotlight) addPackForDuration(spotlight, start, duration)
      if (highlight) addPackForDuration(highlight, start, duration)
    }
    if (backdropId) {
      const clip = useEditor.getState().clips.find((candidate) => candidate.id === backdropId)
      if (clip) {
        useEditor.getState().setClipKeyframe(clip.id, 'scale_x', 0, 1, 'bezier')
        useEditor.getState().setClipKeyframe(clip.id, 'scale_x', Math.max(0.1, clip.duration), 1.06, 'bezier')
        useEditor.getState().setClipKeyframe(clip.id, 'scale_y', 0, 1, 'bezier')
        useEditor.getState().setClipKeyframe(clip.id, 'scale_y', Math.max(0.1, clip.duration), 1.06, 'bezier')
      }
    }

    useEditor.getState().setPlayhead(start)
    useEditor.getState().addTextTitleClip(title, duration)
    const segment = duration / captionLines.length
    captionLines.forEach((line, index) => {
      useEditor.getState().setPlayhead(start + index * segment)
      useEditor.getState().addTextTitleClip(line, Math.max(0.5, segment))
    })
    useEditor.getState().setPlayhead(start)
    const created = useEditor.getState().clips.length - before
    setBriefNote(`Built ${created} editable clips for “${title}” (${briefFormat}, ${duration}s). Move, trim, restyle or delete any piece.`)
    setRecipeNote('')
  }

  /** Plain-file brief exchange: an external agent (or the user) can author
   * this JSON, and OmniFrame builds it with the same editor actions. */
  const exportBrief = () => {
    const brief = {
      kind: 'omniframe-scene-brief',
      version: 1,
      title: briefTitle,
      captions: briefCaptions.split('\n').map((line) => line.trim()).filter(Boolean),
      format: briefFormat,
      duration: briefDuration,
      backdrop: briefBackdrop,
      style: briefStyle,
    }
    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'demo-scene-brief.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setBriefNote('Scene brief saved as JSON — edit it as a plain file, then import it back here to rebuild.')
  }

  const importBrief = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>
      if (parsed.kind !== 'omniframe-scene-brief') throw new Error('Not an OmniFrame scene brief')
      const formats = ['16:9', '9:16', '1:1']
      const backdrops = ['post-card', 'desktop-mac', 'desktop-win', 'phone-frame', 'chrome-webpage', 'spotify-phone', 'maps-phone', 'none']
      const styles = ['clean', 'cinematic', 'tutorial']
      if (typeof parsed.title === 'string') setBriefTitle(parsed.title.slice(0, 80))
      if (Array.isArray(parsed.captions)) setBriefCaptions(parsed.captions.filter((line): line is string => typeof line === 'string').slice(0, 6).join('\n'))
      else if (typeof parsed.captions === 'string') setBriefCaptions(parsed.captions.slice(0, 500))
      if (typeof parsed.format === 'string' && formats.includes(parsed.format)) setBriefFormat(parsed.format as typeof briefFormat)
      if (typeof parsed.duration === 'number') setBriefDuration(Math.max(3, Math.min(12, Math.round(parsed.duration))))
      if (typeof parsed.backdrop === 'string' && backdrops.includes(parsed.backdrop)) setBriefBackdrop(parsed.backdrop)
      if (typeof parsed.style === 'string' && styles.includes(parsed.style)) setBriefStyle(parsed.style as typeof briefStyle)
      setBriefNote('Brief loaded — review the fields, then Build editable scene.')
    } catch {
      setBriefNote('That file is not a valid OmniFrame scene brief JSON.')
    }
  }

  const visibleBundles = PACK_BUNDLES.filter((b) => matches(b.name, b.desc, 'Packs')).sort((a, b) => a.name.localeCompare(b.name))
  const anyVisible =
    visibleBundles.length > 0 ||
    sectionAssets.some((a) => matches(a.name, a.desc, a.group)) ||
    (section === 'edits' && EDIT_PRESETS.some((p) => matches(p.label, p.desc, p.group))) ||
    section === 'threed'

  return (
    <div data-testid="desktop-pack-panel" className="flex h-full flex-col text-xs text-ink-200">
      <button type="button" data-testid="pack-browser-open-btn" onClick={() => setBrowserOpen(true)} className="mb-2 h-8 w-full rounded-md border border-brand/60 bg-brand/15 font-semibold text-brand-200 transition hover:bg-brand/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Open Pack Browser</button>
      <div className="px-3 pt-3">
        <h2 className="text-sm font-semibold text-ink-50">Desktop Pack</h2>
        <label className="mt-2 flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 px-2 py-1.5 focus-within:border-brand">
          <Search size={12} className="shrink-0 text-ink-500" />
          <input
            data-testid="pack-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search packs, windows, cursors…"
            aria-label="Search Desktop Pack"
            className="min-w-0 flex-1 bg-transparent text-[11px] text-ink-100 outline-none placeholder:text-ink-500"
          />
        </label>
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            data-testid="pack-foryou-toggle"
            aria-pressed={forYou}
            onClick={() => setForYou((v) => !v)}
            className={`flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-medium ${forYou ? 'border-rose-400 bg-rose-500/20 text-rose-100' : 'border-ink-700 text-ink-400 hover:border-ink-500'}`}
            title="Order by what you like and place most — learned on this device"
          >
            <Heart size={10} fill={forYou ? 'currentColor' : 'none'} /> For you
          </button>
          <span className="text-[9px] leading-tight text-ink-600">Likes teach the order. Nothing leaves this device.</span>
        </div>
      </div>

      {/* Horizontal segmented bar — the five sections of this tab */}
      <HScrollStrip
        data-testid="pack-section-strip"
        arrowTestIdPrefix="pack-section"
        className="mt-2 shrink-0 border-b border-ink-800"
        innerClassName="flex-nowrap items-center gap-1 px-2 pb-2"
      >
        <div role="tablist" aria-label="Desktop Pack sections" className="flex flex-nowrap items-center gap-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              data-testid={`pack-section-${id}`}
              onClick={() => setSection(id)}
              className={`flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                section === id
                  ? 'border-brand bg-brand/25 text-white'
                  : 'border-ink-700 bg-ink-850 text-ink-300 hover:bg-ink-800 hover:text-ink-100'
              }`}
            >
              <Icon size={12} className="shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </HScrollStrip>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {!anyVisible && searching && (
          <p data-testid="pack-search-empty" className="rounded-md border border-ink-800 px-2 py-3 text-center text-[10px] text-ink-500">
            Nothing in this section matches “{query}”.
          </p>
        )}

        {section === 'windows' && (
          <>
            {(searching ? visibleBundles.length > 0 : true) && (
              <PackFolder folderKey="packs" title="Packs · one-click bundles" count={visibleBundles.length} open={isOpen('packs', true)} onToggle={toggleFolder}>
                <div className="space-y-1.5">
                  {visibleBundles.map((bundle) => (
                    <button
                      key={bundle.id}
                      type="button"
                      data-testid={`pack-bundle-${bundle.id}`}
                      title={`${bundle.name} — stack ${bundle.items.length} clips at the playhead`}
                      onClick={() => addBundle(bundle)}
                      className="block w-full rounded-lg border border-teal-800/70 bg-teal-950/25 px-2 py-2 text-left transition-colors hover:border-teal-500"
                    >
                      <span className="block truncate text-[11px] font-semibold text-teal-100">{bundle.name}</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-teal-200/70">{bundle.desc}</span>
                      <span className="mt-1 inline-block rounded-full bg-teal-900/60 px-1.5 py-px text-[9px] text-teal-200">{bundle.items.length} clips stacked</span>
                    </button>
                  ))}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" data-testid="pack-desktop-mac" onClick={() => addFakeDesktop('mac')} className="rounded-lg border border-ink-700 bg-ink-900 px-2 py-2 text-left transition-colors hover:border-brand/70">
                      <span className="block text-[11px] font-medium text-ink-100">Fake Desktop · macOS</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-ink-500">Wallpaper + Chrome + cursor</span>
                    </button>
                    <button type="button" data-testid="pack-desktop-win" onClick={() => addFakeDesktop('win')} className="rounded-lg border border-ink-700 bg-ink-900 px-2 py-2 text-left transition-colors hover:border-brand/70">
                      <span className="block text-[11px] font-medium text-ink-100">Fake Desktop · Windows</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-ink-500">Wallpaper + Chrome + cursor</span>
                    </button>
                  </div>
                </div>
              </PackFolder>
            )}
            {groups.filter((g) => g !== 'Packs').map((group, gi) => {
              const items = sectionAssets.filter((a) => a.group === group && matches(a.name, a.desc, a.group))
              if (searching && items.length === 0) return null
              const key = `windows-${group}`
              return (
                <PackFolder key={key} folderKey={key} title={group} count={items.length} open={isOpen(key, gi === 0)} onToggle={toggleFolder}>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((def) => <AssetCard key={def.id} def={def} />)}
                  </div>
                </PackFolder>
              )
            })}
          </>
        )}

        {section === 'scenes' && (
          <>
            <div data-testid="pack-scene-builder" className="space-y-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-2.5 py-2">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-100"><Clapperboard size={12} /> Scene Brief Builder</p>
              </div>
              <label className="block text-[10px] text-ink-400" htmlFor="pack-brief-title">Scene title
                <input id="pack-brief-title" data-testid="pack-brief-title" value={briefTitle} onChange={(e) => setBriefTitle(e.target.value)} className="mt-1 h-7 w-full rounded border border-ink-700 bg-ink-900 px-2 text-[11px] text-ink-100 outline-none focus:border-cyan-400" />
              </label>
              <label className="block text-[10px] text-ink-400" htmlFor="pack-brief-captions">Caption beats — one per line
                <textarea id="pack-brief-captions" data-testid="pack-brief-captions" value={briefCaptions} onChange={(e) => setBriefCaptions(e.target.value)} rows={3} className="mt-1 w-full resize-y rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-[11px] leading-snug text-ink-100 outline-none focus:border-cyan-400" />
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="block text-[10px] text-ink-400" htmlFor="pack-brief-format">Format
                  <select id="pack-brief-format" data-testid="pack-brief-format" value={briefFormat} onChange={(e) => setBriefFormat(e.target.value as typeof briefFormat)} className="mt-1 h-7 w-full rounded border border-ink-700 bg-ink-900 px-1.5 text-[11px] text-ink-100">
                    <option value="16:9">Landscape 16:9</option>
                    <option value="9:16">Vertical 9:16</option>
                    <option value="1:1">Square 1:1</option>
                  </select>
                </label>
                <label className="block text-[10px] text-ink-400" htmlFor="pack-brief-duration">Duration · {briefDuration}s
                  <input id="pack-brief-duration" data-testid="pack-brief-duration" type="range" min={3} max={12} step={1} value={briefDuration} onChange={(e) => setBriefDuration(Number(e.target.value))} className="mt-2 w-full accent-cyan-400" />
                </label>
                <label className="block text-[10px] text-ink-400" htmlFor="pack-brief-backdrop">Backdrop / device
                  <select id="pack-brief-backdrop" data-testid="pack-brief-backdrop" value={briefBackdrop} onChange={(e) => setBriefBackdrop(e.target.value)} className="mt-1 h-7 w-full rounded border border-ink-700 bg-ink-900 px-1.5 text-[11px] text-ink-100">
                    <option value="post-card">Social post card</option>
                    <option value="desktop-mac">Fake desktop · macOS</option>
                    <option value="desktop-win">Fake desktop · Windows</option>
                    <option value="phone-frame">Phone frame</option>
                    <option value="chrome-webpage">Chrome webpage · demo</option>
                    <option value="spotify-phone">Music player · phone</option>
                    <option value="maps-phone">Maps · phone</option>
                    <option value="none">No backdrop</option>
                  </select>
                </label>
                <label className="block text-[10px] text-ink-400" htmlFor="pack-brief-style">Look
                  <select id="pack-brief-style" data-testid="pack-brief-style" value={briefStyle} onChange={(e) => setBriefStyle(e.target.value as typeof briefStyle)} className="mt-1 h-7 w-full rounded border border-ink-700 bg-ink-900 px-1.5 text-[11px] text-ink-100">
                    <option value="clean">Clean</option>
                    <option value="cinematic">Cinematic letterbox</option>
                    <option value="tutorial">Tutorial spotlight</option>
                  </select>
                </label>
              </div>
              <button type="button" data-testid="pack-brief-build" onClick={buildSceneBrief} className="h-8 w-full rounded-md bg-cyan-500 font-semibold text-ink-950 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                Build editable scene
              </button>
              <div className="flex gap-1.5">
                <button type="button" data-testid="pack-brief-export" onClick={exportBrief} className="h-7 flex-1 rounded-md border border-ink-700 text-[10px] text-ink-200 transition hover:border-cyan-400/60 hover:text-white">
                  Export brief JSON
                </button>
                <label className="flex h-7 flex-1 cursor-pointer items-center justify-center rounded-md border border-ink-700 text-[10px] text-ink-200 transition hover:border-cyan-400/60 hover:text-white">
                  Import brief JSON
                  <input data-testid="pack-brief-file" type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { void importBrief(e.target.files?.[0]); e.target.value = '' }} />
                </label>
              </div>
              {briefNote && <p data-testid="pack-brief-note" aria-live="polite" className="rounded border border-cyan-400/25 bg-ink-950/60 px-2 py-1.5 text-[10px] leading-snug text-cyan-100">{briefNote}</p>}
            </div>
            {recipeNote && (
              <p data-testid="pack-recipe-note" aria-live="polite" className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[10px] leading-snug text-cyan-100">{recipeNote}</p>
            )}
            {groups.map((group) => {
              const items = SCENE_RECIPES.filter((r) => r.group === group && matches(r.label, r.desc, r.group)).sort((a, b) => a.label.localeCompare(b.label))
              if (searching && items.length === 0) return null
              return (
                <div key={group} className="space-y-1.5">
                  <p className="px-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500">{group}</p>
                  {items.map((recipe) => (
                    <button
                      key={recipe.id}
                      type="button"
                      data-testid={`pack-recipe-${recipe.id}`}
                      disabled={recipe.needsClip && !selectedClip}
                      title={recipe.needsClip && !selectedClip ? `${recipe.desc} — select a clip first` : recipe.desc}
                      onClick={() => void recipe.run().then(setRecipeNote)}
                      className="w-full rounded-lg border border-ink-800 bg-ink-900 px-2.5 py-2 text-left transition hover:border-cyan-500/40 hover:bg-ink-850 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-100"><Clapperboard size={12} className="text-cyan-300" />{recipe.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-ink-400">{recipe.desc}{recipe.needsClip && !selectedClip ? ' (select a clip first)' : ''}</span>
                    </button>
                  ))}
                </div>
              )
            })}
          </>
        )}

        {section === 'apps' && (
          <>
            {groups.map((group, gi) => {
              const items = sectionAssets.filter((a) => a.group === group && matches(a.name, a.desc, a.group))
              if (searching && items.length === 0) return null
              const key = `apps-${group}`
              return (
                <PackFolder key={key} folderKey={key} title={group} count={items.length} open={isOpen(key, gi === 0)} onToggle={toggleFolder}>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((def) => <AssetCard key={def.id} def={def} />)}
                  </div>
                </PackFolder>
              )
            })}
          </>
        )}

        {section === 'cursors' && (
          <>
            {groups.map((group, gi) => {
              const items = sectionAssets.filter((a) => a.group === group && matches(a.name, a.desc, a.group))
              if (searching && items.length === 0) return null
              const key = `cursors-${group}`
              return (
                <PackFolder key={key} folderKey={key} title={group} count={items.length} open={isOpen(key, gi === 0)} onToggle={toggleFolder}>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((def) => <AssetCard key={def.id} def={def} />)}
                  </div>
                </PackFolder>
              )
            })}
            <PackFolder folderKey="cursors-editor" title="Editor Cursor" count={CURSOR_PACKS.length} open={isOpen('cursors-editor', false)} onToggle={toggleFolder}>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {CURSOR_PACKS.map((packDef) => (
                  <button
                    key={packDef.id}
                    type="button"
                    data-testid={`pack-cursor-theme-${packDef.id}`}
                    aria-pressed={cursorConfig.pack === packDef.id && cursorConfig.enabled}
                    onClick={() => setCursorConfig({ pack: packDef.id, theme: packDef.id, enabled: true })}
                    className={`min-h-7 rounded-full border px-2.5 text-[11px] transition-colors ${
                      cursorConfig.pack === packDef.id && cursorConfig.enabled
                        ? 'border-brand bg-brand/25 text-white'
                        : 'border-ink-700 text-ink-300 hover:bg-ink-800 hover:text-ink-100'
                    }`}
                  >
                    {packDef.label}
                  </button>
                ))}
              </div>
            </PackFolder>
          </>
        )}

        {section === 'overlays' && (
          <>
            {groups.map((group, gi) => {
              const items = sectionAssets.filter((a) => a.group === group && matches(a.name, a.desc, a.group))
              if (searching && items.length === 0) return null
              const key = `overlays-${group}`
              return (
                <PackFolder key={key} folderKey={key} title={group} count={items.length} open={isOpen(key, gi === 0)} onToggle={toggleFolder}>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((def) => <AssetCard key={def.id} def={def} />)}
                  </div>
                </PackFolder>
              )
            })}
          </>
        )}

        {section === 'edits' && (
          <>
            
            {['Looks', 'Fixes'].map((group, gi) => {
              const items = EDIT_PRESETS.filter((preset) => preset.group === group && matches(preset.label, preset.desc, preset.group))
              if (searching && items.length === 0) return null
              const key = `edits-${group}`
              return (
                <PackFolder key={key} folderKey={key} title={group} count={items.length} open={isOpen(key, gi === 0)} onToggle={toggleFolder}>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        data-testid={`pack-edit-${preset.id}`}
                        title={`Preview ${preset.label}; Apply in the monitor to commit`}
                        onClick={() => applyEditPreset(preset)}
                        className="min-w-0 rounded-lg border border-ink-800 bg-ink-900 px-2 py-2 text-left transition-colors hover:border-brand/70"
                      >
                        <span className="block truncate text-[11px] font-medium text-ink-100">{preset.label}</span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-ink-500">{preset.desc}</span>
                      </button>
                    ))}
                  </div>
                </PackFolder>
              )
            })}
          </>
        )}

        {section === 'threed' && (
          <>
            <PackFolder folderKey="threed-primitives" title="Primitives" count={PRIMITIVES.length} open={isOpen('threed-primitives', true)} onToggle={toggleFolder}>
              <div className="grid grid-cols-3 gap-1.5">
                {PRIMITIVES.map(({ type, label, color }) => (
                  <button
                    key={type}
                    type="button"
                    data-testid={`pack-3d-${type}`}
                    onClick={() => {
                      addScene3DObject({
                        id: `pack-obj-${Date.now().toString(36)}-${type}`,
                        name: label,
                        type,
                        position: { x: (sceneCount % 5 - 2) * 1.7, y: 0, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 },
                        scale: { x: 1, y: 1, z: 1 },
                        color,
                      })
                      setIs3DMode(true)
                    }}
                    className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-ink-800 bg-ink-900 text-[11px] text-ink-200 transition-colors hover:border-brand/70"
                  >
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </PackFolder>
            <PackFolder folderKey="threed-scene" title="Scene" count={sceneCount} open={isOpen('threed-scene', false)} onToggle={toggleFolder}>
              <p className="text-[10px] leading-snug text-ink-500">{sceneCount} object{sceneCount === 1 ? '' : 's'} in the 3D scene. Added objects open in the 3D view to place.</p>
              <button
                type="button"
                data-testid="pack-open-3d"
                onClick={() => setLeftTab('threed')}
                className="mt-1.5 h-8 w-full rounded-md border border-ink-700 text-[11px] text-ink-200 transition-colors hover:border-brand/70 hover:text-white"
              >
                Open the full 3D Scene panel
              </button>
            </PackFolder>
          </>
        )}
      </div>
      <PackBrowserModal open={browserOpen} onClose={() => setBrowserOpen(false)} />
    </div>
  )
}
