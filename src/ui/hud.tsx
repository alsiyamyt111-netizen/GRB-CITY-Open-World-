// In-game HUD: every element is a small render function placed by <HudLayer> from the saved layout.
// The same render functions are reused by the HUD editor (with editing=true and mock data).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { input, type Game, type HudState } from '../game/engine';
import type { Profile } from '../game/store';
import { WEAPONS, WHEEL_ORDER, ammoLabel, type WeaponId } from '../game/weapons';
import { WeaponGlyph, WeaponIcon } from './weaponIcons';
import { cx } from './common';
import { modeDefs, type HudDef, type HudLayout } from './hudLayout';
import { audio } from '../game/audio';

export type OverlayName = 'map' | 'pause' | 'settings' | 'shop';
export interface HudCtx {
  editing: boolean; hud: HudState; profile: Profile; g: Game | null; mini: RefObject<HTMLCanvasElement | null>;
  weapon: WeaponId; wheelOpen: boolean; setWheelOpen: (v: boolean) => void;
  run: boolean; crouch: boolean; prone: boolean; aim: boolean;
  toggleRun: () => void; toggleCrouch: () => void; toggleProne: () => void; toggleAim: () => void;
  openOverlay: (o: OverlayName) => void; useMedkit: () => void; useEnergy: () => void;
}

export const MOCK_HUD: HudState = { mode: 'walk', health: 82, stamina: 64, speed: 64, vehicleName: 'Civic Line', damage: 12, lights: false, time: 14.5, weather: 'clear', zone: 'Downtown', prompt: '', mission: { name: 'City Tour', step: 1, total: 3, dist: 240 }, fps: 60, crouch: false, camMode: 0, money: 24875, weapon: 'rifle' };

const noop = () => { };
export function mockCtx(profile: Profile, mini: RefObject<HTMLCanvasElement | null>): HudCtx {
  return { editing: true, hud: MOCK_HUD, profile, g: null, mini, weapon: 'rifle', wheelOpen: true, setWheelOpen: noop, run: false, crouch: false, prone: false, aim: false, toggleRun: noop, toggleCrouch: noop, toggleProne: noop, toggleAim: noop, openOverlay: noop, useMedkit: noop, useEnergy: noop };
}

// ---------- primitives ----------
export function Hold({ children, set, className = '', active }: { children: ReactNode; set: (v: boolean) => void; className?: string; active?: boolean }) {
  return <button className={cx('pointer-events-auto rounded-full grid place-items-center text-white font-bold select-none touch-none border-2 backdrop-blur-sm transition active:scale-90', active ? 'bg-[#ffd400]/80 border-[#ffd400] text-black' : 'bg-black/40 border-white/30', className)}
    onPointerDown={e => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); set(true); }} onPointerUp={() => set(false)} onPointerCancel={() => set(false)} onPointerLeave={() => set(false)}>{children}</button>;
}
export function Tap({ children, onTap, className = '', active }: { children: ReactNode; onTap: () => void; className?: string; active?: boolean }) {
  return <button className={cx('pointer-events-auto rounded-full grid place-items-center font-bold select-none touch-none border-2 backdrop-blur-sm active:scale-90 transition', active ? 'bg-[#ffd400]/80 border-[#ffd400] text-black' : 'bg-black/40 border-white/30 text-white', className)} onPointerDown={e => { e.stopPropagation(); onTap(); }}>{children}</button>;
}
/** Round button with a caption underneath (bottom action row, like the reference). */
function LabelBtn({ icon, label, onTap, active }: { icon: ReactNode; label: string; onTap: () => void; active?: boolean }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-start gap-0.5">
      <Tap onTap={onTap} active={active} className="w-14 h-14 text-2xl shadow-lg">{icon}</Tap>
      <span className="text-white text-[12px] font-bold drop-shadow-[0_1px_2px_#000] leading-none">{label}</span>
    </div>
  );
}

