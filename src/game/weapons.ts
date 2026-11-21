// Weapon catalogue + procedural 3D weapons attached to the character's right-hand bone.
// No combat: weapons are only equipped, carried, "used" for show (swing / muzzle flash / throw gesture).
import * as THREE from 'three';
import type { AnimChar } from './models';

export type WeaponId = 'fist' | 'knife' | 'pistol' | 'rifle' | 'sniper' | 'grenade' | 'mine' | 'bomb';
export type WeaponKind = 'melee' | 'gun' | 'throw';
export interface WeaponDef {
  id: WeaponId; name: string; kind: WeaponKind;
  mag?: number; reserve?: number; count?: number; // ammo display only
  ready: number;      // 0..1 how far the right arm is raised while just carrying it
  twoHand?: boolean;  // support hand also raised when aiming
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  fist: { id: 'fist', name: 'Fists', kind: 'melee', ready: 0 },
  knife: { id: 'knife', name: 'Knife', kind: 'melee', ready: 0 },
  pistol: { id: 'pistol', name: 'Pistol', kind: 'gun', mag: 12, reserve: 48, ready: 0.2 },
  rifle: { id: 'rifle', name: 'Assault Rifle', kind: 'gun', mag: 30, reserve: 120, ready: 0.45, twoHand: true },
  sniper: { id: 'sniper', name: 'Sniper Rifle', kind: 'gun', mag: 5, reserve: 20, ready: 0.5, twoHand: true },
  grenade: { id: 'grenade', name: 'Grenade', kind: 'throw', count: 5, ready: 0 },
  mine: { id: 'mine', name: 'Mine', kind: 'throw', count: 3, ready: 0 },
  bomb: { id: 'bomb', name: 'Bomb', kind: 'throw', count: 2, ready: 0 },
};

/** Weapon-wheel order, clockwise starting from the top slice (matches the reference screenshot). */
export const WHEEL_ORDER: WeaponId[] = ['rifle', 'pistol', 'sniper', 'grenade', 'mine', 'fist', 'knife', 'bomb'];
/** Keyboard 1..8 */
export const KEY_ORDER: WeaponId[] = ['fist', 'knife', 'pistol', 'rifle', 'sniper', 'grenade', 'bomb', 'mine'];

export const isWeaponId = (s: string | undefined): s is WeaponId => !!s && s in WEAPONS;
export function ammoLabel(id: WeaponId): string {
  const w = WEAPONS[id];
  if (w.kind === 'gun') return `${w.mag} / ${w.reserve}`;
  if (w.kind === 'throw') return String(w.count);
  return '';
}

// ---------------------------------------------------------------------------
// procedural meshes — grip at the origin, barrel/blade along +Z, "up" is +Y (units: metres)
function buildWeapon(id: WeaponId): THREE.Group | null {
  if (id === 'fist') return null;
  const mat = (c: string, metal = 0.6, rough = 0.45) => new THREE.MeshStandardMaterial({ color: c, metalness: metal, roughness: rough });
  const dark = mat('#1b1d21'), steel = mat('#555b65'), wood = mat('#6b4a2b', 0.1, 0.8), olive = mat('#3d4a2e', 0.2, 0.7), red = mat('#b3202a', 0.1, 0.6), blade = mat('#cfd4dc', 0.9, 0.22);
  const g = new THREE.Group();
  const add = (m: THREE.Mesh, x: number, y: number, z: number, rx = 0) => { m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
  const box = (m: THREE.Material, w: number, h: number, l: number, x: number, y: number, z: number, rx = 0) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m), x, y, z, rx);
  const tube = (m: THREE.Material, r: number, len: number, x: number, y: number, z: number) => add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m), x, y, z, Math.PI / 2);
  const ball = (m: THREE.Material, r: number, x: number, y: number, z: number) => add(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m), x, y, z);
  let muzzleZ = 0, muzzleY = 0;

  switch (id) {
    case 'pistol':
      box(dark, 0.032, 0.045, 0.17, 0, 0.04, 0.06); box(steel, 0.02, 0.02, 0.03, 0, 0.035, 0.16);
      box(dark, 0.03, 0.1, 0.045, 0, -0.03, -0.005, 0.18); muzzleZ = 0.19; muzzleY = 0.04; break;
    case 'rifle':
      box(dark, 0.05, 0.075, 0.42, 0, 0.03, 0.12); box(olive, 0.056, 0.06, 0.2, 0, 0.025, 0.43);
      tube(steel, 0.011, 0.22, 0, 0.03, 0.65); box(olive, 0.04, 0.09, 0.2, 0, 0.0, -0.2);
      box(dark, 0.035, 0.14, 0.06, 0, -0.085, 0.15, 0.2); box(dark, 0.03, 0.09, 0.04, 0, -0.06, 0.0, 0.15);
      box(steel, 0.018, 0.03, 0.03, 0, 0.085, 0.2); muzzleZ = 0.77; muzzleY = 0.03; break;
    case 'sniper':
      box(dark, 0.045, 0.07, 0.6, 0, 0.03, 0.2); tube(steel, 0.012, 0.5, 0, 0.03, 0.78);
      tube(dark, 0.022, 0.24, 0, 0.1, 0.2); box(steel, 0.02, 0.03, 0.02, 0, 0.07, 0.1); box(steel, 0.02, 0.03, 0.02, 0, 0.07, 0.3);
      box(wood, 0.04, 0.1, 0.28, 0, 0.0, -0.25); box(dark, 0.03, 0.09, 0.04, 0, -0.06, 0.0, 0.15); muzzleZ = 1.04; muzzleY = 0.03; break;
    case 'knife':
      box(dark, 0.026, 0.032, 0.11, 0, 0, 0); box(steel, 0.05, 0.016, 0.012, 0, 0, 0.062); box(blade, 0.011, 0.04, 0.18, 0, 0, 0.16); break;
    case 'grenade':
      ball(olive, 0.038, 0, 0.02, 0); add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.025, 10), steel), 0, 0.065, 0); box(steel, 0.008, 0.008, 0.05, 0.03, 0.06, 0.0); break;
    case 'bomb':
      ball(dark, 0.085, 0, 0.04, 0.04); add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8), wood), 0, 0.145, 0.04); ball(red, 0.014, 0, 0.18, 0.04); break;
    case 'mine':
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 20), steel), 0, 0.02, 0.06); add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.045, 12), red), 0, 0.03, 0.06); break;
  }
  if (muzzleZ) {
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.95 }));
    flash.position.set(0, muzzleY, muzzleZ + 0.03); flash.scale.set(1, 1, 1.8); flash.visible = false; g.add(flash); g.userData.flash = flash;
  }
  return g;
}

