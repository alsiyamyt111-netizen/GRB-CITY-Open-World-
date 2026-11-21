import { useEffect, useRef, useState } from 'react';
import { Game, input, type HudState } from '../game/engine';
import { audio } from '../game/audio';
import { Btn, Panel } from './common';
import { MapScreen, SettingsScreen, Shop, Confirm, Logo, type SP } from './screens';
import keyart from '../assets/keyart.jpg';
import { HudLayer, type HudCtx, type OverlayName } from './hud';
import { resolveHud } from './hudLayout';
import { KEY_ORDER } from '../game/weapons';

export function Gameplay(props: SP & { missionId: string | null; clearMission: () => void }) {
  const { profile, update, go, toast } = props;
  const mount = useRef<HTMLDivElement>(null); const mini = useRef<HTMLCanvasElement>(null); const gameRef = useRef<Game | null>(null);
  const [load, setLoad] = useState({ p: 0, msg: 'Preparing…' }); const [ready, setReady] = useState(false);
  const [hud, setHud] = useState<HudState | null>(null); const [overlay, setOverlay] = useState<null | 'pause' | 'map' | 'settings' | 'shop' | 'exit'>(null);
  const [done, setDone] = useState<{ name: string; reward: number } | null>(null); const [toasts, setToasts] = useState<{ id: number; t: string }[]>([]);
  const [crouch, setCrouch] = useState(false); const [run, setRun] = useState(false); const [prone, setProne] = useState(false); const [aim, setAim] = useState(false); const [wheelOpen, setWheelOpen] = useState(false);
  const pushToast = (t: string) => { const id = Math.random(); setToasts(x => [...x.slice(-2), { id, t }]); setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), 2600); };

  useEffect(() => {
    audio.init(); Object.assign(input, { mx: 0, my: 0, run: false, crouch: false, prone: false, jump: false, steer: 0, gas: false, brake: false, handbrake: false });
    const g = new Game(mount.current!, profile, { onHud: setHud, onToast: pushToast, onMissionDone: (name, reward) => { setDone({ name, reward }); update(() => { }); }, onDeath: () => { pushToast('WASTED – respawned at hospital (-$200)'); update(p => { p.money = Math.max(0, p.money - 200); }); }, onSave: () => update(() => { }) });
    gameRef.current = g; let alive = true;
    g.init((p, msg) => alive && setLoad({ p, msg })).then(() => { if (!alive) return; g.minimap = mini.current; if (props.missionId) { g.startMission(props.missionId); props.clearMission(); } g.start(); setReady(true); });
    const key = (e: KeyboardEvent, d: boolean) => {
      const k = e.key.toLowerCase(); const drive = !!g.current;
      if (k === 'w' || k === 'arrowup') { input.my = d ? 1 : 0; } if (k === 's' || k === 'arrowdown') { input.my = d ? -1 : 0; }
      if (k === 'a' || k === 'arrowleft') { input.mx = d ? -1 : 0; } if (k === 'd' || k === 'arrowright') { input.mx = d ? 1 : 0; }
      if (k === 'shift') input.run = d; if (k === ' ') { if (drive) input.handbrake = d; else if (d) input.jump = true; }
      if (!d) return;
      if (k === 'c') { input.crouch = !input.crouch; if (input.crouch) { input.prone = false; setProne(false); } setCrouch(input.crouch); } if (k === 'e' || k === 'f') g.interact(); if (k === 'z') { input.prone = !input.prone; if (input.prone) { input.crouch = false; setCrouch(false); input.run = false; setRun(false); } setProne(input.prone); }
      if (k === 'x') { g.setAim(!g.aim); setAim(g.aim); } if (k === 'g') g.quickThrow(); if (k === 'tab') { e.preventDefault(); setWheelOpen(w => !w); }
      if (k >= '1' && k <= '8') { g.equip(KEY_ORDER[+k - 1]); setWheelOpen(false); }
      if (k === 'l') g.toggleLights(); if (k === 'h') g.horn(); if (k === 'v') g.cycleCamera(); if (k === 'q') g.action();
      if (k === 'm') { g.setPaused(true); setOverlay('map'); } if (k === 'escape' || k === 'p') { g.setPaused(true); setOverlay('pause'); }
    };
    const kd = (e: KeyboardEvent) => key(e, true), ku = (e: KeyboardEvent) => key(e, false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { alive = false; g.snapshot(); update(() => { }); g.dispose(); gameRef.current = null; window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  const g = gameRef.current;
  const openOverlay = (o: typeof overlay) => { g?.setPaused(true); setWheelOpen(false); setOverlay(o); };
  const resume = () => { setOverlay(null); if (g) { g.applySettings(profile.settings); g.setPaused(false); } };
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const driving = hud?.mode === 'drive' || hud?.mode === 'bike';
  const sub: SP = { ...props, back: () => setOverlay('pause') };
  const layout = resolveHud(profile.settings.hud);
  useEffect(() => { // entering a vehicle cancels crouch / prone / aim / open wheel
    if (!driving) return;
    input.crouch = input.prone = input.run = false; setCrouch(false); setProne(false); setRun(false); setAim(false); setWheelOpen(false); gameRef.current?.setAim(false);
  }, [driving]);
  const ctx: HudCtx | null = hud ? {
    editing: false, hud, profile, g, mini, weapon: hud.weapon, wheelOpen, setWheelOpen, run, crouch, prone, aim,
    toggleRun: () => { input.run = !input.run; setRun(input.run); },
    toggleCrouch: () => { input.crouch = !input.crouch; if (input.crouch) { input.prone = false; setProne(false); input.run = false; setRun(false); } setCrouch(input.crouch); },
    toggleProne: () => { input.prone = !input.prone; if (input.prone) { input.crouch = false; setCrouch(false); input.run = false; setRun(false); } setProne(input.prone); },
    toggleAim: () => { const v = !aim; setAim(v); g?.setAim(v); },
    openOverlay: (o: OverlayName) => openOverlay(o),
    useMedkit: () => { g?.useMedkit(); update(() => { }); }, useEnergy: () => { g?.useEnergy(); update(() => { }); },
  } : null;

  return (
    <div className="absolute inset-0 bg-black overflow-hidden select-none">
      <div ref={mount} className="absolute inset-0" />
      {/* camera look layer */}
      <div className="absolute inset-0 touch-none" onPointerDown={e => { look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; }} onPointerMove={e => { const l = look.current; if (l && l.id === e.pointerId) { input.lookDx += e.clientX - l.x; input.lookDy += e.clientY - l.y; l.x = e.clientX; l.y = e.clientY; } }} onPointerUp={() => { look.current = null; }} onPointerCancel={() => { look.current = null; }} />

      {ready && hud && ctx && !overlay && (<>
        <HudLayer layout={layout} mode={driving ? 'drive' : 'foot'} ctx={ctx} />
        {minimapRebind(mini, g)}
        {/* toasts */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none">{toasts.map(t => <div key={t.id} className="bg-black/75 text-white text-sm px-4 py-1.5 rounded-full border border-[#ffd400]/40 animate-[fadeUp_.3s]">{t.t}</div>)}</div>
        {/* interact prompt */}
        {hud.prompt && <button onPointerDown={e => { e.stopPropagation(); g?.interact(); }} className="absolute bottom-[42%] left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white px-4 py-2 rounded-full border border-[#3da5ff] text-sm font-bold">🚪 {hud.prompt}</button>}
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
