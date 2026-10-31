/** Bundled model catalog; URLs are local and all external sources have credit records. */
export const DEVICE_MODEL_OPTIONS = [
  {id:'phone_modern_black',name:'Modern phone · black',kind:'phone'},
  {id:'phone_modern_silver',name:'Modern phone · silver',kind:'phone'},
  {id:'phone_frameless_dark',name:'Frameless phone',kind:'phone'},
  {id:'monitor_gaming_black',name:'Gaming monitor',kind:'monitor'},
  {id:'monitor_clean_office',name:'Office monitor',kind:'monitor'},
  {id:'tv_flat_black',name:'Flat-screen TV',kind:'tv'},
  {id:'laptop_open_dark',name:'Open laptop',kind:'laptop'},
  {id:'tv_crt_knobs_ph',name:'Knob CRT TV · Poly Haven',kind:'tv',source:'https://polyhaven.com/a/Television_01',author:'Gabriel Radić',license:'CC0'},
  {id:'tv_crt_silver_ph',name:'Silver CRT TV · Poly Haven',kind:'tv',source:'https://polyhaven.com/a/television_02',author:'Benny Weimer',license:'CC0'},
] as const
export function defaultDeviceModel(type:string):string {
  if(type==='device_tv_crt_knobs')return 'tv_crt_knobs_ph'
  if(type==='device_tv_crt_silver')return 'tv_crt_silver_ph'
  return type==='device_phone'?'phone_modern_black':type==='device_monitor'?'monitor_gaming_black':type==='device_laptop'?'laptop_open_dark':'tv_flat_black'
}
export const OBJECT_ASSETS = {
  object_arrow_sweep:{model:'arrow_oga',name:'Arrow Sweep',author:'Savino',source:'https://opengameart.org/content/arrow-symbols',license:'CC0',note:'Original gold material on the downloaded arrow geometry.'},
  object_shell_whip:{model:'bullet_shell_oga',name:'Bullet Shell Whip',author:'AlexanderZotov',source:'https://opengameart.org/content/3d-low-poly-pistol-with-bullet-shell',license:'CC0',note:'Shell mesh only, with its original material colors.'},
  object_payphone_orbit:{model:'payphone_ph',name:'Payphone Orbit',author:'UM JOORIN',source:'https://polyhaven.com/a/korean_public_payphone_01',license:'CC0',note:'Base color, normal and roughness maps are embedded.'},
  object_concrete_shatter:{model:'concrete_shards_ph',name:'Concrete Shatter',author:'Dimitrios Savva · material',source:'https://polyhaven.com/a/cracked_concrete',license:'CC0 material',note:'35 original 3D fragments carry your outgoing video; concrete backs keep the downloaded PBR material.'},
} as const
export type ObjectTransitionKind = keyof typeof OBJECT_ASSETS
export function isObjectTransition(type:string):type is ObjectTransitionKind {return Object.prototype.hasOwnProperty.call(OBJECT_ASSETS,type)}
export function transitionThumbnail(type:string):string|undefined {
  return isObjectTransition(type)||type==='device_tv_crt_knobs'||type==='device_tv_crt_silver'?`/models/transition_assets/thumbnails/${type}.png`:undefined
}
