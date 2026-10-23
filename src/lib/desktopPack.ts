/**
 * Desktop Pack assets: procedurally drawn screen-life overlays (the style of
 * editing popularised by desktop-emulation videos — the whole "video" plays
 * out inside fake OS/browser windows). Every asset is a 1280×720 PNG drawn on
 * a canvas, so window frames, cursors and overlays composite over any clip
 * with correct transparency and no external files.
 */

export type PackSection = 'windows' | 'apps' | 'scenes' | 'cursors' | 'overlays' | 'edits' | 'threed'

export interface PackAssetDef {
  id: string
  name: string
  desc: string
  section: Exclude<PackSection, 'edits' | 'threed'>
  /** Folder the asset is filed under inside its section (Explorer-style). */
  group: string
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
}

/** One-click bundle: several assets stacked as layered clips at the playhead. */
export interface PackBundleDef {
  id: string
  name: string
  desc: string
  items: string[] // PackAssetDef ids, bottom layer first
}

export const PACK_BUNDLES: PackBundleDef[] = [
  { id: 'video-call', name: 'Video Call Pack', desc: 'Demo video-call window with highlight box and hand cursor', items: ['video-call-window', 'highlight-box', 'cursor-hand'] },
  { id: 'phone-shopping', name: 'Phone Shopping Pack', desc: 'Demo shopping phone with post card and hand cursor', items: ['shopping-phone', 'post-card', 'cursor-hand'] },
  { id: 'phone-story', name: 'Phone Story Pack', desc: 'Maps, photo gallery and hand cursor for a vertical phone story', items: ['maps-phone', 'photo-gallery-phone', 'cursor-hand'] },
  { id: 'creator-desk', name: 'Creator Desk Pack', desc: 'Podcast player, demo calendar and hand cursor for planning scenes', items: ['podcast-player', 'calendar-window', 'cursor-hand'] },
  { id: 'podcast-studio', name: 'Podcast Studio Pack', desc: 'Studio window, progress bar and hand cursor for podcast edits', items: ['podcast-studio-window', 'progress-bar', 'cursor-hand'] },
  { id: 'phone-lifestyle', name: 'Phone Lifestyle Pack', desc: 'Fitness and food-delivery phones with hand cursor for lifestyle cuts', items: ['fitness-phone', 'food-delivery-phone', 'cursor-hand'] },
  { id: 'studio-desk', name: 'Studio Desk Pack', desc: 'Music studio window, progress bar and hand cursor for studio scenes', items: ['music-studio-window', 'progress-bar', 'cursor-hand'] },
  { id: 'phone-essentials', name: 'Phone Essentials Pack', desc: 'Banking, mail and alarm phones with hand cursor for everyday phone scenes', items: ['banking-phone', 'mail-phone', 'alarm-phone', 'cursor-hand'] },
  { id: 'music-phone', name: 'Music Phone Pack', desc: 'Phone music player with progress bar for vertical listening scenes', items: ['spotify-phone', 'progress-bar', 'cursor-hand'] },
  { id: 'design-review', name: 'Design Review Pack', desc: 'Design canvas, highlight box and hand cursor for UI walkthroughs', items: ['figma-desktop', 'highlight-box', 'cursor-hand'] },
  { id: 'screenlife-mac', name: 'Screen-Life Pack · macOS', desc: 'Desktop, Chrome, cursor and click ring for a full screen-life scene', items: ['desktop-mac', 'chrome-mac', 'cursor-mac', 'click-ring'] },
  { id: 'screenlife-win', name: 'Screen-Life Pack · Windows', desc: 'Desktop, Chrome, cursor and click ring for a full screen-life scene', items: ['desktop-win', 'chrome-win', 'cursor-win', 'click-ring'] },
  { id: 'tutorial', name: 'Tutorial Pack', desc: 'Browser window, hand cursor, highlight box and progress bar', items: ['chrome-win', 'cursor-hand', 'highlight-box', 'progress-bar'] },
  { id: 'social', name: 'Social Pack', desc: 'Phone frame, post card, notification and hand cursor', items: ['phone-frame', 'post-card', 'notify-mac', 'cursor-hand'] },
  { id: 'music-video', name: 'Music Video Pack', desc: 'Music player window, progress bar and click ring', items: ['spotify-desktop', 'progress-bar', 'click-ring'] },
  { id: 'phone-demo', name: 'Phone Demo Pack', desc: 'Android phone home screen with hand cursor', items: ['phone-android-home', 'cursor-hand'] },
  { id: 'privacy', name: 'Privacy Pack', desc: 'Chat window with a censor bar and spotlight dim', items: ['chat-window', 'censor-bar', 'spotlight'] },
  { id: 'streamer', name: 'Streamer Pack', desc: 'PiP frame, screen glare and vignette for face-cam layouts', items: ['pip-frame', 'screen-glare', 'vignette'] },
  { id: 'screenshot-study', name: 'Screenshot Study Pack', desc: 'Light icon desktop, profile phone and mascot frame rebuilt from the UI screenshot study', items: ['desktop-light-icons', 'profile-phone', 'frame-mascot', 'cursor-hand'] },
]

export const PACK_W = 1280
export const PACK_H = 720

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function windowChrome(
  ctx: CanvasRenderingContext2D,
  os: 'mac' | 'win',
  opts: { title: string; browser?: 'chrome' | 'safari'; urlText?: string },
) {
  const x = 110, y = 70, w = PACK_W - 220, h = PACK_H - 170
  // shadow + frame
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 42
  ctx.shadowOffsetY = 16
  roundRect(ctx, x, y, w, h, os === 'mac' ? 12 : 8)
  ctx.fillStyle = 'rgba(24,26,32,0.96)'
  ctx.fill()
  ctx.restore()
  roundRect(ctx, x, y, w, h, os === 'mac' ? 12 : 8)
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  const barH = opts.browser ? 86 : 44
  // title/tab bar background (clip to top rounded corners)
  ctx.save()
  roundRect(ctx, x, y, w, h, os === 'mac' ? 12 : 8)
  ctx.clip()
  ctx.fillStyle = os === 'mac' ? '#3a3d44' : '#20242c'
  ctx.fillRect(x, y, w, barH)
  if (opts.browser) {
    ctx.fillStyle = os === 'mac' ? '#2c2f36' : '#171b21'
    ctx.fillRect(x, y + 44, w, 42)
  }
  ctx.restore()

  if (os === 'mac') {
    const cols = ['#ff5f57', '#febc2e', '#28c840']
    cols.forEach((c, i) => {
      ctx.beginPath()
      ctx.fillStyle = c
      ctx.arc(x + 22 + i * 22, y + 22, 6.5, 0, Math.PI * 2)
      ctx.fill()
    })
  } else {
    ctx.fillStyle = '#e8eaed'
    ctx.font = '600 17px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('─', x + w - 108, y + 27)
    ctx.fillText('▢', x + w - 66, y + 27)
    ctx.fillStyle = '#fff'
    ctx.fillText('✕', x + w - 26, y + 27)
  }

  if (opts.browser === 'chrome') {
    // tab
    ctx.fillStyle = os === 'mac' ? '#4a4e57' : '#2d333d'
    roundRect(ctx, x + (os === 'mac' ? 86 : 14), y + 8, 210, 30, 8)
    ctx.fill()
    ctx.fillStyle = '#d7dbe0'
    ctx.font = '13px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(opts.title, x + (os === 'mac' ? 98 : 26), y + 28)
    // address pill
    ctx.fillStyle = os === 'mac' ? '#1f2228' : '#242a33'
    roundRect(ctx, x + 120, y + 50, w - 240, 28, 14)
    ctx.fill()
    ctx.fillStyle = '#9aa3af'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText(`🔒  ${opts.urlText || 'youtube.com/watch'}`, x + 134, y + 69)
    ctx.fillStyle = '#5f6873'
    ctx.font = '15px system-ui, sans-serif'
    ctx.fillText('‹  ›  ⟳', x + 26, y + 69)
  } else if (opts.browser === 'safari') {
    ctx.fillStyle = '#1f2228'
    roundRect(ctx, x + w / 2 - 190, y + 48, 380, 28, 8)
    ctx.fill()
    ctx.fillStyle = '#9aa3af'
    ctx.font = '13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(opts.urlText || 'apple.com', x + w / 2, y + 67)
    ctx.textAlign = 'left'
  } else {
    ctx.fillStyle = '#c9ced6'
    ctx.font = '500 14px system-ui, sans-serif'
    ctx.textAlign = os === 'mac' ? 'center' : 'left'
    ctx.fillText(opts.title, os === 'mac' ? x + w / 2 : x + 16, y + 28)
    ctx.textAlign = 'left'
  }
}

function wallpaper(ctx: CanvasRenderingContext2D, os: 'mac' | 'win') {
  const g = ctx.createLinearGradient(0, 0, PACK_W, PACK_H)
  if (os === 'mac') {
    g.addColorStop(0, '#3b2d63'); g.addColorStop(0.5, '#7a3b78'); g.addColorStop(1, '#e0678a')
  } else {
    g.addColorStop(0, '#0b3d91'); g.addColorStop(0.6, '#1464c8'); g.addColorStop(1, '#3fa7e0')
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, PACK_W, PACK_H)
  if (os === 'mac') {
    ctx.fillStyle = 'rgba(20,20,28,0.72)'
    ctx.fillRect(0, 0, PACK_W, 30)
    ctx.fillStyle = '#fff'
    ctx.font = '600 14px system-ui, sans-serif'
    ctx.fillText('  ●  Finder   File   Edit   View', 10, 20)
    ctx.textAlign = 'right'
    ctx.fillText('Wed 15 Oct   9:41  ', PACK_W - 8, 20)
    ctx.textAlign = 'left'
    // dock
    const dockW = 460
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    roundRect(ctx, PACK_W / 2 - dockW / 2, PACK_H - 74, dockW, 62, 18)
    ctx.fill()
    const icons = ['#4da3ff', '#5cd65c', '#ffb340', '#ff5f57', '#b78bff', '#4dd7d0', '#f2f2f2', '#8a93a3']
    icons.forEach((c, i) => {
      ctx.fillStyle = c
      roundRect(ctx, PACK_W / 2 - dockW / 2 + 14 + i * 54, PACK_H - 66, 46, 46, 11)
      ctx.fill()
    })
  } else {
    ctx.fillStyle = 'rgba(16,20,28,0.82)'
    ctx.fillRect(0, PACK_H - 46, PACK_W, 46)
    ctx.fillStyle = '#4da3ff'
    roundRect(ctx, PACK_W / 2 - 120, PACK_H - 38, 30, 30, 6)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    roundRect(ctx, PACK_W / 2 - 78, PACK_H - 38, 170, 30, 15)
    ctx.fill()
    ctx.fillStyle = '#dbe4f0'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText('🔍  Search', PACK_W / 2 - 66, PACK_H - 19)
    ctx.textAlign = 'right'
    ctx.fillText('9:41 AM  15/10/2026 ', PACK_W - 8, PACK_H - 19)
    ctx.textAlign = 'left'
  }
}