const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);

/** Owns the weapon meshes, parents them to the right-hand bone, raises the arms procedurally. */
export class WeaponHolder {
  readonly root = new THREE.Group();
  id: WeaponId = 'fist';
  private groups = new Map<WeaponId, THREE.Group>();
  private active: THREE.Group | null = null;
  private rArm: THREE.Object3D | null = null; private lArm: THREE.Object3D | null = null;
  private attached = false; private pose = 0; private kick = 0; private flashT = 0; private hideT = 0;
  private pw = new THREE.Quaternion(); private gw = new THREE.Quaternion(); private conj = new THREE.Quaternion(); private conjInv = new THREE.Quaternion(); private R = new THREE.Quaternion();

  constructor(private ch: AnimChar) {
    const bones = new Map<string, THREE.Object3D>();
    ch.group.traverse(o => { if (o.name) bones.set(o.name.replace(/^mixamorig\d*:?/, ''), o); });
    const hand = bones.get('RightHand');
    this.rArm = bones.get('RightArm') ?? null; this.lArm = bones.get('LeftArm') ?? null;
    for (const id of Object.keys(WEAPONS) as WeaponId[]) { const g = buildWeapon(id); if (g) { g.visible = false; this.root.add(g); this.groups.set(id, g); } }
    if (!hand) { console.warn('[weapons] RightHand bone not found — weapons disabled'); return; }
    try {

    // Calibrate against the relaxed Idle pose: the weapon is oriented as if the character stands
    // facing +Z with the hand hanging down (barrel forward, top up), regardless of the bone's own axes.
    const idle = ch.actions['Idle'];
    if (idle) { idle.reset().setEffectiveWeight(1).play(); ch.mixer.update(0); }
    ch.group.updateMatrixWorld(true);
    const rel = new THREE.Matrix4().copy(ch.group.matrixWorld).invert().multiply(hand.matrixWorld);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); rel.decompose(p, q, s);
    this.root.quaternion.copy(q).invert();
    this.root.scale.setScalar(1 / (s.x || 1)); // cancel the model's auto-scale so meshes stay in real metres
    const mid = bones.get('RightHandMiddle1'); if (mid) this.root.position.copy(mid.position).multiplyScalar(0.5); // palm centre
    idle?.stop();
    hand.add(this.root); this.attached = true;
    } catch (e) { console.warn('[weapons] setup failed — weapons disabled', e); }
  }

  equip(id: WeaponId) {
    this.id = id; this.kick = 0; this.flashT = 0; this.hideT = 0;
    this.active = this.groups.get(id) ?? null;
    this.groups.forEach((g, k) => { g.visible = k === id; g.position.set(0, 0, 0); });
  }

  /** Visual "use": muzzle flash + recoil for guns, hides the item briefly for throwables. */
  fire() {
    const w = WEAPONS[this.id];
    if (w.kind === 'gun') { this.kick = 1; this.flashT = 0.06; } else if (w.kind === 'throw') this.hideT = 0.8;
  }

  /** Call every frame AFTER the character's mixer.update(). */
  update(dt: number, aim: boolean, visible: boolean) {
    if (!this.attached) return;
    const w = WEAPONS[this.id];
    if (this.hideT > 0) this.hideT -= dt;
    this.root.visible = visible && this.hideT <= 0;
    const target = visible && w.kind === 'gun' ? (aim ? 1 : w.ready) : 0;
    this.pose += (target - this.pose) * Math.min(1, dt * 10);
    if (this.pose > 0.01) {
      const ang = -1.45 * this.pose; // ≈ -83° = arm straight forward
      this.rotate(this.rArm, AX, ang);
      if (w.twoHand) { this.rotate(this.lArm, AX, ang * 0.95); this.rotate(this.lArm, AY, -0.55 * this.pose); }
    }
    if (this.kick > 0) this.kick = Math.max(0, this.kick - dt * 8);
    const g = this.active;
    if (g) { g.position.z = -this.kick * 0.04; const f = g.userData.flash as THREE.Object3D | undefined; if (f) { this.flashT -= dt; f.visible = this.flashT > 0; } }
  }

  /** Rotates a bone by `angle` around an axis expressed in the character's (group) frame. */
  private rotate(b: THREE.Object3D | null, axis: THREE.Vector3, angle: number) {
    if (!b || !b.parent) return;
    b.parent.getWorldQuaternion(this.pw); this.ch.group.getWorldQuaternion(this.gw);
    this.conj.copy(this.pw).invert().multiply(this.gw);          // parentWorld⁻¹ · groupWorld
    this.conjInv.copy(this.conj).invert();
    this.R.setFromAxisAngle(axis, angle);
    this.conj.multiply(this.R).multiply(this.conjInv);           // = rotation expressed in the parent's local frame
    b.quaternion.premultiply(this.conj);
  }
}
