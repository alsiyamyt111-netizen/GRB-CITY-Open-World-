// Open-world generator: terrain/hills, river & bridge, road grid, districts, landmarks, vegetation, colliders, map image
import * as THREE from 'three';
import { BLOCK, N, HALF, ROAD_W, SPECIAL_BLOCKS, blockCenter, VEHICLES, VIEWPOINTS } from './data';
import { tex } from './textures';
import { AssetLibrary, LodSet, placeBuilding } from './assets';

export interface Box { minX: number; maxX: number; minZ: number; maxZ: number; h: number }
export const WORLD = 1700;
const RIVER_Z0 = 375, RIVER_Z1 = 440;

let seed = 1337; export const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function hillNoise(x: number, z: number) {
  return Math.sin(x * 0.012) * Math.cos(z * 0.01) * 18 + Math.sin(x * 0.031 + 1.3) * Math.sin(z * 0.027) * 7 + Math.sin(x * 0.07 + z * 0.05) * 2;
}
export function heightAt(x: number, z: number): number {
  if (Math.abs(x) < 9 && z > 330 && z < 485) return 3.2 * Math.sin(Math.min(1, Math.max(0, (z - 330) / 155)) * Math.PI) ; // bridge deck
  const d = Math.max(Math.abs(x) - HALF - 15, Math.abs(z) - HALF - 15, 0);
  if (z > RIVER_Z0 - 25 && z < RIVER_Z1 + 25 && Math.abs(x) < 760) {
    const t = Math.min(z - (RIVER_Z0 - 25), RIVER_Z1 + 25 - z) / 25; return -4 * Math.min(1, t);
  }
  if (d <= 0) return 0;
  const ramp = Math.min(1, d / 120);
  let h = (hillNoise(x, z) + 14) * ramp;
  if (x > HALF) h += Math.min(1, (x - HALF) / 250) * 55 * (0.6 + 0.4 * Math.sin(z * 0.006)); // eastern mountains
  return Math.max(0, h);
}
export const inWater = (x: number, z: number) => z > RIVER_Z0 && z < RIVER_Z1 && Math.abs(x) < 760 && !(Math.abs(x) < 9);

export interface WorldBuild {
  colliders: Box[]; cullables: THREE.Object3D[]; nightMats: THREE.MeshStandardMaterial[]; lampMat: THREE.MeshStandardMaterial;
  water: THREE.Mesh; mapCanvas: HTMLCanvasElement; parkedSpots: { x: number; z: number; rot: number; vid: string }[];
  viewpointMeshes: THREE.Mesh[]; lod: LodSet; zoneAt: (x: number, z: number) => string;
}