function arrowCursor(ctx: CanvasRenderingContext2D, variant: 'win' | 'mac' | 'hand' | 'ibeam' | 'ring') {
  const cx = PACK_W * 0.6, cy = PACK_H * 0.46
  ctx.save()
  ctx.translate(cx, cy)
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 3
  if (variant === 'ring') {
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(255,80,80,0.95)'
    ctx.lineWidth = 5
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,80,80,0.45)'
    ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = 'rgba(255,80,80,0.95)'
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill()
  } else if (variant === 'ibeam') {
    ctx.fillStyle = '#111'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-12, -26); ctx.lineTo(12, -26); ctx.lineTo(12, -18); ctx.lineTo(4, -18); ctx.lineTo(4, 18); ctx.lineTo(12, 18); ctx.lineTo(12, 26); ctx.lineTo(-12, 26); ctx.lineTo(-12, 18); ctx.lineTo(-4, 18); ctx.lineTo(-4, -18); ctx.lineTo(-12, -18)
    ctx.closePath(); ctx.fill(); ctx.stroke()
  } else if (variant === 'hand') {
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-6, 34)
    ctx.lineTo(-14, 10); ctx.quadraticCurveTo(-16, 0, -9, -2)
    ctx.lineTo(-8, -16); ctx.quadraticCurveTo(-7, -24, -2, -23)
    ctx.lineTo(-1, -10)
    ctx.lineTo(1, -22); ctx.quadraticCurveTo(3, -28, 7, -24)
    ctx.lineTo(8, -11)
    ctx.lineTo(10, -21); ctx.quadraticCurveTo(13, -26, 16, -21)
    ctx.lineTo(17, -8)
    ctx.lineTo(20, -15); ctx.quadraticCurveTo(24, -19, 26, -13)
    ctx.lineTo(24, 12); ctx.quadraticCurveTo(22, 30, 8, 34)
    ctx.closePath(); ctx.fill(); ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, 40)
    ctx.lineTo(11, 31)
    ctx.lineTo(17, 46)
    ctx.lineTo(23, 43)
    ctx.lineTo(17, 28)
    ctx.lineTo(28, 28)
    ctx.closePath()
    ctx.fillStyle = variant === 'win' ? '#ffffff' : '#111318'
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = variant === 'win' ? '#111318' : '#ffffff'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
  ctx.restore()
}

function textLines(ctx: CanvasRenderingContext2D, x: number, y: number, widths: number[], color: string, gap = 16) {
  ctx.fillStyle = color
  widths.forEach((w, i) => {
    roundRect(ctx, x, y + i * gap, w, 7, 3.5)
    ctx.fill()
  })
}

function explorerWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Downloads — File Explorer' })
  const x = 110, y = 70
  ctx.fillStyle = '#23262d'
  ctx.fillRect(x + 1, y + 45, 190, 420)
  textLines(ctx, x + 18, y + 66, [110, 88, 96, 74, 102], 'rgba(200,208,220,0.5)', 26)
  const cols = ['#ffd76a', '#7cc7ff', '#ffd76a', '#b78bff', '#7dffb2', '#ffd76a']
  cols.forEach((c, i) => {
    const fx = x + 226 + (i % 3) * 190
    const fy = y + 76 + Math.floor(i / 3) * 130
    ctx.fillStyle = c
    roundRect(ctx, fx, fy, 74, 52, 6)
    ctx.fill()
    textLines(ctx, fx, fy + 64, [86], 'rgba(220,226,236,0.55)')
  })
}

function codeWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'editor.ts — Code' })
  const x = 110, y = 70
  ctx.fillStyle = '#1b1e26'
  ctx.fillRect(x + 1, y + 45, 168, 420)
  textLines(ctx, x + 16, y + 66, [96, 74, 108, 62, 88, 70], 'rgba(160,170,190,0.45)', 24)
  const palette = ['#c792ea', '#82aaff', '#7fdbca', '#ffcb6b', '#89ddff', '#f07178']
  for (let row = 0; row < 12; row++) {
    let cx = x + 210 + (row % 3) * 26
    const segs = 2 + (row % 3)
    for (let s = 0; s < segs; s++) {
      const wdt = 44 + ((row * 37 + s * 53) % 90)
      ctx.fillStyle = palette[(row + s) % palette.length] + 'cc'
      roundRect(ctx, cx, y + 66 + row * 26, wdt, 8, 4)
      ctx.fill()
      cx += wdt + 14
    }
  }
}

function terminalWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'Terminal — zsh' })
  const x = 110, y = 70
  ctx.fillStyle = 'rgba(10,12,10,0.94)'
  ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.font = '15px ui-monospace, monospace'
  const lines: [string, string][] = [
    ['#7ee787', '➜  ~ npm run build'],
    ['#a5d6a7', '✓ 214 modules transformed in 1.8s'],
    ['#7ee787', '➜  ~ git push origin main'],
    ['#a5d6a7', 'Everything up-to-date'],
    ['#e6edf3', '➜  ~ █'],
  ]
  lines.forEach(([c, s], i) => {
    ctx.fillStyle = c
    ctx.fillText(s, x + 22, y + 84 + i * 28)
  })
}

function chatWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'Messages' })
  const x = 110, y = 70
  const bubbles: [number, number, number, string][] = [
    [0, 0, 330, '#33373f'], [1, 64, 260, '#2563eb'], [0, 128, 290, '#33373f'], [1, 192, 350, '#2563eb'], [0, 256, 210, '#33373f'],
  ]
  bubbles.forEach(([right, dy, wdt, color]) => {
    const bx = right ? x + PACK_W - 220 - 36 - wdt : x + 36
    ctx.fillStyle = color
    roundRect(ctx, bx, y + 66 + dy, wdt, 48, 16)
    ctx.fill()
    textLines(ctx, bx + 16, y + 82 + dy, [wdt - 90], 'rgba(255,255,255,0.65)')
  })
}

function deviceFrame(ctx: CanvasRenderingContext2D, tablet: boolean) {
  const w = tablet ? 560 : 300
  const h = tablet ? 700 : 620
  const x = (PACK_W - w) / 2, y = (PACK_H - h) / 2
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 36
  ctx.shadowOffsetY = 14
  roundRect(ctx, x, y, w, h, tablet ? 26 : 44)
  ctx.fillStyle = '#101216'
  ctx.fill()
  ctx.restore()
  roundRect(ctx, x, y, w, h, tablet ? 26 : 44)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  ctx.stroke()
  if (!tablet) {
    ctx.fillStyle = '#101216'
    roundRect(ctx, x + w / 2 - 52, y + 10, 104, 22, 11)
    ctx.fill()
  }
}

function youtubePlayer(ctx: CanvasRenderingContext2D) {
  const x = 110, y = 80, w = PACK_W - 220, h = 500
  roundRect(ctx, x, y, w, h, 10)
  ctx.fillStyle = '#0f0f12'
  ctx.fill()
  roundRect(ctx, x, y, w, h, 10)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.beginPath()
  ctx.moveTo(x + w / 2 - 22, y + 190)
  ctx.lineTo(x + w / 2 - 22, y + 248)
  ctx.lineTo(x + w / 2 + 30, y + 219)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#27272c'
  ctx.fillRect(x, y + h - 8, w, 8)
  ctx.fillStyle = '#ff0033'
  ctx.fillRect(x, y + h - 8, w * 0.42, 8)
  textLines(ctx, x + 26, y + h - 64, [380, 240], 'rgba(230,234,240,0.8)', 22)
}

function postCard(ctx: CanvasRenderingContext2D) {
  const x = 390, y = 130, w = 500, h = 300
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 12
  roundRect(ctx, x, y, w, h, 16)
  ctx.fillStyle = '#171a21'
  ctx.fill()
  ctx.restore()
  roundRect(ctx, x, y, w, h, 16)
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.stroke()
  ctx.fillStyle = '#6d5efc'
  ctx.beginPath(); ctx.arc(x + 44, y + 44, 22, 0, Math.PI * 2); ctx.fill()
  textLines(ctx, x + 80, y + 30, [120, 70], 'rgba(230,234,240,0.75)', 18)
  textLines(ctx, x + 26, y + 92, [440, 420, 300], 'rgba(190,198,212,0.55)', 22)
  ctx.font = '17px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(160,170,190,0.8)'
  ctx.fillText('💬 24      🔁 108      ♥ 1.2k      📊 48k', x + 26, y + h - 26)
}

function notifyCard(ctx: CanvasRenderingContext2D, os: 'mac' | 'win') {
  const w = 380, h = 92
  const x = os === 'mac' ? PACK_W - w - 36 : PACK_W - w - 30
  const y = os === 'mac' ? 40 : PACK_H - h - 66
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 26
  ctx.shadowOffsetY = 10
  roundRect(ctx, x, y, w, h, os === 'mac' ? 18 : 8)
  ctx.fillStyle = os === 'mac' ? 'rgba(38,40,48,0.92)' : 'rgba(24,26,34,0.96)'
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#4da3ff'
  roundRect(ctx, x + 16, y + 16, 34, 34, 8)
  ctx.fill()
  textLines(ctx, x + 64, y + 20, [150, 240], 'rgba(235,238,244,0.8)', 20)
}

function keyCaps(ctx: CanvasRenderingContext2D) {
  const drawKey = (cx: number, label: string) => {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 5
    roundRect(ctx, cx - 42, PACK_H - 170, 84, 84, 14)
    ctx.fillStyle = '#22252d'
    ctx.fill()
    ctx.restore()
    roundRect(ctx, cx - 42, PACK_H - 170, 84, 84, 14)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.stroke()
    ctx.fillStyle = '#e8ebf0'
    ctx.font = '600 30px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(label, cx, PACK_H - 116)
    ctx.textAlign = 'left'
  }
  drawKey(PACK_W / 2 - 52, '⌘')
  drawKey(PACK_W / 2 + 52, 'K')
}

function progressBar(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  roundRect(ctx, 90, h - 64, w - 180, 10, 5)
  ctx.fill()
  ctx.fillStyle = '#6d5efc'
  roundRect(ctx, 90, h - 64, (w - 180) * 0.62, 10, 5)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(90 + (w - 180) * 0.62, h - 59, 11, 0, Math.PI * 2)
  ctx.fill()
}

function highlightBox(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = '#ffd83d'
  ctx.lineWidth = 6
  roundRect(ctx, 350, 210, 580, 260, 14)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,216,61,0.95)'
  roundRect(ctx, 350, 182, 150, 30, 8)
  ctx.fill()
  ctx.fillStyle = '#17130a'
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.fillText('  LOOK HERE', 356, 203)
}

