/**
 * Desktop Pack assets: procedurally drawn screen-life overlays (the style of
 * editing popularised by desktop-emulation videos — the whole "video" plays
 * out inside fake OS/browser windows). Every asset is a 1280×720 PNG drawn on
 * a canvas, so window frames, cursors and overlays composite over any clip
 * with correct transparency and no external files.
 */

export type PackSection = 'windows' | 'cursors' | 'overlays' | 'edits' | 'threed'

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
  { id: 'screenlife-mac', name: 'Screen-Life Pack · macOS', desc: 'Desktop, Chrome, cursor and click ring for a full screen-life scene', items: ['desktop-mac', 'chrome-mac', 'cursor-mac', 'click-ring'] },
  { id: 'screenlife-win', name: 'Screen-Life Pack · Windows', desc: 'Desktop, Chrome, cursor and click ring for a full screen-life scene', items: ['desktop-win', 'chrome-win', 'cursor-win', 'click-ring'] },
  { id: 'tutorial', name: 'Tutorial Pack', desc: 'Browser window, hand cursor, highlight box and progress bar', items: ['chrome-win', 'cursor-hand', 'highlight-box', 'progress-bar'] },
  { id: 'social', name: 'Social Pack', desc: 'Phone frame, post card, notification and hand cursor', items: ['phone-frame', 'post-card', 'notify-mac', 'cursor-hand'] },
  { id: 'privacy', name: 'Privacy Pack', desc: 'Chat window with a censor bar and spotlight dim', items: ['chat-window', 'censor-bar', 'spotlight'] },
  { id: 'streamer', name: 'Streamer Pack', desc: 'PiP frame, screen glare and vignette for face-cam layouts', items: ['pip-frame', 'screen-glare', 'vignette'] },
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

export const PACK_ASSETS: PackAssetDef[] = [
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
