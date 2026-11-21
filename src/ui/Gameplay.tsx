import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Game, input, type HudState } from '../game/engine';
import { audio } from '../game/audio';
import { Btn, Panel, cx } from './common';
import { MapScreen, SettingsScreen, Shop, Confirm, Logo, type SP } from './screens';
import keyart from '../assets/keyart.jpg';

function Joystick() {
  const [base, setBase] = useState<{ x: number; y: number } | null>(null); const [knob, setKnob] = useState({ x: 0, y: 0 }); const id = useRef<number | null>(null);
  const R = 55;
  const move = (e: React.PointerEvent, b = base) => { if (!b) return; let dx = e.clientX - b.x, dy = e.clientY - b.y; const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; } setKnob({ x: dx, y: dy }); input.mx = dx / R; input.my = -dy / R; };
  return (
    <div className="absolute left-0 bottom-0 w-[40%] h-[60%] z-10 touch-none"
      onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); id.current = e.pointerId; const b = { x: e.clientX, y: e.clientY }; setBase(b); move(e, b); }}
      onPointerMove={e => { if (e.pointerId === id.current) move(e); }}
      onPointerUp={() => { id.current = null; setBase(null); setKnob({ x: 0, y: 0 }); input.mx = input.my = 0; }} onPointerCancel={() => { id.current = null; setBase(null); input.mx = input.my = 0; }}>
      {(() => { const b = base || { x: 110, y: window.innerHeight - 110 }; return (
        <div className={cx('fixed w-[120px] h-[120px] rounded-full border-2 border-white/30 bg-black/25 backdrop-blur-sm pointer-events-none', !base && 'opacity-60')} style={{ left: b.x - 60, top: b.y - 60 }}>
          <div className="absolute w-12 h-12 rounded-full bg-gradient-to-b from-white to-gray-300 shadow-lg" style={{ left: 36 + knob.x, top: 36 + knob.y }} />
        </div>); })()}
    </div>
  );
}
function Hold({ children, set, className = '', active }: { children: ReactNode; set: (v: boolean) => void; className?: string; active?: boolean }) {
  return <button className={cx('rounded-full grid place-items-center text-white font-bold select-none touch-none border-2 backdrop-blur-sm transition active:scale-90', active ? 'bg-[#ffd400]/80 border-[#ffd400] text-black' : 'bg-black/40 border-white/30', className)}
    onPointerDown={e => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); set(true); }} onPointerUp={() => set(false)} onPointerCancel={() => set(false)} onPointerLeave={() => set(false)}>{children}</button>;
}
function Tap({ children, onTap, className = '', active }: { children: ReactNode; onTap: () => void; className?: string; active?: boolean }) {
  return <button className={cx('rounded-full grid place-items-center font-bold select-none touch-none border-2 backdrop-blur-sm active:scale-90 transition', active ? 'bg-[#ffd400]/80 border-[#ffd400] text-black' : 'bg-black/40 border-white/30 text-white', className)} onPointerDown={e => { e.stopPropagation(); onTap(); }}>{children}</button>;
}

