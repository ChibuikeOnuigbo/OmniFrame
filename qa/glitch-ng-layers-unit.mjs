/** Run: node --experimental-strip-types qa/glitch-ng-layers-unit.mjs (Node 22+). */
import assert from 'node:assert/strict'
import { renderGlitchRGBA } from '../src/lib/glitchNG.ts'

const w=32,h=24, src=new Uint8ClampedArray(w*h*4)
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4
  src[i]=x*7;src[i+1]=y*10;src[i+2]=(x+y)*4;src[i+3]=(x+y)%5===0?0:255
}
const timeline={lead:0,attack:0.01,hold:3,decay:0.1}
const recipe={seed:772,timeline,parameters:{sliceAmplitudePx:9,chromaticAberrationPx:3,scanOpacity:0.2,noiseOpacity:0.1},layers:[
  {id:'slice',family:'digital-slice',opacity:0.8,blendMode:'normal',seed:3},
  {id:'noise',family:'rgb-shock',opacity:0.35,blendMode:'screen',seed:44}
]}
const render=(t,r=recipe)=>renderGlitchRGBA(src,w,h,t,r,{fps:30})
assert.deepEqual(render(0.6),render(0.6),'same time and seed must match')
assert.notDeepEqual(render(0.6),render(0.65),'different times must change')
assert.deepEqual(render(0.6,{...recipe,layers:recipe.layers.map(l=>({...l,enabled:false}))}),src,'disabled effects have no effect')
assert.deepEqual(render(0.6,{...recipe,layers:[{...recipe.layers[0],opacity:0}]}),src,'zero opacity must be honored')
assert.deepEqual(render(0.6,{...recipe,layers:[{...recipe.layers[0],start:1,end:2}]}),src,'time window must be honored')
const out=render(0.6)
for(let i=3;i<out.length;i+=4) assert.equal(out[i],src[i],'alpha must remain unchanged')
for (const blendMode of ['normal','screen','multiply','add']) {
 const image=render(0.5,{...recipe,layers:[{...recipe.layers[0],blendMode}]})
 assert.equal(image.length,src.length)
}
const silent=renderGlitchRGBA(src,w,h,0.5,{...recipe,layers:[{id:'silent',family:'digital-slice',parameters:{noiseOpacity:0,blockDropRate:0,scanOpacity:0,chromaticAberrationPx:0,sliceAmplitudePx:0}}]})
assert.deepEqual(silent, src, 'zero primitive controls must be an exact bypass')
assert.deepEqual(render(0.5, {family:'digital-slice', timeline, parameters:{intensity:0}}), src, 'zero global intensity is bypass')
assert.notDeepEqual(render(.5, {...recipe, seed:0, layers:undefined}),render(.5, {...recipe, seed:1, layers:undefined}), 'seed zero is distinct from one')
assert.throws(() => renderGlitchRGBA(src, 0, h, 0, recipe))
assert.throws(() => renderGlitchRGBA(src, w, h, NaN, recipe))
assert.equal(render(.5, {...recipe,layers:undefined,parameters:{blockScalePx:0}}).length,src.length)
for(const blendMode of ['normal','screen','multiply','add']) {
 assert.deepEqual(render(.5,{family:'digital-slice',timeline,opacity:0,blendMode}),src,'root opacity zero bypass')
 assert.deepEqual(render(.5,{family:'digital-slice',timeline,blendMode,parameters:{intensity:0}}),src,'zero intensity bypasses every blend')
 assert.deepEqual(render(10,{...recipe,layers:[{...recipe.layers[0],blendMode}]}),src,'expired envelope bypasses every blend')
}
console.log('PASS glitch NG determinism, dynamics, timing, alpha, zero controls, root opacity and all blend-mode bypasses')
