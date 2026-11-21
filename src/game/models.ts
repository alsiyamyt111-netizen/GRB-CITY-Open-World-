// Procedural 3D model builders: articulated humans (with limb pivots for animation) and vehicles.
// GLB/GLTF support: loadGLB() can replace these placeholders when real assets are added to /public/models.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { VehicleDef } from './data';

export interface Look { female: boolean; skin: string; shirt: string; pants: string; hair: string; hat?: boolean }
export interface Human { group: THREE.Group; body: THREE.Group; lLeg: THREE.Group; rLeg: THREE.Group; lArm: THREE.Group; rArm: THREE.Group; lKnee: THREE.Group; rKnee: THREE.Group; head: THREE.Group; phase: number }

const std = (color: string, rough = 0.8, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 10);

export function makeHuman(look: Look): Human {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const skin = std(look.skin, 0.6), shirt = std(look.shirt, 0.75), pants = std(look.pants, 0.85), hair = std(look.hair, 0.5), shoe = std('#f2f2f2', 0.5);
  const f = look.female; const sc = f ? 0.93 : 1;
  const hips = new THREE.Group(); hips.position.y = 0.95 * sc; body.add(hips);
  // torso
  const torso = new THREE.Mesh(cap(f ? 0.17 : 0.2, 0.42), shirt); torso.position.y = 0.32; torso.scale.set(1.15, 1, 0.72); hips.add(torso);
  const pelvis = new THREE.Mesh(cap(f ? 0.17 : 0.16, 0.1), pants); pelvis.scale.set(1.25, 1, 0.8); hips.add(pelvis);
  // jacket collar detail
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), shirt); collar.rotation.x = Math.PI / 2; collar.position.y = 0.6; hips.add(collar);
  // head
  const head = new THREE.Group(); head.position.y = 0.72; hips.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 8), skin); neck.position.y = -0.02; head.add(neck);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 14), skin); skull.scale.set(0.9, 1.1, 1); skull.position.y = 0.13; head.add(skull);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); hairM.scale.set(0.95, 1.12, 1.05); hairM.position.set(0, 0.15, -0.01); head.add(hairM);
  if (f) { const pony = new THREE.Mesh(cap(0.07, 0.25), hair); pony.position.set(0, 0.0, -0.13); pony.rotation.x = 0.3; head.add(pony); }
  const eyeM = std('#111', 0.3); [-0.045, 0.045].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeM); e.position.set(x, 0.15, 0.115); head.add(e); });
  if (look.hat) { const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 14), std('#222')); hat.position.y = 0.25; head.add(hat); const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.14), std('#222')); brim.position.set(0, 0.22, 0.14); head.add(brim); }
  // arms
  const mkArm = (side: number) => {
    const sh = new THREE.Group(); sh.position.set(side * (f ? 0.22 : 0.26), 0.55, 0); hips.add(sh);
    const up = new THREE.Mesh(cap(0.055, 0.26), shirt); up.position.y = -0.16; sh.add(up);
    const lo = new THREE.Mesh(cap(0.045, 0.24), skin); lo.position.y = -0.44; sh.add(lo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin); hand.position.y = -0.6; sh.add(hand);
    return sh;
  };
  const mkLeg = (side: number) => {
    const hp = new THREE.Group(); hp.position.set(side * 0.1, -0.04, 0); hips.add(hp);
    const th = new THREE.Mesh(cap(f ? 0.08 : 0.085, 0.32), pants); th.position.y = -0.22; hp.add(th);
    const knee = new THREE.Group(); knee.position.y = -0.44; hp.add(knee);
    const sh = new THREE.Mesh(cap(0.065, 0.32), pants); sh.position.y = -0.2; knee.add(sh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.25), shoe); foot.position.set(0, -0.42, 0.05); knee.add(foot);
    return { hp, knee };
  };
  const lArm = mkArm(-1), rArm = mkArm(1); const L = mkLeg(-1), R = mkLeg(1);
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
  return { group: g, body, lLeg: L.hp, rLeg: R.hp, lKnee: L.knee, rKnee: R.knee, lArm, rArm, head, phase: 0 };
}