function magnifier(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 7
  ctx.beginPath(); ctx.arc(570, 300, 120, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = 'rgba(20,22,28,0.6)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(570, 300, 112, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 16
  ctx.beginPath(); ctx.moveTo(662, 392); ctx.lineTo(742, 472); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = '300 64px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('+', 570, 322)
  ctx.textAlign = 'left'
}

function censorBar(ctx: CanvasRenderingContext2D) {
  const x = 390, y = 300, w = 500, h = 84
  const cols = ['#3a3f4a', '#565e6e', '#23262d', '#788294', '#454c5c']
  const cell = 20
  for (let yy = y; yy < y + h; yy += cell) {
    for (let xx = x; xx < x + w; xx += cell) {
      ctx.fillStyle = cols[((xx / cell + yy / cell) % cols.length) | 0]
      ctx.fillRect(xx, yy, cell, cell)
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.strokeRect(x, y, w, h)
}


function demoRows(ctx: CanvasRenderingContext2D, x: number, y: number, rows: string[], accent: string) {
  ctx.font = '13px system-ui, sans-serif'
  rows.forEach((label, i) => {
    const ry = y + i * 34
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.055)'
    roundRect(ctx, x, ry, 560, 26, 6)
    ctx.fill()
    ctx.fillStyle = accent
    roundRect(ctx, x + 8, ry + 6, 14, 14, 3)
    ctx.fill()
    ctx.fillStyle = 'rgba(230,234,240,0.85)'
    ctx.fillText(label, x + 32, ry + 18)
  })
}

function spotifyDesktop(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Music Player — Demo' })
  const x = 110, y = 70
  ctx.fillStyle = '#101010'
  ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#181818'
  ctx.fillRect(x + 1, y + 45, 190, 340)
  textLines(ctx, x + 18, y + 66, [110, 88, 96, 74], 'rgba(200,208,220,0.5)', 26)
  ctx.fillStyle = '#1db954'
  ctx.font = '700 22px system-ui, sans-serif'
  ctx.fillText('Demo Playlist', x + 226, y + 92)
  demoRows(ctx, x + 226, y + 112, ['Demo Track 01 — Test Artist', 'Demo Track 02 — Test Artist', 'Demo Track 03 — Test Artist', 'Demo Track 04 — Test Artist', 'Demo Track 05 — Test Artist'], '#1db954')
  // player bar
  ctx.fillStyle = '#181818'
  ctx.fillRect(x + 1, y + 386, PACK_W - 222, 78)
  ctx.fillStyle = '#1db954'
  ctx.beginPath(); ctx.arc(x + 70, y + 424, 18, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#0b0b0b'
  ctx.beginPath(); ctx.moveTo(x + 65, y + 415); ctx.lineTo(x + 65, y + 433); ctx.lineTo(x + 79, y + 424); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  roundRect(ctx, x + 330, y + 420, 420, 6, 3); ctx.fill()
  ctx.fillStyle = '#1db954'
  roundRect(ctx, x + 330, y + 420, 190, 6, 3); ctx.fill()
  ctx.fillStyle = 'rgba(230,234,240,0.8)'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('Demo Track 01 — Test Artist', x + 120, y + 430)
}

function phoneHome(ctx: CanvasRenderingContext2D, os: 'ios' | 'android') {
  deviceFrame(ctx, false)
  const x = (PACK_W - 300) / 2, y = (PACK_H - 620) / 2
  const g = ctx.createLinearGradient(x, y, x + 300, y + 620)
  if (os === 'ios') { g.addColorStop(0, '#3b4a8f'); g.addColorStop(1, '#8a4a7d') } else { g.addColorStop(0, '#123a2c'); g.addColorStop(1, '#1d5c46') }
  ctx.save()
  roundRect(ctx, x + 6, y + 6, 288, 608, 38)
  ctx.clip()
  ctx.fillStyle = g
  ctx.fillRect(x, y, 300, 620)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '600 12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('9:41', x + 150, y + 34)
  ctx.font = '300 44px system-ui, sans-serif'
  ctx.fillText(os === 'ios' ? 'Demo Phone' : 'Demo Pixel', x + 150, y + 120)
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('Tuesday, Demo 15', x + 150, y + 146)
  ctx.textAlign = 'left'
  const apps = ['#ff5f57', '#1db954', '#4da3ff', '#ffb340', '#b78bff', '#ff3b6b', '#4dd7d0', '#f2f2f2', '#7ee787', '#ff9f43', '#6d5efc', '#34c759']
  apps.forEach((c, i) => {
    const ax = x + 26 + (i % 4) * 66
    const ay = y + 190 + Math.floor(i / 4) * 74
    ctx.fillStyle = c
    roundRect(ctx, ax, ay, 48, 48, os === 'ios' ? 12 : 14)
    ctx.fill()
  })
  if (os === 'android') {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    roundRect(ctx, x + 24, y + 500, 252, 38, 19); ctx.fill()
    ctx.fillStyle = '#3c4043'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText('  Search demo…', x + 38, y + 524)
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.24)'
    roundRect(ctx, x + 16, y + 540, 268, 62, 20); ctx.fill()
    apps.slice(0, 4).forEach((c, i) => { ctx.fillStyle = c; roundRect(ctx, x + 28 + i * 66, y + 548, 46, 46, 11); ctx.fill() })
  }
  ctx.restore()
}

function phoneChrome(ctx: CanvasRenderingContext2D) {
  deviceFrame(ctx, false)
  const x = (PACK_W - 300) / 2, y = (PACK_H - 620) / 2
  ctx.save()
  roundRect(ctx, x + 6, y + 6, 288, 608, 38)
  ctx.clip()
  ctx.fillStyle = '#20242c'
  ctx.fillRect(x, y, 300, 620)
  ctx.fillStyle = '#171b21'
  ctx.fillRect(x, y, 300, 92)
  ctx.fillStyle = '#2d333d'
  roundRect(ctx, x + 18, y + 44, 264, 34, 17); ctx.fill()
  ctx.fillStyle = '#9aa3af'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('  demo.site/watch', x + 32, y + 66)
  textLines(ctx, x + 24, y + 120, [220, 250, 180], 'rgba(200,208,220,0.4)', 26)
  demoRows(ctx, x + 20, y + 220, ['Demo result one', 'Demo result two', 'Demo result three'], '#4da3ff')
  ctx.restore()
}

function explorerWin11(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Music — File Explorer' })
  const x = 110, y = 70
  ctx.fillStyle = '#191c22'
  ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#20242c'
  ctx.fillRect(x + 1, y + 45, 196, 420)
  ctx.fillStyle = 'rgba(230,234,240,0.75)'
  ctx.font = '13px system-ui, sans-serif'
  ;['Home', 'Gallery', 'Desktop', 'Downloads', 'Documents', 'Music', 'Videos'].forEach((f, i) => ctx.fillText(`▸  ${f}`, x + 20, y + 78 + i * 30))
  demoRows(ctx, x + 226, y + 66, ['Demo Clip 01.mp4 — 00:12 — 1920×1080', 'Demo Clip 02.mp4 — 00:08 — 1080×1080', 'Demo Song 01.mp3 — 03:05 — Test Artist', 'Demo Photo 01.jpg — 4000×3000', 'Project Notes (demo).txt'], '#ffd76a')
}

function finderMac(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'Demo Folder — Finder' })
  const x = 110, y = 70
  ctx.fillStyle = '#22242a'
  ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#2a2d34'
  ctx.fillRect(x + 1, y + 45, 190, 420)
  ctx.fillStyle = 'rgba(230,234,240,0.75)'
  ctx.font = '13px system-ui, sans-serif'
  ;['Recents', 'Desktop', 'Documents', 'Downloads', 'Movies', 'Music', 'Pictures'].forEach((f, i) => ctx.fillText(`•  ${f}`, x + 20, y + 78 + i * 30))
  for (let i = 0; i < 6; i++) {
    const fx = x + 226 + (i % 3) * 180
    const fy = y + 70 + Math.floor(i / 3) * 140
    ctx.fillStyle = '#ffd76a'
    roundRect(ctx, fx, fy, 74, 52, 6); ctx.fill()
    ctx.fillStyle = 'rgba(230,234,240,0.75)'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(`Demo File 0${i + 1}`, fx, fy + 74)
  }
}

function youtubeStudio(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Channel analytics — Demo Studio' })
  const x = 110, y = 70
  ctx.fillStyle = '#17181c'
  ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#202127'
  ctx.fillRect(x + 1, y + 45, 170, 420)
  textLines(ctx, x + 18, y + 66, [96, 74, 108, 62, 88], 'rgba(160,170,190,0.45)', 26)
  ctx.fillStyle = 'rgba(230,234,240,0.9)'
  ctx.font = '700 20px system-ui, sans-serif'
  ctx.fillText('Demo Channel analytics', x + 206, y + 92)
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(200,208,220,0.7)'
  ctx.fillText('Views  12.4K demo      Watch time  812 demo hours', x + 206, y + 120)
  const bars = [42, 68, 55, 90, 74, 120, 96, 140, 112, 160, 132, 178]
  bars.forEach((bh, i) => {
    ctx.fillStyle = i % 3 === 0 ? '#3ea6ff' : 'rgba(62,166,255,0.55)'
    ctx.fillRect(x + 216 + i * 58, y + 330 - bh, 34, bh)
  })
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(x + 206, y + 330, 720, 2)
}

function gmailWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'Inbox — Demo Mail' })
  const x = 110, y = 70
  ctx.fillStyle = '#1b1d23'
  ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#22252d'
  ctx.fillRect(x + 1, y + 45, 180, 420)
  textLines(ctx, x + 18, y + 66, [96, 74, 108, 62], 'rgba(160,170,190,0.45)', 26)
  demoRows(ctx, x + 216, y + 66, ['Demo Sender — Test subject line one', 'Demo Team — Your demo report is ready', 'Demo Store — Order demo #0001 confirmed', 'Demo Studio — Video finished processing', 'Demo News — Weekly demo digest'], '#ff6b6b')
}

function whatsappChat(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Demo Chat' })
  const x = 110, y = 70
  ctx.fillStyle = '#0b141a'
  ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#1f2c34'
  ctx.fillRect(x + 1, y + 45, PACK_W - 222, 52)
  ctx.fillStyle = '#25d366'
  ctx.beginPath(); ctx.arc(x + 42, y + 71, 16, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(230,234,240,0.9)'
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.fillText('Demo Contact', x + 70, y + 76)
  const bubbles: [number, number, string][] = [[0, 0, 'Demo message one'], [1, 58, 'Demo reply here'], [0, 116, 'Sending the demo file now'], [1, 174, 'Got it — test looks good']]
  ctx.font = '13px system-ui, sans-serif'
  bubbles.forEach(([right, dy, label]) => {
    const wdt = 300
    const bx = right ? x + PACK_W - 220 - 36 - wdt : x + 36
    ctx.fillStyle = right ? '#005c4b' : '#1f2c34'
    roundRect(ctx, bx, y + 116 + dy, wdt, 42, 10)
    ctx.fill()
    ctx.fillStyle = 'rgba(235,240,244,0.9)'
    ctx.fillText(label, bx + 14, y + 142 + dy)
  })
}

function figmaPhone(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'Phone UI — Demo Design' })
  const x = 110, y = 70
  ctx.fillStyle = '#1e1e1e'
  ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#2c2c2c'
  ctx.fillRect(x + 1, y + 45, 180, 420)
  textLines(ctx, x + 18, y + 66, [96, 74, 108, 62, 88, 70], 'rgba(180,180,190,0.4)', 24)
  ctx.fillStyle = '#262626'
  ctx.fillRect(x + 190, y + 45, PACK_W - 412, 420)
  for (let i = 0; i < 2; i++) {
    const fx = x + 320 + i * 300
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'
    ctx.lineWidth = 2
    roundRect(ctx, fx, y + 76, 190, 360, 20); ctx.stroke()
    ctx.fillStyle = '#a259ff'
    roundRect(ctx, fx + 18, y + 104, 154, 90, 10); ctx.fill()
    textLines(ctx, fx + 18, y + 216, [140, 110, 128], 'rgba(220,220,230,0.5)', 24)
    ctx.fillStyle = '#0d99ff'
    roundRect(ctx, fx + 18, y + 330, 154, 36, 8); ctx.fill()
  }
  ctx.fillStyle = '#2c2c2c'
  ctx.fillRect(x + PACK_W - 220 - 170, y + 45, 170, 420)
  textLines(ctx, x + PACK_W - 220 - 152, y + 66, [110, 88, 96, 74, 102], 'rgba(180,180,190,0.4)', 26)
}


function spotifyMac(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'Music Player — Demo (Mac)' })
  const x = 110, y = 70
  ctx.fillStyle = '#101010'
  ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  demoRows(ctx, x + 26, y + 96, ['Demo Track 01 — Test Artist', 'Demo Track 02 — Test Artist', 'Demo Track 03 — Sample Band'], '#1db954')
  ctx.fillStyle = '#1db954'
  ctx.beginPath(); ctx.arc(x + 120, y + 330, 40, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#0c0e12'
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.fillText('DEMO', x + 98, y + 336)
}

function spotifyPhone(ctx: CanvasRenderingContext2D) {
  deviceFrame(ctx, false)
  const w = 300, h = 620
  const x = (PACK_W - w) / 2, y = (PACK_H - h) / 2
  ctx.fillStyle = '#121212'
  roundRect(ctx, x + 6, y + 38, w - 12, h - 90, 24); ctx.fill()
  ctx.fillStyle = '#1db954'
  roundRect(ctx, x + 30, y + 70, w - 60, 170, 12); ctx.fill()
  ctx.fillStyle = '#0c0e12'
  ctx.font = '600 17px system-ui, sans-serif'
  ctx.fillText('DEMO ALBUM', x + 44, y + 162)
  demoRows(ctx, x + 34, y + 300, ['Demo Track 01', 'Demo Track 02', 'Demo Track 03'], '#1db954')
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  roundRect(ctx, x + 30, y + 470, w - 60, 7, 3.5); ctx.fill()
  ctx.fillStyle = '#1db954'
  roundRect(ctx, x + 30, y + 470, 120, 7, 3.5); ctx.fill()
  ctx.fillStyle = '#e8eaed'
  ctx.font = '17px system-ui, sans-serif'
  ctx.fillText('⏮   ▶   ⏭', x + 112, y + 520)
}