export async function buildWorld(scene: THREE.Scene, progress: (p: number, msg: string) => void, quality: number, lib?: AssetLibrary): Promise<WorldBuild> {
  seed = 1337;
  if (!lib) { // self-contained: no changes needed in the calling file
    lib = new AssetLibrary();
    await lib.downloadPack((p, m) => progress(p * 0.04, m));
    await lib.preload(['house', 'home', 'office']);
  }
  const tick = () => new Promise(r => setTimeout(r, 0));
  const colliders: Box[] = [], cullables: THREE.Object3D[] = [], nightMats: THREE.MeshStandardMaterial[] = [];
  progress(0.05, 'Sculpting terrain…'); await tick();
  // TERRAIN
  const seg = quality > 1 ? 220 : 150;
  const tg = new THREE.PlaneGeometry(WORLD, WORLD, seg, seg); tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position as THREE.BufferAttribute; const cols: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); const h = heightAt(x, z); pos.setY(i, h - 0.05);
    if (h < -0.5) c.set('#8a7a5a'); else if (h > 45) c.set('#8c8577'); else if (h > 30) c.setRGB(0.45, 0.5, 0.33); else c.setRGB(0.55 + rnd() * 0.08, 0.7 + rnd() * 0.08, 0.45);
    cols.push(c.r, c.g, c.b);
  }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); tg.computeVertexNormals();
  const grass = tex.grass().clone(); grass.repeat.set(160, 160); grass.needsUpdate = true;
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: grass, vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true; scene.add(terrain);

  // WATER
  const wn = tex.water(); wn.repeat.set(40, 4);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1520, RIVER_Z1 - RIVER_Z0 + 50), new THREE.MeshPhysicalMaterial({ color: '#1d4e63', roughness: 0.08, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6), transparent: true, opacity: 0.92, clearcoat: 1 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -1.4, (RIVER_Z0 + RIVER_Z1) / 2); scene.add(water);

  progress(0.2, 'Paving roads…'); await tick();
  // CITY GROUND: sidewalks (blocks) + roads
  const sw = tex.sidewalk().clone(); sw.repeat.set(BLOCK / 4, BLOCK / 4); sw.needsUpdate = true;
  const swMat = new THREE.MeshStandardMaterial({ map: sw, roughness: 0.9 });
  const grassMat = new THREE.MeshStandardMaterial({ map: tex.grass(), roughness: 1 });
  const roadTex = tex.road().clone(); roadTex.repeat.set(1, N * BLOCK / 16); roadTex.needsUpdate = true;
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 });
  const asph = tex.asphalt().clone(); asph.repeat.set(2, 2); asph.needsUpdate = true;
  const interMat = new THREE.MeshStandardMaterial({ map: asph, roughness: 0.85 });
  const len = N * BLOCK + ROAD_W;
  for (let i = 0; i <= N; i++) {
    const p = -HALF + i * BLOCK;
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, len), roadMat); rz.rotation.x = -Math.PI / 2; rz.position.set(p, 0.02, 0); rz.receiveShadow = true; scene.add(rz);
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, len), roadMat); rx.rotation.x = -Math.PI / 2; rx.rotation.z = Math.PI / 2; rx.position.set(0, 0.021, p); rx.receiveShadow = true; scene.add(rx);
    for (let j = 0; j <= N; j++) { const it = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_W), interMat); it.rotation.x = -Math.PI / 2; it.position.set(p, 0.03, -HALF + j * BLOCK); scene.add(it); }
  }
  // highway out to the hills (east) and bridge road south
  const hw = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 300), roadMat); hw.rotation.x = -Math.PI / 2; hw.rotation.z = Math.PI / 2; hw.position.set(HALF + 150, 0.02, 0); hw.visible = false; // terrain-following later via trail
  scene.add(hw);

  // block sidewalks
  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
    const [cx, cz] = blockCenter(bx, bz); const sp = SPECIAL_BLOCKS[`${bx},${bz}`];
    const s = new THREE.Mesh(new THREE.BoxGeometry(BLOCK - ROAD_W, 0.2, BLOCK - ROAD_W), sp === 'park' || sp === 'playground' ? grassMat : swMat);
    s.position.set(cx, 0.1, cz); s.receiveShadow = true; scene.add(s);
  }

  progress(0.35, 'Constructing buildings…'); await tick();
  const facadeMats: THREE.MeshStandardMaterial[] = [];
  for (let k = 0; k < 6; k++) { const m = new THREE.MeshStandardMaterial({ map: tex.facade(k), emissiveMap: tex.facade(k, true), emissive: '#ffffff', emissiveIntensity: 0, roughness: k % 3 === 2 ? 0.2 : 0.8, metalness: k % 3 === 2 ? 0.5 : 0.05 }); facadeMats.push(m); nightMats.push(m); }
  const roofMat = new THREE.MeshStandardMaterial({ color: '#555a60', roughness: 0.9 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const addBuilding = (x: number, z: number, w: number, d: number, h: number, mat: THREE.Material, parent?: THREE.Group) => {
    const mats = [mat, mat, roofMat, roofMat, mat, mat];
    const geo = new THREE.BoxGeometry(w, h, d); const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let f = 0; f < 6; f++) { if (f === 2 || f === 3) continue; const fw = f < 2 ? d : w; for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(fw / 8)), uv.getY(i) * Math.max(1, Math.round(h / 16))); }
    const m = new THREE.Mesh(geo, mats); m.position.set(x, h / 2 + 0.2, z); m.castShadow = true; m.receiveShadow = true; m.userData.h = h;
    // fix texture repeat via per-building UV scale is costly; use shared repeat by clone-free approach
    (parent || scene).add(m); colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: h + 0.2 });
    return m;
  };
  const solid = (col: string, r = 0.7, met = 0) => new THREE.MeshStandardMaterial({ color: col, roughness: r, metalness: met });
  const parkedSpots: WorldBuild['parkedSpots'] = [];
  const treePts: [number, number, number][] = [];
  const signs: { x: number; z: number; text: string; color: string; h: number }[] = [];
  const inner = BLOCK - ROAD_W - 6;
  const lod = new LodSet(); const ctx = { lib, lod, colliders };
  { // update LOD from the render camera twice a second (no game-loop change needed)
    let lodT = 0; const prev = scene.onBeforeRender;
    scene.onBeforeRender = (r: any, s: any, camera: THREE.Camera, ...rest: any[]) => {
      (prev as any).call(scene, r, s, camera, ...rest);
      const t = performance.now(); if (t - lodT < 500) return; lodT = t;
      lod.update(camera.matrixWorld.elements[12], camera.matrixWorld.elements[14]);
    };
  }

  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
    const [cx, cz] = blockCenter(bx, bz); const sp = SPECIAL_BLOCKS[`${bx},${bz}`];
    const grp = new THREE.Group(); grp.userData.center = new THREE.Vector3(cx, 0, cz); scene.add(grp); cullables.push(grp);
    const distC = Math.hypot(cx, cz) / HALF; // downtown => tall
    if (sp === 'hospital') {
      addBuilding(cx, cz - 8, 46, 26, 22, solid('#eef0f2', 0.5), grp); addBuilding(cx - 16, cz + 12, 14, 18, 10, solid('#dfe3e6'), grp);
      const cross = solid('#e01818'); cross.emissive.set('#e01818'); cross.emissiveIntensity = 0.5;
      const c1 = new THREE.Mesh(boxGeo, cross); c1.scale.set(6, 2, 0.4); c1.position.set(cx, 18, cz + 5.3); grp.add(c1);
      const c2 = new THREE.Mesh(boxGeo, cross); c2.scale.set(2, 6, 0.4); c2.position.set(cx, 18, cz + 5.3); grp.add(c2);
      parkedSpots.push({ x: cx + 12, z: cz + 20, rot: 0, vid: 'amb' }); signs.push({ x: cx, z: cz + 5.4, text: 'HOSPITAL', color: '#e01818', h: 12 });
    } else if (sp === 'police') {
      addBuilding(cx, cz - 6, 40, 28, 14, solid('#2d4a7a', 0.6), grp); addBuilding(cx + 16, cz - 6, 6, 6, 24, solid('#1e3357'), grp);
      parkedSpots.push({ x: cx - 10, z: cz + 20, rot: 0, vid: 'cop' }, { x: cx - 4, z: cz + 20, rot: 0, vid: 'cop' });
      signs.push({ x: cx, z: cz + 8.1, text: 'POLICE', color: '#1d5fe0', h: 10 });
    } else if (sp === 'petrol') {
      addBuilding(cx - 14, cz - 16, 16, 10, 5, solid('#f4f4f4'), grp);
      const canopy = new THREE.Mesh(boxGeo, solid('#f2b705', 0.4, 0.3)); canopy.scale.set(26, 1, 14); canopy.position.set(cx + 4, 6, cz + 6); canopy.castShadow = true; grp.add(canopy);
      for (const [px, pz] of [[-6, 0], [4, 0], [14, 0], [-6, 12], [4, 12], [14, 12]]) { const p = new THREE.Mesh(boxGeo, solid('#c62828')); p.scale.set(0.6, 6, 0.6); p.position.set(cx + px - 2, 3, cz + pz); grp.add(p); }
      for (const px of [-2, 8]) addBuilding(cx + px, cz + 6, 1.2, 2.5, 1.6, solid('#1565c0'), grp);
      parkedSpots.push({ x: cx + 20, z: cz - 14, rot: 1.57, vid: 'truck' }); signs.push({ x: cx + 4, z: cz + 13.1, text: 'FUEL', color: '#f2b705', h: 6.8 });
    } else if (sp === 'mall') {
      addBuilding(cx, cz - 4, inner, inner * 0.62, 16, facadeMats[2], grp);
      addBuilding(cx, cz - 4, inner * 0.4, inner * 0.3, 26, facadeMats[5], grp);
      signs.push({ x: cx, z: cz - 4 + inner * 0.31 + 0.1, text: 'RICH MALL', color: '#ffd400', h: 12 });
      for (let i = -2; i <= 2; i++) parkedSpots.push({ x: cx + i * 6, z: cz + 22, rot: 0, vid: ['sedan', 'hatch', 'gt', 'sedan', 'fury'][i + 2] });
    } else if (sp === 'park' || sp === 'playground') {
      for (let i = 0; i < 22; i++) treePts.push([cx + (rnd() - 0.5) * inner, cz + (rnd() - 0.5) * inner, 0.8 + rnd() * 0.6]);
      // path cross
      const path = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, inner), swMat); path.position.set(cx, 0.22, cz); grp.add(path);
      const path2 = path.clone(); path2.rotation.y = Math.PI / 2; grp.add(path2);
      // fountain / playground
      if (sp === 'park') {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 1, 24), solid('#bbb')); f.position.set(cx, 0.6, cz); grp.add(f);
        const fw = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.2, 24), solid('#3a8fb0', 0.1, 0.3)); fw.position.set(cx, 1.05, cz); grp.add(fw);
        colliders.push({ minX: cx - 5, maxX: cx + 5, minZ: cz - 5, maxZ: cz + 5, h: 1.1 });
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; addBuilding(cx + Math.cos(a) * 12, cz + Math.sin(a) * 12, 2.4, 0.7, 0.5, solid('#6d4c41'), grp); }
      } else {
        const red = solid('#e53935'), blu = solid('#1e88e5'), yel = solid('#fdd835');
        const slide = new THREE.Mesh(boxGeo, yel); slide.scale.set(2, 0.2, 8); slide.position.set(cx + 12, 2, cz + 10); slide.rotation.x = 0.45; grp.add(slide);
        addBuilding(cx + 12, cz + 6, 3, 3, 3.5, red, grp);
        for (const sx of [-14, -8]) { const fr = new THREE.Mesh(boxGeo, blu); fr.scale.set(0.3, 4, 0.3); fr.position.set(cx + sx, 2, cz - 12); grp.add(fr); const fr2 = fr.clone(); fr2.position.z = cz - 8; grp.add(fr2); }
        const bar = new THREE.Mesh(boxGeo, blu); bar.scale.set(6.3, 0.3, 0.3); bar.position.set(cx - 11, 4, cz - 12); grp.add(bar);
        const sand = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.1, 20), solid('#d9c48b')); sand.position.set(cx - 10, 0.25, cz + 10); grp.add(sand);
        signs.push({ x: cx, z: cz + inner / 2, text: 'PLAYGROUND', color: '#1e88e5', h: 3 });
      }
    } else if (sp === 'parking') {
      const lot = new THREE.Mesh(new THREE.BoxGeometry(inner, 0.05, inner), interMat); lot.position.set(cx, 0.23, cz); grp.add(lot);
      const ids = VEHICLES.map(v => v.id);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) parkedSpots.push({ x: cx - 18 + i * 12, z: cz - 10 + j * 20, rot: j ? Math.PI : 0, vid: ids[(i * 2 + j) % ids.length] });
      signs.push({ x: cx, z: cz + inner / 2, text: 'P  PARKING', color: '#1d5fe0', h: 3 });
    } else {
      // generic: subdivide into lots
      const downtown = distC < 0.55, residential = distC > 0.9;
      const lots = residential ? 3 : 2; const lw = inner / lots;
      for (let i = 0; i < lots; i++) for (let j = 0; j < lots; j++) {
        const x = cx - inner / 2 + lw * (i + 0.5), z = cz - inner / 2 + lw * (j + 0.5);
        if (residential) {
          if (rnd() < 0.2) { treePts.push([x, z, 1]); continue; }
          // GLB house (falls back to the old box house if the model is missing). Assumes model front faces +Z.
          const face = j === lots - 1 ? 0 : j === 0 ? Math.PI : i === 0 ? -Math.PI / 2 : Math.PI / 2;
          if (placeBuilding(ctx, grp, rnd() < 0.5 ? 'house' : 'home', x, z, face, { w: lw * 0.8 })) { if (rnd() < 0.5) treePts.push([x + lw * 0.42, z + lw * 0.4, 0.7]); continue; }
          const h = 5 + rnd() * 4; const m = addBuilding(x, z, lw * 0.7, lw * 0.6, h, facadeMats[[1, 3, 4][Math.floor(rnd() * 3)]], grp);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(lw * 0.55, 3, 4), solid(['#8d3b2b', '#5a3d2b', '#444'][Math.floor(rnd() * 3)])); roof.rotation.y = Math.PI / 4; roof.position.set(x, m.userData.h + 1.7, z); roof.castShadow = true; grp.add(roof);
          if (rnd() < 0.5) treePts.push([x + lw * 0.42, z + lw * 0.4, 0.7]);
        } else {
          const h = downtown ? 30 + rnd() * 70 : 12 + rnd() * 28;
          const towers = ['office', 'skyline'].filter(k => lib?.has(k));
          if (towers.length && placeBuilding(ctx, grp, towers[Math.floor(rnd() * towers.length)], x, z, Math.floor(rnd() * 4) * Math.PI / 2, { h, maxW: lw * 0.85 })) continue;
          const mat = facadeMats[Math.floor(rnd() * 6)];
          addBuilding(x, z, lw * (0.7 + rnd() * 0.2), lw * (0.7 + rnd() * 0.2), h, mat, grp);
          if (downtown && rnd() < 0.5) addBuilding(x, z, lw * 0.4, lw * 0.4, h + 10 + rnd() * 20, mat, grp);
        }
      }
    }
  }
  await tick();
  progress(0.55, 'Planting forests…'); await tick();
  // Sidewalk trees + hills forest
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) { if (rnd() < 0.5) treePts.push([-HALF + i * BLOCK + 10.5, -HALF + j * BLOCK + 20 + rnd() * 40, 0.6]); }
  const forestCount = quality > 1 ? 1400 : quality > 0 ? 900 : 500;
  for (let i = 0; i < forestCount; i++) {
    const x = (rnd() - 0.5) * (WORLD - 60), z = (rnd() - 0.5) * (WORLD - 60);
    if (Math.abs(x) < HALF + 30 && Math.abs(z) < HALF + 30) continue; if (inWater(x, z) || heightAt(x, z) < -0.3) continue;
    if (Math.abs(z) < 12 && x > HALF) continue; // keep trail clear
    treePts.push([x, z, 0.8 + rnd() * 0.9]);
  }
  const trunkG = new THREE.CylinderGeometry(0.2, 0.32, 3, 6); trunkG.translate(0, 1.5, 0);
  const leafG = new THREE.IcosahedronGeometry(2.2, 1); leafG.translate(0, 4.4, 0);
  const pineG = new THREE.ConeGeometry(2, 6, 7); pineG.translate(0, 5.5, 0);
  const trunks = new THREE.InstancedMesh(trunkG, solid('#4e342e', 0.9), treePts.length);
  const leaves = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: '#3f7a2c', roughness: 0.85, flatShading: true }), treePts.length);
  const pines = new THREE.InstancedMesh(pineG, new THREE.MeshStandardMaterial({ color: '#2a5a28', roughness: 0.85, flatShading: true }), treePts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  let li = 0, pi = 0; const col = new THREE.Color();
  treePts.forEach(([x, z, s], i) => {
    const y = heightAt(x, z) + (Math.abs(x) < HALF + 10 && Math.abs(z) < HALF + 10 ? 0.2 : 0);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6); sv.set(s, s, s); pv.set(x, y, z); m4.compose(pv, q, sv);
    trunks.setMatrixAt(i, m4);
    if (y > 20 || rnd() < 0.25) { pines.setMatrixAt(pi, m4); col.setHSL(0.3 + rnd() * 0.05, 0.45, 0.2 + rnd() * 0.08); pines.setColorAt(pi++, col); }
    else { leaves.setMatrixAt(li, m4); col.setHSL(0.22 + rnd() * 0.1, 0.5, 0.25 + rnd() * 0.1); leaves.setColorAt(li++, col); }
    if (Math.abs(x) < HALF + 20 && Math.abs(z) < HALF + 20) colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, h: 4 });
  });
  leaves.count = li; pines.count = pi; [trunks, leaves, pines].forEach(m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });

  progress(0.68, 'Building the bridge…'); await tick();
  // BRIDGE
  const bridgeMat = solid('#9aa0a6', 0.6, 0.4);
  const deckN = 40;
  for (let k = 0; k < deckN; k++) {
    const z0 = 330 + k * (155 / deckN), z1 = z0 + 155 / deckN; const zc = (z0 + z1) / 2;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 155 / deckN + 0.15), interMat); seg.position.set(0, heightAt(0, zc) - 0.25, zc);
    seg.rotation.x = -Math.atan2(heightAt(0, z1) - heightAt(0, z0), z1 - z0); seg.receiveShadow = true; scene.add(seg);
    for (const sx of [-9, 9]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.1, 155 / deckN + 0.1), bridgeMat); rail.position.set(sx, heightAt(0, zc) + 0.5, zc); rail.rotation.x = seg.rotation.x; scene.add(rail); }
  }
  for (const z of [370, 445]) for (const sx of [-9.5, 9.5]) { const tw = new THREE.Mesh(new THREE.BoxGeometry(1.2, 24, 1.2), bridgeMat); tw.position.set(sx, 9, z); tw.castShadow = true; scene.add(tw); }
  for (const z of [370, 445]) { const top = new THREE.Mesh(new THREE.BoxGeometry(20, 1.2, 1.2), bridgeMat); top.position.set(0, 20.5, z); scene.add(top); }
  for (let z = 335; z <= 480; z += 6) { const tz = z < 407 ? 370 : 445; const d = Math.abs(z - tz); for (const sx of [-9.2, 9.2]) { const h = 20 - heightAt(0, z) - d * 0.25; if (h < 1) continue; const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 4), bridgeMat); cable.position.set(sx, heightAt(0, z) + h / 2 + 0.5, z); scene.add(cable); } }
  // bridge piers in river
  for (const z of [395, 420]) { const p = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 3), bridgeMat); p.position.set(0, -1.5, z); scene.add(p); }
  // keep player on bridge: side rails as colliders
  colliders.push({ minX: -10, maxX: -9, minZ: 340, maxZ: 480, h: 2 }, { minX: 9, maxX: 10, minZ: 340, maxZ: 480, h: 2 });

  progress(0.78, 'Wiring street lights…'); await tick();
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: '#ffd27a', emissiveIntensity: 0 });
  const poleG = new THREE.CylinderGeometry(0.1, 0.14, 7, 6); poleG.translate(0, 3.5, 0);
  const lampG = new THREE.BoxGeometry(0.5, 0.25, 1.4); lampG.translate(0, 7, 0.6);
  const lampPts: [number, number, number][] = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) { const p = -HALF + i * BLOCK, q2 = -HALF + j * BLOCK + BLOCK / 2; lampPts.push([p + 9, q2, -Math.PI / 2], [q2, p - 9, Math.PI]); }
  const poles = new THREE.InstancedMesh(poleG, solid('#444', 0.5, 0.7), lampPts.length), lamps = new THREE.InstancedMesh(lampG, lampMat, lampPts.length);
  lampPts.forEach(([x, z, r], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r); m4.compose(pv.set(x, 0.2, z), q, sv.set(1, 1, 1)); poles.setMatrixAt(i, m4); lamps.setMatrixAt(i, m4); });
  scene.add(poles, lamps);

  // SIGNS (canvas text panels)
  signs.forEach(s => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d')!;
    g.fillStyle = 'rgba(15,18,24,0.92)'; g.fillRect(0, 0, 512, 128); g.fillStyle = s.color; g.fillRect(0, 118, 512, 10);
    g.font = 'bold 72px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(s.text, 256, 62);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#fff', emissiveIntensity: 0.4 }));
    m.position.set(s.x, s.h, s.z + 0.05); scene.add(m);
  });

  // hiking trail markers + viewpoints
  const vpMeshes: THREE.Mesh[] = [];
  VIEWPOINTS.forEach(([x, z]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 8), new THREE.MeshStandardMaterial({ color: '#29b6f6', emissive: '#29b6f6', emissiveIntensity: 0.8 }));
    m.position.set(x, heightAt(x, z) + 1.5, z); scene.add(m); vpMeshes.push(m);
  });
  const stoneMat = solid('#8d8478', 0.95);
  for (let x = HALF + 20; x < 760; x += 14) { const z = Math.sin(x * 0.02) * 30 - (x - HALF) * 0.2; for (const s of [-3, 3]) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rnd() * 0.4), stoneMat); st.position.set(x, heightAt(x, z + s) + 0.2, z + s); scene.add(st); } }
  // rocks on mountains (climbable obstacles)
  const rockG = new THREE.DodecahedronGeometry(1, 0); const rocks = new THREE.InstancedMesh(rockG, stoneMat, 160);
  for (let i = 0; i < 160; i++) { const x = HALF + 60 + rnd() * 450, z = (rnd() - 0.5) * 900; if (inWater(x, z)) { rocks.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; } const s = 1 + rnd() * 3; m4.compose(pv.set(x, heightAt(x, z), z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6), sv.set(s, s * 0.7, s)); rocks.setMatrixAt(i, m4); }
  rocks.castShadow = true; scene.add(rocks);
  // radio tower on summit
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 30, 4), solid('#c62828', 0.5, 0.5)); tower.position.set(560, heightAt(560, -120) + 15, -125); scene.add(tower);

  progress(0.88, 'Drawing city map…'); await tick();
  // MAP CANVAS (2D render for minimap & map screen)
  const MS = 1024; const mc = document.createElement('canvas'); mc.width = mc.height = MS; const g = mc.getContext('2d')!;
  const toM = (v: number) => (v + WORLD / 2) / WORLD * MS;
  const img = g.createImageData(MS, MS);
  for (let y = 0; y < MS; y += 1) for (let x = 0; x < MS; x += 1) {
    const wx = x / MS * WORLD - WORLD / 2, wz = y / MS * WORLD - WORLD / 2; const h = heightAt(wx, wz); const i = (y * MS + x) * 4;
    let r = 92, gg = 134, b = 74;
    if (inWater(wx, wz) || h < -1.5) { r = 40; gg = 110; b = 160; } else if (h > 45) { r = 150; gg = 140; b = 125; } else if (h > 0.5) { const k = Math.min(1, h / 50); r = 92 - k * 20; gg = 134 - k * 30; b = 74 - k * 10; }
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
    const sp = SPECIAL_BLOCKS[`${bx},${bz}`]; const [cx, cz] = blockCenter(bx, bz);
    g.fillStyle = sp === 'park' || sp === 'playground' ? '#5e9e4e' : sp === 'hospital' ? '#e9e9e9' : sp === 'police' ? '#5476b8' : sp === 'petrol' ? '#e3b23c' : sp === 'mall' ? '#c47ad6' : '#8a8f98';
    const s = (BLOCK - ROAD_W) / WORLD * MS; g.fillRect(toM(cx) - s / 2, toM(cz) - s / 2, s, s);
  }
  g.fillStyle = '#2b2e33'; const rw = ROAD_W / WORLD * MS;
  for (let i = 0; i <= N; i++) { const p = toM(-HALF + i * BLOCK); g.fillRect(p - rw / 2, toM(-HALF - 8), rw, (len) / WORLD * MS); g.fillRect(toM(-HALF - 8), p - rw / 2, len / WORLD * MS, rw); }
  g.fillRect(toM(0) - rw / 2, toM(330), rw, 155 / WORLD * MS);
  g.strokeStyle = '#c9a26b'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath();
  for (let x = HALF + 20; x < 760; x += 10) { const z = Math.sin(x * 0.02) * 30 - (x - HALF) * 0.2; x === HALF + 20 ? g.moveTo(toM(x), toM(z)) : g.lineTo(toM(x), toM(z)); } g.stroke(); g.setLineDash([]);

  const zoneAt = (x: number, z: number) => {
    if (inWater(x, z)) return 'Silver River';
    if (Math.abs(x) < 10 && z > 330 && z < 485) return 'Golden Span Bridge';
    if (x > HALF + 20) return heightAt(x, z) > 40 ? 'Eagle Peak' : 'Eastern Hills';
    if (Math.abs(x) > HALF + 20 || Math.abs(z) > HALF + 20) return z > 0 ? 'Riverside' : 'Countryside';
    const bx = Math.floor((x + HALF) / BLOCK), bz = Math.floor((z + HALF) / BLOCK);
    const sp = SPECIAL_BLOCKS[`${bx},${bz}`]; if (sp) return { hospital: 'Central Hospital', police: 'Police HQ', petrol: 'Fuel Station', mall: 'Rich Mall', park: 'City Park', parking: 'Parking Lot', playground: 'Kids Playground' }[sp];
    const d = Math.hypot(x, z) / HALF; return d < 0.55 ? 'Downtown' : d > 0.9 ? 'Green Homes' : 'Midtown';
  };
  progress(1, 'Done'); 
  return { colliders, cullables, nightMats, lampMat, water, mapCanvas: mc, parkedSpots, viewpointMeshes: vpMeshes, lod, zoneAt };
}