export function Gameplay(props: SP & { missionId: string | null; clearMission: () => void }) {
  const { profile, update, go, toast } = props;
  const mount = useRef<HTMLDivElement>(null); const mini = useRef<HTMLCanvasElement>(null); const gameRef = useRef<Game | null>(null);
  const [load, setLoad] = useState({ p: 0, msg: 'Preparing…' }); const [ready, setReady] = useState(false);
  const [hud, setHud] = useState<HudState | null>(null); const [overlay, setOverlay] = useState<null | 'pause' | 'map' | 'settings' | 'shop' | 'exit'>(null);
  const [done, setDone] = useState<{ name: string; reward: number } | null>(null); const [toasts, setToasts] = useState<{ id: number; t: string }[]>([]);
  const [crouch, setCrouch] = useState(false); const [run, setRun] = useState(false);
  const pushToast = (t: string) => { const id = Math.random(); setToasts(x => [...x.slice(-2), { id, t }]); setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), 2600); };

  useEffect(() => {
    audio.init(); Object.assign(input, { mx: 0, my: 0, run: false, crouch: false, jump: false, steer: 0, gas: false, brake: false, handbrake: false });
    const g = new Game(mount.current!, profile, { onHud: setHud, onToast: pushToast, onMissionDone: (name, reward) => { setDone({ name, reward }); update(() => { }); }, onDeath: () => { pushToast('WASTED – respawned at hospital (-$200)'); update(p => { p.money = Math.max(0, p.money - 200); }); }, onSave: () => update(() => { }) });
    gameRef.current = g; let alive = true;
    g.init((p, msg) => alive && setLoad({ p, msg })).then(() => { if (!alive) return; g.minimap = mini.current; if (props.missionId) { g.startMission(props.missionId); props.clearMission(); } g.start(); setReady(true); });
    const key = (e: KeyboardEvent, d: boolean) => {
      const k = e.key.toLowerCase(); const drive = !!g.current;
      if (k === 'w' || k === 'arrowup') { input.my = d ? 1 : 0; } if (k === 's' || k === 'arrowdown') { input.my = d ? -1 : 0; }
      if (k === 'a' || k === 'arrowleft') { input.mx = d ? -1 : 0; } if (k === 'd' || k === 'arrowright') { input.mx = d ? 1 : 0; }
      if (k === 'shift') input.run = d; if (k === ' ') { if (drive) input.handbrake = d; else if (d) input.jump = true; }
      if (!d) return;
      if (k === 'c') { input.crouch = !input.crouch; setCrouch(input.crouch); } if (k === 'e' || k === 'f') g.interact(); if (k === 'l') g.toggleLights(); if (k === 'h') g.horn(); if (k === 'v') g.cycleCamera(); if (k === 'q') g.action();
      if (k === 'm') { g.setPaused(true); setOverlay('map'); } if (k === 'escape' || k === 'p') { g.setPaused(true); setOverlay('pause'); }
    };
    const kd = (e: KeyboardEvent) => key(e, true), ku = (e: KeyboardEvent) => key(e, false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { alive = false; g.snapshot(); update(() => { }); g.dispose(); gameRef.current = null; window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const g = gameRef.current;
  const openOverlay = (o: typeof overlay) => { g?.setPaused(true); setOverlay(o); };
  const resume = () => { setOverlay(null); if (g) { g.applySettings(profile.settings); g.setPaused(false); } };
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const driving = hud?.mode === 'drive' || hud?.mode === 'bike';
  const hh = hud ? Math.floor(hud.time) : 0, mm = hud ? Math.floor((hud.time % 1) * 60) : 0;
  const sub: SP = { ...props, back: () => setOverlay('pause') };

  return (
    <div className="absolute inset-0 bg-black overflow-hidden select-none">
      <div ref={mount} className="absolute inset-0" />
      {/* camera look layer */}
      <div className="absolute inset-0 touch-none" onPointerDown={e => { look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; }} onPointerMove={e => { const l = look.current; if (l && l.id === e.pointerId) { input.lookDx += e.clientX - l.x; input.lookDy += e.clientY - l.y; l.x = e.clientX; l.y = e.clientY; } }} onPointerUp={() => { look.current = null; }} onPointerCancel={() => { look.current = null; }} />

      {ready && hud && !overlay && (<>
        {/* top-left minimap */}
        <div className="absolute top-3 left-3 z-20 flex flex-col items-center gap-1">
          <canvas ref={mini} width={150} height={150} onClick={() => openOverlay('map')} className="w-[110px] h-[110px] md:w-[150px] md:h-[150px] rounded-full border-4 border-black/60 shadow-xl bg-black cursor-pointer" />
          <div className="w-[110px] md:w-[150px] space-y-1">
            <div className="h-1.5 bg-black/50 rounded"><div className="h-full rounded bg-[#4caf50] transition-all" style={{ width: hud.health + '%' }} /></div>
            <div className="h-1.5 bg-black/50 rounded"><div className="h-full rounded bg-[#ffd400] transition-all" style={{ width: hud.stamina + '%' }} /></div>
          </div>
        </div>
        {minimapRebind(mini, g)}
        {/* top center: zone & time */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none">
          <div className="bg-[#0b3d91]/80 border border-white/20 rounded-lg px-4 py-1 text-white font-black text-sm md:text-lg shadow">{hud.zone}</div>
          <div className="text-white/80 text-xs mt-1 drop-shadow">{String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')} • {({ clear: '☀️', cloudy: '☁️', rain: '🌧️', fog: '🌫️' } as any)[hud.weather]} {hud.weather} • {hud.mode.toUpperCase()}{profile.settings.showFps && ` • ${hud.fps} FPS`}</div>
        </div>
        {/* top right */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/55 rounded-full pl-1 pr-3 py-1 text-white font-bold text-sm"><span className="w-6 h-6 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-600 grid place-items-center text-black text-xs font-black">$</span>{hud.money.toLocaleString()}</div>
          <div className="hidden sm:flex items-center gap-1 bg-black/55 rounded-full px-3 py-1 text-white font-bold text-sm">💎 {profile.gems}</div>
          <Tap onTap={() => g?.cycleCamera()} className="w-10 h-10 !rounded-lg text-lg">🎥</Tap>
          <Tap onTap={() => openOverlay('map')} className="w-10 h-10 !rounded-lg text-lg">🗺️</Tap>
          <Tap onTap={() => openOverlay('pause')} className="w-10 h-10 !rounded-lg text-lg">⏸</Tap>
        </div>
        {/* mission tracker */}
        {hud.mission && <Panel className="absolute top-20 right-3 z-20 px-3 py-2 text-white text-sm w-52"><div className="text-[#ffd400] font-bold">{hud.mission.name}</div><div className="text-xs text-white/70">Checkpoint {hud.mission.step}/{hud.mission.total} • {hud.mission.dist} m</div>{hud.mission.timeLeft !== undefined && <div className={cx('font-black text-lg', hud.mission.timeLeft < 15 ? 'text-red-400' : 'text-white')}>⏱ {Math.ceil(hud.mission.timeLeft)}s</div>}<button className="text-xs text-white/50 underline" onClick={() => g?.cancelMission()}>Abandon</button></Panel>}
        {/* toasts */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none">{toasts.map(t => <div key={t.id} className="bg-black/75 text-white text-sm px-4 py-1.5 rounded-full border border-[#ffd400]/40 animate-[fadeUp_.3s]">{t.t}</div>)}</div>
        {/* interact prompt */}
        {hud.prompt && <button onPointerDown={e => { e.stopPropagation(); g?.interact(); }} className="absolute bottom-[42%] left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white px-4 py-2 rounded-full border border-[#3da5ff] text-sm font-bold">🚪 {hud.prompt}</button>}

        {!driving ? (<>
          <Joystick />
          <div className="absolute right-4 bottom-4 z-20 w-[200px] h-[200px]">
            <Hold set={v => { input.run = v; setRun(v); }} active={run} className="absolute right-0 bottom-16 w-[72px] h-[72px] text-2xl">🏃</Hold>
            <Tap onTap={() => { input.jump = true; }} className="absolute right-[84px] bottom-0 w-16 h-16 text-2xl">⤒</Tap>
            <Tap onTap={() => g?.action()} className="absolute right-[90px] bottom-[84px] w-14 h-14 text-2xl">👊</Tap>
            <Tap onTap={() => { input.crouch = !input.crouch; setCrouch(input.crouch); }} active={crouch} className="absolute right-[2px] bottom-[150px] w-12 h-12 text-xl">🧎</Tap>
            <Tap onTap={() => g?.interact()} className="absolute right-0 bottom-0 w-14 h-14 text-xl">🚗</Tap>
          </div>
          <div className="absolute left-3 bottom-[46%] sm:bottom-auto sm:top-[42%] z-20 flex flex-col gap-2">
            <Tap onTap={() => { g?.useMedkit(); update(() => { }); }} className="w-11 h-11 text-lg relative">🩹<span className="absolute -top-1 -right-1 text-[10px] bg-red-600 rounded-full px-1">{profile.medkits}</span></Tap>
            <Tap onTap={() => { g?.useEnergy(); update(() => { }); }} className="w-11 h-11 text-lg relative">🥤<span className="absolute -top-1 -right-1 text-[10px] bg-blue-600 rounded-full px-1">{profile.energy}</span></Tap>
          </div>
        </>) : (<>
          <div className="absolute left-4 bottom-5 z-20 flex gap-3">
            <Hold set={v => { input.steer = v ? -1 : (input.steer === -1 ? 0 : input.steer); }} className="w-20 h-20 text-3xl">◀</Hold>
            <Hold set={v => { input.steer = v ? 1 : (input.steer === 1 ? 0 : input.steer); }} className="w-20 h-20 text-3xl">▶</Hold>
          </div>
          <div className="absolute right-4 bottom-5 z-20 flex items-end gap-3">
            <div className="flex flex-col gap-2">
              <Tap onTap={() => g?.toggleLights()} active={hud.lights} className="w-12 h-12 text-xl">💡</Tap>
              <Tap onTap={() => g?.horn()} className="w-12 h-12 text-xl">📯</Tap>
              <Hold set={v => { input.handbrake = v; }} className="w-12 h-12 text-xs">HB</Hold>
            </div>
            <Hold set={v => { input.brake = v; }} className="w-16 h-20 !rounded-xl text-sm">BRAKE</Hold>
            <Hold set={v => { input.gas = v; }} className="w-16 h-28 !rounded-xl text-sm !bg-[#ffd400]/30">GAS</Hold>
            <Tap onTap={() => g?.interact()} className="absolute -top-16 right-0 w-12 h-12 text-xl">🚪</Tap>
          </div>
          {/* speedometer */}
          <div className="absolute right-4 top-20 z-20 w-28 h-28 rounded-full bg-black/60 border-4 border-white/20 grid place-items-center text-center pointer-events-none" style={{ background: `conic-gradient(#ffd400 ${Math.min(1, hud.speed / 260) * 270}deg, rgba(0,0,0,.6) 0deg)` }}>
            <div className="w-[88px] h-[88px] rounded-full bg-[#0b0f17] grid place-items-center"><div><div className="text-white text-3xl font-black leading-none">{Math.round(hud.speed)}</div><div className="text-white/60 text-[10px]">KM/H</div></div></div>
          </div>
          <Panel className="absolute left-1/2 -translate-x-1/2 bottom-4 z-20 px-3 py-1 text-white text-xs text-center pointer-events-none"><b>{hud.vehicleName}</b><div className="w-28 h-1.5 bg-white/10 rounded mt-1"><div className="h-full rounded" style={{ width: 100 - hud.damage + '%', background: hud.damage > 60 ? '#ff5a5a' : '#4caf50' }} /></div></Panel>
        </>)}
      </>)}

      {/* LOADING world */}
      {!ready && (
        <div className="absolute inset-0 z-50"><img src={keyart} className="absolute inset-0 w-full h-full object-cover" alt="" /><div className="absolute inset-0 bg-black/50" />
          <div className="absolute left-6 top-6"><Logo /></div>
          <div className="absolute bottom-8 inset-x-6 md:inset-x-24"><p className="text-white/80 text-sm mb-2">{load.msg}</p><div className="h-3 bg-black/60 rounded-full overflow-hidden border border-white/10"><div className="h-full bg-gradient-to-r from-[#3da5ff] to-[#ffd400] transition-all" style={{ width: load.p * 100 + '%' }} /></div><p className="text-white font-bold mt-2 text-center">Building city… {Math.floor(load.p * 100)}%</p></div>
        </div>)}

      {/* PAUSE */}
      {overlay === 'pause' && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm grid place-items-center">
          <Panel className="w-72 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-2"><span className="w-8 h-8 rounded bg-red-600 grid place-items-center text-white">⏸</span><h2 className="text-white text-2xl font-black">Game Paused</h2></div>
            <Btn variant="yellow" onClick={resume}>▶ Resume</Btn>
            <Btn onClick={() => setOverlay('map')}>📍 Map</Btn>
            <Btn onClick={() => setOverlay('settings')}>⚙ Settings</Btn>
            <Btn onClick={() => setOverlay('shop')}>🛒 Shop</Btn>
            <Btn onClick={() => { g?.snapshot(); update(() => { }); toast('Game saved'); }}>💾 Save Game</Btn>
            <Btn onClick={() => { g?.snapshot(); update(() => { }); go('lobby'); }}>🏠 Main Menu</Btn>
            <Btn variant="red" onClick={() => setOverlay('exit')}>⎋ Exit Game</Btn>
          </Panel>
        </div>)}
      {overlay === 'exit' && <Confirm text="Save and exit to title?" onNo={() => setOverlay('pause')} onYes={() => { g?.snapshot(); update(() => { }); go('menu'); }} />}
      {overlay === 'map' && <MapScreen {...sub} back={resume} game={g} />}
      {overlay === 'settings' && <SettingsScreen {...sub} />}
      {overlay === 'shop' && <Shop {...sub} />}
      {done && <div className="absolute inset-0 z-50 bg-black/60 grid place-items-center"><Panel className="p-6 text-center w-80"><div className="text-[#ffd400] text-sm font-bold tracking-widest">MISSION PASSED</div><div className="text-white text-2xl font-black my-2">{done.name}</div><div className="text-4xl font-black text-[#ffd400] mb-4">+$ {done.reward}</div><Btn variant="yellow" className="w-full" onClick={() => setDone(null)}>Continue</Btn></Panel></div>}
    </div>
  );
}
// re-bind minimap canvas after HUD remounts (overlay closes)
function minimapRebind(ref: React.RefObject<HTMLCanvasElement | null>, g: Game | null) { queueMicrotask(() => { if (g && ref.current) g.minimap = ref.current; }); return null; }
