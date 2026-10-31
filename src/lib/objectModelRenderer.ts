import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {OBJECT_ASSETS,type ObjectTransitionKind} from './transitionAssetCatalog'
import {fragmentPose,objectParameter,objectRigAt,type ObjectTransitionOptions} from './object3d'
type Fragment={object:THREE.Object3D;position:THREE.Vector3;rotation:THREE.Euler;index:number}
type Model={root:THREE.Group;fragments:Fragment[]}
const loaded=new Map<string,Model>(),pending=new Map<string,Promise<void>>()
let renderer:THREE.WebGLRenderer|null=null,failure:string|null=null
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.05,100)
camera.position.z=5
scene.add(new THREE.HemisphereLight(0xe2edff,0x272130,2.2))
const key=new THREE.DirectionalLight(0xffe1b3,4);key.position.set(-2,3,5);scene.add(key)
const rim=new THREE.DirectionalLight(0x7fafff,4);rim.position.set(3,1,-2);scene.add(rim)
const input=document.createElement('canvas');input.width=1024;input.height=1024
const frameTexture=new THREE.CanvasTexture(input);frameTexture.flipY=false;frameTexture.colorSpace=THREE.SRGBColorSpace;frameTexture.minFilter=THREE.LinearFilter;frameTexture.generateMipmaps=false
const video=new THREE.MeshBasicMaterial({map:frameTexture,toneMapped:false,transparent:true,side:THREE.FrontSide})
export function preloadObjectModel(id:string):Promise<void>{
  if(!Object.values(OBJECT_ASSETS).some(asset=>asset.model===id))return Promise.reject(new Error('Unknown transition asset'))
  if(loaded.has(id))return Promise.resolve()
  if(!pending.has(id))pending.set(id,new GLTFLoader().loadAsync(`/models/transition_assets/${id}.glb`).then(gltf=>{
    const root=gltf.scene,fragments:Fragment[]=[]
    root.traverse(o=>{
      if(o.name.startsWith('Fragment_'))fragments.push({object:o,position:o.position.clone(),rotation:o.rotation.clone(),index:fragments.length})
      if(o instanceof THREE.Mesh){
        if(o.name.startsWith('VideoShard_'))o.material=video
        for(const material of Array.isArray(o.material)?o.material:[o.material]){material.userData.sourceOpacity=material.opacity;material.transparent=true}
      }
    })
    if(id==='concrete_shards_ph'&&fragments.length!==35)throw new Error('Invalid fracture rig')
    loaded.set(id,{root,fragments})
  }).catch(error=>{pending.delete(id);throw error}))
  return pending.get(id)!
}
export function drawObjectModel(ctx:CanvasRenderingContext2D,w:number,h:number,type:ObjectTransitionKind,rig:ReturnType<typeof objectRigAt>,from:HTMLCanvasElement,options:ObjectTransitionOptions):boolean {
  const model=loaded.get(OBJECT_ASSETS[type].model)
  if(!model||failure)return false
  try{
    if(!renderer){renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,premultipliedAlpha:true});renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0)}
    if(renderer.domElement.width!==w||renderer.domElement.height!==h)renderer.setSize(w,h,false)
    camera.aspect=w/h;camera.updateProjectionMatrix()
    const visibleH=2*Math.tan(THREE.MathUtils.degToRad(20))*camera.position.z,visibleW=visibleH*camera.aspect
    key.intensity=objectParameter(options.keyLight,4,0,8);rim.intensity=objectParameter(options.rimLight,4,0,8)
    const {root,fragments}=model
    root.position.set(rig.x*visibleW,-rig.y*visibleH,0)
    root.rotation.set(THREE.MathUtils.degToRad(rig.rotX),THREE.MathUtils.degToRad(rig.rotY),THREE.MathUtils.degToRad(rig.rotZ))
    root.scale.setScalar(Math.min(visibleW,visibleH)*.48*rig.size)
    if(type==='object_concrete_shatter'){
      root.scale.set(visibleW/2,visibleH/2,1)
      const x=input.getContext('2d')!;x.clearRect(0,0,1024,1024);x.drawImage(from,0,0,1024,1024);frameTexture.needsUpdate=true
      for(const fragment of fragments){
        const p=fragmentPose(fragment.index,fragment.position.x,fragment.position.y,rig.p,options)
        fragment.object.position.set(fragment.position.x+p.x,fragment.position.y+p.y,fragment.position.z+p.z)
        fragment.object.rotation.set(fragment.rotation.x+p.rx,fragment.rotation.y+p.ry,fragment.rotation.z+p.rz)
      }
    }
    root.traverse(o=>{if(o instanceof THREE.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material])material.opacity=(material.userData.sourceOpacity??1)*rig.alpha})
    scene.add(root)
    try{renderer.render(scene,camera)}finally{scene.remove(root)}
    ctx.drawImage(renderer.domElement,0,0,w,h)
    return true
  }catch(error){failure=String(error);console.warn('3D asset renderer unavailable; using transition wipe fallback',error);return false}
}
export function objectModelStatus(){return {loadedModels:loaded.size,webgl:renderer!==null&&!failure,error:failure}}
