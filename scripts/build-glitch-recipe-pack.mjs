/** Compile the authored recipe library into a compact, lazy-loaded UI pack. */
import fs from 'node:fs'
const recipes = fs.readFileSync('new_glitch/presets.ndjson','utf8').trim().split('\n').map(JSON.parse)
const entries = recipes.map(r => {
  const p=r.parameters,t=r.timeline,pal=r.palette
  // Authored timing values are seconds. Fit long envelopes to the declared
  // recipe duration instead of multiplying every value by the duration.
  const sum=t.lead+t.attack+t.hold+t.decay, scale=Math.min(1,r.duration/sum)
  return {id:r.id,name:r.name,cat:'Glitch NG',trace:`Authored recipe ${r.id}; ${r.family}; render validation is tracked separately`,patch:{
    ngFamily:r.family,ngSeed:r.seed,ngIntensity:1,ngOpacity:1,ngBlend:'normal',ngPattern:t.eventPattern,
    ngPrimary:pal.primary,ngSecondary:pal.secondary,
    ngLead:t.lead*scale,ngAttack:t.attack*scale,ngHold:t.hold*scale,ngDecay:t.decay*scale,
    ngSliceAmp:p.sliceAmplitudePx,ngSliceDensity:p.sliceDensity,ngChroma:p.chromaticAberrationPx,
    ngScanOpacity:p.scanOpacity,ngScanSpacing:p.scanSpacingPx,ngNoise:p.noiseOpacity,
    ngBlock:p.blockScalePx,ngBlockRate:p.blockDropRate,ngGhost:p.ghostOpacity,
    ngGhostDelay:p.ghostDelayFrames,ngRoll:p.verticalRollPx,ngFrequency:p.frequencyHz,
  }}
})
if(entries.length!==5000 || new Set(entries.map(e=>e.id)).size!==5000) throw Error('Expected exactly 5000 unique recipe IDs')
fs.mkdirSync('public/effects',{recursive:true})
fs.writeFileSync('public/effects/glitch-recipes.json',JSON.stringify(entries))
console.log(`Compiled ${entries.length} authored recipes; no claim of perceptual uniqueness`)
