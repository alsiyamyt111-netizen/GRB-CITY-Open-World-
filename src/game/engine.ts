// RICH CITY core engine – rendering, player controller, vehicles, AI, environment & missions
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { buildWorld, heightAt, inWater, WORLD, type Box, type WorldBuild } from './world';
import { WeaponHolder, WEAPONS, isWeaponId, type WeaponId } from './weapons';
import { makeHuman, animateHuman, makeVehicle, loadCharacter, setCharState, type Human, type VehicleMesh, type AnimChar } from './models';
import { VEHICLES, MISSIONS, VIEWPOINTS, HALF, BLOCK, N, CHARACTERS, ANIM_FILES, type VehicleDef, type MissionDef } from './data';
import { addXp, type Profile, type Settings } from './store';
import { tex } from './textures';
import { audio } from './audio';

export const input = { mx: 0, my: 0, run: false, crouch: false, jump: false, lookDx: 0, lookDy: 0, steer: 0, gas: false, brake: false, handbrake: false, action: false, prone: false };

export interface HudState {
  mode: 'walk' | 'run' | 'drive' | 'bike' | 'hike' | 'swim'; health: number; stamina: number; speed: number; vehicleName: string; damage: number; lights: boolean;
  time: number; weather: string; zone: string; prompt: string; mission: null | { name: string; step: number; total: number; timeLeft?: number; dist: number }; fps: number; crouch: boolean; camMode: number; money: number; weapon: WeaponId; run: boolean;
}
interface Veh { def: VehicleDef; m: VehicleMesh; pos: THREE.Vector3; heading: number; speed: number; steer: number; damage: number; ai: boolean; parked: boolean; driver?: Human; from: [number, number]; to: [number, number]; owned?: boolean; lights: boolean; prevPos: THREE.Vector3 }
interface Ped { h: Human; pos: THREE.Vector3; from: [number, number]; to: [number, number]; speed: number; fallen: number; heading: number }

const DAY_MIN = 60; // one full in-game day = 60 real minutes (night ≈ 5 min)
const PRESETS = {
  low: { pr: 0.7, shadows: false, smap: 512, draw: 260, traffic: 8, peds: 10, q: 0 },
  medium: { pr: 1, shadows: true, smap: 1024, draw: 420, traffic: 14, peds: 18, q: 1 },
  high: { pr: 1.5, shadows: true, smap: 2048, draw: 620, traffic: 20, peds: 26, q: 2 },
  ultra: { pr: 2, shadows: true, smap: 4096, draw: 900, traffic: 26, peds: 34, q: 2 },
};
const STATE_CLIP: Record<string, string> = { idle: 'Idle', walk: 'Walk', run: 'Run', jump: 'Jump', crouch: 'Crouch', prone: 'Prone' };
const nodePos = (i: number, j: number) => new THREE.Vector3(-HALF + i * BLOCK, 0, -HALF + j * BLOCK);
const fwd = (h: number) => new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
const right = (h: number) => new THREE.Vector3(-Math.cos(h), 0, Math.sin(h));
const groundAt = (x: number, z: number) => {
  const h = heightAt(x, z);
  if (Math.abs(x) < HALF + 8 && Math.abs(z) < HALF + 8) { const mx = ((x + HALF) % BLOCK + BLOCK) % BLOCK, mz = ((z + HALF) % BLOCK + BLOCK) % BLOCK; if (mx > 8 && mx < BLOCK - 8 && mz > 8 && mz < BLOCK - 8) return 0.2; }
  return h;
};

