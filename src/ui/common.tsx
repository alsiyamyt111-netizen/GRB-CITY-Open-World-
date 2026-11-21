import { useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { makeHuman, animateHuman, makeVehicle, loadCharacter, setCharState, type Look } from '../game/models';
import type { VehicleDef } from '../game/data';
import { audio } from '../game/audio';
import type { Profile } from '../game/store';

export const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');

export function Btn({ children, onClick, variant = 'dark', className = '', disabled }: { children: ReactNode; onClick?: () => void; variant?: 'yellow' | 'dark' | 'blue' | 'red'; className?: string; disabled?: boolean }) {
  const v = { yellow: 'bg-gradient-to-b from-[#ffe14d] to-[#f5b800] text-black shadow-[0_4px_20px_rgba(255,200,0,.35)]', dark: 'bg-black/55 text-white border border-white/10 hover:bg-black/70', blue: 'bg-gradient-to-b from-[#3da5ff] to-[#1565d8] text-white', red: 'bg-gradient-to-b from-[#ff5a5a] to-[#c81e1e] text-white' }[variant];
  return <button disabled={disabled} onClick={() => { audio.init(); audio.click(); onClick?.(); }} className={cx('rounded-lg px-4 py-2.5 font-bold tracking-wide transition active:scale-95 disabled:opacity-40 backdrop-blur-md select-none', v, className)}>{children}</button>;
}

export function TopBar({ profile, onBack, title, onShop, right }: { profile: Profile; onBack?: () => void; title?: string; onShop?: () => void; right?: ReactNode }) {
  return (
    <div className="absolute top-0 inset-x-0 flex items-center gap-3 p-3 z-20">
      {onBack && <button onClick={() => { audio.click(); onBack(); }} className="w-10 h-10 rounded-lg bg-black/55 border border-white/10 text-white text-xl active:scale-90">←</button>}
      {title && <h2 className="text-white text-xl md:text-2xl font-black tracking-wide drop-shadow">{title}</h2>}
      <div className="flex-1" />
      <Currency profile={profile} onShop={onShop} />
      {right}
    </div>
  );
}
export function Currency({ profile, onShop }: { profile: Profile; onShop?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 bg-black/55 border border-white/10 rounded-full pl-1 pr-3 py-1 text-white font-bold text-sm"><span className="w-6 h-6 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 grid place-items-center text-black text-xs font-black">$</span>{profile.money.toLocaleString()}</div>
      <div className="flex items-center gap-1.5 bg-black/55 border border-white/10 rounded-full pl-1 pr-3 py-1 text-white font-bold text-sm"><span className="text-base">💎</span>{profile.gems}</div>
      {onShop && <button onClick={() => { audio.click(); onShop(); }} className="w-7 h-7 rounded-md bg-yellow-400 text-black font-black active:scale-90">+</button>}
    </div>
  );
}
export const Panel = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={cx('bg-[#0b0f17]/75 backdrop-blur-md border border-white/10 rounded-xl', className)}>{children}</div>;

/** Lightweight Three.js preview with drag-to-rotate (characters / vehicles).
 *  charFile (a .glb path) shows the real rigged 3D model with an idle animation;
 *  look (procedural colors) is used only as a fallback when no charFile is given. */
export function Preview3D({ look, charFile, vehicle, color, className = '', bg = true }: { look?: Look; charFile?: string; vehicle?: VehicleDef; color?: string; className?: string; bg?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!; const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true;
    el.appendChild(r.domElement);
    const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#cfe3ff', '#3a3020', 1.4)); const key = new THREE.DirectionalLight('#fff4e0', 3); key.position.set(3, 6, 4); key.castShadow = true; scene.add(key);
    const rim = new THREE.DirectionalLight('#5fa8ff', 2); rim.position.set(-4, 3, -4); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshStandardMaterial({ color: '#1a1f2a', roughness: 0.4, metalness: 0.4 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; if (bg) scene.add(floor);
    const root = new THREE.Group(); scene.add(root);
    let human: ReturnType<typeof makeHuman> | null = null;
    let anim: Awaited<ReturnType<typeof loadCharacter>> | null = null; let cancelled = false;
    if (charFile) {
      cam.position.set(0, 1.2, 4.3); cam.lookAt(0, 0.9, 0);
      loadCharacter(charFile, { Idle: import.meta.env.BASE_URL + 'models/anims/Idle.fbx' }, 1.78).then(ch => {
        if (cancelled) return; anim = ch; root.add(ch.group); setCharState(ch, 'Idle', 0);
      }).catch(e => console.warn('[Preview3D] character load failed', e));
    } else if (look) { human = makeHuman(look); root.add(human.group); cam.position.set(0, 1.3, 4.6); cam.lookAt(0, 0.95, 0); }
    if (vehicle) { const v = makeVehicle(vehicle, color); root.add(v.group); const s = Math.max(vehicle.len, 3); cam.position.set(s * 0.9, s * 0.45, s * 1.1); cam.lookAt(0, vehicle.hgt * 0.4, 0); floor.scale.setScalar(s / 3); root.rotation.y = 0.6; }
    let drag = false, lx = 0, raf = 0, auto = true; const t0 = performance.now();
    const down = (e: PointerEvent) => { drag = true; auto = false; lx = e.clientX; }; const move = (e: PointerEvent) => { if (drag) { root.rotation.y += (e.clientX - lx) * 0.01; lx = e.clientX; } }; const up = () => { drag = false; };
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    const size = () => { const w = el.clientWidth, h = el.clientHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); }; size();
    const ro = new ResizeObserver(size); ro.observe(el); let last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop); const now = performance.now(), dt = (now - last) / 1000; last = now;
      if (auto && vehicle) root.rotation.y += dt * 0.3;
      if (human) animateHuman(human, dt, 'idle', 0);
      if (anim) anim.mixer.update(dt);
      if ((human || anim) && auto) root.rotation.y = Math.sin((now - t0) / 2500) * 0.4;
      r.render(scene, cam);
    };
    loop();
    return () => { cancelled = true; cancelAnimationFrame(raf); ro.disconnect(); el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose(); }); r.dispose(); r.domElement.remove(); };
  }, [JSON.stringify(look), charFile, vehicle?.id, color]);
  return <div ref={ref} className={cx('touch-none cursor-grab', className)} />;
}
