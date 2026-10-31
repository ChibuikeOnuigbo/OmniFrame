/**
 * Board T / glitch-audit pack integration: deterministic layered glitch kernel
 * ported from OmniFrame_Glitch_Audit code/glitchEngine.mjs (reference impl).
 * Families: horizontal slices, RGB separation, block dropout, line tear,
 * scan noise, vector edge, neon corrupt, spectral tint — parameterized and
 * keyframeable via fx params (ng* fields), preview/export parity by design
 * (same RGBA math in browser playback.ts and headless appRender.mjs).
 */
export interface NgLayer {
  id: string
  enabled?: boolean
  family: string
  timeOffset?: number
  palette?: NgRecipe['palette']
  timeline?: NgRecipe['timeline']
  seed?: number
  opacity?: number
  blendMode?: 'normal' | 'screen' | 'multiply' | 'add'
  start?: number
  end?: number
  parameters?: Record<string, number>
}
export interface NgRecipe {
  opacity?: number
  blendMode?: NgLayer['blendMode']
  /** Ordered, independent and reversible effect layers; legacy recipes remain valid. */
  layers?: NgLayer[]
  family?: string
  seed?: number
  palette?: { primary?: string; secondary?: string; bg?: string; name?: string }
  timeline?: { lead?: number; attack?: number; hold?: number; decay?: number; eventPattern?: string }
  parameters?: Record<string, number>
}
export interface NgEffect {
  ngOpacity?: number
  ngPattern?: string
  ngGhost?: number
  ngGhostDelay?: number
  ngRoll?: number
  ngFrequency?: number
  ngLayersJSON?: string
  ngBlend?: NgLayer['blendMode']
  ngIntensity?: number
  ngFamily?: string
  ngSeed?: number
  ngPrimary?: string
  ngSecondary?: string
  ngLead?: number
  ngAttack?: number
  ngHold?: number
  ngDecay?: number
  ngSliceAmp?: number
  ngSliceDensity?: number
  ngChroma?: number
  ngScanOpacity?: number
  ngScanSpacing?: number
  ngNoise?: number
  ngBlock?: number
  ngBlockRate?: number
}
export function hasNg(e: NgEffect | null | undefined): boolean {
  return !!e && (!!e.ngFamily || !!e.ngLayersJSON)
}
export function recipeFromEffect(e: NgEffect): NgRecipe {
  if (e.ngLayersJSON) {
    try { return { layers: JSON.parse(e.ngLayersJSON) as NgLayer[] } } catch { /* legacy single family */ }
  }
  return {
    opacity: e.ngOpacity ?? 1, blendMode: e.ngBlend ?? 'normal',
    family: e.ngFamily,
    seed: e.ngSeed ?? 8156,
    palette: { primary: e.ngPrimary || '#a568ff', secondary: e.ngSecondary || '#15e4f3' },
    timeline: { lead: e.ngLead ?? 0.4, attack: e.ngAttack ?? 0.25, hold: e.ngHold ?? 0.6, decay: e.ngDecay ?? 0.4, eventPattern: e.ngPattern },
    parameters: {
      ghostOpacity: e.ngGhost ?? .18, ghostDelayFrames: e.ngGhostDelay ?? 2, verticalRollPx: e.ngRoll ?? 8, frequencyHz: e.ngFrequency ?? 4,
      intensity: e.ngIntensity ?? 1,
      sliceAmplitudePx: e.ngSliceAmp ?? 12, sliceDensity: e.ngSliceDensity ?? 10,
      chromaticAberrationPx: e.ngChroma ?? 4, scanOpacity: e.ngScanOpacity ?? 0.2,
      scanSpacingPx: e.ngScanSpacing ?? 3, noiseOpacity: e.ngNoise ?? 0.1,
      blockScalePx: e.ngBlock ?? 20, blockDropRate: e.ngBlockRate ?? 0.1,
    },
  }
}
export function applyGlitchNG(canvas: { width: number; height: number; getContext: (t: '2d') => CanvasRenderingContext2D | null }, e: NgEffect, tSec: number, fps = 30): void {
  if (!hasNg(e)) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width, h = canvas.height
  const img = ctx.getImageData(0, 0, w, h)
  const out = renderGlitchRGBA(img.data, w, h, tSec, recipeFromEffect(e), { fps })
  img.data.set(out)
  ctx.putImageData(img, 0, 0)
}
/** OmniFrame glitch CPU reference kernel (browser + Node).
 * Real 8-bit RGBA input; deterministic by (seed,time,frameRate).
 * This is a reference implementation / integration foundation, not a drop-in replacement
 * for OmniFrame's GPU renderer. Works with any Uint8ClampedArray frame.
 */
