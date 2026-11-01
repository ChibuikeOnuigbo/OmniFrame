export const BLEND_GROUPS = [
 {name:'Normal',modes:['source-over']},
 {name:'Darken',modes:['darken','multiply','color-burn']},
 {name:'Lighten / Add (+)',modes:['lighten','screen','color-dodge','lighter']},
 {name:'Contrast',modes:['overlay','soft-light','hard-light']},
 {name:'Difference',modes:['difference','exclusion']},
 {name:'Color components',modes:['hue','saturation','color','luminosity']},
] as const
export const BLEND_MODES = new Set<string>(BLEND_GROUPS.flatMap(g=>[...g.modes]))
export type BlendKey = {time:number;mode:GlobalCompositeOperation}
export function blendAt(clip:{start:number;blendMode?:GlobalCompositeOperation;blendKeys?:BlendKey[]},time:number):GlobalCompositeOperation {
 let mode=clip.blendMode||'source-over',latest=-Infinity
 for(const key of clip.blendKeys||[])if(Number.isFinite(key.time)&&key.time<=time-clip.start+1e-7&&key.time>=latest&&BLEND_MODES.has(key.mode)){mode=key.mode;latest=key.time}
 return mode
}
export function putBlendKey(keys:BlendKey[],time:number,mode:string):BlendKey[] {
 if(!Number.isFinite(time)||time<0||!BLEND_MODES.has(mode))throw Error('Invalid blend keyframe')
 return [...keys.filter(k=>Math.abs(k.time-time)>1e-7),{time,mode:mode as GlobalCompositeOperation}].sort((a,b)=>a.time-b.time)
}
