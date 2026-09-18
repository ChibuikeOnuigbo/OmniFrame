/**
 * The 3D scene model. Pure serialisable data — the renderer (three.js in the web app)
 * reads this and nothing else, so a scene round-trips through .vxproj unchanged and can
 * be validated without a GPU.
 */
import { uid } from '../core/id.js';
import { Vec3, Quaternion, QUAT_IDENTITY } from './rig.js';

export type SceneObjectKind =
  | 'model' | 'plane' | 'image' | 'video' | 'text' | 'empty' | 'camera' | 'light';

export type LightKind = 'directional' | 'point' | 'spot' | 'environment';

export type MaterialKind = 'standard' | 'physical' | 'basic' | 'emissive';

export interface MaterialDef {
  id: string;
  name: string;
  kind: MaterialKind;
  baseColor: string;
  baseColorTexture?: string;
  roughness: number;
  metalness: number;
  emissive: string;
  emissiveIntensity: number;
  normalMap?: string;
  opacity: number;
  transparent: boolean;
  side: 'front' | 'back' | 'double';
}

export interface LightDef {
  id: string;
  kind: LightKind;
  color: string;
  intensity: number;
  /** point/spot: range; directional: ignored */
  range: number;
  /** spot cone angle in radians */
  angle: number;
  penumbra: number;
  castShadow: boolean;
  shadowSoftness: number;
  shadowBias: number;
  shadowMapSize: number;
  /** environment only: strength multiplier on the IBL */
  environmentStrength: number;
}

export interface CameraDef {
  id: string;
  projection: 'perspective' | 'orthographic';
  /** perspective: vertical FOV in degrees; orthographic: ignored */
  fov: number;
  /** perspective: focal length in mm, kept in sync with fov */
  focalLength: number;
  near: number;
  far: number;
  orthoSize: number;
  dof: { enabled: boolean; focusDistance: number; aperture: number };
}

export interface Transform3 {
  position: Vec3;
  rotation: Quaternion;
  scale: Vec3;
}

export const IDENTITY_TRANSFORM: Transform3 = {
  position: { x: 0, y: 0, z: 0 },
  rotation: QUAT_IDENTITY,
  scale: { x: 1, y: 1, z: 1 },
};

export interface SceneObject {
  id: string;
  kind: SceneObjectKind;
  name: string;
  parentId: string | null;
  transform: Transform3;
  visible: boolean;
  opacity: number;
  /** asset reference for model/image/video */
  assetId: string | null;
  materialId: string | null;
  light?: LightDef;
  camera?: CameraDef;
  /** for plane/video/image: world-space size */
  size: { width: number; height: number };
  /** 'render' | 'unlit' | 'matte' */
  renderMode: 'render' | 'unlit' | 'matte';
  /** 2.5D depth placement driven by a tracked plane */
  depthLayer: number;
  /** animation clip bindings */
  clipId: string | null;
  /** baked lightmap texture id, when this object has been baked */
  lightmapId: string | null;
}

export interface EnvironmentDef {
  /** 'room' (procedural RoomEnvironment) | 'hdri' | 'color' | 'none' */
  mode: 'room' | 'hdri' | 'color' | 'none';
  hdriAssetId: string | null;
  color: string;
  intensity: number;
  /** blur applied to the environment when used as a background */
  backgroundBlur: number;
  showBackground: boolean;
  rotation: number;
}

export interface BakedLightmapRecord {
  id: string;
  objectId: string;
  /** hash of geometry+lights+materials at bake time — the invalidation key */
  cacheKey: string;
  width: number;
  height: number;
  samples: number;
  bounces: number;
  bakedAt: number;
  bakeMs: number;
  /** true only when a real bake ran; never set optimistically */
  valid: boolean;
}

export interface Scene3D {
  id: string;
  name: string;
  objects: SceneObject[];
  materials: MaterialDef[];
  environment: EnvironmentDef;
  activeCameraId: string | null;
  lightmaps: BakedLightmapRecord[];
  /** renderer quality preset */
  quality: 'draft' | 'balanced' | 'final';
  shadowQuality: 'off' | 'low' | 'medium' | 'high';
  textureLimit: number;
  antialias: boolean;
}