function Stick() {
  const ref = useRef<HTMLDivElement>(null); const pid = useRef<number | null>(null); const [k, setK] = useState({ x: 0, y: 0 });
  useEffect(() => () => { input.mx = input.my = 0; }, []);
  const upd = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect(); const R = r.width / 2 * 0.55; // travel radius in screen px (already includes the element's scale)
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    input.mx = dx / R; input.my = -dy / R; setK({ x: dx / R, y: dy / R });
  };
  const end = () => { pid.current = null; setK({ x: 0, y: 0 }); input.mx = input.my = 0; };
  return (
    <div ref={ref} className="pointer-events-auto w-full h-full rounded-full bg-black/35 border-2 border-white/25 backdrop-blur-sm touch-none relative"
      onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); pid.current = e.pointerId; upd(e); }}
      onPointerMove={e => { if (e.pointerId === pid.current) upd(e); }} onPointerUp={end} onPointerCancel={end}>
      <span className="absolute left-1/2 top-1.5 -translate-x-1/2 text-white/50 text-xs">▲</span><span className="absolute left-1/2 bottom-1.5 -translate-x-1/2 text-white/50 text-xs">▼</span>
      <span className="absolute top-1/2 left-2 -translate-y-1/2 text-white/50 text-xs">◀</span><span className="absolute top-1/2 right-2 -translate-y-1/2 text-white/50 text-xs">▶</span>
      <div className="absolute w-[84px] h-[84px] rounded-full bg-gradient-to-b from-white to-gray-300 shadow-lg pointer-events-none" style={{ left: 38 + k.x * 44, top: 38 + k.y * 44 }} />
    </div>
  );
}

// ---------- weapon wheel ----------
function WeaponWheel({ c }: { c: HudCtx }) {
  const S = 420, C = S / 2, R1 = 100, R2 = 208;
  const pt = (r: number, a: number) => [C + r * Math.sin(a * Math.PI / 180), C - r * Math.cos(a * Math.PI / 180)];
  const arc = (a0: number, a1: number) => { const [x0, y0] = pt(R2, a0), [x1, y1] = pt(R2, a1), [x2, y2] = pt(R1, a1), [x3, y3] = pt(R1, a0); return `M${x0} ${y0}A${R2} ${R2} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${R1} ${R1} 0 0 0 ${x3} ${y3}Z`; };
  const pick = (id: WeaponId) => { c.g?.equip(id); c.setWheelOpen(false); };
  const cur = WEAPONS[c.weapon];
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full h-full pointer-events-none drop-shadow-2xl">
      <circle cx={C} cy={C} r={R2 + 4} fill="#000" opacity=".4" />
      {WHEEL_ORDER.map((id, i) => {
        const sel = id === c.weapon; const [ix, iy] = pt(158, i * 45); const lbl = ammoLabel(id);
        return (
          <g key={id} className="pointer-events-auto cursor-pointer" onPointerDown={e => { e.stopPropagation(); pick(id); }} color={sel ? '#111' : '#fff'}>
            <path d={arc(i * 45 - 22.5 + 1, i * 45 + 22.5 - 1)} fill={sel ? '#f2b705' : '#1b1e24'} fillOpacity={sel ? 1 : 0.92} stroke={sel ? '#ffe27a' : '#666'} strokeWidth="2" />
            <g transform={`translate(${ix - 30} ${iy - 24}) scale(.6)`}><WeaponGlyph id={id} /></g>
            {lbl && <text x={ix} y={iy + 18} textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{lbl}</text>}
          </g>
        );
      })}
      <g className="pointer-events-auto cursor-pointer" onPointerDown={e => { e.stopPropagation(); c.setWheelOpen(false); }} color="#fff">
        <circle cx={C} cy={C} r={R1 - 6} fill="#15181d" stroke="#8a8f98" strokeWidth="3" />
        <g transform={`translate(${C - 50} ${C - 36}) scale(1)`}><WeaponGlyph id={c.weapon} /></g>
        <text x={C} y={C + 44} textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor">{ammoLabel(c.weapon) || cur.name}</text>
      </g>
    </svg>
  );
}

const Bullet = () => <svg viewBox="0 0 60 60" className="w-14 h-14 rotate-45"><path d="M30 4c8 6 12 16 12 28v14H18V32C18 20 22 10 30 4z" fill="#e8b820" stroke="#7a5a00" strokeWidth="2" /><rect x="18" y="46" width="24" height="8" fill="#b88a10" /></svg>;
const Crosshair = () => <svg viewBox="0 0 60 60" className="w-12 h-12" fill="none" stroke="white" strokeWidth="3"><circle cx="30" cy="30" r="14" /><circle cx="30" cy="30" r="3" fill="white" /><path d="M30 4v12M30 44v12M4 30h12M44 30h12" /></svg>;
const WEATHER: Record<string, string> = { clear: '☀️', cloudy: '☁️', rain: '🌧️', fog: '🌫️' };

