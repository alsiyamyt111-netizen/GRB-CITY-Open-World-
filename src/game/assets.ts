// assets.ts — GLB library for Phase 2: download-once pack, load-once/clone, near/far LOD
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Box } from './world';

export interface FitSpec { w?: number; h?: number; maxW?: number }
export interface ModelDef { files: string[]; fit: FitSpec; proxyColor: string }

// The loader tries each folder in order, so the GLB can sit in public/models/ or public/models/buildings/ etc.
const F = (name: string) => ['models/', 'models/buildings/', 'models/city/', 'models/vehicles/', 'models/cars/'].map(d => d + name);
// Paths relative to AssetLibrary base. Add more keys (skyline, trees, road pieces, cars) the same way.
export const MODELS: Record<string, ModelDef> = {
  house:  { files: F('modern_house.glb'), fit: { w: 16 }, proxyColor: '#cfc8bd' },
  home:   { files: F('modern_home.glb'), fit: { w: 16 }, proxyColor: '#c9c2b4' },
  office: { files: F('modern_building_-_gallery_-_office.glb'), fit: { h: 40 }, proxyColor: '#8d99a6' },
  car:    { files: F('paris-car-01.glb'), fit: { w: 4.5 }, proxyColor: '#aa3333' },
};

export class AssetLibrary {
  private loader = new GLTFLoader();
  private templates = new Map<string, THREE.Group | null>();
  private pending = new Map<string, Promise<THREE.Group | null>>();
  private proxyGeo = new THREE.BoxGeometry(1, 1, 1);
  private proxyMats = new Map<string, THREE.Material>();

  constructor(private base: string = import.meta.env.BASE_URL) { this.loader.setMeshoptDecoder(MeshoptDecoder); }

  /** One-time map pack download into Cache Storage. Needs models/manifest.json: { version, files:[{path,size}] } */
  async downloadPack(onProgress: (p: number, msg: string) => void): Promise<void> {
    if (!('caches' in self)) return;
    try {
      const m = await (await fetch(this.base + 'models/manifest.json', { cache: 'no-cache' })).json() as { version: string; files: { path: string; size: number }[] };
      const name = 'map-pack-' + m.version;
      for (const k of await caches.keys()) if (k.startsWith('map-pack-') && k !== name) await caches.delete(k);
      const cache = await caches.open(name);
      const total = m.files.reduce((a, f) => a + f.size, 0) || 1; let done = 0;
      for (const f of m.files) {
        const url = this.base + f.path;
        if (!(await cache.match(url))) { const r = await fetch(url); if (!r.ok) throw new Error('fetch ' + f.path); await cache.put(url, r); }
        done += f.size; onProgress(done / total, 'Downloading map pack…');
      }
    } catch (e) { console.warn('Map pack download skipped, loading from network', e); }
  }

  private async buffer(url: string): Promise<ArrayBuffer> {
    const hit = 'caches' in self ? await caches.match(url) : undefined;
    const r = hit ?? await fetch(url);
    if (!r.ok) throw new Error('load ' + url);
    return r.arrayBuffer();
  }

  /** Load once, normalise (origin = bottom centre, scaled to `fit`). Returns null on failure so callers can fall back to boxes. */
  load(key: string): Promise<THREE.Group | null> {
    const p0 = this.pending.get(key); if (p0) return p0;
    const def = MODELS[key];
    const p = (async () => {
      if (!def) return null;
      try {
        let gltf: Awaited<ReturnType<GLTFLoader['parseAsync']>> | null = null;
        for (const f of def.files) {
          try { gltf = await this.loader.parseAsync(await this.buffer(this.base + f), ''); break; } catch { /* try next folder */ }
        }
        if (!gltf) throw new Error('not found: ' + def.files[0]);
        const root = gltf.scene; root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
        const s = def.fit.h ? def.fit.h / size.y : (def.fit.w ?? 10) / Math.max(size.x, size.z);
        root.scale.setScalar(s);
        root.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
        root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
        const wrap = new THREE.Group(); wrap.add(root); wrap.userData.size = size.multiplyScalar(s);
        this.templates.set(key, wrap); return wrap;
      } catch (e) { console.warn('GLB failed:', key, e); this.templates.set(key, null); return null; }
    })();
    this.pending.set(key, p); return p;
  }

  async preload(keys: string[], onProgress?: (p: number, msg: string) => void) {
    for (let i = 0; i < keys.length; i++) { await this.load(keys[i]); onProgress?.((i + 1) / keys.length, 'Loading models…'); }
  }

  has(key: string) { return !!this.templates.get(key); }

  /** Clone shares geometry + materials with the template, so memory does not grow per copy. */
  spawn(key: string, fit?: FitSpec): THREE.Group | null {
    const t = this.templates.get(key); if (!t) return null;
    const o = t.clone(true); const size = (t.userData.size as THREE.Vector3).clone();
    if (fit) {
      let k = fit.h ? fit.h / size.y : fit.w ? fit.w / Math.max(size.x, size.z) : 1;
      if (fit.maxW) k = Math.min(k, fit.maxW / Math.max(size.x, size.z));
      o.scale.setScalar(k); size.multiplyScalar(k);
    }
    o.userData.size = size; return o;
  }

  /** Cheap coloured box used for distant buildings. */
  proxy(key: string, size: THREE.Vector3): THREE.Mesh {
    let mat = this.proxyMats.get(key);
    if (!mat) { mat = new THREE.MeshStandardMaterial({ color: MODELS[key]?.proxyColor ?? '#999', roughness: 0.9 }); this.proxyMats.set(key, mat); }
    const m = new THREE.Mesh(this.proxyGeo, mat); m.scale.copy(size); m.position.y = size.y / 2; return m;
  }
}

/** Swaps real GLB <-> box proxy by distance. Call update() ~every 0.5 s, not every frame. */
export class LodSet {
  private items: { near: THREE.Object3D; far: THREE.Object3D; x: number; z: number; isNear: boolean }[] = [];
  add(near: THREE.Object3D, far: THREE.Object3D, x: number, z: number) { near.visible = false; far.visible = true; this.items.push({ near, far, x, z, isNear: false }); }
  update(px: number, pz: number, nearDist = 160) {
    const r2 = nearDist * nearDist;
    for (const it of this.items) {
      const isNear = (it.x - px) ** 2 + (it.z - pz) ** 2 < r2;
      if (isNear !== it.isNear) { it.isNear = isNear; it.near.visible = isNear; it.far.visible = !isNear; }
    }
  }
}

export interface PlaceCtx { lib?: AssetLibrary; lod: LodSet; colliders: Box[] }

/** Place a GLB building (with box proxy + collider). Returns false if the model is missing, so the caller can use the old box building. */
export function placeBuilding(ctx: PlaceCtx, parent: THREE.Object3D, key: string, x: number, z: number, rot: number, fit?: FitSpec): boolean {
  const near = ctx.lib?.spawn(key, fit); if (!near) return false;
  const size = near.userData.size as THREE.Vector3;
  near.position.set(x, 0.2, z); near.rotation.y = rot;
  const far = ctx.lib!.proxy(key, size); far.position.set(x, 0.2 + size.y / 2, z); far.rotation.y = rot;
  parent.add(near, far); near.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(near);
  ctx.colliders.push({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, h: b.max.y });
  ctx.lod.add(near, far, x, z); return true;
}
