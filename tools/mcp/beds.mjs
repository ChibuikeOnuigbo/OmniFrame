// replaceBg bed painters (mirror of the app's replaceBg family maths).
export function bedPainterLocal(id) {
  return (ctx, w, h, t) => {
    if (id === 'synthwave') {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#160b2e'); g.addColorStop(0.6, '#3d1163'); g.addColorStop(1, '#0a0620')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(255,80,200,0.5)'; ctx.lineWidth = 1
      for (let i = 0; i < 9; i++) { const y = h * 0.55 + i * i * 2.2 + t * 6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
      for (let i = 0; i <= 10; i++) { const x = (i / 10) * w; ctx.beginPath(); ctx.moveTo(w / 2 + (x - w / 2) * 0.2, h * 0.55); ctx.lineTo(x, h); ctx.stroke() }
      ctx.fillStyle = '#ff9a3d'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.42, h * 0.14, Math.PI, 0); ctx.fill()
    } else if (id === 'aurora') {
      ctx.fillStyle = '#04101c'; ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 4; i++) {
        const g = ctx.createLinearGradient(0, h * (0.15 + i * 0.12), w, h * (0.4 + i * 0.12))
        g.addColorStop(0, 'rgba(40,255,180,0)'); g.addColorStop(0.5, `rgba(40,255,180,${0.16 - i * 0.03})`); g.addColorStop(1, 'rgba(80,120,255,0)')
        ctx.fillStyle = g; ctx.beginPath()
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.25 + i * 0.13) + Math.sin(x * 0.02 + t * 2 + i) * h * 0.06)
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill()
      }
    } else if (id === 'grid') {
      ctx.fillStyle = '#0b0f14'; ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(90,200,255,0.35)'; const o = (t * 20) % 32
      for (let x = -32 + o; x < w + 32; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = -32 + o; y < h + 32; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
    } else if (id === 'bokeh') {
      const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#20143a'); g.addColorStop(1, '#0d0a1c')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 14; i++) { const x = ((i * 97) % w) + Math.sin(t + i) * 8, y = ((i * 61) % h), r = 8 + (i % 5) * 7; ctx.fillStyle = `rgba(255,190,120,${0.10 + (i % 3) * 0.05})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill() }
    } else if (id === 'sunset') {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b1055'); g.addColorStop(0.5, '#c94b4b'); g.addColorStop(1, '#ffb199')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.62, h * 0.12, 0, 7); ctx.fill()
    } else if (id === 'studio') {
      const g = ctx.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.5, w * 0.7); g.addColorStop(0, '#8d939c'); g.addColorStop(1, '#23262b')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    } else if (id === 'wedge') {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
      const g = ctx.createLinearGradient(0, 0, w * 0.7, h); g.addColorStop(0, '#7d0c0c'); g.addColorStop(1, '#e01818')
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.85, 0); ctx.lineTo(w * 0.6, h); ctx.lineTo(0, h); ctx.fill()
    } else { ctx.fillStyle = '#101216'; ctx.fillRect(0, 0, w, h) }
  }
}