export const GLITCH_FAMILIES: string[] = ['digital-slice','rgb-shock','vhs-tear','datamosh-inspired','scan-burst','phantom-echo','neon-corrupt','pixel-collapse','vector-edge','spectral-logo'];
const clamp=(x: number,a: number,b: number)=>Math.max(a,Math.min(b,x));
const hexRgb=(v?: string): number[]=>{let x=(v||'#ff39bb').replace('#',''); return [parseInt(x.slice(0,2),16)||0,parseInt(x.slice(2,4),16)||0,parseInt(x.slice(4,6),16)||0]};
function rng(seed: number){let s=(seed ^ 0x9e3779b9)>>>0;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296}}
export function intensityEnvelope(t: number, recipe: NgRecipe){
  const env=recipe.timeline||{},a=env.lead??0.4,b=env.attack??0.25,h=env.hold??0.6,d=env.decay??0.4;
  if (t<a) return 0;
  const local=t-a, total=b+h+d, u=clamp(local/Math.max(total,1e-6),0,1);
  let gate=1;
  switch(env.eventPattern) {
    case 'dual-attack': gate = u < .4 || u > .55 ? 1 : .1; break;
    case 'subtle-break': gate = .35 + .65 * Math.sin(Math.PI*u)**2; break;
    case 'pulse-to-clean': gate = (1-u) * (.5+.5*Math.sin(local*24)**2); break;
    case 'reverse-shatter': gate = u*u; break;
    case 'freeze-then-snap': gate = u < .55 ? .12 : 1; break;
    case 'rhythmic': gate = .15 + .85 * Math.max(0,Math.sin(local*Math.PI*8)); break;
    case 'microburst': gate = .25 + .75 * Math.sin(local*32)**4; break;
    case 'hard-intro': gate = Math.exp(-local*2); break;
    case 'slow-build': gate = Math.sqrt(u); break;
    case 'long-tail': gate = 1-.5*u; break;
  }
  if(t<a+b)return gate*clamp((t-a)/Math.max(b,1e-6),0,1);
  if(t<a+b+h)return gate;
  if(t<a+b+h+d)return gate*clamp(1-(t-a-b-h)/Math.max(d,1e-6),0,1);
  return 0;
}
function copyPixel(src: Uint8ClampedArray,si: number,dst: Uint8ClampedArray,di: number,alpha: number){dst[di]=src[si];dst[di+1]=src[si+1];dst[di+2]=src[si+2];dst[di+3]=alpha}
export function renderGlitchRGBA(src: Uint8ClampedArray, width: number, height: number, time: number, recipe: NgRecipe, { fps = 30 }: { fps?: number } = {}){
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || !Number.isFinite(time) || !Number.isFinite(fps) || fps <= 0) throw new Error('Invalid frame dimensions, time, or fps');
  if(!(src instanceof Uint8ClampedArray)||src.length!==width*height*4)throw new Error('Expected width*height*4 RGBA');
  if (!recipe.layers?.length && ((recipe.opacity ?? 1) !== 1 || (recipe.blendMode ?? 'normal') !== 'normal')) {
    return renderGlitchRGBA(src,width,height,time,{layers:[{id:'single',family:recipe.family ?? 'digital-slice',seed:recipe.seed,palette:recipe.palette,timeline:recipe.timeline,parameters:recipe.parameters,opacity:recipe.opacity,blendMode:recipe.blendMode}]},{fps})
  }
  // Composable glitch v2. Every layer has independent timing, blend and seed.
  // A disabled/out-of-window layer never mutates the previous frame.
  if (recipe.layers?.length) {
    let composite = new Uint8ClampedArray(src);
    for (const layer of recipe.layers) {
      if (layer.enabled === false || time < (layer.start ?? -Infinity) || time > (layer.end ?? Infinity)) continue;
      const opacity = clamp(layer.opacity ?? 1, 0, 1);
      if (opacity === 0) continue;
      const individual: NgRecipe = {
        family: layer.family, seed: layer.seed ?? recipe.seed,
        palette: layer.palette ?? recipe.palette,
        timeline: layer.timeline ?? recipe.timeline,
        parameters: { ...recipe.parameters, ...layer.parameters },
      };
      const layerTime = time - (layer.timeOffset ?? 0);
      if (intensityEnvelope(layerTime, individual) <= 0 || (individual.parameters?.intensity ?? 1) <= 0) continue;
      const rendered = renderGlitchRGBA(composite, width, height, layerTime, individual, { fps });
      for (let i = 0; i < composite.length; i += 4) {
        // Alpha is always the original coverage, including premultiplied-looking masks.
        const coverage = composite[i + 3] / 255;
        for (let c = 0; c < 3; c++) {
          const base = composite[i + c], top = rendered[i + c];
          let mixed = top;
          switch (layer.blendMode ?? 'normal') {
            case 'screen': mixed = 255 - (255 - base) * (255 - top) / 255; break;
            case 'multiply': mixed = base * top / 255; break;
            case 'add': mixed = Math.min(255, base + top); break;
          }
          composite[i + c] = coverage === 0 ? base : Math.round(base + (mixed - base) * opacity);
        }
      }
    }
    return composite;
  }
  const p=recipe.parameters||{},family=recipe.family||'digital-slice';
  const k=Math.floor(Math.max(0,time)*fps),rand=rng((recipe.seed ?? 1)^Math.imul(k+1,2654435761));
  let intensity=intensityEnvelope(time,recipe) * clamp(p.intensity ?? 1, 0, 1);
  if(family==='rgb-shock'||family==='scan-burst') intensity*=.85+.15*Math.sin(time*32)**2;
  const out=new Uint8ClampedArray(src.length);
  if(intensity<=0){out.set(src);return out}
  let amp=Math.round((p.sliceAmplitudePx??12)*intensity),chroma=Math.round((p.chromaticAberrationPx??4)*intensity);
  const primary=hexRgb(recipe.palette?.primary),secondary=hexRgb(recipe.palette?.secondary);
  const density=p.sliceDensity??10;const rowShift=new Int16Array(height);
  const shiftBand=Math.max(2,Math.round(height/Math.max(2,density)));
  for(let y=0;y<height;y++){
    if(y%shiftBand===0){let next=(rand()-.5)*2*amp;if(['vhs-tear','digital-slice','spectral-logo','datamosh-inspired'].includes(family)&&rand()>.55) next*=1.9;rowShift.fill(Math.round(next),y,Math.min(height,y+shiftBand))}
  }
  const block=Math.max(1, Math.round(p.blockScalePx??20));const blockProb=(p.blockDropRate??.1)*intensity;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    const idx=(y*width+x)*4;let sh=rowShift[y];
    if(family==='rgb-shock')sh=Math.round(sh*.3);
    if(family==='pixel-collapse')sh=Math.round(sh*.7);
    if(family==='scan-burst')sh=Math.round(sh*Math.sin(y*.18));
    let sy=y;
    if(family==='vhs-tear') { sh+=Math.round(Math.sin(y/height*9+time*9)*amp*.6); sy=((y+Math.round(Math.sin(time*(p.frequencyHz??4))*(p.verticalRollPx??8)*intensity))%height+height)%height; }
    if(family==='pixel-collapse') { sh+=Math.round((Math.floor(x/block)*block-x)*intensity); }
    const sx=clamp(x+sh,0,width-1),si=(sy*width+sx)*4;
    copyPixel(src,si,out,idx,src[si+3]);
    if(family==='rgb-shock'||family==='neon-corrupt'||family==='spectral-logo'||family==='digital-slice'){
      out[idx]=src[(y*width+clamp(sx+chroma,0,width-1))*4];
      out[idx+2]=src[(y*width+clamp(sx-chroma,0,width-1))*4+2];
    }
    if(family==='phantom-echo') {
      const offset=Math.round((p.ghostDelayFrames??2)*4*intensity), ghost=clamp((p.ghostOpacity??.18)*intensity,0,1);
      const gi=(y*width+clamp(x+offset,0,width-1))*4;
      for(let c=0;c<3;c++) out[idx+c]=out[idx+c]*(1-ghost)+src[gi+c]*ghost;
    }
    if(family==='datamosh-inspired') {
      const gx=Math.floor(sx/block)*block, gy=Math.floor(sy/block)*block, gi=(gy*width+gx)*4;
      for(let c=0;c<3;c++) out[idx+c]=out[idx+c]*(1-.55*intensity)+src[gi+c]*.55*intensity;
    }
    if((y%Math.max(2,p.scanSpacingPx??3))===0){let shade=1-(p.scanOpacity??.2)*intensity;out[idx]*=shade;out[idx+1]*=shade;out[idx+2]*=shade}
    if(family==='vector-edge'&&x>0&&y>0){let left=(y*width+x-1)*4;let diff=Math.abs(src[idx]-src[left])+Math.abs(src[idx+1]-src[left+1])+Math.abs(src[idx+2]-src[left+2]);if(diff>50){out[idx]=secondary[0];out[idx+1]=secondary[1];out[idx+2]=secondary[2]}}
    if(family==='neon-corrupt'&&out[idx]+out[idx+1]+out[idx+2]>350){out[idx]=clamp(out[idx]+primary[0]*.25*intensity,0,255);out[idx+2]=clamp(out[idx+2]+secondary[2]*.25*intensity,0,255)}
  }
  // Bounded block artifacts; no independent RNG per pixel required to reproduce.
  const blocks=Math.floor((width*height/(block*block))*blockProb*.4);
  for(let n=0;n<blocks;n++){
    const bx=Math.floor(rand()*width),by=Math.floor(rand()*height),bw=Math.min(width-bx,Math.floor(block*(.4+rand()))),bh=Math.min(height-by,Math.floor(block*(.1+rand()*.3)));
    let dx=Math.floor((rand()-.5)*2*amp*2);
    for(let yy=by;yy<by+bh;yy++) for(let xx=bx;xx<bx+bw;xx++){
      const target=(yy*width+xx)*4,sx=clamp(xx+dx,0,width-1),source=(yy*width+sx)*4;
      if(family==='pixel-collapse'||family==='datamosh-inspired')copyPixel(src,source,out,target,src[source+3]);
      else{out[target]=primary[0]*.35+out[target]*.65;out[target+1]=secondary[1]*.3+out[target+1]*.7;out[target+2]=primary[2]*.35+out[target+2]*.65;}
    }
  }
  const noise=Math.max(0,Math.min(.4,p.noiseOpacity??.1))*intensity;
  const rNoise=rng((recipe.seed ?? 1)^Math.imul(k+321,2246822519));
  for(let i=0;i<src.length;i+=4){let n=(rNoise()-.5)*noise*255;out[i]=clamp(out[i]+n,0,255);out[i+1]=clamp(out[i+1]+n,0,255);out[i+2]=clamp(out[i+2]+n,0,255);out[i+3]=src[i+3]}
  return out;
}