/** Procedural animation state machine: idle / walk / run / jump / crouch / sit */
export function animateHuman(h: Human, dt: number, state: 'idle' | 'walk' | 'run' | 'jump' | 'crouch' | 'sit' | 'fall', speed: number) {
  const t = performance.now() / 1000;
  if (state === 'sit') { h.lLeg.rotation.x = h.rLeg.rotation.x = -1.4; h.lKnee.rotation.x = h.rKnee.rotation.x = 1.4; h.lArm.rotation.x = h.rArm.rotation.x = -1.0; h.body.position.y = -0.4; h.body.rotation.x = 0; return; }
  if (state === 'fall') { h.body.rotation.x = -Math.PI / 2; h.body.position.y = -0.7; return; }
  h.body.rotation.x = 0;
  const rate = state === 'run' ? 11 : state === 'walk' || state === 'crouch' ? 7 : 0;
  h.phase += dt * rate * Math.max(0.5, Math.min(speed / (state === 'run' ? 7 : 3), 1.3));
  const s = Math.sin(h.phase), amp = state === 'run' ? 0.9 : state === 'walk' ? 0.5 : state === 'crouch' ? 0.35 : 0;
  const lerp = (a: number, b: number) => a + (b - a) * Math.min(1, dt * 12);
  if (state === 'jump') {
    h.lLeg.rotation.x = lerp(h.lLeg.rotation.x, -0.8); h.rLeg.rotation.x = lerp(h.rLeg.rotation.x, 0.3);
    h.lKnee.rotation.x = lerp(h.lKnee.rotation.x, 1.1); h.rKnee.rotation.x = lerp(h.rKnee.rotation.x, 0.4);
    h.lArm.rotation.x = lerp(h.lArm.rotation.x, -2.4); h.rArm.rotation.x = lerp(h.rArm.rotation.x, -2.4);
    h.body.position.y = 0; return;
  }
  h.lLeg.rotation.x = lerp(h.lLeg.rotation.x, s * amp + (state === 'crouch' ? -0.9 : 0));
  h.rLeg.rotation.x = lerp(h.rLeg.rotation.x, -s * amp + (state === 'crouch' ? -0.9 : 0));
  h.lKnee.rotation.x = lerp(h.lKnee.rotation.x, Math.max(0, -s) * amp * 1.4 + (state === 'crouch' ? 1.4 : 0));
  h.rKnee.rotation.x = lerp(h.rKnee.rotation.x, Math.max(0, s) * amp * 1.4 + (state === 'crouch' ? 1.4 : 0));
  h.lArm.rotation.x = lerp(h.lArm.rotation.x, -s * amp * 0.9); h.rArm.rotation.x = lerp(h.rArm.rotation.x, s * amp * 0.9);
  h.lArm.rotation.z = -0.08; h.rArm.rotation.z = 0.08;
  const breathe = state === 'idle' ? Math.sin(t * 2) * 0.01 : Math.abs(Math.cos(h.phase)) * (state === 'run' ? 0.08 : 0.03);
  h.body.position.y = lerp(h.body.position.y, (state === 'crouch' ? -0.35 : 0) + breathe);
  h.body.rotation.x = state === 'run' ? 0.15 : 0;
}

export interface VehicleMesh { group: THREE.Group; body: THREE.MeshPhysicalMaterial; wheels: THREE.Object3D[]; frontWheels: THREE.Object3D[]; headMat: THREE.MeshStandardMaterial; tailMat: THREE.MeshStandardMaterial; sirenMats?: THREE.MeshStandardMaterial[] }