export class Game {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera;
  sun = new THREE.DirectionalLight('#fff', 3); hemi = new THREE.HemisphereLight('#bcd8ff', '#4a4030', 1);
  sky = new Sky(); pmrem: THREE.PMREMGenerator; envRT?: THREE.WebGLRenderTarget; lastEnvTime = -99;
  world!: WorldBuild; grid = new Map<string, Box[]>();
  player!: AnimChar; weapons!: WeaponHolder; aim = false; baseFov = 60; pos = new THREE.Vector3(9.5, 0.2, 40); vy = 0; yaw = Math.PI; onGround = true; health = 100; stamina = 100; punchT = 0;
  camYaw = Math.PI; camPitch = 0.25; camMode = 0; camPos = new THREE.Vector3();
  vehicles: Veh[] = []; peds: Ped[] = []; current: Veh | null = null;
  time = 9; weather = 'clear'; weatherT = 120; cloud = 0; rain = 0; fogK = 0; rainPts!: THREE.Points; clouds: THREE.Sprite[] = []; stars!: THREE.Points;
  headSpot = new THREE.SpotLight('#fff3d0', 0, 60, 0.5, 0.4, 1.2);
  mission: { def: MissionDef; idx: number; timeLeft?: number } | null = null; marker!: THREE.Group; waypoint: THREE.Vector3 | null = null;
  minimap: HTMLCanvasElement | null = null; running = false; paused = false; raf = 0; clock = new THREE.Clock();
  hudT = 0; lodT = 0; saveT = 0; stepT = 0; fps = 60; fpsAcc = 0; fpsN = 0; preset = PRESETS.medium; zone = '';
  constructor(public container: HTMLElement, public profile: Profile, public cb: { onHud: (h: HudState) => void; onToast: (t: string) => void; onMissionDone: (name: string, reward: number) => void; onDeath: () => void; onSave: () => void }) {
    const s = profile.settings; this.preset = PRESETS[s.preset];
    this.renderer = new THREE.WebGLRenderer({ antialias: s.preset === 'high' || s.preset === 'ultra', powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.6;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.onResize(); window.addEventListener('resize', this.onResize);
  }
  onResize = () => { const w = this.container.clientWidth, h = this.container.clientHeight; this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); };

  async init(progress: (p: number, msg: string) => void) {
    const S = this.scene;
    this.sky.scale.setScalar(4000); S.add(this.sky);
    const u = this.sky.material.uniforms; u.turbidity.value = 6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
    S.add(this.sun, this.sun.target, this.hemi);
    this.sun.castShadow = true; const sc = this.sun.shadow.camera; sc.left = sc.bottom = -70; sc.right = sc.top = 70; sc.far = 500; this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.05;
    S.fog = new THREE.Fog('#b8c8d8', 50, 600);
    this.world = await buildWorld(S, (p, m) => progress(p * 0.8, m), this.preset.q);
    for (const b of this.world.colliders) { for (let x = Math.floor(b.minX / 40); x <= Math.floor(b.maxX / 40); x++) for (let z = Math.floor(b.minZ / 40); z <= Math.floor(b.maxZ / 40); z++) { const k = x + ',' + z; (this.grid.get(k) || this.grid.set(k, []).get(k)!).push(b); } }
    progress(0.82, 'Spawning characters…'); await new Promise(r => setTimeout(r, 0));
    const charDef = CHARACTERS.find(c => c.id === this.profile.charId) || CHARACTERS[0];
    this.player = await loadCharacter(charDef.file, ANIM_FILES, 1.78); S.add(this.player.group);
    this.weapons = new WeaponHolder(this.player); this.weapons.equip(isWeaponId(this.profile.weapon) ? this.profile.weapon : 'fist'); this.baseFov = this.camera.fov;
    if (this.profile.savedPos) { this.pos.set(this.profile.savedPos.x, 0, this.profile.savedPos.z); this.time = this.profile.savedPos.time; }
    // parked vehicles
    for (const sp of this.world.parkedSpots) this.spawnVehicle(VEHICLES.find(v => v.id === sp.vid)!, sp.x, sp.z, sp.rot, false);
    // player's garage vehicle
    const myDef = VEHICLES.find(v => v.id === this.profile.selectedVehicle) || VEHICLES[0];
    const mine = this.spawnVehicle(myDef, this.pos.x - 5.5, this.pos.z, Math.PI, false, this.profile.vehicleColor[myDef.id]); mine.owned = true; mine.damage = this.profile.vehicleDamage[myDef.id] || 0; this.applyDamageLook(mine);
    progress(0.88, 'Starting traffic…');
    // traffic pool
    const civ = VEHICLES.filter(v => v.type !== 'police' || Math.random() < 0.3);
    for (let i = 0; i < 26; i++) { const v = this.spawnVehicle(civ[i % civ.length], 0, 0, 0, true); this.recycleTraffic(v, true); }
    for (let i = 0; i < 34; i++) {
      const c = CHARACTERS[i % 8]; const h = makeHuman({ female: c.female, skin: c.skin, shirt: ['#37474f', '#8e24aa', '#f4511e', '#1e88e5', '#43a047', '#fdd835', '#eee', '#222'][i % 8], pants: ['#263238', '#3e2723', '#1a237e', '#555'][i % 4], hair: c.hair });
      const p: Ped = { h, pos: new THREE.Vector3(), from: [0, 0], to: [0, 0], speed: 1.1 + Math.random() * 0.6, fallen: 0, heading: 0 }; h.group.traverse(o => { o.castShadow = false; }); S.add(h.group); this.recyclePed(p, true); this.peds.push(p);
    }
    progress(0.93, 'Weather & sky…');
    // rain
    const rg = new THREE.BufferGeometry(); const rp = new Float32Array(4000 * 3); for (let i = 0; i < rp.length; i++) rp[i] = (Math.random() - 0.5) * 80;
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rainPts = new THREE.Points(rg, new THREE.PointsMaterial({ color: '#aac', size: 0.12, transparent: true, opacity: 0.6, depthWrite: false })); this.rainPts.frustumCulled = false; S.add(this.rainPts);
    const ct = tex.cloud(); for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, opacity: 0.5, depthWrite: false, fog: false })); s.scale.set(260, 130, 1); s.position.set((Math.random() - 0.5) * 2400, 220 + Math.random() * 80, (Math.random() - 0.5) * 2400); S.add(s); this.clouds.push(s); }
    const sg = new THREE.BufferGeometry(); const sp2: number[] = []; for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().randomDirection(); if (v.y < 0.05) v.y = -v.y + 0.05; v.multiplyScalar(1500); sp2.push(v.x, v.y, v.z); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp2, 3)); this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); S.add(this.stars);
    // mission marker
    this.marker = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, fog: false })); beam.position.y = 30;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 32), new THREE.MeshBasicMaterial({ color: '#ffd400' })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
    this.marker.add(beam, ring); this.marker.visible = false; S.add(this.marker);
    S.add(this.headSpot, this.headSpot.target);
    this.applySettings(this.profile.settings);
    progress(1, 'Ready');
  }

  spawnVehicle(def: VehicleDef, x: number, z: number, rot: number, ai: boolean, color?: string): Veh {
    const traffColors = ['#c62828', '#eeeeee', '#1565c0', '#212121', '#9e9e9e', '#2e7d32', '#f9a825', '#6a1b9a'];
    const m = makeVehicle(def, color || (ai && (def.type === 'car' || def.type === 'sports') ? traffColors[Math.floor(Math.random() * traffColors.length)] : undefined));
    const v: Veh = { def, m, pos: new THREE.Vector3(x, groundAt(x, z), z), heading: rot, speed: 0, steer: 0, damage: 0, ai, parked: !ai, from: [0, 0], to: [0, 0], lights: false, prevPos: new THREE.Vector3() };
    if (ai) { const d = makeHuman({ female: Math.random() < 0.5, skin: '#c68a5e', shirt: '#455a64', pants: '#222', hair: '#111' }); d.group.scale.setScalar(0.95); animateHuman(d, 1, 'sit', 0); d.group.position.set(def.type === 'bike' ? 0 : 0.4, def.type === 'bike' ? 0.45 : 0.25, def.type === 'bike' ? -0.2 : -0.1); m.group.add(d.group); v.driver = d; }
    m.group.position.copy(v.pos); m.group.rotation.y = rot; this.scene.add(m.group); this.vehicles.push(v); return v;
  }
  recycleTraffic(v: Veh, initial = false) {
    // object pooling: reposition existing traffic car on a road node near the player
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(Math.random() * (N + 1)), j = Math.floor(Math.random() * (N + 1));
      const p = nodePos(i, j); const d = p.distanceTo(this.pos);
      if (!initial && (d < 90 || d > 260)) continue;
      const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => i + a >= 0 && i + a <= N && j + b >= 0 && j + b <= N) as [number, number][];
      const [a, b] = dirs[Math.floor(Math.random() * dirs.length)];
      v.from = [i, j]; v.to = [i + a, j + b]; const h = Math.atan2(a, b);
      v.heading = h; v.pos.copy(p).add(right(h).multiplyScalar(4)).add(fwd(h).multiplyScalar(10)); v.speed = 8; v.damage = 0; this.applyDamageLook(v); return;
    }
  }
  recyclePed(p: Ped, initial = false) {
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(Math.random() * (N + 1)), j = Math.floor(Math.random() * (N + 1)); const n = nodePos(i, j);
      if (!initial && (n.distanceTo(this.pos) < 60 || n.distanceTo(this.pos) > 200)) continue;
      const dirs = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).filter(([a, b]) => i + a >= 0 && i + a <= N && j + b >= 0 && j + b <= N);
      const [a, b] = dirs[Math.floor(Math.random() * dirs.length)]; p.from = [i, j]; p.to = [i + a, j + b]; p.heading = Math.atan2(a, b);
      p.pos.copy(n).add(right(p.heading).multiplyScalar(10)).add(fwd(p.heading).multiplyScalar(Math.random() * 60)); p.fallen = 0; p.h.body.rotation.x = 0; return;
    }
  }
  applyDamageLook(v: Veh) { const base = new THREE.Color(v.def.color); if (v.m.body.userData.base) base.copy(v.m.body.userData.base); else v.m.body.userData.base = v.m.body.color.clone(); v.m.body.color.copy(v.m.body.userData.base).lerp(new THREE.Color('#222'), Math.min(0.8, v.damage / 120)); v.m.body.roughness = 0.25 + v.damage / 200; }

  collide(p: THREE.Vector3, r: number, y: number): boolean {
    let hit = false; const k0 = Math.floor(p.x / 40), k1 = Math.floor(p.z / 40);
    for (let gx = k0 - 1; gx <= k0 + 1; gx++) for (let gz = k1 - 1; gz <= k1 + 1; gz++) {
      const list = this.grid.get(gx + ',' + gz); if (!list) continue;
      for (const b of list) {
        if (y > b.h - 0.3) continue;
        const cx = Math.max(b.minX, Math.min(p.x, b.maxX)), cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          hit = true;
          if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
          else { const o = [p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z]; const m = Math.min(...o); if (m === o[0]) p.x = b.minX - r; else if (m === o[1]) p.x = b.maxX + r; else if (m === o[2]) p.z = b.minZ - r; else p.z = b.maxZ + r; }
        }
      }
    }
    const lim = WORLD / 2 - 20; p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z));
    return hit;
  }

  applySettings(s: Settings) {
    this.preset = PRESETS[s.preset];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.preset.pr));
    this.renderer.shadowMap.enabled = this.preset.shadows; this.sun.castShadow = this.preset.shadows;
    if (this.sun.shadow.mapSize.x !== this.preset.smap) { this.sun.shadow.mapSize.set(this.preset.smap, this.preset.smap); this.sun.shadow.map?.dispose(); (this.sun.shadow as any).map = null; }
    this.scene.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && !Array.isArray(m)) m.needsUpdate = true; });
    this.camera.far = this.preset.draw * 4 + 1000; this.camera.updateProjectionMatrix();
    this.vehicles.filter(v => v.ai).forEach((v, i) => { v.m.group.visible = i < this.preset.traffic; });
    this.peds.forEach((p, i) => { p.h.group.visible = i < this.preset.peds; });
    audio.setVolumes(s.sfx, s.ambient);
  }

  start() { this.running = true; this.clock.start(); const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.frame(); }; loop(); }
  setPaused(p: boolean) { this.paused = p; if (!p) this.clock.getDelta(); audio.engine(false, 0); }
  dispose() {
    this.running = false; cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.onResize);
    this.scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as any; if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x: THREE.Material) => x.dispose()); });
    this.envRT?.dispose(); this.pmrem.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); audio.engine(false, 0); audio.ambience(0, 0);
  }

  // ---------- actions from UI ----------
  nearestVehicle() { let best: Veh | null = null, bd = 1e9; for (const v of this.vehicles) { if (!v.m.group.visible) continue; const d = v.pos.distanceTo(this.pos); const lim = Math.max(3.2, v.def.len / 2 + 1.6); if (d < lim && d < bd) { bd = d; best = v; } } return best; }
  interact() {
    input.run = false; audio.door();
    if (this.current) {
      const v = this.current; v.parked = true; v.speed = 0; this.current = null;
      this.player.group.removeFromParent(); this.scene.add(this.player.group); this.player.group.visible = true;
      const out = v.pos.clone().add(right(v.heading).multiplyScalar(v.def.wid / 2 + 1.0)); this.collide(out, 0.4, 0); this.pos.copy(out); this.pos.y = groundAt(out.x, out.z); this.yaw = v.heading; this.vy = 0; this.onGround = true; setCharState(this.player, 'Idle', 0.15);
      this.headSpot.intensity = 0; v.m.headMat.emissiveIntensity = 0.2; v.m.sirenMats?.forEach(m => m.emissiveIntensity = 0); audio.engine(false, 0);
      if (v.owned) { this.profile.vehicleDamage[v.def.id] = v.damage; }
      return;
    }
    const v = this.nearestVehicle(); if (!v) { this.cb.onToast('No vehicle nearby'); return; }
    if (v.damage >= 100) { this.cb.onToast('This vehicle is wrecked!'); return; }
    if (v.ai) { v.ai = false; if (v.driver) { v.driver.group.visible = false; } this.cb.onToast(`You took the ${v.def.name}`); }
    v.parked = false; this.current = v; this.camYaw = v.heading;
    if (v.def.type === 'bike') { this.player.group.removeFromParent(); v.m.group.add(this.player.group); this.player.group.position.set(0, 0.42, -0.25); this.player.group.rotation.set(0, 0, 0); setCharState(this.player, 'Crouch', 0.1); }
    else this.player.group.visible = false;
  }
  action() {
    if (this.current) { audio.horn(); this.peds.forEach(p => { if (p.pos.distanceTo(this.current!.pos) < 15) p.speed = 2.6; }); return; }
    const w = WEAPONS[this.weapons.id];
    if (w.kind === 'gun') { this.weapons.fire(); audio.blip(w.id === 'sniper' ? 90 : w.id === 'pistol' ? 220 : 160, 0.07, 'square', 0.12); audio.blip(60, 0.1, 'sawtooth', 0.08); return; } // show only: flash + recoil, no bullets
    if (this.punchT <= 0) { this.punchT = 0.6; setCharState(this.player, 'Punch', 0.05); }
    if (w.kind === 'throw') { this.weapons.fire(); audio.blip(320, 0.2, 'sine', 0.08); return; } // throw gesture only
    audio.blip(150, 0.08, 'square', 0.1);
    if (w.id === 'fist') for (const p of this.peds) if (!p.fallen && p.pos.distanceTo(this.pos) < 1.8) { p.fallen = 6; audio.blip(90, 0.15, 'sawtooth'); }
  }
  /** Equip a weapon (not while in a vehicle). Persisted in the profile. */
  equip(id: WeaponId) {
    input.run = false;
    if (this.current) { this.cb.onToast('Get out of the vehicle first'); return; }
    this.weapons.equip(id); this.profile.weapon = id; audio.click(); this.cb.onSave();
  }
  setAim(on: boolean) { this.aim = on; if (on) input.run = false; }
  /** Grenade button: throw one, then switch back to what was in hand. */
  quickThrow() {
    if (this.current) return;
    const prev = this.weapons.id;
    if (prev !== 'grenade') this.weapons.equip('grenade');
    this.action();
    if (prev !== 'grenade') setTimeout(() => { if (this.weapons.id === 'grenade') this.weapons.equip(prev); }, 900);
  }
  toggleLights() { input.run = false; if (!this.current) return; this.current.lights = !this.current.lights; audio.click(); }
  horn() { input.run = false; audio.horn(); }
  cycleCamera() { input.run = false; this.camMode = (this.camMode + 1) % 3; audio.click(); }
  useMedkit() { input.run = false; if (this.profile.medkits <= 0) { this.cb.onToast('No medkits – buy in Shop'); return; } this.profile.medkits--; this.health = 100; this.cb.onToast('Health restored'); audio.reward(); }
  useEnergy() { input.run = false; if (this.profile.energy <= 0) { this.cb.onToast('No energy drinks – buy in Shop'); return; } this.profile.energy--; this.stamina = 100; this.cb.onToast('Stamina refilled'); audio.reward(); }
  repairCurrent() { const v = this.current || this.vehicles.find(v => v.owned); if (v) { v.damage = 0; this.applyDamageLook(v); if (v.owned) this.profile.vehicleDamage[v.def.id] = 0; } }
  startMission(id: string) { const def = MISSIONS.find(m => m.id === id); if (!def) return; this.mission = { def, idx: 0, timeLeft: def.time }; this.cb.onToast(`Mission: ${def.name}`); audio.reward(); }
  cancelMission() { this.mission = null; this.marker.visible = false; }
  setWaypoint(x: number, z: number) { this.waypoint = new THREE.Vector3(x, 0, z); }
  teleport(x: number, z: number) { if (this.current) this.interact(); this.pos.set(x, groundAt(x, z), z); }
  snapshot() { this.profile.savedPos = { x: this.current ? this.current.pos.x : this.pos.x, z: this.current ? this.current.pos.z : this.pos.z, time: this.time }; const own = this.vehicles.find(v => v.owned); if (own) this.profile.vehicleDamage[own.def.id] = own.damage; }

  // ---------- main loop ----------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    if (this.paused) return;
    if (this.current) this.updateDriving(dt); else this.updateOnFoot(dt);
    this.player.mixer.update(dt);
    this.weapons.update(dt, this.aim && !this.current, !this.current);
    this.updateTraffic(dt); this.updatePeds(dt); this.updateEnvironment(dt); this.updateCamera(dt); this.updateMission(dt);
    this.lodT -= dt; if (this.lodT < 0) { this.lodT = 0.5; const d2 = this.preset.draw ** 2; for (const g of this.world.cullables) g.visible = g.userData.center.distanceToSquared(this.camera.position) < d2; }
    this.saveT += dt; if (this.saveT > 30) { this.saveT = 0; this.snapshot(); this.cb.onSave(); }
    this.hudT -= dt; if (this.hudT < 0) { this.hudT = 0.1; this.emitHud(); }
    this.drawMinimap();
    this.renderer.render(this.scene, this.camera);
  }

  updateOnFoot(dt: number) {
    const P = this.player; const sens = this.profile.settings.sensitivity;
    this.camYaw -= input.lookDx * 0.005 * sens; this.camPitch = Math.max(-0.35, Math.min(1.1, this.camPitch + input.lookDy * 0.004 * sens)); input.lookDx = input.lookDy = 0;
    const swim = inWater(this.pos.x, this.pos.z) && this.pos.y < -0.8;
    let mx = input.mx, my = input.my;
    if (input.run && this.stamina <= 1) input.run = false;
    if (input.run && Math.hypot(mx, my) < 0.05) my = 1; // run button alone: sprint forward
    const mag = Math.min(1, Math.hypot(mx, my));
    const running = input.run && mag > 0.05 && this.stamina > 1 && !input.crouch && !input.prone && !swim;
    const speed = swim ? 2.2 : input.prone ? 0.9 : input.crouch ? 1.8 : running ? 7.5 : 3.2;
    if (mag > 0.05) {
      const ang = this.camYaw - Math.atan2(mx, my); const targetYaw = ang;
      let d = targetYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * 12);
      const prev = this.pos.clone();
      this.pos.x += Math.sin(ang) * speed * mag * dt; this.pos.z += Math.cos(ang) * speed * mag * dt;
      // steep slope check (hiking): slow down climbing
      const gNew = groundAt(this.pos.x, this.pos.z), gOld = groundAt(prev.x, prev.z);
      const slope = (gNew - gOld) / Math.max(0.001, Math.hypot(this.pos.x - prev.x, this.pos.z - prev.z));
      if (slope > 1.4 && this.onGround) { this.pos.x = prev.x; this.pos.z = prev.z; }
      this.collide(this.pos, 0.4, this.pos.y - groundAt(this.pos.x, this.pos.z));
      // collide with vehicles
      for (const v of this.vehicles) { if (!v.m.group.visible) continue; const d2 = v.pos.distanceTo(this.pos), r = v.def.wid / 2 + 0.5; if (d2 < r + v.def.len * 0.3) { const local = this.pos.clone().sub(v.pos); const f = fwd(v.heading), rr = right(v.heading); const lf = local.dot(f), lr = local.dot(rr); if (Math.abs(lf) < v.def.len / 2 + 0.3 && Math.abs(lr) < v.def.wid / 2 + 0.3) { const pushR = (v.def.wid / 2 + 0.31) * Math.sign(lr || 1); if (v.def.wid / 2 + 0.3 - Math.abs(lr) < v.def.len / 2 + 0.3 - Math.abs(lf)) this.pos.copy(v.pos).add(f.multiplyScalar(lf)).add(rr.multiplyScalar(pushR)); else this.pos.copy(v.pos).add(f.multiplyScalar((v.def.len / 2 + 0.31) * Math.sign(lf || 1))).add(rr.multiplyScalar(lr)); } } }
      this.stepT -= dt * (running ? 1.8 : 1); if (this.stepT < 0 && this.onGround) { this.stepT = 0.4; audio.step(); }
    }
    if (running) this.stamina = Math.max(0, this.stamina - dt * 14); else this.stamina = Math.min(100, this.stamina + dt * (mag > 0.05 ? 8 : 16));
    // jump & gravity
    const g = swim ? -1.3 : groundAt(this.pos.x, this.pos.z);
    if (input.jump && this.onGround && !swim && !input.prone && this.stamina > 8) { this.vy = 8.5; this.onGround = false; this.stamina -= 8; }
    input.jump = false;
    this.vy -= 24 * dt; this.pos.y += this.vy * dt;
    if (this.pos.y <= g) { if (!this.onGround && this.vy < -16) { const dmg = (-this.vy - 16) * 6; this.health -= dmg; this.cb.onToast('Ouch! Fall damage'); } this.pos.y = g; this.vy = 0; this.onGround = true; }
    else if (this.pos.y > g + 0.3) this.onGround = false;
    if (swim) this.stamina = Math.max(0, this.stamina - dt * 4);
    P.group.position.copy(this.pos); P.group.rotation.y = this.yaw;
    if (swim) P.group.position.y -= 0.7;
    if (this.punchT > 0) this.punchT -= dt;
    else {
      const st = !this.onGround ? 'jump' : input.prone ? 'prone' : input.crouch ? 'crouch' : mag > 0.05 ? (running ? 'run' : 'walk') : 'idle';
      setCharState(P, STATE_CLIP[swim ? 'walk' : st]);
    }
    this.health = Math.min(100, this.health + dt * 0.5);
    if (this.health <= 0) { this.health = 100; this.cb.onDeath(); this.pos.set(-280 + 40, 0.2, -280 + 76); this.vy = 0; if (this.mission) { this.cb.onToast('Mission failed'); this.cancelMission(); } }
  }

  updateDriving(dt: number) {
    const v = this.current!; const d = v.def; const sens = this.profile.settings.sensitivity;
    this.camYaw -= input.lookDx * 0.005 * sens; this.camPitch = Math.max(-0.2, Math.min(1.0, this.camPitch + input.lookDy * 0.004 * sens)); input.lookDx = input.lookDy = 0;
    const steerIn = Math.abs(input.steer) > 0.01 ? input.steer : input.mx;
    const gas = input.gas || input.my > 0.35, brake = input.brake || input.my < -0.35;
    const dead = v.damage >= 100; const maxS = d.maxSpeed * (1 - Math.min(0.5, v.damage / 200));
    if (gas && !dead) v.speed += (v.speed < 0 ? d.accel * 2 : d.accel * (1 - v.speed / maxS)) * dt;
    if (brake) { if (v.speed > 0.5) v.speed -= d.accel * 2.2 * dt; else if (!dead) v.speed = Math.max(-maxS * 0.3, v.speed - d.accel * 0.6 * dt); }
    if (input.handbrake) v.speed *= 1 - dt * 2.5;
    if (!gas && !brake) v.speed *= 1 - dt * 0.35;
    if (Math.abs(v.speed) < 0.05 && !gas) v.speed = 0;
    v.steer += (-steerIn * 0.6 - v.steer) * Math.min(1, dt * 6);
    const turn = v.steer * d.handling * Math.min(1, Math.abs(v.speed) / 8) * Math.sign(v.speed) * (1 - Math.min(0.5, Math.abs(v.speed) / (maxS * 2)));
    v.heading += turn * dt;
    v.prevPos.copy(v.pos);
    v.pos.addScaledVector(fwd(v.heading), v.speed * dt);
    // collisions: two circles along the body
    const r = d.wid / 2 + 0.1; let hit = false;
    for (const s of [0.32, -0.32, 0]) { const c = v.pos.clone().addScaledVector(fwd(v.heading), d.len * s); const before = c.clone(); if (this.collide(c, r, 0.2)) { hit = true; v.pos.add(c.sub(before)); } }
    if (inWater(v.pos.x, v.pos.z)) { v.pos.copy(v.prevPos); hit = true; }
    for (const o of this.vehicles) { if (o === v || !o.m.group.visible) continue; const dd = o.pos.distanceTo(v.pos); const rr = (o.def.wid + d.wid) / 2 + Math.min(o.def.len, d.len) * 0.25; if (dd < rr) { const n = v.pos.clone().sub(o.pos).setY(0).normalize(); v.pos.addScaledVector(n, rr - dd); if (Math.abs(v.speed) > 4) { o.damage = Math.min(100, o.damage + Math.abs(v.speed) * 1.2); this.applyDamageLook(o); o.speed = 0; } hit = true; } }
    if (hit && Math.abs(v.speed) > 2) { const imp = Math.abs(v.speed); v.damage = Math.min(100, v.damage + imp * 0.9); this.applyDamageLook(v); if (imp > 6) audio.crash(); v.speed *= -0.25; if (v.damage >= 100) this.cb.onToast('Vehicle wrecked! Exit and find another.'); if (this.profile.settings.vibrate && navigator.vibrate) navigator.vibrate(60); }
    // pedestrians knocked
    for (const p of this.peds) if (!p.fallen && p.pos.distanceTo(v.pos) < d.wid / 2 + 0.8 && Math.abs(v.speed) > 5) { p.fallen = 6; audio.blip(80, 0.2, 'sawtooth'); }
    const gy = groundAt(v.pos.x, v.pos.z); v.pos.y += (gy - v.pos.y) * Math.min(1, dt * 15);
    const gF = groundAt(v.pos.x + Math.sin(v.heading) * 1.5, v.pos.z + Math.cos(v.heading) * 1.5), gB = groundAt(v.pos.x - Math.sin(v.heading) * 1.5, v.pos.z - Math.cos(v.heading) * 1.5);
    this.syncVehicle(v, dt, Math.atan2(gB - gF, 3));
    if (d.type === 'bike') v.m.group.rotation.z = -v.steer * Math.min(1, Math.abs(v.speed) / 15) * 0.6;
    this.pos.copy(v.pos);
    // lights
    v.m.headMat.emissiveIntensity = v.lights ? 3 : 0.2; v.m.tailMat.emissiveIntensity = brake ? 3 : v.lights ? 1 : 0.3;
    this.headSpot.intensity = v.lights ? 120 : 0;
    if (v.lights) { const f = fwd(v.heading); this.headSpot.position.copy(v.pos).add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(f, d.len / 2); this.headSpot.target.position.copy(v.pos).addScaledVector(f, 25); }
    if (v.m.sirenMats) { const on = v.lights; const t = Math.floor(performance.now() / 200) % 2; v.m.sirenMats[0].emissiveIntensity = on && t ? 4 : 0; v.m.sirenMats[1].emissiveIntensity = on && !t ? 4 : 0; }
    const rpm = Math.min(1, Math.abs(v.speed) / maxS); audio.engine(!dead, rpm * 0.85 + (gas ? 0.15 : 0), d.type === 'bus' || d.type === 'truck');
    this.stamina = Math.min(100, this.stamina + dt * 10);
  }
  syncVehicle(v: Veh, dt: number, pitch = 0) {
    v.m.group.position.copy(v.pos); v.m.group.rotation.set(pitch, v.heading, v.m.group.rotation.z, 'YXZ');
    for (const w of v.m.wheels) w.rotation.x += v.speed * dt / 0.36;
    for (const f of v.m.frontWheels) f.rotation.y = v.steer * 0.6;
  }

  updateTraffic(dt: number) {
    const night = this.night();
    let idx = 0;
    for (const v of this.vehicles) {
      if (!v.ai) { if (v !== this.current && v.speed !== 0) { v.speed *= 1 - dt * 2; v.pos.addScaledVector(fwd(v.heading), v.speed * dt); this.syncVehicle(v, dt); } continue; }
      if (idx++ >= this.preset.traffic) continue;
      if (v.damage >= 60) { v.speed = 0; this.syncVehicle(v, dt); if (v.pos.distanceTo(this.pos) > 200) this.recycleTraffic(v); continue; }
      const segDir = Math.atan2(v.to[0] - v.from[0], v.to[1] - v.from[1]);
      const target = nodePos(v.to[0], v.to[1]).add(right(segDir).multiplyScalar(4)).sub(fwd(segDir).multiplyScalar(4));
      const toT = target.clone().sub(v.pos).setY(0); const dist = toT.length();
      if (dist < 3) {
        const [i, j] = v.to; const back: [number, number] = [v.from[0] - i, v.from[1] - j];
        const opts = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).filter(([a, b]) => i + a >= 0 && i + a <= N && j + b >= 0 && j + b <= N && !(a === back[0] && b === back[1]));
        const pick = opts.length ? opts[Math.floor(Math.random() * opts.length)] : back; v.from = [i, j]; v.to = [i + pick[0], j + pick[1]];
      }
      let desired = Math.atan2(toT.x, toT.z); let dh = Math.atan2(Math.sin(desired - v.heading), Math.cos(desired - v.heading));
      v.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh * 3 * dt));
      // obstacle avoidance: brake for player, peds & cars ahead
      let target_s = Math.abs(dh) > 0.4 ? 5 : Math.min(14, v.def.maxSpeed * 0.35); const F = fwd(v.heading);
      const check = (p: THREE.Vector3, lat: number) => { const rel = p.clone().sub(v.pos); const ahead = rel.dot(F); if (ahead > 0 && ahead < 12 + v.def.len / 2 && Math.abs(rel.dot(right(v.heading))) < lat) target_s = Math.min(target_s, ahead < v.def.len / 2 + 3 ? 0 : 3); };
      check(this.pos, 2.4);
      for (const o of this.vehicles) if (o !== v && o.m.group.visible && o.pos.distanceToSquared(v.pos) < 400) check(o.pos, 2.2);
      v.speed += (target_s - v.speed) * Math.min(1, dt * 2.5);
      v.pos.addScaledVector(F, v.speed * dt); v.pos.y = groundAt(v.pos.x, v.pos.z);
      v.m.headMat.emissiveIntensity = night > 0.5 ? 2.5 : 0.2; v.m.tailMat.emissiveIntensity = night > 0.5 ? 1 : 0.3;
      this.syncVehicle(v, dt);
      // hit player on foot
      if (!this.current && v.speed > 4 && v.pos.distanceTo(this.pos) < 2) { this.health -= v.speed * 2; this.vy = 5; this.onGround = false; audio.crash(); }
      if (v.pos.distanceTo(this.pos) > 300) this.recycleTraffic(v);
    }
  }
  updatePeds(dt: number) {
    this.peds.forEach((p, i) => {
      if (i >= this.preset.peds) return;
      if (p.fallen > 0) { p.fallen -= dt; animateHuman(p.h, dt, 'fall', 0); p.h.group.position.copy(p.pos); if (p.fallen <= 0) { p.h.body.rotation.x = 0; p.h.body.position.y = 0; } return; }
      const dist2 = p.pos.distanceToSquared(this.pos);
      if (dist2 > 230 * 230) { this.recyclePed(p); return; }
      p.h.group.visible = dist2 < 140 * 140; // distance LOD culling
      const segDir = Math.atan2(p.to[0] - p.from[0], p.to[1] - p.from[1]);
      const target = nodePos(p.to[0], p.to[1]).add(right(segDir).multiplyScalar(10)).sub(fwd(segDir).multiplyScalar(10));
      const toT = target.clone().sub(p.pos).setY(0);
      if (toT.length() < 1.5) { const [a, b] = p.to; const opts = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).filter(([x, y]) => a + x >= 0 && a + x <= N && b + y >= 0 && b + y <= N && !(a + x === p.from[0] && b + y === p.from[1])); const pk = opts[Math.floor(Math.random() * opts.length)] || [p.from[0] - a, p.from[1] - b]; p.from = [a, b]; p.to = [a + pk[0], b + pk[1]]; }
      p.heading = Math.atan2(toT.x, toT.z);
      let sp = p.speed; if (dist2 < 1.2) sp = 0; // stop to avoid walking through player
      p.pos.addScaledVector(fwd(p.heading), sp * dt); p.pos.y = groundAt(p.pos.x, p.pos.z);
      p.speed += (1.3 - p.speed) * dt * 0.2;
      p.h.group.position.copy(p.pos); p.h.group.rotation.y = p.heading;
      if (dist2 < 120 * 120) animateHuman(p.h, dt, sp > 2 ? 'run' : sp > 0 ? 'walk' : 'idle', sp); // LOD: skip animation when far
    });
  }

  night() { const dist = Math.min(this.time, 24 - this.time); return Math.max(0, Math.min(1, 1 - (dist - 1) / 0.5)); } // full night 23:00-01:00 (~5 min), fades in/out
  updateEnvironment(dt: number) {
    this.time = (this.time + dt * 24 / (DAY_MIN * 60)) % 24;
    // weather state machine
    this.weatherT -= dt; if (this.weatherT < 0) { const opts = ['clear', 'clear', 'cloudy', 'rain', 'fog']; this.weather = opts[Math.floor(Math.random() * opts.length)]; this.weatherT = 90 + Math.random() * 120; this.cb.onToast(`Weather: ${this.weather}`); }
    const tc = this.weather === 'clear' ? 0.1 : this.weather === 'fog' ? 0.5 : 0.85, tr = this.weather === 'rain' ? 1 : 0, tf = this.weather === 'fog' ? 1 : this.weather === 'rain' ? 0.5 : 0;
    const k = Math.min(1, dt * 0.3); this.cloud += (tc - this.cloud) * k; this.rain += (tr - this.rain) * k; this.fogK += (tf - this.fogK) * k;
    const elev = Math.sin((this.time - 6) / 12 * Math.PI); const az = (this.time / 24) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(Math.asin(elev)), elev, Math.sin(az) * Math.cos(Math.asin(elev))).normalize();
    const u = this.sky.material.uniforms; u.sunPosition.value.copy(sunDir); u.rayleigh.value = 1.6 + this.cloud * 2; u.turbidity.value = 6 + this.cloud * 8;
    const night = this.night(); const day = 1 - night;
    const sunUp = Math.max(0, elev);
    this.sun.intensity = (Math.min(1, sunUp * 3) * 3.2 * (1 - this.cloud * 0.6)) + night * 0.25;
    this.sun.color.setHSL(0.1, 0.6, 0.6 + Math.min(0.35, sunUp));
    const lightDir = elev > 0 ? sunDir : sunDir.clone().negate(); // moonlight at night
    this.sun.position.copy(this.pos).addScaledVector(lightDir, 200); this.sun.target.position.copy(this.pos);
    if (night > 0.5) this.sun.color.set('#8aa4d8');
    this.hemi.intensity = 0.25 + day * (0.9 - this.cloud * 0.3);
    this.renderer.toneMappingExposure = 0.35 + day * 0.3;
    const fogCol = new THREE.Color().setHSL(0.58, 0.25 * day, 0.08 + day * (0.62 - this.cloud * 0.15));
    const fog = this.scene.fog as THREE.Fog; fog.color.copy(fogCol); fog.far = this.preset.draw * (1 - this.fogK * 0.7) + 80; fog.near = 30 * (1 - this.fogK * 0.8);
    (this.stars.material as THREE.PointsMaterial).opacity = night * (1 - this.cloud);
    for (const n of this.world.nightMats) n.emissiveIntensity = night * 1.4;
    this.world.lampMat.emissiveIntensity = night * 3;
    // env map reflections (PMREM) refreshed periodically
    if (this.preset.q > 0 && Math.abs(this.time - this.lastEnvTime) > 0.75) {
      this.lastEnvTime = this.time; const sc = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(1000); Object.assign(sky2.material.uniforms.sunPosition.value, sunDir); sky2.material.uniforms.rayleigh.value = u.rayleigh.value; sky2.material.uniforms.turbidity.value = u.turbidity.value; sc.add(sky2);
      this.envRT?.dispose(); this.envRT = this.pmrem.fromScene(sc as any, 0, 0.1, 2000); this.scene.environment = this.envRT.texture; (this.scene as any).environmentIntensity = 0.15 + day * 0.6; sky2.geometry.dispose(); sky2.material.dispose();
    }
    // clouds
    for (const c of this.clouds) { c.position.x += dt * 4; if (c.position.x > 1200) c.position.x = -1200; (c.material as THREE.SpriteMaterial).opacity = (0.15 + this.cloud * 0.7) * (0.4 + day * 0.6); (c.material as THREE.SpriteMaterial).color.setScalar(0.3 + day * 0.7 - this.cloud * 0.25); }
    // rain particles follow camera
    this.rainPts.visible = this.rain > 0.05; if (this.rainPts.visible) { const a = this.rainPts.geometry.attributes.position as THREE.BufferAttribute; const arr = a.array as Float32Array; for (let i = 1; i < arr.length; i += 3) { arr[i] -= dt * 30; if (arr[i] < -10) arr[i] += 50; } a.needsUpdate = true; this.rainPts.position.copy(this.camera.position).setY(this.camera.position.y - 10); (this.rainPts.material as THREE.PointsMaterial).opacity = this.rain * 0.6; }
    // water animation
    const wm = this.world.water.material as THREE.MeshPhysicalMaterial; if (wm.normalMap) { wm.normalMap.offset.x += dt * 0.01; wm.normalMap.offset.y += dt * 0.005; }
    this.world.viewpointMeshes.forEach((m, i) => { m.visible = !this.profile.viewpoints.includes(i); m.rotation.y += dt; });
    audio.ambience(this.rain, 0.3 + (this.pos.y > 20 ? 0.6 : 0));
  }

  updateCamera(dt: number) {
    const tgt = this.current ? this.current.pos.clone().add(new THREE.Vector3(0, this.current.def.hgt * 0.8 + 0.6, 0)) : this.pos.clone().add(new THREE.Vector3(0, input.prone ? 0.65 : input.crouch ? 1.1 : 1.55, 0));
    if (this.current) { const dh = Math.atan2(Math.sin(this.current.heading - this.camYaw), Math.cos(this.current.heading - this.camYaw)); if (Math.abs(this.current.speed) > 2) this.camYaw += dh * Math.min(1, dt * 2.5); }
    const big = this.current ? this.current.def.len : 0;
    const dist = this.camMode === 2 ? 0.01 : (this.camMode === 0 ? (this.aim && !this.current ? 2.9 : 4.2) : 7.5) + big * 0.9;
    if (this.camMode === 2) { // first person / hood cam
      const f = fwd(this.current ? this.current.heading : this.camYaw);
      const p = tgt.clone().addScaledVector(f, this.current ? this.current.def.len * 0.1 : 0.25); this.camera.position.copy(p);
      this.camera.lookAt(p.clone().addScaledVector(f, 10).add(new THREE.Vector3(0, -this.camPitch * 4 + 0.6, 0))); this.player.group.visible = !!(this.current && this.current.def.type === 'bike') ? false : !this.current ? false : false; return;
    }
    if (!this.current) this.player.group.visible = true; else if (this.current.def.type === 'bike') this.player.group.visible = true;
    const off = new THREE.Vector3(-Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), -Math.cos(this.camYaw) * Math.cos(this.camPitch)).multiplyScalar(dist);
    const want = tgt.clone().add(off); const gy = groundAt(want.x, want.z) + 0.4; if (want.y < gy) want.y = gy;
    this.camPos.lerp(want, this.camPos.lengthSq() === 0 ? 1 : Math.min(1, dt * 10)); this.camera.position.copy(this.camPos);
    this.camera.lookAt(tgt);
    const fov = this.current ? 62 + Math.min(14, Math.abs(this.current.speed) * 0.25) : this.aim ? this.baseFov * 0.72 : this.baseFov;
    if (Math.abs(fov - this.camera.fov) > 0.01) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 6); this.camera.updateProjectionMatrix(); }
  }

  updateMission(dt: number) {
    const m = this.mission; const at = this.current ? this.current.pos : this.pos;
    // viewpoints
    VIEWPOINTS.forEach(([x, z], i) => { if (!this.profile.viewpoints.includes(i) && Math.hypot(at.x - x, at.z - z) < 4) { this.profile.viewpoints.push(i); this.profile.money += 250; addXp(this.profile, 150); this.cb.onToast(`Viewpoint discovered! +$250 (${this.profile.viewpoints.length}/${VIEWPOINTS.length})`); audio.reward(); } });
    if (this.waypoint && at.distanceTo(this.waypoint.clone().setY(at.y)) < 8) { this.waypoint = null; this.cb.onToast('Waypoint reached'); }
    if (!m) { this.marker.visible = !!this.waypoint; if (this.waypoint) { this.marker.position.set(this.waypoint.x, groundAt(this.waypoint.x, this.waypoint.z), this.waypoint.z); (this.marker.children[0] as THREE.Mesh<any, THREE.MeshBasicMaterial>).material.color.set('#3da5ff'); } return; }
    (this.marker.children[0] as THREE.Mesh<any, THREE.MeshBasicMaterial>).material.color.set('#ffd400');
    const [px, pz] = m.def.points[m.idx]; this.marker.visible = true; this.marker.position.set(px, groundAt(px, pz), pz); this.marker.children[1].rotation.z += dt * 2;
    if (m.timeLeft !== undefined) { m.timeLeft -= dt; if (m.timeLeft <= 0) { this.cb.onToast('Mission failed – out of time'); audio.blip(200, 0.4, 'sawtooth'); this.cancelMission(); return; } }
    if (Math.hypot(at.x - px, at.z - pz) < (this.current ? 7 : 4)) {
      m.idx++; audio.blip(990, 0.12, 'triangle');
      if (m.idx >= m.def.points.length) {
        const first = !this.profile.completed.includes(m.def.id); const reward = first ? m.def.reward : Math.round(m.def.reward * 0.5);
        this.profile.money += reward; addXp(this.profile, reward); if (first) this.profile.completed.push(m.def.id);
        audio.reward(); this.cb.onMissionDone(m.def.name, reward); this.cancelMission();
      } else this.cb.onToast(`Checkpoint ${m.idx}/${m.def.points.length}`);
    }
  }

  emitHud() {
    const v = this.current; const at = v ? v.pos : this.pos;
    this.zone = this.world.zoneAt(at.x, at.z);
    const swim = !v && inWater(this.pos.x, this.pos.z) && this.pos.y < -0.8;
    const mode: HudState['mode'] = v ? (v.def.type === 'bike' ? 'bike' : 'drive') : swim ? 'swim' : (Math.abs(this.pos.x) > HALF + 20 || Math.abs(this.pos.z) > HALF + 20) ? 'hike' : input.run && (Math.abs(input.mx) + Math.abs(input.my) > 0.05) ? 'run' : 'walk';
    let prompt = ''; if (!v) { const n = this.nearestVehicle(); if (n) prompt = n.damage >= 100 ? `${n.def.name} (wrecked)` : `Enter ${n.def.name}`; } else prompt = 'Exit vehicle';
    let mission: HudState['mission'] = null;
    if (this.mission) { const [px, pz] = this.mission.def.points[this.mission.idx]; mission = { name: this.mission.def.name, step: this.mission.idx + 1, total: this.mission.def.points.length, timeLeft: this.mission.timeLeft, dist: Math.round(Math.hypot(at.x - px, at.z - pz)) }; }
    this.cb.onHud({ mode, health: Math.max(0, this.health), stamina: this.stamina, speed: v ? Math.abs(v.speed) * 3.6 : 0, vehicleName: v?.def.name || '', damage: v?.damage || 0, lights: !!v?.lights, time: this.time, weather: this.weather, zone: this.zone, prompt, mission, fps: this.fps, crouch: input.crouch, camMode: this.camMode, money: this.profile.money, weapon: this.weapons.id, run: input.run });
  }

  drawMinimap() {
    const cv = this.minimap; if (!cv) return; const ctx = cv.getContext('2d')!; const W = cv.width;
    const at = this.current ? this.current.pos : this.pos; const scale = 1024 / WORLD; const R = 130; // world units radius
    ctx.save(); ctx.clearRect(0, 0, W, W); ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); ctx.clip();
    ctx.translate(W / 2, W / 2); ctx.rotate(this.camYaw + Math.PI); const k = W / (2 * R);
    ctx.scale(k, k); ctx.drawImage(this.world.mapCanvas, -(at.x + WORLD / 2) * 1, -(at.z + WORLD / 2) * 1, WORLD, WORLD);
    void scale;
    // vehicles & peds
    for (const v of this.vehicles) { if (!v.m.group.visible || v === this.current) continue; const dx = v.pos.x - at.x, dz = v.pos.z - at.z; if (dx * dx + dz * dz > R * R * 2) continue; ctx.fillStyle = v.def.type === 'police' ? '#3d7bff' : v.ai ? '#ddd' : '#9fe'; ctx.fillRect(dx - 2, dz - 2, 4, 4); }
    const tgt = this.mission ? this.mission.def.points[this.mission.idx] : this.waypoint ? [this.waypoint.x, this.waypoint.z] : null;
    VIEWPOINTS.forEach(([x, z], i) => { if (this.profile.viewpoints.includes(i)) return; ctx.fillStyle = '#29b6f6'; ctx.beginPath(); ctx.arc(x - at.x, z - at.z, 4, 0, 7); ctx.fill(); });
    if (tgt) { ctx.fillStyle = this.mission ? '#ffd400' : '#3da5ff'; ctx.beginPath(); ctx.arc(tgt[0] - at.x, tgt[1] - at.z, 7, 0, 7); ctx.fill(); }
    ctx.restore();
    // edge arrow to target
    if (tgt) { const dx = tgt[0] - at.x, dz = tgt[1] - at.z; const a = Math.atan2(dx, dz) - this.camYaw; const d = Math.hypot(dx, dz); if (d > R * 0.9) { ctx.save(); ctx.translate(W / 2 - Math.sin(a) * W * 0.42, W / 2 - Math.cos(a) * W * 0.42); ctx.fillStyle = this.mission ? '#ffd400' : '#3da5ff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill(); ctx.restore(); } }
    // player arrow
    const ph = (this.current ? this.current.heading : this.yaw) - this.camYaw;
    ctx.save(); ctx.translate(W / 2, W / 2); ctx.rotate(-ph); ctx.fillStyle = '#ffd400'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}