function discordChat(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Community Chat — Demo Server' })
  const x = 110, y = 70
  ctx.fillStyle = '#1e1f22'
  ctx.fillRect(x + 1, y + 45, 200, 420)
  demoRows(ctx, x + 22, y + 96, ['# announcements', '# general (demo)', '# clips-and-edits', '# support'], '#5865f2')
  const msgs: [string, string][] = [
    ['DemoUser', 'This is a demo message.'],
    ['TestMod', 'All names here are test data.'],
    ['DemoUser', 'Replace with your own chat.'],
  ]
  ctx.font = '13px system-ui, sans-serif'
  msgs.forEach(([who, text], i) => {
    ctx.fillStyle = '#5865f2'
    ctx.beginPath(); ctx.arc(x + 250, y + 92 + i * 74, 15, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#e8eaed'
    ctx.font = '600 13px system-ui, sans-serif'
    ctx.fillText(who, x + 276, y + 84 + i * 74)
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(215,221,232,0.8)'
    ctx.fillText(text, x + 276, y + 106 + i * 74)
  })
}

function vscodeWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'demo-project — Code Editor' })
  const x = 110, y = 70
  ctx.fillStyle = '#181818'
  ctx.fillRect(x + 1, y + 45, 190, 420)
  demoRows(ctx, x + 22, y + 96, ['src', 'demo.ts', 'styles.css', 'README-demo.md'], '#4da3ff')
  const palette = ['#c792ea', '#82aaff', '#7fdbca', '#ffcb6b', '#89ddff', '#f07178']
  for (let row = 0; row < 11; row++) {
    let cx = x + 240 + (row % 3) * 26
    const segs = 2 + (row % 3)
    for (let sg = 0; sg < segs; sg++) {
      const wdt = 44 + ((row * 37 + sg * 53) % 90)
      ctx.fillStyle = palette[(row + sg) % palette.length] + 'cc'
      roundRect(ctx, cx, y + 76 + row * 27, wdt, 8, 4)
      ctx.fill()
      cx += wdt + 14
    }
  }
}

function figmaDesktop(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'Demo App — Design Canvas' })
  const x = 110, y = 70
  ctx.fillStyle = '#1e1e1e'
  ctx.fillRect(x + 1, y + 45, 170, 420)
  demoRows(ctx, x + 20, y + 96, ['Frame — Home', 'Card (demo)', 'Button (demo)', 'Text (demo)'], '#b78bff')
  ctx.fillStyle = '#2c2c2c'
  ctx.fillRect(x + 171, y + 45, PACK_W - 392, 420)
  // phone wireframe in the middle of the canvas
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1.5
  roundRect(ctx, x + 420, y + 80, 190, 340, 18); ctx.stroke()
  ctx.fillStyle = '#6d5efc'
  roundRect(ctx, x + 436, y + 100, 158, 60, 8); ctx.fill()
  demoRows(ctx, x + 440, y + 210, ['Title (demo)', 'Body (demo)'], '#b78bff')
  ctx.fillStyle = '#6d5efc'
  roundRect(ctx, x + 436, y + 350, 158, 34, 17); ctx.fill()
}

function chromeWebpage(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Demo Site — Example', browser: 'chrome', urlText: 'example.com/demo' })
  const x = 110, y = 70
  ctx.fillStyle = '#f4f5f7'
  ctx.fillRect(x + 1, y + 87, PACK_W - 222, 378)
  ctx.fillStyle = '#171a21'
  ctx.font = '600 24px system-ui, sans-serif'
  ctx.fillText('Demo headline (test text)', x + 60, y + 150)
  ctx.font = '14px system-ui, sans-serif'
  ctx.fillStyle = '#4a5160'
  ctx.fillText('Replace this page with your own screen recording.', x + 60, y + 182)
  ctx.fillText('Second demo paragraph — no real data here.', x + 60, y + 206)
  ctx.fillStyle = '#6d5efc'
  roundRect(ctx, x + 60, y + 240, 170, 40, 20); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.fillText('Call to action', x + 92, y + 265)
  const cols = ['#ffd76a', '#7cc7ff', '#7dffb2']
  cols.forEach((c, i) => {
    ctx.fillStyle = c
    roundRect(ctx, x + 60 + i * 260, y + 330, 220, 100, 10); ctx.fill()
  })
}

function phoneSceneBase(ctx: CanvasRenderingContext2D, bg = '#171a21') {
  deviceFrame(ctx, false)
  const w = 300, h = 620
  const x = (PACK_W - w) / 2, y = (PACK_H - h) / 2
  ctx.save()
  roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 38)
  ctx.clip()
  ctx.fillStyle = bg
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '600 12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('9:41 · Demo', x + w / 2, y + 32)
  ctx.textAlign = 'left'
  return { x, y, w, h }
}

function mapsPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h } = phoneSceneBase(ctx, '#dcead7')
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 18
  ctx.beginPath(); ctx.moveTo(x, y + 190); ctx.bezierCurveTo(x + 90, y + 150, x + 190, y + 260, x + w, y + 210); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + 80, y + 48); ctx.bezierCurveTo(x + 110, y + 220, x + 160, y + 390, x + 120, y + h); ctx.stroke()
  ctx.strokeStyle = '#f7c948'
  ctx.lineWidth = 7
  ctx.beginPath(); ctx.moveTo(x, y + 330); ctx.lineTo(x + w, y + 290); ctx.stroke()
  ctx.strokeStyle = '#4da3ff'
  ctx.lineWidth = 6
  ctx.beginPath(); ctx.moveTo(x + 52, y + 470); ctx.bezierCurveTo(x + 120, y + 360, x + 170, y + 330, x + 210, y + 210); ctx.stroke()
  ctx.fillStyle = '#e94235'
  ctx.beginPath(); ctx.arc(x + 210, y + 196, 17, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(x + 210, y + 196, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  roundRect(ctx, x + 20, y + 54, w - 40, 42, 21); ctx.fill()
  ctx.fillStyle = '#3c4043'; ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('Search demo place…', x + 38, y + 80)
  roundRect(ctx, x + 20, y + h - 132, w - 40, 92, 14); ctx.fill()
  ctx.fillStyle = '#171a21'; ctx.font = '600 15px system-ui, sans-serif'
  ctx.fillText('Demo Park', x + 38, y + h - 96)
  ctx.fillStyle = '#5f6368'; ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('12 min · Demo route · No real location', x + 38, y + h - 70)
  ctx.restore()
}

function photoGalleryPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#111318')
  ctx.fillStyle = '#f2f3f5'; ctx.font = '600 19px system-ui, sans-serif'
  ctx.fillText('Demo Photos', x + 22, y + 66)
  ctx.fillStyle = '#9aa3af'; ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('Test album · Sample images only', x + 22, y + 88)
  const colours = ['#ffd76a', '#7cc7ff', '#7dffb2', '#ff8fa3', '#b78bff', '#4dd7d0', '#ff9f43', '#f2f2f2', '#6d5efc']
  colours.forEach((colour, i) => {
    const gx = x + 18 + (i % 3) * 90
    const gy = y + 116 + Math.floor(i / 3) * 118
    ctx.fillStyle = colour
    roundRect(ctx, gx, gy, 78, 92, 10); ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(gx, gy + 68, 78, 24)
    ctx.fillStyle = '#fff'; ctx.font = '10px system-ui, sans-serif'
    ctx.fillText(`IMG_DEMO_${String(i + 1).padStart(2, '0')}`, gx + 7, gy + 84)
  })
  ctx.restore()
}

function notesPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#fff7d6')
  ctx.fillStyle = '#25200f'; ctx.font = '600 20px system-ui, sans-serif'
  ctx.fillText('Demo Notes', x + 22, y + 68)
  demoRows(ctx, x + 20, y + 104, ['Scene ideas (demo)', 'Shot list — test', 'Caption drafts', 'Export checklist'], '#d99a00')
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, x + 20, y + 330, w - 40, 190, 12); ctx.fill()
  ctx.fillStyle = '#3d371f'; ctx.font = '600 14px system-ui, sans-serif'
  ctx.fillText('Scene ideas (demo)', x + 36, y + 360)
  ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = '#756b45'
  ctx.fillText('Replace this note with your own text.', x + 36, y + 390)
  ctx.fillText('No private notes are stored in this asset.', x + 36, y + 414)
  ctx.restore()
}

function weatherPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#79aee8')
  ctx.fillStyle = '#fff'; ctx.font = '600 20px system-ui, sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('Demo City', x + w / 2, y + 78)
  ctx.font = '300 62px system-ui, sans-serif'; ctx.fillText('24°', x + w / 2, y + 148)
  ctx.font = '14px system-ui, sans-serif'; ctx.fillText('Sunny · Sample forecast', x + w / 2, y + 176)
  ctx.textAlign = 'left'
  ;[['Today', '24°'], ['Tue', '23°'], ['Wed', '21°'], ['Thu', '25°']].forEach(([day, temp], i) => {
    const ry = y + 230 + i * 58
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; roundRect(ctx, x + 22, ry, w - 44, 42, 12); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = '13px system-ui, sans-serif'; ctx.fillText(day, x + 38, ry + 27); ctx.fillText(temp, x + w - 70, ry + 27)
  })
  ctx.restore()
}

function settingsPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#17191f')
  ctx.fillStyle = '#f2f3f5'; ctx.font = '600 20px system-ui, sans-serif'
  ctx.fillText('Demo Settings', x + 22, y + 68)
  ;[['Notifications', true], ['Auto captions', true], ['High quality export', false], ['Demo mode', true]].forEach(([label, on], i) => {
    const ry = y + 104 + i * 70
    ctx.fillStyle = '#22252d'; roundRect(ctx, x + 18, ry, w - 36, 52, 12); ctx.fill()
    ctx.fillStyle = '#e8eaed'; ctx.font = '13px system-ui, sans-serif'; ctx.fillText(String(label), x + 34, ry + 32)
    ctx.fillStyle = on ? '#34c759' : '#5f6368'; roundRect(ctx, x + w - 82, ry + 14, 44, 24, 12); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + w - (on ? 50 : 72), ry + 26, 9, 0, Math.PI * 2); ctx.fill()
  })
  ctx.restore()
}

function calendarWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'Demo Calendar' })
  const x = 110, y = 70
  ctx.fillStyle = '#f6f4ef'; ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#252525'; ctx.font = '600 20px system-ui, sans-serif'
  ctx.fillText('October — Demo Month', x + 30, y + 88)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  days.forEach((day, i) => { ctx.fillStyle = '#6d675d'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(day, x + 36 + i * 132, y + 118) })
  for (let i = 0; i < 28; i++) {
    const gx = x + 26 + (i % 7) * 132, gy = y + 132 + Math.floor(i / 7) * 72
    ctx.fillStyle = '#fff'; roundRect(ctx, gx, gy, 116, 58, 8); ctx.fill()
    ctx.fillStyle = '#4a463e'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(String(i + 1), gx + 8, gy + 17)
    if (i === 9 || i === 16 || i === 23) { ctx.fillStyle = i === 16 ? '#ff8fa3' : '#7cc7ff'; roundRect(ctx, gx + 8, gy + 28, 92, 18, 5); ctx.fill(); ctx.fillStyle = '#1d2733'; ctx.fillText(i === 16 ? 'Demo launch' : 'Demo edit', gx + 13, gy + 41) }
  }
}

function podcastPlayer(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Podcast Player — Demo' })
  const x = 110, y = 70
  ctx.fillStyle = '#181423'; ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#6d5efc'; roundRect(ctx, x + 34, y + 78, 190, 190, 16); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = '700 22px system-ui, sans-serif'; ctx.fillText('DEMO CAST', x + 62, y + 182)
  ctx.font = '600 20px system-ui, sans-serif'; ctx.fillText('Episode 01 — Test Topic', x + 258, y + 116)
  ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = '#b7b0d8'; ctx.fillText('Demo voices · Sample chapter markers', x + 258, y + 144)
  for (let i = 0; i < 42; i++) { const bh = 12 + ((i * 29) % 52); ctx.fillStyle = i < 18 ? '#b78bff' : '#49415f'; ctx.fillRect(x + 258 + i * 16, y + 218 - bh / 2, 8, bh) }
  ctx.fillStyle = '#e8eaed'; ctx.font = '18px system-ui, sans-serif'; ctx.fillText('⏮    ▶    ⏭', x + 430, y + 300)
  demoRows(ctx, x + 258, y + 342, ['Chapter 1 — Intro (demo)', 'Chapter 2 — Test story', 'Chapter 3 — Demo recap'], '#b78bff')
}

function spreadsheetWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Demo Budget — Spreadsheet' })
  const x = 110, y = 70
  ctx.fillStyle = '#f4f5f7'; ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#188038'; ctx.fillRect(x + 1, y + 45, PACK_W - 222, 38)
  ctx.fillStyle = '#fff'; ctx.font = '600 14px system-ui, sans-serif'; ctx.fillText('Demo Budget (test numbers)', x + 22, y + 69)
  const rows = [['Item', 'Demo cost', 'Status'], ['Camera card', '100', 'Test'], ['Music licence', '25', 'Sample'], ['Storage', '40', 'Demo'], ['Total', '165', 'Test only']]
  rows.forEach((row, r) => row.forEach((cell, c) => {
    const gx = x + 22 + c * 250, gy = y + 104 + r * 52
    ctx.fillStyle = r === 0 ? '#dce8dd' : '#fff'; ctx.fillRect(gx, gy, 238, 40); ctx.strokeStyle = '#c9d1c9'; ctx.strokeRect(gx, gy, 238, 40)
    ctx.fillStyle = '#202124'; ctx.font = `${r === 0 ? '600 ' : ''}12px system-ui, sans-serif`; ctx.fillText(cell, gx + 10, gy + 25)
  }))
}

function videoCallWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Demo Video Call' })
  const x = 110, y = 70
  ctx.fillStyle = '#12141a'; ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  const people = [['Demo Host', '#6d5efc'], ['Test Guest', '#2dd4bf'], ['Sample Speaker', '#f59e0b'], ['Demo Viewer', '#ff8fa3']]
  people.forEach(([name, colour], i) => {
    const gx = x + 26 + (i % 2) * 505, gy = y + 66 + Math.floor(i / 2) * 164
    ctx.fillStyle = '#1d2029'; roundRect(ctx, gx, gy, 480, 146, 12); ctx.fill()
    ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(gx + 240, gy + 58, 30, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(name, gx + 240, gy + 122); ctx.textAlign = 'left'
  })
  ctx.fillStyle = '#22252d'; roundRect(ctx, x + 390, y + 408, 300, 42, 21); ctx.fill()
  ctx.fillStyle = '#e8eaed'; ctx.font = '15px system-ui, sans-serif'; ctx.fillText('🎙   📷   ☐   ☎', x + 462, y + 436)
}

function shoppingPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#f6f4ef')
  ctx.fillStyle = '#252525'; ctx.font = '600 19px system-ui, sans-serif'; ctx.fillText('Demo Shop', x + 22, y + 68)
  ctx.fillStyle = '#756b45'; ctx.font = '12px system-ui, sans-serif'; ctx.fillText('Sample products · Test prices', x + 22, y + 90)
  const items = [['Demo Mug', '10 test'], ['Sample Tee', '20 test'], ['Demo Poster', '15 test'], ['Test Sticker', '5 test']]
  items.forEach(([name, price], i) => {
    const gx = x + 18 + (i % 2) * 138, gy = y + 116 + Math.floor(i / 2) * 172
    ctx.fillStyle = '#fff'; roundRect(ctx, gx, gy, 124, 148, 12); ctx.fill()
    ctx.fillStyle = ['#ffd76a', '#7cc7ff', '#ff8fa3', '#7dffb2'][i]; roundRect(ctx, gx + 12, gy + 12, 100, 76, 9); ctx.fill()
    ctx.fillStyle = '#252525'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText(name, gx + 12, gy + 112)
    ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = '#756b45'; ctx.fillText(price, gx + 12, gy + 132)
  })
  ctx.fillStyle = '#171a21'; roundRect(ctx, x + 22, y + 486, w - 44, 42, 21); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Demo checkout', x + w / 2, y + 513); ctx.textAlign = 'left'
  ctx.restore()
}

function filesPhone(ctx: CanvasRenderingContext2D) {
  const { x, y } = phoneSceneBase(ctx, '#17191f')
  ctx.fillStyle = '#f2f3f5'; ctx.font = '600 20px system-ui, sans-serif'; ctx.fillText('Demo Files', x + 22, y + 68)
  demoRows(ctx, x + 20, y + 100, ['Demo Clip 01.mp4', 'Demo Photo 01.jpg', 'Project Notes (demo).txt', 'Demo Song 01.mp3', 'Export Test.mp4'], '#ffd76a')
  ctx.fillStyle = '#22252d'; roundRect(ctx, x + 20, y + 330, 260, 116, 12); ctx.fill()
  ctx.fillStyle = '#e8eaed'; ctx.font = '600 13px system-ui, sans-serif'; ctx.fillText('Storage — demo only', x + 36, y + 360)
  ctx.fillStyle = '#3a3f4a'; roundRect(ctx, x + 36, y + 382, 228, 10, 5); ctx.fill()
  ctx.fillStyle = '#4da3ff'; roundRect(ctx, x + 36, y + 382, 92, 10, 5); ctx.fill()
  ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = '#9aa3af'; ctx.fillText('Test files · No real folders', x + 36, y + 420)
  ctx.restore()
}

function podcastStudioWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Demo Podcast Studio' })
  const x = 110, y = 70
  ctx.fillStyle = '#101318'; ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  const hosts: [string, string][] = [['Demo Host', '#6d5efc'], ['Test Guest', '#2dd4bf']]
  hosts.forEach(([name, colour], i) => {
    const gx = x + 26 + i * 505
    ctx.fillStyle = '#1a1e26'; roundRect(ctx, gx, y + 66, 480, 170, 12); ctx.fill()
    ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(gx + 240, y + 132, 34, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(name, gx + 240, y + 196)
    ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = '#9aa3af'; ctx.fillText('🎙 Demo microphone', gx + 240, y + 216); ctx.textAlign = 'left'
  })
  const levels: [string, number][] = [['Host level (demo)', 0.72], ['Guest level (demo)', 0.58], ['Music bed (demo)', 0.3]]
  levels.forEach(([label, v], i) => {
    const gy = y + 262 + i * 40
    ctx.fillStyle = '#9aa3af'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(label, x + 30, gy + 4)
    ctx.fillStyle = '#2a2f3a'; roundRect(ctx, x + 190, gy - 5, 560, 8, 4); ctx.fill()
    ctx.fillStyle = '#6d5efc'; roundRect(ctx, x + 190, gy - 5, 560 * v, 8, 4); ctx.fill()
    ctx.beginPath(); ctx.arc(x + 190 + 560 * v, gy - 1, 7, 0, Math.PI * 2); ctx.fillStyle = '#e8eaed'; ctx.fill()
  })
  ctx.fillStyle = '#ff5f57'; ctx.beginPath(); ctx.arc(x + 42, y + 408, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#e8eaed'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText('REC · 00:00 demo take', x + 56, y + 412)
}

function slidesWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'Demo Slides — Explainer' })
  const x = 110, y = 70
  ctx.fillStyle = '#f4f2ec'; ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  for (let i = 0; i < 3; i++) {
    const gy = y + 66 + i * 96
    ctx.fillStyle = i === 0 ? '#fff' : '#e9e5da'; roundRect(ctx, x + 24, gy, 150, 80, 8); ctx.fill()
    ctx.strokeStyle = i === 0 ? '#6d5efc' : 'rgba(0,0,0,0.08)'; ctx.lineWidth = i === 0 ? 2 : 1; roundRect(ctx, x + 24, gy, 150, 80, 8); ctx.stroke()
    ctx.fillStyle = '#252525'; ctx.font = '600 10px system-ui, sans-serif'; ctx.fillText(`Demo slide ${i + 1}`, x + 36, gy + 24)
    ctx.fillStyle = '#8a8474'; ctx.font = '9px system-ui, sans-serif'; ctx.fillText('Sample text only', x + 36, gy + 42)
  }
  ctx.fillStyle = '#fff'; roundRect(ctx, x + 200, y + 66, 780, 300, 10); ctx.fill()
  ctx.fillStyle = '#171a21'; ctx.font = '700 34px system-ui, sans-serif'; ctx.fillText('Demo Title', x + 236, y + 140)
  ctx.font = '15px system-ui, sans-serif'; ctx.fillStyle = '#55503f'
  ;['Sample point one — replace with your text', 'Sample point two — demo content only', 'Sample point three — test fields'].forEach((line, i) => ctx.fillText('•  ' + line, x + 236, y + 190 + i * 34))
  ctx.fillStyle = '#171a21'; roundRect(ctx, x + 200, y + 386, 780, 44, 8); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText('Speaker notes (demo): introduce the demo topic, then switch scenes.', x + 216, y + 413)
}

function fitnessPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#101216')
  ctx.fillStyle = '#f2f3f5'; ctx.font = '600 20px system-ui, sans-serif'; ctx.fillText('Demo Activity', x + 22, y + 68)
  const cx = x + w / 2, cy = y + 168
  const rings: [string, number][] = [['#ff5f57', 0.78], ['#7dffb2', 0.62], ['#4da3ff', 0.45]]
  rings.forEach(([colour, frac], i) => {
    const r = 62 - i * 16
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    ctx.strokeStyle = colour; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke()
  })
  ctx.fillStyle = '#f2f3f5'; ctx.font = '700 17px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Demo rings', cx, cy + 6); ctx.textAlign = 'left'
  const stats: [string, string][] = [['Move (demo)', '320 / 400 test'], ['Exercise (demo)', '18 / 30 test'], ['Steps (demo)', '6,420 sample']]
  stats.forEach(([label, value], i) => {
    const gy = y + 286 + i * 52
    ctx.fillStyle = '#1a1e26'; roundRect(ctx, x + 20, gy, w - 40, 40, 10); ctx.fill()
    ctx.fillStyle = '#9aa3af'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(label, x + 34, gy + 25)
    ctx.fillStyle = '#f2f3f5'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(value, x + w - 34, gy + 25); ctx.textAlign = 'left'
  })
  ctx.restore()
}

function foodDeliveryPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#f7f3ee')
  ctx.fillStyle = '#252525'; ctx.font = '600 20px system-ui, sans-serif'; ctx.fillText('Demo Eats', x + 22, y + 68)
  ctx.fillStyle = '#8a8474'; ctx.font = '12px system-ui, sans-serif'; ctx.fillText('Sample kitchens · Test delivery times', x + 22, y + 90)
  const places: [string, string, string][] = [
    ['Demo Burger Bar', '#ffd76a', '4.8 demo · 15 test min'],
    ['Sample Sushi', '#7cc7ff', '4.9 demo · 20 test min'],
    ['Test Tacos', '#ff8fa3', '4.7 demo · 12 test min'],
  ]
  places.forEach(([name, colour, meta], i) => {
    const gy = y + 112 + i * 104
    ctx.fillStyle = '#fff'; roundRect(ctx, x + 18, gy, w - 36, 90, 12); ctx.fill()
    ctx.fillStyle = colour; roundRect(ctx, x + 30, gy + 14, 62, 62, 9); ctx.fill()
    ctx.fillStyle = '#252525'; ctx.font = '600 13px system-ui, sans-serif'; ctx.fillText(name, x + 106, gy + 38)
    ctx.fillStyle = '#8a8474'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(meta, x + 106, gy + 60)
  })
  ctx.fillStyle = '#171a21'; roundRect(ctx, x + 22, y + 486, w - 44, 42, 21); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Demo order · 0 test items', x + w / 2, y + 513); ctx.textAlign = 'left'
  ctx.restore()
}

function videoPlayerPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#0c0e13')
  ctx.fillStyle = '#20242c'; roundRect(ctx, x + 16, y + 70, w - 32, 190, 14); ctx.fill()
  ctx.fillStyle = '#6d5efc'; ctx.beginPath(); ctx.arc(x + w / 2, y + 165, 28, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + w / 2 - 8, y + 152); ctx.lineTo(x + w / 2 - 8, y + 178); ctx.lineTo(x + w / 2 + 12, y + 165); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; roundRect(ctx, x + 34, y + 232, w - 68, 6, 3); ctx.fill()
  ctx.fillStyle = '#ff5f57'; roundRect(ctx, x + 34, y + 232, 104, 6, 3); ctx.fill()
  ctx.fillStyle = '#f2f3f5'; ctx.font = '600 16px system-ui, sans-serif'; ctx.fillText('Demo Video Title', x + 22, y + 304)
  ctx.fillStyle = '#9aa3af'; ctx.font = '12px system-ui, sans-serif'; ctx.fillText('Test Channel · Demo views · Sample captions', x + 22, y + 328)
  demoRows(ctx, x + 20, y + 368, ['Next demo video', 'Sample tutorial', 'Test recap'], '#ff5f57')
  ctx.restore()
}

function photoEditorWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Demo Photo Editor' })
  const x = 110, y = 70
  ctx.fillStyle = '#14161c'; ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  const gx = x + 24, gy = y + 66, gw = 690, gh = 296
  const sky = ctx.createLinearGradient(gx, gy, gx, gy + gh)
  sky.addColorStop(0, '#7cc7ff'); sky.addColorStop(0.62, '#ffd76a'); sky.addColorStop(1, '#ff8fa3')
  ctx.fillStyle = sky; ctx.fillRect(gx, gy, gw, gh)
  ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(gx + 470, gy + 92, 30, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#3f6212'; ctx.beginPath(); ctx.ellipse(gx + 150, gy + gh, 330, 92, 0, Math.PI, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#365314'; ctx.beginPath(); ctx.ellipse(gx + 520, gy + gh, 360, 70, 0, Math.PI, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(10,10,14,0.55)'; roundRect(ctx, gx + 14, gy + gh - 34, 220, 22, 6); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText('Demo photo — sample image', gx + 24, gy + gh - 19)
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = ['#7cc7ff', '#ffd76a', '#ff8fa3', '#7dffb2', '#b78bff'][i]
    roundRect(ctx, gx + i * 142, gy + gh + 14, 128, 54, 8); ctx.fill()
  }
  ctx.fillStyle = '#f2f3f5'; ctx.font = '600 13px system-ui, sans-serif'; ctx.fillText('Adjust (demo)', x + 742, y + 84)
  const sliders: [string, number][] = [['Exposure', 0.6], ['Contrast', 0.45], ['Saturation', 0.7], ['Warmth', 0.35]]
  sliders.forEach(([label, v], i) => {
    const sy = y + 116 + i * 52
    ctx.fillStyle = '#9aa3af'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(`${label} (demo)`, x + 742, sy)
    ctx.fillStyle = '#2a2f3a'; roundRect(ctx, x + 742, sy + 10, 250, 8, 4); ctx.fill()
    ctx.fillStyle = '#4da3ff'; roundRect(ctx, x + 742, sy + 10, 250 * v, 8, 4); ctx.fill()
    ctx.beginPath(); ctx.arc(x + 742 + 250 * v, sy + 14, 7, 0, Math.PI * 2); ctx.fillStyle = '#e8eaed'; ctx.fill()
  })
  ctx.fillStyle = '#1d2129'; roundRect(ctx, x + 742, y + 352, 250, 64, 10); ctx.fill()
  ctx.fillStyle = '#9aa3af'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText('Histogram — demo only', x + 758, y + 378)
  ctx.fillStyle = '#4da3ff'; ctx.fillText('▲ ▲▲  sample levels', x + 758, y + 400)
}

function docWriterWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'mac', { title: 'Demo Doc — Writer' })
  const x = 110, y = 70
  ctx.fillStyle = '#e9e7e1'; ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  ctx.fillStyle = '#f4f2ec'; roundRect(ctx, x + 24, y + 66, 150, 330, 10); ctx.fill()
  ctx.fillStyle = '#252525'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText('Demo docs', x + 40, y + 92)
  ;['Demo Doc 01', 'Sample Notes', 'Test Outline'].forEach((label, i) => {
    ctx.fillStyle = i === 0 ? '#fff' : 'transparent'; roundRect(ctx, x + 34, y + 106 + i * 40, 130, 30, 7); ctx.fill()
    ctx.fillStyle = '#55503f'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(label, x + 44, y + 125 + i * 40)
  })
  ctx.fillStyle = '#fff'; roundRect(ctx, x + 198, y + 66, 700, 330, 6); ctx.fill()
  ctx.fillStyle = '#252525'; ctx.font = '700 25px system-ui, sans-serif'; ctx.fillText('Demo Document', x + 234, y + 122)
  ctx.fillStyle = '#8a8474'; ctx.font = '12px system-ui, sans-serif'; ctx.fillText('Sample text only — replace every line with your own words.', x + 234, y + 148)
  for (let row = 0; row < 7; row++) {
    const lw = 620 - ((row * 137) % 210)
    ctx.fillStyle = '#d8d3c6'; roundRect(ctx, x + 234, y + 178 + row * 28, lw, 9, 4); ctx.fill()
  }
  ctx.fillStyle = '#171a21'; roundRect(ctx, x + 234, y + 396 - 18, 190, 30, 8); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = '600 11px system-ui, sans-serif'; ctx.fillText('Demo button — no action', x + 250, y + 397)
}

function musicStudioWindow(ctx: CanvasRenderingContext2D) {
  windowChrome(ctx, 'win', { title: 'Demo Music Studio' })
  const x = 110, y = 70
  ctx.fillStyle = '#101216'; ctx.fillRect(x + 1, y + 45, PACK_W - 222, 420)
  const tracks: [string, string, number[]][] = [
    ['Demo Drums', '#ff8fa3', [0, 90, 180, 270, 360, 450]],
    ['Demo Bass', '#7cc7ff', [0, 180, 360]],
    ['Demo Keys', '#7dffb2', [45, 225, 405]],
    ['Demo Vocal', '#ffd76a', [90, 270, 450]],
  ]
  tracks.forEach(([label, colour, blocks], i) => {
    const gy = y + 66 + i * 62
    ctx.fillStyle = '#1a1e26'; roundRect(ctx, x + 24, gy, 120, 48, 8); ctx.fill()
    ctx.fillStyle = '#e8eaed'; ctx.font = '600 11px system-ui, sans-serif'; ctx.fillText(label, x + 36, gy + 29)
    ctx.fillStyle = '#171b21'; roundRect(ctx, x + 158, gy, 820, 48, 8); ctx.fill()
    blocks.forEach((off) => {
      ctx.fillStyle = colour; roundRect(ctx, x + 166 + off, gy + 8, 76, 32, 6); ctx.fill()
    })
  })
  ctx.strokeStyle = '#ff5f57'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 470, y + 60); ctx.lineTo(x + 470, y + 322); ctx.stroke()
  ctx.fillStyle = '#ff5f57'; ctx.font = '600 11px system-ui, sans-serif'; ctx.fillText('▶ 00:00 demo playhead', x + 482, y + 74)
  ;['Demo fader 1', 'Demo fader 2', 'Demo fader 3', 'Demo master'].forEach((label, i) => {
    const fx = x + 60 + i * 240
    ctx.fillStyle = '#1a1e26'; roundRect(ctx, fx, y + 348, 190, 62, 10); ctx.fill()
    ctx.fillStyle = '#2a2f3a'; roundRect(ctx, fx + 24, y + 384, 142, 7, 3); ctx.fill()
    ctx.fillStyle = '#e8eaed'; roundRect(ctx, fx + 24 + 142 * (0.3 + i * 0.18), y + 378, 14, 18, 3); ctx.fill()
    ctx.fillStyle = '#9aa3af'; ctx.font = '10px system-ui, sans-serif'; ctx.fillText(label, fx + 24, y + 372)
  })
}

function bankingPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#0f1420')
  ctx.fillStyle = '#f2f3f5'; ctx.font = '600 20px system-ui, sans-serif'; ctx.fillText('Demo Bank', x + 22, y + 68)
  ctx.fillStyle = '#1d2a44'; roundRect(ctx, x + 18, y + 92, w - 36, 128, 16); ctx.fill()
  ctx.fillStyle = '#9db8dd'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText('Demo balance · Sample account 0123', x + 36, y + 124)
  ctx.fillStyle = '#fff'; ctx.font = '700 27px system-ui, sans-serif'; ctx.fillText('1,250 test credits', x + 36, y + 162)
  ctx.fillStyle = '#9db8dd'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText('Test numbers only — not a real account', x + 36, y + 190)
  const rows: [string, string][] = [['Demo Coffee', '−5 test'], ['Sample Salary', '+900 test'], ['Demo Transfer', '−40 test'], ['Test Refund', '+12 test']]
  rows.forEach(([label, amount], i) => {
    const gy = y + 244 + i * 58
    ctx.fillStyle = '#171d29'; roundRect(ctx, x + 20, gy, w - 40, 46, 10); ctx.fill()
    ctx.fillStyle = '#f2f3f5'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText(label, x + 34, gy + 28)
    ctx.fillStyle = amount.startsWith('+') ? '#7dffb2' : '#ff8fa3'; ctx.textAlign = 'right'; ctx.fillText(amount, x + w - 34, gy + 28); ctx.textAlign = 'left'
  })
  ctx.restore()
}

function mailPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#f6f6f8')
  ctx.fillStyle = '#252525'; ctx.font = '600 20px system-ui, sans-serif'; ctx.fillText('Demo Inbox', x + 22, y + 68)
  const mails: [string, string, string][] = [
    ['DS', 'Demo Sender', 'Sample subject — test mail'],
    ['TN', 'Test News', 'Demo digest · sample headlines'],
    ['SP', 'Sample Photos', 'Your demo album is ready (test)'],
    ['DR', 'Demo Receipts', 'Receipt (sample) — 0 test credits'],
  ]
  mails.forEach(([initials, sender, subject], i) => {
    const gy = y + 92 + i * 78
    ctx.fillStyle = '#fff'; roundRect(ctx, x + 18, gy, w - 36, 66, 12); ctx.fill()
    ctx.fillStyle = ['#6d5efc', '#2dd4bf', '#f59e0b', '#ff8fa3'][i]; ctx.beginPath(); ctx.arc(x + 52, gy + 33, 17, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(initials, x + 52, gy + 37); ctx.textAlign = 'left'
    ctx.fillStyle = '#252525'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText(sender, x + 80, gy + 28)
    ctx.fillStyle = '#8a8474'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(subject, x + 80, gy + 48)
  })
  ctx.fillStyle = '#171a21'; roundRect(ctx, x + 22, y + 486, w - 44, 42, 21); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✎ Compose demo mail', x + w / 2, y + 513); ctx.textAlign = 'left'
  ctx.restore()
}

function alarmPhone(ctx: CanvasRenderingContext2D) {
  const { x, y, w } = phoneSceneBase(ctx, '#101216')
  ctx.fillStyle = '#f2f3f5'; ctx.font = '600 20px system-ui, sans-serif'; ctx.fillText('Demo Clock', x + 22, y + 68)
  ctx.font = '700 44px system-ui, sans-serif'; ctx.fillText('07:30', x + 22, y + 128)
  ctx.fillStyle = '#9aa3af'; ctx.font = '12px system-ui, sans-serif'; ctx.fillText('Demo time · Sample day', x + 22, y + 152)
  const alarms: [string, string, boolean][] = [['06:45', 'Demo wake-up', true], ['08:15', 'Sample reminder', true], ['21:30', 'Test wind-down', false]]
  alarms.forEach(([time, label, on], i) => {
    const gy = y + 182 + i * 72
    ctx.fillStyle = '#1a1e26'; roundRect(ctx, x + 20, gy, w - 40, 60, 12); ctx.fill()
    ctx.fillStyle = '#f2f3f5'; ctx.font = '600 17px system-ui, sans-serif'; ctx.fillText(time, x + 36, gy + 30)
    ctx.fillStyle = '#9aa3af'; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(label, x + 36, gy + 50)
    ctx.fillStyle = on ? '#35c759' : '#3a3f4a'; roundRect(ctx, x + w - 84, gy + 18, 46, 24, 12); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + w - (on ? 52 : 72), gy + 30, 9, 0, Math.PI * 2); ctx.fill()
  })
  ctx.fillStyle = '#22252d'; roundRect(ctx, x + 22, y + 486, w - 44, 42, 21); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+ Add demo alarm', x + w / 2, y + 513); ctx.textAlign = 'left'
  ctx.restore()
}