const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 18); wheelGeo.rotateZ(Math.PI / 2);
const tireMat = std('#141414', 0.9); const rimMat = std('#bbbbbb', 0.3, 0.9);
const glassMat = new THREE.MeshPhysicalMaterial({ color: '#0d1620', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85, clearcoat: 1 });
const darkMat = std('#1a1a1a', 0.7);

export function makeVehicle(def: VehicleDef, colorOverride?: string): VehicleMesh {
  const g = new THREE.Group(); const L = def.len, W = def.wid, H = def.hgt;
  const body = new THREE.MeshPhysicalMaterial({ color: colorOverride || def.color, roughness: 0.25, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.08 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff8e0', emissiveIntensity: 0.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#600', emissive: '#ff1010', emissiveIntensity: 0.3 });
  const wheels: THREE.Object3D[] = [], front: THREE.Object3D[] = [];
  const addWheel = (x: number, z: number, r: number, w: number, isFront: boolean) => {
    const piv = new THREE.Group(); piv.position.set(x, r, z); g.add(piv);
    const tire = new THREE.Mesh(wheelGeo, tireMat); tire.scale.set(w, r, r); piv.add(tire);
    const rim = new THREE.Mesh(wheelGeo, rimMat); rim.scale.set(w * 1.05, r * 0.6, r * 0.6); tire.add(rim); rim.scale.set(1.05, 0.6, 0.6);
    wheels.push(tire); if (isFront) front.push(piv);
  };
  const box = (w: number, h: number, l: number, m: THREE.Material, x: number, y: number, z: number) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m); b.position.set(x, y, z); g.add(b); return b; };
  let sirenMats: THREE.MeshStandardMaterial[] | undefined;
  if (def.type === 'bike') {
    addWheel(0, L * 0.38, 0.33, 0.12, true); addWheel(0, -L * 0.38, 0.33, 0.15, false);
    box(0.32, 0.35, L * 0.55, body, 0, 0.7, 0.05); // tank/body
    box(0.28, 0.12, 0.6, darkMat, 0, 0.88, -0.3); // seat
    box(0.7, 0.05, 0.05, rimMat, 0, 1.05, L * 0.3); // handlebar
    box(0.12, 0.5, 0.12, rimMat, 0, 0.75, L * 0.35).rotation.x = -0.4;
    box(0.18, 0.12, 0.08, headMat, 0, 0.95, L * 0.4); box(0.15, 0.08, 0.05, tailMat, 0, 0.8, -L * 0.48);
    box(0.15, 0.15, 0.6, rimMat, 0.15, 0.4, -0.4); // exhaust
  } else {
    const r = def.type === 'bus' || def.type === 'truck' ? 0.5 : 0.36;
    const wz = L / 2 - r * 1.6;
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => addWheel(sx * (W / 2 - 0.12), sz * wz, r, 0.26, sz > 0));
    const sports = def.type === 'sports';
    const lowH = sports ? H * 0.42 : H * 0.48;
    const lower = box(W, lowH, L, body, 0, r * 0.7 + lowH / 2, 0);
    if (sports) { lower.scale.set(1, 1, 1); box(W * 0.98, 0.06, L * 0.25, body, 0, r * 0.7 + lowH + 0.03, L * 0.36).rotation.x = -0.08; }
    if (def.type === 'bus') {
      box(W * 0.98, H - lowH - r * 0.5, L * 0.98, body, 0, r * 0.7 + lowH + (H - lowH - r * 0.5) / 2, 0);
      box(W * 1.01, 0.7, L * 0.9, glassMat, 0, r * 0.7 + lowH + 0.6, -0.1);
      box(W * 0.9, 0.9, 0.05, glassMat, 0, r * 0.7 + lowH + 0.4, L / 2);
    } else if (def.type === 'truck' || def.type === 'ambulance') {
      const cabL = def.type === 'truck' ? 2.2 : 1.8;
      box(W * 0.96, H - lowH - r * 0.5, cabL, def.type === 'truck' ? body : body, 0, r * 0.7 + lowH + (H - lowH - r * 0.5) / 2, L / 2 - cabL / 2);
      box(W * 0.9, 0.6, 0.05, glassMat, 0, r * 0.7 + lowH + 0.55, L / 2 + 0.01);
      const cargoM = def.type === 'truck' ? std('#9e9e9e', 0.6, 0.3) : body;
      box(W, H - r * 0.7 + 0.1, L - cabL - 0.2, cargoM, 0, r * 0.7 + (H - r * 0.7) / 2 + 0.1, -cabL / 2 - 0.1);
      if (def.type === 'ambulance') {
        const red = std('#d01010'); box(W * 1.01, 0.25, L * 0.6, red, 0, r * 0.7 + lowH, -0.6);
        const crossM = std('#d01010'); box(0.02, 0.6, 0.18, crossM, W / 2 + 0.01, H * 0.7, -1); box(0.02, 0.18, 0.6, crossM, W / 2 + 0.01, H * 0.7, -1);
        sirenMats = [new THREE.MeshStandardMaterial({ color: '#f00', emissive: '#f00', emissiveIntensity: 0 }), new THREE.MeshStandardMaterial({ color: '#00f', emissive: '#00f', emissiveIntensity: 0 })];
        box(0.4, 0.15, 0.25, sirenMats[0], -0.4, H + 0.15, L / 2 - 1); box(0.4, 0.15, 0.25, sirenMats[1], 0.4, H + 0.15, L / 2 - 1);
      }
    } else {
      const cabH = H - lowH - r * 0.7, cabL = sports ? L * 0.42 : L * 0.55;
      const cab = box(W * 0.86, cabH, cabL, glassMat, 0, r * 0.7 + lowH + cabH / 2, sports ? -L * 0.05 : -L * 0.04);
      const roof = box(W * 0.84, 0.06, cabL * 0.75, body, 0, r * 0.7 + lowH + cabH, cab.position.z - 0.05);
      if (def.type === 'police') {
        const white = std('#f4f4f4', 0.3, 0.3); box(W * 1.005, lowH * 0.5, L * 0.5, white, 0, r * 0.7 + lowH * 0.6, -0.2);
        sirenMats = [new THREE.MeshStandardMaterial({ color: '#f00', emissive: '#f00', emissiveIntensity: 0 }), new THREE.MeshStandardMaterial({ color: '#00f', emissive: '#00f', emissiveIntensity: 0 })];
        box(0.5, 0.12, 0.25, sirenMats[0], -0.28, roof.position.y + 0.08, roof.position.z); box(0.5, 0.12, 0.25, sirenMats[1], 0.28, roof.position.y + 0.08, roof.position.z);
      }
      if (sports) box(W * 0.9, 0.05, 0.3, darkMat, 0, r * 0.7 + lowH + 0.25, -L / 2 + 0.2); // spoiler
    }
    // lights, grille, bumpers, mirrors
    const ly = r * 0.7 + lowH * 0.65;
    box(0.4, 0.14, 0.05, headMat, -W / 2 + 0.3, ly, L / 2 + 0.01); box(0.4, 0.14, 0.05, headMat, W / 2 - 0.3, ly, L / 2 + 0.01);
    box(0.4, 0.12, 0.05, tailMat, -W / 2 + 0.3, ly, -L / 2 - 0.01); box(0.4, 0.12, 0.05, tailMat, W / 2 - 0.3, ly, -L / 2 - 0.01);
    box(W * 0.5, 0.15, 0.04, darkMat, 0, ly - 0.05, L / 2 + 0.01);
    box(W * 1.02, 0.12, 0.15, darkMat, 0, r * 0.7 + 0.06, L / 2); box(W * 1.02, 0.12, 0.15, darkMat, 0, r * 0.7 + 0.06, -L / 2);
    box(0.08, 0.08, 0.15, body, -W / 2 - 0.05, r * 0.7 + lowH + 0.1, L * 0.18); box(0.08, 0.08, 0.15, body, W / 2 + 0.05, r * 0.7 + lowH + 0.1, L * 0.18);
  }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return { group: g, body, wheels, frontWheels: front, headMat, tailMat, sirenMats };
}

