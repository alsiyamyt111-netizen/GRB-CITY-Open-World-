import { useEffect, useRef, useState } from 'react';
import { loadProfile, saveProfile, type Profile } from './game/store';
import { audio } from './game/audio';
import { Splash, Loading, MainMenu, Lobby, CharacterSelect, Customize, Garage, VehicleSelect, MissionSelect, MapScreen, SettingsScreen, Shop, type Screen, type SP } from './ui/screens';
import { Gameplay } from './ui/Gameplay';

export default function App() {
  const pRef = useRef<Profile>(loadProfile());
  const [, setVer] = useState(0);
  const [stack, setStack] = useState<Screen[]>(['splash']);
  const [toast, setToast] = useState<string | null>(null);
  const [mission, setMission] = useState<string | null>(null);
  const [portrait, setPortrait] = useState(false);
  const screen = stack[stack.length - 1];

  useEffect(() => { const f = () => setPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 900); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const update = (fn: (p: Profile) => void) => { fn(pRef.current); saveProfile(pRef.current); audio.setVolumes(pRef.current.settings.sfx, pRef.current.settings.ambient); setVer(v => v + 1); };
  const go = (s: Screen) => setStack(st => (s === 'menu' || s === 'splash' || s === 'loading') ? [s] : s === 'lobby' ? ['menu', 'lobby'] : [...st, s]);
  const back = () => setStack(st => (st.length > 1 ? st.slice(0, -1) : st));
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(x => (x === t ? null : x)), 2200); };
  const goFullscreen = () => { const el = document.documentElement as any; if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().then(() => (screen as any).orientation?.lock?.('landscape')).catch(() => { }); try { (window.screen.orientation as any)?.lock?.('landscape').catch(() => { }); } catch { /* unsupported */ } };

  const props: SP = { profile: pRef.current, update, go, back, toast: showToast };
  const view = (() => {
    switch (screen) {
      case 'splash': return <Splash {...props} />;
      case 'loading': return <Loading {...props} />;
      case 'menu': return <MainMenu {...props} />;
      case 'lobby': return <Lobby {...props} />;
      case 'character': return <CharacterSelect {...props} />;
      case 'customize': return <Customize {...props} />;
      case 'garage': return <Garage {...props} />;
      case 'vehicles': return <VehicleSelect {...props} />;
      case 'missions': return <MissionSelect {...props} onStart={id => { setMission(id); go('game'); }} />;
      case 'map': return <MapScreen {...props} />;
      case 'settings': return <SettingsScreen {...props} />;
      case 'shop': return <Shop {...props} />;
      case 'game': return <Gameplay {...props} missionId={mission} clearMission={() => setMission(null)} />;
    }
  })();

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-[Rajdhani,system-ui,sans-serif]" onPointerDown={() => { audio.init(); if (screen === 'game' || screen === 'lobby') goFullscreen(); }}>
      <div key={screen} className="absolute inset-0 animate-[fadeIn_.35s_ease-out]">{view}</div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-black/85 text-white px-5 py-2 rounded-full border border-[#ffd400]/50 font-bold">{toast}</div>}
      {portrait && screen === 'game' && <div className="fixed inset-0 z-[200] bg-black/95 grid place-items-center text-center text-white p-8"><div><div className="text-6xl mb-4 animate-pulse">📱↻</div><div className="text-xl font-bold">Rotate your phone to landscape</div><div className="text-white/60 text-sm mt-2">Rich City is played in landscape mode</div></div></div>}
    </div>
  );
}