export function newScene(name = 'Scene'): Scene3D {
  const camId = uid('cam');
  return {
    id: uid('scene3d'),
    name,
    objects: [
      {
        id: camId,
        kind: 'camera',
        name: 'Camera',
        parentId: null,
        transform: { position: { x: 0, y: 1.4, z: 5 }, rotation: QUAT_IDENTITY, scale: { x: 1, y: 1, z: 1 } },
        visible: true,
        opacity: 1,
        assetId: null,
        materialId: null,
        camera: {
          id: camId, projection: 'perspective', fov: 50, focalLength: 35,
          near: 0.1, far: 1000, orthoSize: 5,
          dof: { enabled: false, focusDistance: 5, aperture: 0.02 },
        },
        size: { width: 1, height: 1 },
        renderMode: 'render',
        depthLayer: 0,
        clipId: null,
        lightmapId: null,
      },
    ],
    materials: [defaultMaterial()],
    environment: {
      mode: 'room', hdriAssetId: null, color: '#111318', intensity: 1,
      backgroundBlur: 0, showBackground: true, rotation: 0,
    },
    activeCameraId: camId,
    lightmaps: [],
    quality: 'balanced',
    shadowQuality: 'medium',
    textureLimit: 2048,
    antialias: true,
  };
}

export function defaultMaterial(): MaterialDef {
  return {
    id: uid('mat'),
    name: 'Default',
    kind: 'standard',
    baseColor: '#c8c8c8',
    roughness: 0.6,
    metalness: 0,
    emissive: '#000000',
    emissiveIntensity: 0,
    opacity: 1,
    transparent: false,
    side: 'front',
  };
}

export function addObject(scene: Scene3D, partial: Partial<SceneObject> & { kind: SceneObjectKind }): SceneObject {
  const obj: SceneObject = {
    id: uid('obj3d'),
    name: partial.kind,
    parentId: null,
    transform: { position: { x: 0, y: 0, z: 0 }, rotation: QUAT_IDENTITY, scale: { x: 1, y: 1, z: 1 } },
    visible: true,
    opacity: 1,
    assetId: null,
    materialId: scene.materials[0]?.id ?? null,
    size: { width: 1, height: 1 },
    renderMode: 'render',
    depthLayer: 0,
    clipId: null,
    lightmapId: null,
    ...partial,
  };
  scene.objects.push(obj);
  return obj;
}

export function addLight(scene: Scene3D, kind: LightKind, position: Vec3): SceneObject {
  const id = uid('light');
  return addObject(scene, {
    id,
    kind: 'light',
    name: `${kind} light`,
    transform: { position, rotation: QUAT_IDENTITY, scale: { x: 1, y: 1, z: 1 } },
    light: {
      id, kind, color: '#ffffff', intensity: kind === 'directional' ? 2 : 12,
      range: 20, angle: Math.PI / 6, penumbra: 0.3,
      castShadow: kind !== 'environment', shadowSoftness: 2, shadowBias: 0.0005,
      shadowMapSize: 1024, environmentStrength: 1,
    },
  });
}

/** Field-of-view in degrees from a 35mm-equivalent focal length (24mm vertical gate). */
export function focalLengthToFov(focalMm: number): number {
  return (2 * Math.atan(12 / Math.max(1, focalMm)) * 180) / Math.PI;
}

export function fovToFocalLength(fovDeg: number): number {
  return 12 / Math.tan((fovDeg * Math.PI) / 360);
}

/** Warn about scenes that will not render in real time, with the actual numbers. */
export function sceneBudgetReport(scene: Scene3D): {
  ok: boolean;
  drawCalls: number;
  shadowCastingLights: number;
  texturePixels: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const shadowCastingLights = scene.objects.filter((o) => o.light?.castShadow).length;
  const drawCalls = scene.objects.filter((o) => o.visible && o.kind !== 'light' && o.kind !== 'empty').length;
  const texturePixels = scene.materials.reduce((s, m) => s + (m.baseColorTexture || m.normalMap ? scene.textureLimit * scene.textureLimit : 0), 0);
  if (shadowCastingLights > 4) {
    warnings.push(`${shadowCastingLights} shadow-casting lights will cost ${shadowCastingLights} extra full-scene passes per frame. Consider baking the static ones.`);
  }
  if (drawCalls > 400) {
    warnings.push(`${drawCalls} draw calls exceeds the ~400 budget for 60fps on integrated GPUs. Instance or merge static geometry.`);
  }
  if (texturePixels > 4096 * 4096 * 8) {
    warnings.push(`Texture budget exceeded (${(texturePixels / 1e6).toFixed(1)} MP). Lower the texture limit or use mipmapped atlases.`);
  }
  return { ok: warnings.length === 0, drawCalls, shadowCastingLights, texturePixels, warnings };
}