/** Optional GLB loader – drop real optimized models into public/models and call this. */
const loader = new GLTFLoader();
export function loadGLB(url: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  return new Promise((res, rej) => loader.load(url, g => res({ scene: g.scene, animations: g.animations }), undefined, rej));
}

/** Loads a .glb/.gltf prop/building/vehicle and uniformly scales it so its height matches targetHeight
 *  (or its longest side, if byLongestSide). Pivots the result so its base sits at local y=0. Cheap way
 *  to drop in arbitrary scanned/downloaded assets (Sketchfab, etc.) without hand-tuning export scale. */
export async function loadProp(url: string, targetHeight: number, byLongestSide = false): Promise<THREE.Group> {
  const { scene } = await loadGLB(url);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3(); box.getSize(size);
  const dim = byLongestSide ? Math.max(size.x, size.y, size.z) : (size.y || 1);
  const scale = targetHeight / (dim || 1);
  scene.scale.setScalar(scale);
  const box2 = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3(); box2.getCenter(center);
  scene.position.x -= center.x; scene.position.z -= center.z; scene.position.y -= box2.min.y;
  scene.traverse(o => { const m = o as THREE.Mesh; if ((m as any).isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const wrap = new THREE.Group(); wrap.add(scene); return wrap;
}

// ---------------------------------------------------------------------------
// Mixamo-rigged skinned characters + retargeted FBX animation clips.
// Every mixamo export re-numbers its bone prefix ("mixamorig", "mixamorig1",
// "mixamorig9:", "mixamorig12", ...), so clips from one download won't play on
// a skeleton from another unless we normalize names first.
const BONE_PREFIX = /^mixamorig\d*:?/;
const boneSuffix = (name: string) => name.replace(BONE_PREFIX, '');

/** Rewrites an FBX AnimationClip's track node-names to match the bone names actually
 *  present on targetRoot, so one Mixamo animation clip can drive any Mixamo character.
 *  Also fixes the two Hips-position problems found in the shipped clips:
 *  1) units: jump.fbx stores Hips translation ~10x smaller than Run/Walk/Idle (rest Y 10 vs 104), which sank the
 *     character into the ground. Hips position is rescaled by (target hips rest Y / clip hips rest Y).
 *  2) root motion: Run/Walk/Jump move the Hips forward (Run ~3.7 m per 0.63 s loop) and then snap back at the loop point,
 *     which looked like running, getting stuck, jumping backwards and running again. The linear forward/side drift is
 *     removed so the clip plays in place (the game moves the character itself). */
function retargetClip(clip: THREE.AnimationClip, targetRoot: THREE.Object3D, srcHipsRestY = 0): THREE.AnimationClip {
  const byBone = new Map<string, string>(); const found: { hips?: THREE.Object3D } = {};
  targetRoot.traverse(o => { if (!o.name) return; const b = boneSuffix(o.name); byBone.set(b, o.name); if (b === 'Hips' && !found.hips) found.hips = o; });
  const k = found.hips && srcHipsRestY > 1e-4 && found.hips.position.y > 1e-4 ? found.hips.position.y / srcHipsRestY : 1;
  const tracks: THREE.KeyframeTrack[] = [];
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf('.');
    if (dot < 0) continue;
    const bone = boneSuffix(t.name.slice(0, dot));
    const mapped = byBone.get(bone);
    if (!mapped) continue; // bone not present on this rig (e.g. extra finger joints) — skip
    const nt = t.clone(); nt.name = mapped + t.name.slice(dot);
    if (bone === 'Hips' && t.name.slice(dot) === '.position') {
      const v = nt.values as unknown as Float32Array, times = nt.times, n = times.length;
      for (let i = 0; i < v.length; i++) v[i] *= k;
      const T = (times[n - 1] - times[0]) || 1;
      for (const axis of [0, 2]) { // X and Z: remove the linear travel, keep the natural sway/bounce
        const first = v[axis], drift = v[(n - 1) * 3 + axis] - first;
        for (let i = 0; i < n; i++) v[i * 3 + axis] -= drift * ((times[i] - times[0]) / T);
      }
    }
    tracks.push(nt);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

const fbxLoader = new FBXLoader();
interface LoadedAnim { clip: THREE.AnimationClip; hipsRestY: number }
const fbxCache = new Map<string, Promise<LoadedAnim>>();
function loadFBXAnim(url: string): Promise<LoadedAnim> {
  let p = fbxCache.get(url);
  if (!p) {
    p = new Promise((res, rej) => fbxLoader.load(url, obj => {
      const clip = obj.animations[0];
      if (!clip) { rej(new Error('no animation in ' + url)); return; }
      let hipsRestY = 0; obj.traverse(o => { if (!hipsRestY && o.name && boneSuffix(o.name) === 'Hips') hipsRestY = o.position.y; });
      res({ clip, hipsRestY });
    }, undefined, rej));
    fbxCache.set(url, p);
  }
  return p;
}

export interface AnimChar {
  group: THREE.Group;          // add this to the scene
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  current: string;
  height: number;
}

/** Loads a Mixamo-rigged .glb body + a set of named Mixamo .fbx animation clips,
 *  scales the body to targetHeight (meters) and wires every clip onto its skeleton. */
export async function loadCharacter(modelUrl: string, animUrls: Record<string, string>, targetHeight = 1.78): Promise<AnimChar> {
  const { scene } = await loadGLB(modelUrl);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3(); box.getSize(size);
  const scale = targetHeight / (size.y || 1);
  scene.scale.setScalar(scale);
  const box2 = new THREE.Box3().setFromObject(scene);
  const center = new THREE.Vector3(); box2.getCenter(center);
  scene.position.x -= center.x; scene.position.z -= center.z; scene.position.y -= box2.min.y;
  scene.traverse(o => { const m = o as THREE.Mesh; if ((m as any).isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  const group = new THREE.Group(); group.add(scene);
  const mixer = new THREE.AnimationMixer(scene);
  const actions: Record<string, THREE.AnimationAction> = {};
  await Promise.all(Object.entries(animUrls).map(async ([name, url]) => {
    try {
      const la = await loadFBXAnim(url);
      const clip = retargetClip(la.clip, scene, la.hipsRestY);
      if (clip.tracks.length) actions[name] = mixer.clipAction(clip);
    } catch (e) { console.warn('[character] animation failed to load:', name, e); }
  }));
  return { group, mixer, actions, current: '', height: targetHeight };
}

const ONE_SHOT = new Set(['Jump', 'Kick', 'Punch', 'Getup', 'Death', 'StandToSit', 'SitToStand']);

/** Cross-fades to a named action (a no-op if already playing). Pass a callback for
 *  one-shot animations (Kick/Punch/Getup/...) to know when they finish. */
export function setCharState(ch: AnimChar, name: string, fade = 0.2, onDone?: () => void) {
  if (ch.current === name) return;
  const next = ch.actions[name];
  if (!next) return; // animation not loaded for this character — stay on current pose
  const oneShot = ONE_SHOT.has(name);
  next.reset().setEffectiveWeight(1).fadeIn(fade);
  next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
  next.clampWhenFinished = oneShot;
  next.play();
  const prev = ch.actions[ch.current];
  if (prev && prev !== next) prev.fadeOut(fade);
  ch.current = name;
  if (oneShot && onDone) {
    const mixer = ch.mixer;
    const handler = (e: any) => { if (e.action === next) { mixer.removeEventListener('finished', handler); onDone(); } };
    mixer.addEventListener('finished', handler);
  }
}
