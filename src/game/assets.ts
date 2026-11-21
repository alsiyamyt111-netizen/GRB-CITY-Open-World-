// assets.ts — GLB library for Phase 2: download-once pack, load-once/clone, near/far LOD
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Box } from './world';

export interface FitSpec { w?: number; h?: number; maxW?: number }
export interface ModelDef { files: string[]; fit: FitSpec; proxyColor: string }

// The loader tries each folder in order, so the GLB can sit in public/models/ or public/models/buildings/ etc.
const F = (name: string) => ['models/', 'models/buildings/', 'models/city/', 'models/vehicles/', 'models/cars/', 'models/trees/', 'models/nature/', 'models/roads/', 'models/props/'].map(d => d + name);
// Paths relative to AssetLibrary base. Add more keys (skyline, trees, road pieces, cars) the same way.
export const MODELS: Record<string, ModelDef> = {
  house:  { files: F('modern_house.glb'), fit: { w: 16 }, proxyColor: '#cfc8bd' },
  home:   { files: F('modern_home.glb'), fit: { w: 16 }, proxyColor: '#c9c2b4' },
  office: { files: F('modern_building_-_gallery_-_office.glb'), fit: { h: 40 }, proxyColor: '#8d99a6' },
  trees:  { files: F('low_poly_forest_tree_pack.glb'), fit: { h: 7 }, proxyColor: '#2f5d2a' },
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

  private async readGLTF(def: ModelDef) {
    for (const f of def.files) {
      try { return await this.loader.parseAsync(await this.buffer(this.base + f), ''); } catch { /* try next folder */ }
    }
    throw new Error('not found: ' + def.files[0]);
  }

  private raw = new Map<string, Promise<THREE.Group | null>>();
  /** Load a multi-object pack as-is (no scaling), once. Used for the tree pack. */
  loadRaw(key: string): Promise<THREE.Group | null> {
    let p = this.raw.get(key);
    if (!p) { const def = MODELS[key]; p = def ? this.readGLTF(def).then(g => g.scene, e => { console.warn('GLB failed:', key, e); return null; }) : Promise.resolve(null); this.raw.set(key, p); }
    return p;
  }

  /** Load once, normalise (origin = bottom centre, scaled to `fit`). Returns null on failure so callers can fall back to boxes. */
  load(key: string): Promise<THREE.Group | null> {
    const p0 = this.pending.get(key); if (p0) return p0;
    const def = MODELS[key];
    const p = (async () => {
      if (!def) return null;
      try {
        const gltf = await this.readGLTF(def);
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

// ---------------- trees from a GLB pack ----------------
export interface TreeVariant { parts: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[]; m: THREE.Matrix4 }[]; tris: number }

/** Splits a tree pack into variants (one per top-level object), scaled together so the median tree is `targetH` tall,
 *  each standing on y=0 and centred on x/z. Ground planes and tiny pieces are skipped. Returns [] if nothing usable. */
export async function loadTreeVariants(lib: AssetLibrary | undefined, key: string, targetH = 7, maxVariants = 6): Promise<TreeVariant[]> {
  const raw = lib ? await lib.loadRaw(key) : null; if (!raw) return [];
  raw.updateMatrixWorld(true);
  const hasMesh = (o: THREE.Object3D) => { let f = false; o.traverse(c => { if ((c as THREE.Mesh).isMesh) f = true; }); return f; };
  let node: THREE.Object3D = raw;
  for (;;) { const kids = node.children.filter(hasMesh); if (kids.length === 1 && kids[0].children.length) node = kids[0]; else break; }
  const info = node.children.filter(hasMesh).map(g => { const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3()); return { g, b, s }; })
    .filter(v => v.s.y > 1e-4 && !(v.s.x > v.s.y * 4 && v.s.z > v.s.y * 4) && !/ground|plane|terrain/i.test(v.g.name));
  if (!info.length) return [];
  const hs = info.map(v => v.s.y).sort((x, y) => x - y), med = hs[Math.floor(hs.length / 2)];
  const sc = targetH / med;
  const out: TreeVariant[] = [];
  for (const v of info.filter(v => v.s.y >= med * 0.4).slice(0, maxVariants)) {
    const N = new THREE.Matrix4().makeScale(sc, sc, sc).multiply(new THREE.Matrix4().makeTranslation(-(v.b.min.x + v.b.max.x) / 2, -v.b.min.y, -(v.b.min.z + v.b.max.z) / 2));
    const parts: TreeVariant['parts'] = []; let tris = 0;
    v.g.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; parts.push({ geo: g, mat: m.material, m: N.clone().multiply(m.matrixWorld) }); });
    if (parts.length) out.push({ parts, tris });
  }
  return out;
}

/** Instanced forest: one InstancedMesh per variant part, so draw calls = variants x parts. Keeps total triangles under maxTris. */
export function scatterTrees(scene: THREE.Object3D, variants: TreeVariant[], pts: [number, number, number][], yAt: (x: number, z: number) => number, rnd: () => number, maxTris = 450000): number {
  const avg = variants.reduce((a, v) => a + v.tris, 0) / variants.length || 1;
  const use = pts.slice(0, Math.max(50, Math.floor(maxTris / avg)));
  const buckets: [number, number, number][][] = variants.map(() => []);
  use.forEach((p, i) => buckets[i % variants.length].push(p));
  const q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  variants.forEach((v, vi) => {
    const b = buckets[vi]; if (!b.length) return;
    const mats = b.map(([x, z, s]) => new THREE.Matrix4().compose(pv.set(x, yAt(x, z), z), q.setFromAxisAngle(up, rnd() * 6.283), sv.set(s, s, s)));
    for (const part of v.parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, b.length);
      mats.forEach((tm, i) => im.setMatrixAt(i, m.multiplyMatrices(tm, part.m)));
      im.instanceMatrix.needsUpdate = true; (im as any).computeBoundingSphere?.(); scene.add(im);
    }
  });
  return use.length;
}