// ---------- elements ----------
const ELEMENTS: Record<string, (c: HudCtx) => ReactNode> = {
  minimap: c => (
    <div className="pointer-events-auto w-full h-full rounded-full border-4 border-black/60 shadow-xl bg-black overflow-hidden cursor-pointer" onClick={() => c.openOverlay('map')}>
      {c.editing ? <div className="w-full h-full bg-[radial-gradient(circle,#3b7a45,#16341f)] grid place-items-center text-white/70 text-xs font-bold">MINIMAP</div> : <canvas ref={c.mini} width={150} height={150} className="w-full h-full" />}
    </div>),
  pause: c => <Tap onTap={() => c.openOverlay('pause')} className="w-full h-full text-xl">⏸</Tap>,
  bars: c => (
    <div className="w-full h-full flex flex-col justify-center gap-1.5 pointer-events-none">
      {([['❤', c.hud.health, '#e53935'], ['⚡', c.hud.stamina, '#43c443']] as const).map(([ic, v, col]) => (
        <div key={ic} className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-black/60 border border-white/30 grid place-items-center text-[10px] text-white">{ic}</span>
          <div className="flex-1 h-3.5 rounded bg-black/55 border border-white/25 overflow-hidden"><div className="h-full transition-all" style={{ width: v + '%', background: col }} /></div></div>))}
    </div>),
  zone: c => {
    const h = c.hud; const hh = Math.floor(h.time), mm = Math.floor((h.time % 1) * 60);
    return (
      <div className="w-full h-full text-center pointer-events-none">
        <div className="bg-[#0b3d91]/80 border border-white/20 rounded-lg px-4 py-1 text-white font-black text-lg shadow truncate">{h.zone}</div>
        <div className="text-white/85 text-xs mt-1 drop-shadow whitespace-nowrap">{String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')} • {WEATHER[h.weather] ?? ''} {h.weather} • {h.mode.toUpperCase()}{c.profile.settings.showFps && ` • ${h.fps} FPS`}</div>
      </div>);
  },
  money: c => (
    <div className="w-full h-full flex items-center justify-end gap-2 pointer-events-none">
      <div className="flex items-center gap-1.5 bg-black/55 rounded-full pl-1 pr-3 py-1 text-[#7dff7d] font-black text-base"><span className="w-6 h-6 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 grid place-items-center text-black text-xs font-black">$</span>{c.hud.money.toLocaleString()}</div>
      <div className="flex items-center gap-1 bg-black/55 rounded-full px-2.5 py-1 text-white font-bold text-sm">💎 {c.profile.gems}</div>
    </div>),
  mission: c => {
    const m = c.hud.mission; if (!m) return null;
    return (
      <div className="w-full h-full bg-[#0b0f17]/75 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 text-white text-sm">
        <div className="text-[#ffd400] font-bold truncate">{m.name}</div>
        <div className="text-xs text-white/70">Checkpoint {m.step}/{m.total} • {m.dist} m</div>
        {m.timeLeft !== undefined && <div className={cx('font-black text-lg leading-tight', m.timeLeft < 15 ? 'text-red-400' : 'text-white')}>⏱ {Math.ceil(m.timeLeft)}s</div>}
        <button className="pointer-events-auto text-xs text-white/50 underline" onClick={() => c.g?.cancelMission()}>Abandon</button>
      </div>);
  },
  mapBtn: c => <Tap onTap={() => c.openOverlay('map')} className="w-full h-full text-xl">🗺️</Tap>,
  shop: c => <Tap onTap={() => c.openOverlay('shop')} className="w-full h-full text-xl">🛒</Tap>,
  camera: c => <LabelBtn icon="📷" label="Camera" onTap={() => c.g?.cycleCamera()} />,
  // --- on foot ---
  weapon: c => {
    const w = WEAPONS[c.weapon]; const lbl = ammoLabel(c.weapon);
    return (
      <div className="pointer-events-auto relative w-full h-full rounded-xl bg-[#0b0f17]/70 border border-white/15 backdrop-blur-md flex flex-col items-center justify-center text-white select-none touch-none" onPointerDown={e => { e.stopPropagation(); audio.click(); c.setWheelOpen(!c.wheelOpen); }}>
        <WeaponIcon id={c.weapon} className="w-[120px] h-[50px]" />
        <div className="font-black text-lg leading-none mt-0.5">{lbl || w.name}</div>
        <button className="absolute top-1 right-1 w-8 h-8 rounded-full bg-black/50 grid place-items-center text-base touch-none" onPointerDown={e => { e.stopPropagation(); c.openOverlay('settings'); }}>⚙</button>
      </div>);
  },
  wheel: c => (c.wheelOpen || c.editing) ? <WeaponWheel c={c} /> : null,
  joystick: () => <Stick />,
  fire: c => {
    const k = WEAPONS[c.weapon].kind;
    return <Tap onTap={() => c.g?.action()} className="w-full h-full !border-4 shadow-xl text-5xl">{k === 'gun' ? <Bullet /> : k === 'throw' ? '💥' : c.weapon === 'knife' ? '🗡️' : '👊'}</Tap>;
  },
  aim: c => <Tap onTap={c.toggleAim} active={c.aim} className="w-full h-full"><Crosshair /></Tap>,
  grenade: c => <Tap onTap={() => c.g?.quickThrow()} className="w-full h-full"><WeaponIcon id="grenade" className="w-8 h-4 !text-white" /></Tap>,
  jump: () => <Tap onTap={() => { input.jump = true; }} className="w-full h-full text-4xl">🤸</Tap>,
  vehicle: c => <LabelBtn icon="🚗" label="Vehicle" onTap={() => c.g?.interact()} />,
  run: c => <LabelBtn icon="🏃" label="Run" onTap={c.toggleRun} active={c.run} />,
  crouch: c => <LabelBtn icon="🧎" label="Crouch" onTap={c.toggleCrouch} active={c.crouch} />,
  lie: c => <LabelBtn icon="🛌" label="Lie Down" onTap={c.toggleProne} active={c.prone} />,
  medkit: c => <Tap onTap={c.useMedkit} className="w-full h-full text-xl relative">🩹<span className="absolute -top-1 -right-1 text-[10px] bg-red-600 rounded-full px-1">{c.profile.medkits}</span></Tap>,
  energy: c => <Tap onTap={c.useEnergy} className="w-full h-full text-xl relative">🥤<span className="absolute -top-1 -right-1 text-[10px] bg-blue-600 rounded-full px-1">{c.profile.energy}</span></Tap>,
  // --- driving ---
  steer: () => (
    <div className="w-full h-full flex items-center justify-between">
      <Hold set={v => { input.steer = v ? -1 : (input.steer === -1 ? 0 : input.steer); }} className="w-20 h-20 text-3xl">◀</Hold>
      <Hold set={v => { input.steer = v ? 1 : (input.steer === 1 ? 0 : input.steer); }} className="w-20 h-20 text-3xl">▶</Hold>
    </div>),
  pedals: () => (
    <div className="w-full h-full flex items-end justify-end gap-3">
      <Hold set={v => { input.brake = v; }} className="w-16 h-20 !rounded-xl text-sm">BRAKE</Hold>
      <Hold set={v => { input.gas = v; }} className="w-16 h-28 !rounded-xl text-sm !bg-[#ffd400]/30">GAS</Hold>
    </div>),
  driveTools: c => (
    <div className="w-full h-full flex flex-col items-center justify-between">
      <Tap onTap={() => c.g?.toggleLights()} active={c.hud.lights} className="w-12 h-12 text-xl">💡</Tap>
      <Tap onTap={() => c.g?.horn()} className="w-12 h-12 text-xl">📯</Tap>
      <Hold set={v => { input.handbrake = v; }} className="w-12 h-12 text-xs">HB</Hold>
      <Tap onTap={() => c.g?.interact()} className="w-12 h-12 text-xl">🚪</Tap>
    </div>),
  speedo: c => (
    <div className="w-full h-full rounded-full border-4 border-white/20 grid place-items-center text-center pointer-events-none" style={{ background: `conic-gradient(#ffd400 ${Math.min(1, c.hud.speed / 260) * 270}deg, rgba(0,0,0,.6) 0deg)` }}>
      <div className="w-[88px] h-[88px] rounded-full bg-[#0b0f17] grid place-items-center"><div><div className="text-white text-3xl font-black leading-none">{Math.round(c.hud.speed)}</div><div className="text-white/60 text-[10px]">KM/H</div></div></div>
    </div>),
  vehicleInfo: c => (
    <div className="w-full h-full bg-[#0b0f17]/75 border border-white/10 rounded-xl px-3 py-1 text-white text-xs text-center pointer-events-none"><b>{c.hud.vehicleName}</b><div className="w-full h-1.5 bg-white/10 rounded mt-1"><div className="h-full rounded" style={{ width: 100 - c.hud.damage + '%', background: c.hud.damage > 60 ? '#ff5a5a' : '#4caf50' }} /></div></div>),
};

export const renderHudElement = (id: string, c: HudCtx) => ELEMENTS[id]?.(c) ?? null;
export const slotStyle = (d: HudDef, it: { x: number; y: number; s: number }): CSSProperties => ({ left: `${it.x * 100}%`, top: `${it.y * 100}%`, width: d.w, height: d.h, transform: `translate(-50%,-50%) scale(${it.s})` });

/** Draws all visible elements for the current mode at their saved positions. */
export function HudLayer({ layout, mode, ctx }: { layout: HudLayout; mode: 'foot' | 'drive'; ctx: HudCtx }) {
  return <>{modeDefs(mode).map(d => {
    const it = layout[d.id]; if (it.hidden) return null;
    return <div key={d.id} className={cx('absolute pointer-events-none', d.id === 'wheel' ? 'z-30' : 'z-20')} style={slotStyle(d, it)}>{renderHudElement(d.id, ctx)}</div>;
  })}</>;
}