/** Screenshot-study scene (light desktop, icon grid) — rebuilt generically. */
function desktopLightIcons(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, PACK_H)
  g.addColorStop(0, '#fdfdfd'); g.addColorStop(1, '#eef1f5')
  ctx.fillStyle = g; ctx.fillRect(0, 0, PACK_W, PACK_H)
  const apps: Array<[string, string]> = [['#4da3ff', 'Files'], ['#5cd65c', 'Store'], ['#ffb340', 'Notes'], ['#b78bff', 'Draw'], ['#ff6b81', 'Music'], ['#35c7c7', 'Chat'], ['#f2f2f2', 'Docs'], ['#5c7cfa', 'Web']]
  apps.forEach(([col, label], i) => {
    const x = 36 + (i % 2) * 92, y = 36 + Math.floor(i / 2) * 104
    ctx.save(); ctx.shadowColor = 'rgba(20,30,50,0.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3
    ctx.fillStyle = col; roundRect(ctx, x, y, 56, 56, 14); ctx.fill(); ctx.restore()
    ctx.fillStyle = '#39424f'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x + 28, y + 74); ctx.textAlign = 'left'
  })
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, PACK_H - 44, PACK_W, 44)
  ctx.fillStyle = 'rgba(20,30,50,0.08)'; ctx.fillRect(0, PACK_H - 44, PACK_W, 1)
  ctx.fillStyle = '#39424f'; ctx.font = '13px system-ui, sans-serif'; ctx.fillText('  Search', 16, PACK_H - 17)
  ctx.textAlign = 'right'; ctx.fillText('9:41  ', PACK_W - 12, PACK_H - 17); ctx.textAlign = 'left'
}

