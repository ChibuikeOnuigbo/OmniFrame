/**
 * Patch-under fill for omniframe cut-outs: after the hole mask punches the
 * source clip, this fills the hole for EVERY frame so the cut-out's absence
 * never shows. 'smart' averages the ring around the hole (flat or graduated
 * beds fill seamlessly); 'clone'/'donor' copy a source region.
 * Shared by playback.ts (booted app) and tools/mcp/appRender.mjs (headless).
 */
export interface PatchUnderSpec {
  strategy?: 'smart' | 'clone' | 'donor' | 'blur' | 'gradient'
  x0: number; y0: number; x1: number; y1: number // sequence-space hole rect
  brushRadius?: number
  feather?: number
  donor?: [number, number]
}

export function applyPatchUnder(
  x: CanvasRenderingContext2D, patch: PatchUnderSpec, r: { x: number; y: number; w: number; h: number }, seqW: number, seqH: number,
  donorCanvas?: HTMLCanvasElement | { width: number; height: number; getContext: (k: '2d') => CanvasRenderingContext2D },
): void {
  const W = x.canvas.width, H = x.canvas.height
  if (![patch.x0,patch.x1,patch.y0,patch.y1,r.x,r.y,r.w,r.h].every(Number.isFinite) || r.w<=0 || r.h<=0) return
  const X0 = (Math.min(patch.x0,patch.x1)-r.x)/r.w*W, X1 = (Math.max(patch.x0,patch.x1)-r.x)/r.w*W
  const Y0 = (Math.min(patch.y0,patch.y1)-r.y)/r.h*H, Y1 = (Math.max(patch.y0,patch.y1)-r.y)/r.h*H
  const hw = X1 - X0, hh = Y1 - Y0
  if (hw<=0 || hh<=0) return
  const feather = Math.max(0,patch.feather ?? 5) * (W / r.w)
  const strat = patch.strategy || 'clone'
  if (strat === 'smart') {
    const d = x.getImageData(0, 0, W, H).data
    let rr = 0, gg = 0, bb = 0, n = 0
    const ring = (px: number, py: number) => {
      const ix = Math.round(px), iy = Math.round(py)
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) return
      const i = (iy * W + ix) * 4
      if (d[i + 3] < 8) return
      rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++
    }
    for (let X = X0 - 4; X <= X1 + 4; X += 2) { ring(X, Y0 - 4); ring(X, Y1 + 4) }
    for (let Y = Y0 - 4; Y <= Y1 + 4; Y += 2) { ring(X0 - 4, Y); ring(X1 + 4, Y) }
    const col = n ? `rgb(${(rr / n) | 0},${(gg / n) | 0},${(bb / n) | 0})` : 'rgb(255,255,255)'
    x.save()
    x.globalCompositeOperation = 'destination-over'
    x.filter = feather > 0 ? `blur(${feather}px)` : 'none'
    x.fillStyle = col
    x.fillRect(X0 - 1, Y0 - 1, hw + 2, hh + 2)
    x.restore()
    x.filter = 'none'
    return
  }
  // Work from an immutable pixel snapshot so self-cloning never reads pixels
  // already overwritten by this patch. This path works in browser and NAPI.
  const image=x.getImageData(0,0,W,H), original=new Uint8ClampedArray(image.data)
  const donor=donorCanvas ? donorCanvas.getContext('2d')!.getImageData(0,0,donorCanvas.width,donorCanvas.height).data : original
  const DW=donorCanvas?.width ?? W, DH=donorCanvas?.height ?? H
  const donorX=((patch.donor?.[0] ?? r.x)-r.x)/r.w*W
  const donorY=((patch.donor?.[1] ?? r.y)-r.y)/r.h*H
  const sample=(data:Uint8ClampedArray,width:number,height:number,px:number,py:number,channel:number)=>data[(Math.max(0,Math.min(height-1,Math.round(py)))*width+Math.max(0,Math.min(width-1,Math.round(px))))*4+channel]
  const radius=Math.max(1,Math.min(36,(patch.brushRadius ?? 6)*W/r.w))
  for(let py=Math.max(0,Math.floor(Y0));py<Math.min(H,Math.ceil(Y1));py++)for(let px=Math.max(0,Math.floor(X0));px<Math.min(W,Math.ceil(X1));px++){
    const edge=Math.min(px+.5-X0,X1-px-.5,py+.5-Y0,Y1-py-.5)
    const t=feather>0?Math.max(0,Math.min(1,edge/feather)):1,weight=t*t*(3-2*t)
    if(weight<=0)continue
    const u=Math.max(0,Math.min(1,(px-X0)/hw)),v=Math.max(0,Math.min(1,(py-Y0)/hh)),i=(py*W+px)*4
    const rgba=[0,0,0,0]
    for(let c=0;c<4;c++){
      if(strat==='gradient'){
        const a=sample(original,W,H,X0-2,Y0-2,c),b=sample(original,W,H,X1+2,Y0-2,c),d=sample(original,W,H,X0-2,Y1+2,c),e=sample(original,W,H,X1+2,Y1+2,c)
        rgba[c]=(a*(1-u)+b*u)*(1-v)+(d*(1-u)+e*u)*v
      }else if(strat==='blur'){
        rgba[c]=(sample(original,W,H,px-radius,py-radius,c)+sample(original,W,H,px+radius,py-radius,c)+sample(original,W,H,px-radius,py+radius,c)+sample(original,W,H,px+radius,py+radius,c))/4
      }else rgba[c]=sample(donor,DW,DH,(donorX+px-X0)*DW/W,(donorY+py-Y0)*DH/H,c)
    }
    const sa=rgba[3]/255*weight,da=original[i+3]/255,alpha=sa+da*(1-sa)
    for(let c=0;c<3;c++)image.data[i+c]=alpha>0?(rgba[c]*sa+original[i+c]*da*(1-sa))/alpha:0
    image.data[i+3]=alpha*255
  }
  x.putImageData(image,0,0)
}