/** Screenshot-study phone profile (artboard layout) — generic demo content. */
function profilePhone(ctx: CanvasRenderingContext2D) {
  deviceFrame(ctx, false)
  const x = (PACK_W - 300) / 2, y = (PACK_H - 620) / 2, w = 300
  ctx.save(); roundRect(ctx, x + 6, y + 6, w - 12, 608, 38); ctx.clip()
  const g = ctx.createLinearGradient(0, y, 0, y + 200); g.addColorStop(0, '#7fb2d9'); g.addColorStop(1, '#cfe5f5')
  ctx.fillStyle = g; ctx.fillRect(x + 6, y + 6, w - 12, 210)
  ctx.fillStyle = '#fdfdfd'; ctx.fillRect(x + 6, y + 216, w - 12, 398)
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(PACK_W / 2, y + 216, 52, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#39424f'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(PACK_W / 2, y + 198, 16, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(PACK_W / 2, y + 252, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke()
  ctx.fillStyle = '#4da3ff'; ctx.beginPath(); ctx.arc(PACK_W / 2 + 46, y + 252, 15, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1d2733'; ctx.font = '700 24px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Demo User', PACK_W / 2, y + 306)
  ;[['My Courses', '4 Active'], ['Saved Items', '10 Saved'], ['Account Info', 'Edit']].forEach(([a, b], i) => {
    const gy = y + 326 + i * 56
    ctx.fillStyle = '#eef1f5'; roundRect(ctx, x + 22, gy, w - 44, 44, 12); ctx.fill()
    ctx.fillStyle = '#39424f'; ctx.font = '600 14px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(a, x + 38, gy + 28)
    ctx.fillStyle = '#31567d'; roundRect(ctx, x + w - 118, gy + 9, 84, 26, 13); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b, x + w - 76, gy + 26)
  })
  ctx.fillStyle = '#31567d'; roundRect(ctx, x + 6, y + 540, w - 12, 74, 18); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = '600 11px system-ui, sans-serif'
  ;['Home', 'Courses', 'Saved', 'Profile'].forEach((t, i) => ctx.fillText(t, x + 48 + i * 68, y + 592))
  ctx.textAlign = 'left'; ctx.restore()
}

/** Screenshot-study mascot frame overlay — transparent, generic shapes. */
function frameMascot(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#f4f1ea'; roundRect(ctx, w * 0.24, h * 0.22, w * 0.55, h * 0.56, 18); ctx.fill()
  ctx.strokeStyle = '#191919'; ctx.lineWidth = 6; roundRect(ctx, w * 0.24, h * 0.22, w * 0.55, h * 0.56, 18); ctx.stroke()
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#191919'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.arc(w * 0.335, h * 0.185, 44, 0, Math.PI * 2); ctx.fill(); ctx.stroke() // top mascot head
  ctx.beginPath(); ctx.moveTo(w * 0.305, h * 0.15); ctx.lineTo(w * 0.315, h * 0.115); ctx.lineTo(w * 0.335, h * 0.145); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(w * 0.345, h * 0.145); ctx.lineTo(w * 0.365, h * 0.115); ctx.lineTo(w * 0.37, h * 0.155); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#191919'; ctx.beginPath(); ctx.arc(w * 0.335, h * 0.185, 11, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(w * 0.215, h * 0.79, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke() // bottom-left mascot
  ctx.beginPath(); ctx.arc(w * 0.875, h * 0.68, 36, 0, Math.PI * 2); ctx.fill(); ctx.stroke() // right mascot
  ctx.fillStyle = '#191919'; roundRect(ctx, w * 0.862, h * 0.745, 26, 40, 8); ctx.fill()
}

export const PACK_ASSETS: PackAssetDef[] = [
  { id: 'spotify-mac', name: 'Music Player · Mac', desc: 'Streaming player in a macOS window with demo tracks', section: 'apps', group: 'Music', paint: (c) => spotifyMac(c) },
  { id: 'spotify-phone', name: 'Music Player · Phone', desc: 'Phone now-playing screen with demo album and progress', section: 'apps', group: 'Music', paint: (c) => spotifyPhone(c) },
  { id: 'podcast-player', name: 'Podcast Player · Desktop', desc: 'Podcast window with demo episode, waveform and chapters', section: 'apps', group: 'Music', paint: (c) => podcastPlayer(c) },
  { id: 'maps-phone', name: 'Maps · Phone', desc: 'Phone map with a demo route and place card — no real location', section: 'apps', group: 'Phones', paint: (c) => mapsPhone(c) },
  { id: 'photo-gallery-phone', name: 'Photo Gallery · Phone', desc: 'Phone gallery grid with sample image labels', section: 'apps', group: 'Phones', paint: (c) => photoGalleryPhone(c) },
  { id: 'notes-phone', name: 'Notes · Phone', desc: 'Phone notes list with demo scene-planning text', section: 'apps', group: 'Phones', paint: (c) => notesPhone(c) },
  { id: 'weather-phone', name: 'Weather · Phone', desc: 'Phone weather card with a sample forecast', section: 'apps', group: 'Phones', paint: (c) => weatherPhone(c) },
  { id: 'settings-phone', name: 'Settings · Phone', desc: 'Phone settings toggles with demo labels', section: 'apps', group: 'Phones', paint: (c) => settingsPhone(c) },
  { id: 'calendar-window', name: 'Calendar · Desktop', desc: 'Desktop calendar with demo launch and edit events', section: 'apps', group: 'Productivity', paint: (c) => calendarWindow(c) },
  { id: 'video-call-window', name: 'Video Call · Desktop', desc: 'Video-call grid with demo participant names', section: 'apps', group: 'Creators', paint: (c) => videoCallWindow(c) },
  { id: 'shopping-phone', name: 'Shopping · Phone', desc: 'Phone shop grid with sample products and test prices', section: 'apps', group: 'Phones', paint: (c) => shoppingPhone(c) },
  { id: 'files-phone', name: 'Files · Phone', desc: 'Phone file list with demo media names — no real folders', section: 'apps', group: 'Phones', paint: (c) => filesPhone(c) },
  { id: 'video-player-phone', name: 'Video Player · Phone', desc: 'Phone player with demo title, channel and up-next list', section: 'apps', group: 'Phones', paint: (c) => videoPlayerPhone(c) },
  { id: 'podcast-studio-window', name: 'Podcast Studio · Desktop', desc: 'Two-host studio window with demo mics, mixer levels and record timer', section: 'apps', group: 'Creators', paint: (c) => podcastStudioWindow(c) },
  { id: 'slides-window', name: 'Slides · Desktop', desc: 'Presentation editor with demo slides and speaker notes', section: 'apps', group: 'Productivity', paint: (c) => slidesWindow(c) },
  { id: 'fitness-phone', name: 'Fitness · Phone', desc: 'Phone activity rings with demo stats — sample numbers only', section: 'apps', group: 'Phones', paint: (c) => fitnessPhone(c) },
  { id: 'food-delivery-phone', name: 'Food Delivery · Phone', desc: 'Phone delivery list with sample kitchens and test times', section: 'apps', group: 'Phones', paint: (c) => foodDeliveryPhone(c) },
  { id: 'music-studio-window', name: 'Music Studio · Desktop', desc: 'DAW window with demo tracks, clip blocks and mixer faders', section: 'apps', group: 'Music', paint: (c) => musicStudioWindow(c) },
  { id: 'photo-editor-window', name: 'Photo Editor · Desktop', desc: 'Photo editor window with demo image, filmstrip and adjustment sliders', section: 'apps', group: 'Code & Design', paint: (c) => photoEditorWindow(c) },
  { id: 'doc-writer-window', name: 'Doc Writer · Desktop', desc: 'Word processor with a demo document and sample text lines', section: 'apps', group: 'Productivity', paint: (c) => docWriterWindow(c) },
  { id: 'banking-phone', name: 'Banking · Phone', desc: 'Phone banking card with demo balance and test transactions', section: 'apps', group: 'Phones', paint: (c) => bankingPhone(c) },
  { id: 'mail-phone', name: 'Mail · Phone', desc: 'Phone inbox with demo senders and sample subjects', section: 'apps', group: 'Phones', paint: (c) => mailPhone(c) },
  { id: 'alarm-phone', name: 'Clock & Alarms · Phone', desc: 'Phone clock with demo alarms and toggle pills', section: 'apps', group: 'Phones', paint: (c) => alarmPhone(c) },
  { id: 'spreadsheet-window', name: 'Spreadsheet · Demo Budget', desc: 'Spreadsheet window with test numbers only', section: 'apps', group: 'Productivity', paint: (c) => spreadsheetWindow(c) },
  { id: 'discord-chat', name: 'Community Chat · Demo', desc: 'Purple community chat with demo channels and messages', section: 'apps', group: 'Chat & Mail', paint: (c) => discordChat(c) },
  { id: 'vscode-window', name: 'Code Editor · Demo Project', desc: 'Editor window with demo file tree and syntax lines', section: 'apps', group: 'Code & Design', paint: (c) => vscodeWindow(c) },
  { id: 'figma-desktop', name: 'Design Canvas · Desktop', desc: 'Design-tool window with a phone wireframe (demo)', section: 'apps', group: 'Code & Design', paint: (c) => figmaDesktop(c) },
  { id: 'chrome-webpage', name: 'Chrome Webpage · Demo', desc: 'Browser window showing a demo landing page', section: 'windows', group: 'Browsers', paint: (c) => chromeWebpage(c) },
  { id: 'spotify-desktop', name: 'Music Player · Desktop', desc: 'Streaming player window with demo playlist and progress', section: 'apps', group: 'Music', paint: (c) => spotifyDesktop(c) },
  { id: 'explorer-win11', name: 'File Explorer · Windows 11', desc: 'Explorer window with demo media files — no real folder names', section: 'apps', group: 'Files & Browsers', paint: (c) => explorerWin11(c) },
  { id: 'finder-mac', name: 'Finder · macOS', desc: 'Finder window with demo files and sidebar favourites', section: 'apps', group: 'Files & Browsers', paint: (c) => finderMac(c) },
  { id: 'phone-ios-home', name: 'Phone Home · iOS style', desc: 'Phone frame with demo home screen and dock', section: 'apps', group: 'Phones', paint: (c) => phoneHome(c, 'ios') },
  { id: 'phone-android-home', name: 'Phone Home · Android style', desc: 'Phone frame with demo home screen and search pill', section: 'apps', group: 'Phones', paint: (c) => phoneHome(c, 'android') },
  { id: 'chrome-phone', name: 'Chrome · Phone', desc: 'Mobile browser with demo search results', section: 'apps', group: 'Phones', paint: (c) => phoneChrome(c) },
  { id: 'figma-phone-ui', name: 'Phone UI Design Canvas', desc: 'Design-tool canvas with phone wireframes (demo)', section: 'apps', group: 'Phones', paint: (c) => figmaPhone(c) },
  { id: 'youtube-studio', name: 'Creator Studio · Analytics', desc: 'Analytics dashboard with demo chart — sell the growth story', section: 'apps', group: 'Creators', paint: (c) => youtubeStudio(c) },
  { id: 'gmail-window', name: 'Mail Inbox · Demo', desc: 'Inbox window with demo senders and subjects', section: 'apps', group: 'Chat & Mail', paint: (c) => gmailWindow(c) },
  { id: 'whatsapp-chat', name: 'Chat App · Demo', desc: 'Messaging window with demo bubbles', section: 'apps', group: 'Chat & Mail', paint: (c) => whatsappChat(c) },
  { id: 'desktop-mac', name: 'Fake Desktop · macOS', desc: 'Wallpaper, menu bar and dock — build a screen-life scene', section: 'windows', group: 'Desktops', paint: (c) => wallpaper(c, 'mac') },
  { id: 'desktop-win', name: 'Fake Desktop · Windows', desc: 'Wallpaper and taskbar — build a screen-life scene', section: 'windows', group: 'Desktops', paint: (c) => wallpaper(c, 'win') },
  { id: 'chrome-mac', name: 'Chrome Bar · macOS', desc: 'Browser window with traffic lights and address bar', section: 'windows', group: 'Browsers', paint: (c) => windowChrome(c, 'mac', { title: 'My Video — YouTube', browser: 'chrome' }) },
  { id: 'chrome-win', name: 'Chrome Bar · Windows', desc: 'Browser window with Windows controls and address bar', section: 'windows', group: 'Browsers', paint: (c) => windowChrome(c, 'win', { title: 'My Video — YouTube', browser: 'chrome' }) },
  { id: 'safari-mac', name: 'Safari Bar · macOS', desc: 'Safari window with centered address field', section: 'windows', group: 'Browsers', paint: (c) => windowChrome(c, 'mac', { title: 'Safari', browser: 'safari' }) },
  { id: 'mac-window', name: 'macOS Window', desc: 'Plain app window frame, transparent body', section: 'windows', group: 'App Windows', paint: (c) => windowChrome(c, 'mac', { title: 'Untitled — Notes' }) },
  { id: 'win-window', name: 'Windows Window', desc: 'Windows 11 app window frame, transparent body', section: 'windows', group: 'App Windows', paint: (c) => windowChrome(c, 'win', { title: 'Document — Editor' }) },

  { id: 'cursor-mac', name: 'Cursor · macOS Arrow', desc: 'Black macOS pointer on a transparent frame', section: 'cursors', group: 'Pointers', paint: (c) => arrowCursor(c, 'mac') },
  { id: 'cursor-win', name: 'Cursor · Windows Arrow', desc: 'White Windows pointer on a transparent frame', section: 'cursors', group: 'Pointers', paint: (c) => arrowCursor(c, 'win') },
  { id: 'cursor-hand', name: 'Cursor · Hand Pointer', desc: 'Link/hover hand for click moments', section: 'cursors', group: 'Pointers', paint: (c) => arrowCursor(c, 'hand') },
  { id: 'cursor-ibeam', name: 'Cursor · Text I-Beam', desc: 'Typing/text-field cursor for tutorials', section: 'cursors', group: 'Pointers', paint: (c) => arrowCursor(c, 'ibeam') },
  { id: 'click-ring', name: 'Click Ring', desc: 'Red click emphasis ring — place at click moments', section: 'cursors', group: 'Clicks & Marks', paint: (c) => arrowCursor(c, 'ring') },

  { id: 'letterbox', name: 'Letterbox Bars', desc: 'Cinematic 2.39:1 black bars', section: 'overlays', group: 'Frames & Bars', paint: (ctx, w, h) => { ctx.fillStyle = '#000'; const bar = Math.round(h * 0.115); ctx.fillRect(0, 0, w, bar); ctx.fillRect(0, h - bar, w, bar) } },
  { id: 'vignette', name: 'Vignette', desc: 'Soft darkened edges', section: 'overlays', group: 'Light & Focus', paint: (ctx, w, h) => { const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.78); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h) } },
  { id: 'spotlight', name: 'Spotlight Dim', desc: 'Darkens everything except the centre — pair with Mask', section: 'overlays', group: 'Light & Focus', paint: (ctx, w, h) => { const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.16, w / 2, h / 2, h * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.82)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h) } },
  { id: 'film-frame', name: 'Film Frame', desc: '35mm sprocket-hole frame border', section: 'overlays', group: 'Frames & Bars', paint: (ctx, w, h) => { ctx.fillStyle = '#0a0a0c'; ctx.fillRect(0, 0, w, 44); ctx.fillRect(0, h - 44, w, 44); ctx.fillStyle = '#e8e4da'; for (let x = 18; x < w - 20; x += 46) { roundRect(ctx, x, 12, 26, 20, 4); ctx.fill(); roundRect(ctx, x, h - 32, 26, 20, 4); ctx.fill() } } },
  { id: 'pip-frame', name: 'PiP Frame', desc: 'Rounded picture-in-picture border', section: 'overlays', group: 'Frames & Bars', paint: (ctx, w, h) => { ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 10; roundRect(ctx, 26, 26, w - 52, h - 52, 28); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; roundRect(ctx, 34, 34, w - 68, h - 68, 22); ctx.stroke() } },
  { id: 'screen-glare', name: 'Screen Glare', desc: 'Diagonal monitor sheen for screen recordings', section: 'overlays', group: 'Light & Focus', paint: (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.35, 'rgba(255,255,255,0.03)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h) } },
  { id: 'desktop-light-icons', name: 'Fake Desktop · Light Icons', desc: 'Light wallpaper with a tidy icon grid (screenshot-study rebuild)', group: 'Desktops', section: 'windows', paint: (c) => desktopLightIcons(c) },
  { id: 'profile-phone', name: 'Profile Phone', desc: 'Phone profile with avatar, stat pills and bottom nav (screenshot-study rebuild)', section: 'apps', group: 'Social', paint: (c) => profilePhone(c) },
  { id: 'frame-mascot', name: 'Mascot Frame', desc: 'Mascot-corner frame overlay for face-cam / explainer layouts (screenshot-study rebuild)', section: 'overlays', group: 'Frames & Bars', paint: (c, w, h) => frameMascot(c, w, h) },
  { id: 'desktop-linux', name: 'Fake Desktop · Linux', desc: 'Dark desktop with top bar and side dock', group: 'Desktops', section: 'windows', paint: (ctx) => { const g = ctx.createLinearGradient(0, 0, PACK_W, PACK_H); g.addColorStop(0, '#2d1b33'); g.addColorStop(1, '#77216f'); ctx.fillStyle = g; ctx.fillRect(0, 0, PACK_W, PACK_H); ctx.fillStyle = 'rgba(12,12,16,0.85)'; ctx.fillRect(0, 0, PACK_W, 30); ctx.fillStyle = '#f2f2f2'; ctx.font = '600 13px system-ui, sans-serif'; ctx.fillText('  Activities', 8, 20); ctx.textAlign = 'right'; ctx.fillText('15 Oct  9:41  ', PACK_W - 8, 20); ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(20,20,26,0.8)'; ctx.fillRect(10, 150, 56, 400); ['#ff7830', '#4da3ff', '#5cd65c', '#b78bff', '#f2f2f2'].forEach((c, i) => { ctx.fillStyle = c; roundRect(ctx, 20, 166 + i * 66, 36, 36, 9); ctx.fill() }) } },
  { id: 'desktop-dark', name: 'Fake Desktop · Dark Studio', desc: 'Minimal dark backdrop for product shots', group: 'Desktops', section: 'windows', paint: (ctx) => { const g = ctx.createRadialGradient(PACK_W / 2, 260, 80, PACK_W / 2, 360, 760); g.addColorStop(0, '#232733'); g.addColorStop(1, '#0a0b0f'); ctx.fillStyle = g; ctx.fillRect(0, 0, PACK_W, PACK_H) } },
  { id: 'firefox', name: 'Firefox Bar', desc: 'Firefox window with tab and address bar', group: 'Browsers', section: 'windows', paint: (c) => windowChrome(c, 'win', { title: 'Mozilla Firefox', browser: 'chrome', urlText: 'mozilla.org' }) },
  { id: 'edge', name: 'Edge Bar · Windows', desc: 'Edge-style browser window for Windows tutorials', group: 'Browsers', section: 'windows', paint: (c) => windowChrome(c, 'win', { title: 'New tab — Edge', browser: 'chrome', urlText: 'bing.com' }) },
  { id: 'explorer', name: 'File Explorer · Windows', desc: 'Explorer window with folders — hide your real desktop', group: 'App Windows', section: 'windows', paint: (c) => explorerWindow(c) },
  { id: 'code-editor', name: 'Code Editor', desc: 'Dark editor window with syntax lines', group: 'App Windows', section: 'windows', paint: (c) => codeWindow(c) },
  { id: 'terminal', name: 'Terminal', desc: 'Terminal window with build output', group: 'App Windows', section: 'windows', paint: (c) => terminalWindow(c) },
  { id: 'chat-window', name: 'Chat Window', desc: 'Messaging window with chat bubbles', group: 'App Windows', section: 'windows', paint: (c) => chatWindow(c) },
  { id: 'phone-frame', name: 'Phone Frame', desc: 'Smartphone bezel — put vertical clips inside', group: 'Devices & Social', section: 'windows', paint: (c) => deviceFrame(c, false) },
  { id: 'tablet-frame', name: 'Tablet Frame', desc: 'Tablet bezel for app demos', group: 'Devices & Social', section: 'windows', paint: (c) => deviceFrame(c, true) },
  { id: 'youtube-player', name: 'YouTube Player', desc: 'Video player frame with progress bar', group: 'Devices & Social', section: 'windows', paint: (c) => youtubePlayer(c) },
  { id: 'post-card', name: 'Social Post Card', desc: 'Post card with avatar, text and reactions', group: 'Devices & Social', section: 'windows', paint: (c) => postCard(c) },
  { id: 'notify-mac', name: 'Notification · macOS', desc: 'Glass notification banner, top-right', group: 'Devices & Social', section: 'windows', paint: (c) => notifyCard(c, 'mac') },
  { id: 'notify-win', name: 'Notification · Windows', desc: 'Toast notification, bottom-right', group: 'Devices & Social', section: 'windows', paint: (c) => notifyCard(c, 'win') },
  { id: 'key-caps', name: 'Shortcut Keys', desc: '⌘K key caps for shortcut callouts', group: 'Devices & Social', section: 'windows', paint: (c) => keyCaps(c) },
  { id: 'progress-bar', name: 'Progress Bar', desc: 'Slim playback/progress bar along the bottom', group: 'Devices & Social', section: 'windows', paint: (c, w, h) => progressBar(c, w, h) },
  { id: 'highlight-box', name: 'Highlight Box', desc: 'Look-here callout box for tutorials', group: 'Clicks & Marks', section: 'cursors', paint: (c) => highlightBox(c) },
  { id: 'magnifier', name: 'Magnifier', desc: 'Zoom magnifier badge for detail callouts', group: 'Clicks & Marks', section: 'cursors', paint: (c) => magnifier(c) },
  { id: 'censor-bar', name: 'Censor Bar', desc: 'Pixelated bar — hide names, chats and plates', group: 'Clicks & Marks', section: 'cursors', paint: (c) => censorBar(c) },
]


const urlCache = new Map<string, string>()

export function packAssetUrl(id: string): string {
  const cached = urlCache.get(id)
  if (cached) return cached
  const def = PACK_ASSETS.find((a) => a.id === id)
  if (!def) return ''
  const canvas = document.createElement('canvas')
  canvas.width = PACK_W
  canvas.height = PACK_H
  const ctx = canvas.getContext('2d')!
  def.paint(ctx, PACK_W, PACK_H)
  const url = canvas.toDataURL('image/png')
  urlCache.set(id, url)
  return url
}
