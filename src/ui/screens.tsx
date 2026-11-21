import { useEffect, useRef, useState } from 'react';
import keyart from '../assets/keyart.jpg';
import { Btn, TopBar, Panel, Preview3D, cx, Currency } from './common';
import { CHARACTERS, VEHICLES, MISSIONS, SHOP_ITEMS, SPECIAL_BLOCKS, BLOCK, N, HALF, blockCenter, VIEWPOINTS } from '../game/data';
import { getLook, resetSave, newProfile, type Profile, type Preset } from '../game/store';
import { audio } from '../game/audio';
import type { Game } from '../game/engine';
import { HudEditor } from './HudEditor';

export type Screen = 'splash' | 'loading' | 'menu' | 'lobby' | 'character' | 'customize' | 'garage' | 'vehicles' | 'missions' | 'map' | 'settings' | 'shop' | 'game';
export interface SP { profile: Profile; update: (fn: (p: Profile) => void) => void; go: (s: Screen) => void; back: () => void; toast: (t: string) => void }

const Bg = ({ dim = 0.55 }: { dim?: number }) => (<><img src={keyart} className="absolute inset-0 w-full h-full object-cover" alt="" /><div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(5,8,14,${dim + 0.3}) 0%, rgba(5,8,14,${dim}) 50%, rgba(5,8,14,${dim - 0.2}) 100%)` }} /></>);
export const Logo = ({ big }: { big?: boolean }) => (
  <div className={cx('font-black italic leading-none select-none', big ? 'text-6xl md:text-8xl' : 'text-4xl md:text-5xl')} style={{ textShadow: '0 4px 0 #000, 0 0 30px rgba(0,0,0,.6)' }}>
    <span className="text-white">RICH </span><span className="text-[#ffd400]">CITY</span>
    <div className={cx('not-italic font-bold tracking-[0.35em] text-[#3da5ff]', big ? 'text-base md:text-xl mt-2' : 'text-xs mt-1')}>OPEN WORLD LIFE</div>
  </div>
);

export function Splash({ go }: SP) {
  useEffect(() => { const t = setTimeout(() => go('loading'), 2600); return () => clearTimeout(t); }, []);
  return (
    <div className="absolute inset-0 bg-black grid place-items-center cursor-pointer" onClick={() => { audio.init(); go('loading'); }}>
      <img src={keyart} className="absolute inset-0 w-full h-full object-cover opacity-60 animate-[zoom_6s_ease-out_forwards]" alt="" />
      <div className="relative text-center animate-[fadeUp_1s_ease-out]"><Logo big /><p className="text-white/70 mt-8 text-sm animate-pulse">Tap to continue</p></div>
      <p className="absolute bottom-3 text-white/40 text-xs">An original game • Rich City Studios</p>
    </div>
  );
}

export function Loading({ go }: SP) {
  const [p, setP] = useState(0); const tips = ['Tip: Hold RUN to sprint – watch your stamina bar.', 'Tip: Find blue beacons on the hills for exploration rewards.', 'Tip: Turn on headlights at night with the 💡 button.', 'Tip: Your game auto-saves every 30 seconds.'];
  useEffect(() => { let v = 0; const steps = ['Initializing audio', 'Compiling shaders', 'Preparing textures', 'Loading profile']; const id = setInterval(() => { v += 4 + Math.random() * 8; setP(Math.min(100, v)); if (v >= 100) { clearInterval(id); setTimeout(() => go('menu'), 300); } }, 90); void steps; return () => clearInterval(id); }, []);
  return (
    <div className="absolute inset-0"><Bg dim={0.3} />
      <div className="absolute left-6 top-6"><Logo /></div>
      <div className="absolute bottom-8 inset-x-6 md:inset-x-24">
        <p className="text-white/80 text-sm mb-2">{tips[Math.floor(p / 26) % tips.length]}</p>
        <div className="h-3 bg-black/60 rounded-full overflow-hidden border border-white/10"><div className="h-full bg-gradient-to-r from-[#ffd400] to-[#ffb300] transition-all" style={{ width: p + '%' }} /></div>
        <p className="text-white font-bold mt-2 text-center">Loading… {Math.floor(p)}%</p>
      </div>
    </div>
  );
}

export function MainMenu({ profile, go }: SP) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="absolute inset-0"><Bg />
      <div className="absolute right-0 bottom-0 w-[45%] h-[90%] hidden sm:block"><Preview3D charFile={(CHARACTERS.find(c => c.id === profile.charId) || CHARACTERS[0]).file} className="w-full h-full" bg={false} /></div>
      <div className="absolute top-3 right-3"><Currency profile={profile} /></div>
      <div className="absolute left-6 md:left-12 top-1/2 -translate-y-1/2 flex flex-col gap-3 w-60">
        <div className="mb-4"><Logo /></div>
        <Btn variant="yellow" className="text-xl py-3" onClick={() => go('lobby')}>▶ PLAY</Btn>
        <Btn onClick={() => go('settings')}>⚙ Settings</Btn>
        <Btn onClick={() => go('shop')}>🛒 Shop</Btn>
        <Btn onClick={() => setConfirm(true)}>⎋ Exit</Btn>
      </div>
      {confirm && <Confirm text="Exit Rich City?" onYes={() => { window.close(); go('splash'); }} onNo={() => setConfirm(false)} />}
    </div>
  );
}
export function Confirm({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  return <div className="absolute inset-0 z-50 bg-black/70 grid place-items-center"><Panel className="p-6 w-80 text-center"><p className="text-white text-lg font-bold mb-5">{text}</p><div className="flex gap-3"><Btn className="flex-1" onClick={onNo}>Cancel</Btn><Btn variant="yellow" className="flex-1" onClick={onYes}>Yes</Btn></div></Panel></div>;
}

export function Lobby({ profile, go, back }: SP) {
  const ch = CHARACTERS.find(c => c.id === profile.charId)!; const veh = VEHICLES.find(v => v.id === profile.selectedVehicle)!;
  const items: [string, string, Screen][] = [['👤', 'Character', 'character'], ['🎨', 'Customize', 'customize'], ['🚗', 'Garage', 'garage'], ['🏁', 'Vehicles', 'vehicles'], ['📋', 'Missions', 'missions'], ['📍', 'Map', 'map'], ['🛒', 'Shop', 'shop'], ['⚙', 'Settings', 'settings']];
  return (
    <div className="absolute inset-0"><Bg dim={0.4} />
      <div className="absolute top-3 left-3 right-3 flex items-center gap-3 z-10">
        <button onClick={() => { audio.click(); back(); }} className="w-10 h-10 rounded-lg bg-black/55 border border-white/10 text-white text-xl">←</button>
        <Panel className="flex items-center gap-3 px-3 py-1.5"><div className="w-10 h-10 rounded-full grid place-items-center text-xl" style={{ background: ch.shirt }}>{ch.female ? '👩' : '👨'}</div><div><div className="text-white font-bold leading-tight">{ch.name}</div><div className="text-xs text-[#3da5ff]">Lv. {profile.level}</div><div className="w-24 h-1.5 bg-white/20 rounded"><div className="h-full bg-[#3da5ff] rounded" style={{ width: (profile.xp / (profile.level * 1000)) * 100 + '%' }} /></div></div></Panel>
        <div className="flex-1" /><Currency profile={profile} onShop={() => go('shop')} />
      </div>
      <div className="absolute left-3 top-20 bottom-3 flex flex-col gap-2 w-44 overflow-y-auto">
        {items.map(([i, l, s]) => <Btn key={s} className="text-left flex items-center gap-3" onClick={() => go(s)}><span>{i}</span>{l}</Btn>)}
      </div>
      <div className="absolute left-[30%] right-[22%] top-16 bottom-0"><Preview3D charFile={ch.file} className="w-full h-full" bg={false} /></div>
      <Panel className="absolute right-3 top-20 w-52 p-3 hidden sm:block">
        <div className="text-white/60 text-xs">ACTIVE VEHICLE</div><div className="text-white font-bold">{veh.name}</div>
        <Preview3D vehicle={veh} color={profile.vehicleColor[veh.id]} className="w-full h-28" bg={false} />
        <div className="text-white/60 text-xs mt-2">Missions done: <b className="text-[#ffd400]">{profile.completed.length}/{MISSIONS.length}</b></div>
        <div className="text-white/60 text-xs">Viewpoints: <b className="text-[#3da5ff]">{profile.viewpoints.length}/{VIEWPOINTS.length}</b></div>
      </Panel>
      <Btn variant="yellow" className="absolute right-4 bottom-4 text-xl px-8 py-3" onClick={() => go('game')}>START GAME ▶</Btn>
    </div>
  );
}

export function CharacterSelect({ profile, update, back }: SP) {
  const [sel, setSel] = useState(profile.charId); const c = CHARACTERS.find(c => c.id === sel)!;
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#121a2a] to-[#06080d]">
      <TopBar profile={profile} onBack={back} title="Character" />
      <div className="absolute top-16 left-3 bottom-3 w-[55%] grid grid-cols-4 gap-2 content-start overflow-y-auto">
        {CHARACTERS.map(ch => (
          <button key={ch.id} onClick={() => { audio.click(); setSel(ch.id); }} className={cx('relative rounded-xl aspect-[3/4] border-2 overflow-hidden transition', sel === ch.id ? 'border-[#ffd400] scale-[1.02]' : 'border-white/10')} style={{ background: `linear-gradient(180deg, ${ch.shirt}55, #0b0f17)` }}>
            <div className="text-4xl md:text-5xl mt-3">{ch.female ? '👩' : '👨'}</div>
            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[11px] font-bold py-1">{ch.name}</div>
            <div className="absolute top-1 left-1 w-3 h-3 rounded-full" style={{ background: ch.shirt, border: '1px solid #fff5' }} />
            {profile.charId === ch.id && <div className="absolute top-1 right-1 bg-[#ffd400] text-black rounded-full w-5 h-5 text-xs font-black grid place-items-center">✓</div>}
          </button>))}
      </div>
      <div className="absolute right-0 top-14 bottom-0 w-[44%]">
        <Preview3D charFile={c.file} className="w-full h-full" />
        <div className="absolute top-2 inset-x-0 text-center"><div className="text-white font-black text-xl">{c.name}</div><div className="text-white/60 text-sm">{c.bio} • {c.female ? 'Female' : 'Male'}</div></div>
        <Btn variant="yellow" className="absolute bottom-4 left-1/2 -translate-x-1/2 px-10 text-lg" onClick={() => { update(p => { p.charId = sel; }); back(); }}>Select</Btn>
      </div>
    </div>
  );
}

const PALETTE = ['#151515', '#f2f2f2', '#c41a1a', '#1f6fd1', '#2e7d32', '#e0338a', '#f2b705', '#6a1b9a', '#5d4037', '#37474f', '#ff6d00', '#00acc1'];
const SKINS = ['#f1c9a5', '#e0b090', '#d29b74', '#c68a5e', '#a8724a', '#8d5a3a', '#6b4226'];
export function Customize({ profile, update, back, toast }: SP) {
  const base = getLook(profile); const [look, setLook] = useState(base); const cost = 200;
  const Row = ({ label, k, colors }: { label: string; k: 'shirt' | 'pants' | 'hair' | 'skin'; colors: string[] }) => (
    <div className="mb-3"><div className="text-white/70 text-xs mb-1 font-bold">{label}</div><div className="flex flex-wrap gap-1.5">{colors.map(c => <button key={c} onClick={() => { audio.click(); setLook({ ...look, [k]: c }); }} className={cx('w-8 h-8 rounded-lg border-2', look[k] === c ? 'border-[#ffd400]' : 'border-white/10')} style={{ background: c }} />)}</div></div>);
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#121a2a] to-[#06080d]">
      <TopBar profile={profile} onBack={back} title="Customize" />
      <div className="absolute left-0 top-14 bottom-0 w-1/2"><Preview3D look={look} className="w-full h-full" /></div>
      <Panel className="absolute right-3 top-16 bottom-3 w-[46%] p-4 overflow-y-auto">
        <p className="text-white/50 text-[11px] mb-3">Color preview only — your actual in-game character uses its fixed 3D model look (change character under Character select instead).</p>
        <Row label="SKIN TONE" k="skin" colors={SKINS} /><Row label="TOP / JACKET" k="shirt" colors={PALETTE} /><Row label="PANTS" k="pants" colors={PALETTE} /><Row label="HAIR" k="hair" colors={['#0d0806', '#2b1a10', '#4a2a15', '#8d5524', '#d4a017', '#9e9e9e', '#c41a1a']} />
        <label className="flex items-center gap-2 text-white mb-4"><input type="checkbox" checked={!!look.hat} onChange={e => setLook({ ...look, hat: e.target.checked })} className="w-5 h-5 accent-yellow-400" /> Cap</label>
        <Btn variant="yellow" className="w-full" onClick={() => {
          if (profile.money < cost) return toast('Not enough money');
          update(p => { p.money -= cost; p.custom[p.charId] = { skin: look.skin, shirt: look.shirt, pants: look.pants, hair: look.hair, hat: !!look.hat }; }); toast('Outfit saved!'); back();
        }}>Save Outfit ($ {cost})</Btn>
      </Panel>
    </div>
  );
}

export function Garage({ profile, update, back, go, toast }: SP) {
  const owned = VEHICLES.filter(v => profile.owned.includes(v.id)); const [sel, setSel] = useState(profile.selectedVehicle);
  const v = VEHICLES.find(x => x.id === sel)!; const dmg = profile.vehicleDamage[sel] || 0;
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#0e1522] to-[#05070b]">
      <TopBar profile={profile} onBack={back} title="Garage" onShop={() => go('shop')} />
      <div className="absolute left-0 right-[34%] top-14 bottom-28"><Preview3D vehicle={v} color={profile.vehicleColor[v.id]} className="w-full h-full" /></div>
      <div className="absolute left-3 right-[34%] bottom-3 flex gap-2 overflow-x-auto">
        {owned.map(o => <button key={o.id} onClick={() => { audio.click(); setSel(o.id); }} className={cx('shrink-0 w-28 h-20 rounded-lg border-2 bg-black/50 text-white text-xs font-bold p-1 flex flex-col items-center justify-center', sel === o.id ? 'border-[#ffd400]' : 'border-white/10')}><span className="text-2xl">{o.type === 'bike' ? '🏍️' : o.type === 'bus' ? '🚌' : o.type === 'truck' ? '🚚' : o.type === 'ambulance' ? '🚑' : o.type === 'police' ? '🚓' : o.type === 'sports' ? '🏎️' : '🚗'}</span>{o.name}{profile.selectedVehicle === o.id && <span className="text-[#ffd400]">● Active</span>}</button>)}
        <button onClick={() => go('vehicles')} className="shrink-0 w-28 h-20 rounded-lg border-2 border-dashed border-white/20 text-white/70 text-sm">+ Get more</button>
      </div>
      <Panel className="absolute right-3 top-16 bottom-3 w-[32%] p-4 overflow-y-auto">
        <div className="text-white font-black text-xl">{v.name}</div><div className="text-[#3da5ff] text-xs uppercase mb-3">{v.type}</div>
        <Stat l="Top speed" v={v.maxSpeed / 75} t={`${Math.round(v.maxSpeed * 3.6)} km/h`} /><Stat l="Acceleration" v={v.accel / 25} /><Stat l="Handling" v={v.handling / 2.4} /><Stat l="Condition" v={1 - dmg / 100} t={`${Math.round(100 - dmg)}%`} c={dmg > 50 ? '#ff5a5a' : '#4caf50'} />
        <div className="text-white/70 text-xs font-bold mt-3 mb-1">PAINT ($300)</div>
        <div className="flex flex-wrap gap-1.5 mb-3">{PALETTE.map(c => <button key={c} onClick={() => { if (profile.money < 300) return toast('Not enough money'); update(p => { p.money -= 300; p.vehicleColor[v.id] = c; }); }} className="w-7 h-7 rounded-md border border-white/20" style={{ background: c }} />)}</div>
        <Btn className="w-full mb-2" disabled={dmg === 0} onClick={() => { const c = Math.round(dmg * 10); if (profile.money < c) return toast('Not enough money'); update(p => { p.money -= c; p.vehicleDamage[v.id] = 0; }); toast('Vehicle repaired'); }}>🔧 Repair (${Math.round(dmg * 10)})</Btn>
        <Btn variant="yellow" className="w-full" onClick={() => { update(p => { p.selectedVehicle = sel; }); toast(`${v.name} set as active`); }}>{profile.selectedVehicle === sel ? '✓ Active' : 'Use This Vehicle'}</Btn>
      </Panel>
    </div>
  );
}
const Stat = ({ l, v, t, c = '#ffd400' }: { l: string; v: number; t?: string; c?: string }) => (<div className="mb-2"><div className="flex justify-between text-xs text-white/70"><span>{l}</span><span>{t}</span></div><div className="h-2 bg-white/10 rounded"><div className="h-full rounded" style={{ width: Math.min(100, v * 100) + '%', background: c }} /></div></div>);

export function VehicleSelect({ profile, update, back, toast }: SP) {
  const [sel, setSel] = useState(VEHICLES[0].id); const [filter, setFilter] = useState('all'); const v = VEHICLES.find(x => x.id === sel)!; const own = profile.owned.includes(v.id);
  const list = VEHICLES.filter(x => filter === 'all' || (filter === 'cars' ? ['car', 'sports'].includes(x.type) : filter === 'bikes' ? x.type === 'bike' : !['car', 'sports', 'bike'].includes(x.type)));
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#0e1522] to-[#05070b]">
      <TopBar profile={profile} onBack={back} title="Vehicle Selection" />
      <div className="absolute left-3 top-16 bottom-3 w-[40%] flex flex-col">
        <div className="flex gap-1 mb-2">{['all', 'cars', 'bikes', 'service'].map(f => <button key={f} onClick={() => setFilter(f)} className={cx('px-3 py-1 rounded-md text-xs font-bold uppercase', filter === f ? 'bg-[#ffd400] text-black' : 'bg-black/50 text-white')}>{f}</button>)}</div>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto">{list.map(x => <button key={x.id} onClick={() => { audio.click(); setSel(x.id); }} className={cx('rounded-lg p-2 text-left border-2 bg-black/50', sel === x.id ? 'border-[#ffd400]' : 'border-white/10')}><div className="text-white font-bold text-sm">{x.name}</div><div className="text-xs text-white/50 uppercase">{x.type}</div><div className={cx('text-xs font-bold', profile.owned.includes(x.id) ? 'text-green-400' : 'text-[#ffd400]')}>{profile.owned.includes(x.id) ? 'OWNED' : '$ ' + x.price.toLocaleString()}</div></button>)}</div>
      </div>
      <div className="absolute right-0 left-[43%] top-14 bottom-20"><Preview3D vehicle={v} className="w-full h-full" /></div>
      <div className="absolute right-4 bottom-4 flex gap-3 items-center">
        <div className="text-white text-right"><div className="font-black text-lg">{v.name}</div><div className="text-xs text-white/60">{Math.round(v.maxSpeed * 3.6)} km/h top speed</div></div>
        {own ? <Btn variant="yellow" onClick={() => { update(p => { p.selectedVehicle = v.id; }); toast(`${v.name} selected`); back(); }}>Select</Btn>
          : <Btn variant="blue" onClick={() => { if (profile.money < v.price) return toast('Not enough money'); update(p => { p.money -= v.price; p.owned.push(v.id); p.selectedVehicle = v.id; }); toast(`Purchased ${v.name}!`); audio.reward(); }}>Buy $ {v.price.toLocaleString()}</Btn>}
      </div>
    </div>
  );
}

export function MissionSelect({ profile, back, onStart }: SP & { onStart: (id: string) => void }) {
  const [sel, setSel] = useState(MISSIONS[0].id); const m = MISSIONS.find(x => x.id === sel)!;
  return (
    <div className="absolute inset-0"><Bg dim={0.6} />
      <TopBar profile={profile} onBack={back} title="Missions" />
      <div className="absolute left-3 top-16 bottom-3 w-[48%] flex flex-col gap-2 overflow-y-auto">
        {MISSIONS.map(x => <button key={x.id} onClick={() => { audio.click(); setSel(x.id); }} className={cx('flex items-center gap-3 rounded-xl p-3 text-left border-2 bg-black/55 backdrop-blur', sel === x.id ? 'border-[#ffd400]' : 'border-white/10')}><span className="text-3xl">{x.icon}</span><div className="flex-1"><div className="text-white font-bold">{x.name}</div><div className="text-xs text-white/50 uppercase">{x.type}{x.time ? ` • ${x.time}s limit` : ''}</div></div><div className="text-right"><div className="text-[#ffd400] font-bold text-sm">$ {x.reward}</div>{profile.completed.includes(x.id) && <div className="text-green-400 text-xs">✓ Done</div>}</div></button>)}
      </div>
      <Panel className="absolute right-3 top-16 bottom-3 w-[46%] p-5 flex flex-col">
        <div className="text-5xl">{m.icon}</div><div className="text-white font-black text-2xl mt-2">{m.name}</div><p className="text-white/70 mt-2">{m.desc}</p>
        <div className="mt-4 text-sm text-white/80 space-y-1"><div>🏁 Checkpoints: <b>{m.points.length}</b></div><div>💰 Reward: <b className="text-[#ffd400]">${m.reward}</b> {profile.completed.includes(m.id) && <span className="text-white/50">(replay: 50%)</span>}</div>{m.time && <div>⏱ Time limit: <b>{m.time}s</b></div>}</div>
        <div className="flex-1" /><Btn variant="yellow" className="text-lg" onClick={() => onStart(m.id)}>Start Mission ▶</Btn>
      </Panel>
    </div>
  );
}

function drawSchematic(ctx: CanvasRenderingContext2D, S: number) {
  const W = 1700, to = (v: number) => (v + W / 2) / W * S;
  ctx.fillStyle = '#5c8a4a'; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#6f7a5a'; ctx.fillRect(to(340), 0, S, S);
  ctx.fillStyle = '#2f6ea0'; ctx.fillRect(to(-760), to(375), to(760) - to(-760), to(440) - to(375));
  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) { const sp = SPECIAL_BLOCKS[`${bx},${bz}`]; const [cx, cz] = blockCenter(bx, bz); ctx.fillStyle = sp === 'park' || sp === 'playground' ? '#5e9e4e' : sp === 'hospital' ? '#eee' : sp === 'police' ? '#5476b8' : sp === 'petrol' ? '#e3b23c' : sp === 'mall' ? '#c47ad6' : '#8a8f98'; const s = 64 / W * S; ctx.fillRect(to(cx) - s / 2, to(cz) - s / 2, s, s); }
  ctx.fillStyle = '#2b2e33'; for (let i = 0; i <= N; i++) { const p = to(-HALF + i * BLOCK); ctx.fillRect(p - 2, to(-HALF), 4, to(HALF) - to(-HALF)); ctx.fillRect(to(-HALF), p - 2, to(HALF) - to(-HALF), 4); }
  ctx.fillRect(to(0) - 2, to(330), 4, to(485) - to(330));
}
export function MapScreen({ profile, back, game }: SP & { game?: Game | null }) {
  const ref = useRef<HTMLCanvasElement>(null); const [legend] = useState([['#eee', 'Hospital'], ['#5476b8', 'Police'], ['#e3b23c', 'Petrol'], ['#c47ad6', 'Mall'], ['#5e9e4e', 'Park'], ['#29b6f6', 'Viewpoint'], ['#ffd400', 'Mission']]);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const cv = ref.current!; const S = 1024; cv.width = cv.height = S; const ctx = cv.getContext('2d')!; const to = (v: number) => (v + 850) / 1700 * S;
    if (game) ctx.drawImage(game.world.mapCanvas, 0, 0, S, S); else drawSchematic(ctx, S);
    ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    const lbl = (t: string, x: number, z: number) => { ctx.fillStyle = '#000a'; ctx.fillText(t, to(x) + 1, to(z) + 1); ctx.fillStyle = '#fff'; ctx.fillText(t, to(x), to(z)); };
    lbl('DOWNTOWN', 0, -10); lbl('SILVER RIVER', -400, 410); lbl('EAGLE PEAK', 560, -150); lbl('EASTERN HILLS', 500, 200); lbl('RIVERSIDE', -200, 560);
    VIEWPOINTS.forEach(([x, z], i) => { if (profile.viewpoints.includes(i)) return; ctx.fillStyle = '#29b6f6'; ctx.beginPath(); ctx.arc(to(x), to(z), 7, 0, 7); ctx.fill(); });
    MISSIONS.forEach(m => { const [x, z] = m.points[0]; ctx.font = '20px Arial'; ctx.fillText(m.icon, to(x), to(z) + 7); });
    if (game) { const at = game.current ? game.current.pos : game.pos; ctx.fillStyle = '#ffd400'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(to(at.x), to(at.z), 10, 0, 7); ctx.fill(); ctx.stroke(); if (game.waypoint) { ctx.fillStyle = '#3da5ff'; ctx.beginPath(); ctx.arc(to(game.waypoint.x), to(game.waypoint.z), 10, 0, 7); ctx.fill(); ctx.stroke(); } }
  }, [game, profile.viewpoints.length, zoom]);
  const tap = (e: React.MouseEvent) => { if (!game) return; const r = (e.target as HTMLCanvasElement).getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 1700 - 850, z = (e.clientY - r.top) / r.height * 1700 - 850; game.setWaypoint(x, z); audio.click(); setZoom(z => z + 0.0001); };
  return (
    <div className="absolute inset-0 bg-[#070a10] z-40">
      <TopBar profile={profile} onBack={back} title="Map" />
      <div className="absolute inset-0 top-14 overflow-auto grid place-items-center p-2">
        <canvas ref={ref} onClick={tap} className="rounded-xl border border-white/10 cursor-crosshair" style={{ height: `min(${85 * Math.floor(zoom)}vh, ${100 * Math.floor(zoom)}vw)`, aspectRatio: '1' }} />
      </div>
      <Panel className="absolute left-3 bottom-3 p-2 text-xs text-white space-y-1">{legend.map(([c, l]) => <div key={l} className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: c }} />{l}</div>)}<div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#3da5ff]" />Waypoint</div></Panel>
      <div className="absolute right-3 bottom-3 flex flex-col gap-2">
        <Btn onClick={() => setZoom(z => Math.min(3, Math.floor(z) + 1))}>＋</Btn><Btn onClick={() => setZoom(z => Math.max(1, Math.floor(z) - 1))}>－</Btn>
        {game && <Btn variant="blue" onClick={() => { game.waypoint = null; setZoom(z => z + 0.0001); }}>Clear WP</Btn>}
      </div>
      {game && <p className="absolute top-16 inset-x-0 text-center text-white/60 text-xs pointer-events-none">Tap the map to set a waypoint</p>}
    </div>
  );
}

export function SettingsScreen({ profile, update, back, toast }: SP) {
  const s = profile.settings; const set = (k: keyof typeof s, v: any) => update(p => { (p.settings as any)[k] = v; });
  const Slider = ({ l, k, min, max, step }: { l: string; k: 'sfx' | 'ambient' | 'sensitivity' | 'dayLength'; min: number; max: number; step: number }) => (<div className="mb-4"><div className="flex justify-between text-white text-sm mb-1"><span>{l}</span><span className="text-[#ffd400]">{k === 'dayLength' ? `${s[k]} min` : Math.round((s[k] as number) * 100) + '%'}</span></div><input type="range" min={min} max={max} step={step} value={s[k] as number} onChange={e => set(k, +e.target.value)} className="w-full accent-yellow-400" /></div>);
  const [confirm, setConfirm] = useState(false); const [editHud, setEditHud] = useState(false);
  return (
    <div className="absolute inset-0 z-40"><Bg dim={0.7} />
      <TopBar profile={profile} onBack={back} title="Settings" />
      <div className="absolute inset-x-3 top-16 bottom-3 grid md:grid-cols-2 gap-3 overflow-y-auto">
        <Panel className="p-4">
          <h3 className="text-[#3da5ff] font-bold mb-3">GRAPHICS</h3>
          <div className="grid grid-cols-4 gap-2 mb-2">{(['low', 'medium', 'high', 'ultra'] as Preset[]).map(p => <button key={p} onClick={() => { audio.click(); set('preset', p); }} className={cx('py-2 rounded-lg font-bold capitalize text-sm', s.preset === p ? 'bg-[#ffd400] text-black' : 'bg-black/50 text-white border border-white/10')}>{p}</button>)}</div>
          <p className="text-white/50 text-xs mb-4">{{ low: 'No shadows, reduced resolution & traffic – for low-end phones.', medium: 'Soft shadows, reflections – recommended for 4GB RAM.', high: 'Higher resolution, 2K shadows, more traffic.', ultra: 'Max resolution, 4K shadows, dense city life.' }[s.preset]} Anti-aliasing changes apply on next game start.</p>
          <label className="flex items-center justify-between text-white text-sm mb-3">Show FPS<input type="checkbox" checked={s.showFps} onChange={e => set('showFps', e.target.checked)} className="w-5 h-5 accent-yellow-400" /></label>
          <Slider l="Day length" k="dayLength" min={2} max={30} step={1} />
        </Panel>
        <Panel className="p-4">
          <h3 className="text-[#3da5ff] font-bold mb-3">SOUND & CONTROLS</h3>
          <Slider l="Sound effects" k="sfx" min={0} max={1} step={0.05} /><Slider l="Ambient (rain/wind)" k="ambient" min={0} max={1} step={0.05} /><Slider l="Camera sensitivity" k="sensitivity" min={0.3} max={2.5} step={0.1} />
          <label className="flex items-center justify-between text-white text-sm mb-4">Vibration<input type="checkbox" checked={s.vibrate} onChange={e => set('vibrate', e.target.checked)} className="w-5 h-5 accent-yellow-400" /></label>
          <h3 className="text-[#3da5ff] font-bold mb-2 mt-1">HUD</h3>
          <p className="text-white/50 text-xs mb-2">Drag, resize, hide or show every button and panel. Separate On-Foot and Driving layouts.</p>
          <div className="grid grid-cols-2 gap-2 mb-4"><Btn variant="yellow" onClick={() => setEditHud(true)}>✋ Edit HUD Layout</Btn><Btn onClick={() => { update(p => { p.settings.hud = {}; }); toast('HUD layout reset'); }}>Reset HUD</Btn></div>
          <Btn variant="red" className="w-full" onClick={() => setConfirm(true)}>Reset Save Data</Btn>
        </Panel>
      </div>
      {editHud && <HudEditor profile={profile} onClose={() => setEditHud(false)} onCommit={over => update(p => { p.settings.hud = over; })} />}
      {confirm && <Confirm text="Delete all progress?" onNo={() => setConfirm(false)} onYes={() => { resetSave(); const n = newProfile(); update(p => Object.assign(p, n)); setConfirm(false); toast('Save data reset'); }} />}
    </div>
  );
}

export function Shop({ profile, update, back, toast }: SP & { onItem?: (id: string) => void }) {
  const [tab, setTab] = useState<'items' | 'vehicles'>('items');
  const buyItem = (id: string) => {
    const it = SHOP_ITEMS.find(i => i.id === id)!;
    if (it.currency === 'gems' ? profile.gems < it.price : profile.money < it.price) return toast('Not enough ' + it.currency);
    update(p => { if (it.currency === 'gems') p.gems -= it.price; else p.money -= it.price; if (id === 'med') p.medkits += 3; if (id === 'energy') p.energy += 3; if (id === 'repair') p.vehicleDamage[p.selectedVehicle] = 0; if (id === 'conv') p.money += 5000; if (id === 'gems') p.gems += 25; });
    audio.reward(); toast(`Purchased ${it.name}`);
  };
  return (
    <div className="absolute inset-0 z-40"><Bg dim={0.65} />
      <TopBar profile={profile} onBack={back} title="Shop" />
      <div className="absolute left-3 top-16 flex gap-2">{(['items', 'vehicles'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={cx('px-4 py-1.5 rounded-md font-bold uppercase text-sm', tab === t ? 'bg-[#ffd400] text-black' : 'bg-black/50 text-white')}>{t}</button>)}<span className="text-white/60 text-xs self-center ml-2">🩹 {profile.medkits} • 🥤 {profile.energy}</span></div>
      <div className="absolute inset-x-3 top-28 bottom-3 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 content-start">
        {tab === 'items' ? SHOP_ITEMS.map(it => <Panel key={it.id} className="p-4 flex flex-col items-center text-center"><div className="text-5xl">{it.icon}</div><div className="text-white font-bold mt-2">{it.name}</div><div className="text-white/50 text-xs mb-3 flex-1">{it.desc}</div><Btn variant={it.currency === 'gems' ? 'blue' : 'yellow'} className="w-full" onClick={() => buyItem(it.id)}>{it.price === 0 ? 'FREE' : it.currency === 'gems' ? `💎 ${it.price}` : `$ ${it.price}`}</Btn></Panel>)
          : VEHICLES.filter(v => v.price > 0).map(v => { const own = profile.owned.includes(v.id); return <Panel key={v.id} className="p-3 flex flex-col"><div className="h-20 grid place-items-center text-5xl rounded-lg mb-1" style={{ background: `radial-gradient(circle, ${v.color}66, transparent 70%)` }}>{v.type === 'bike' ? '🏍️' : v.type === 'bus' ? '🚌' : v.type === 'truck' ? '🚚' : v.type === 'ambulance' ? '🚑' : v.type === 'police' ? '🚓' : v.type === 'sports' ? '🏎️' : '🚗'}</div><div className="text-white font-bold">{v.name}</div><div className="text-white/50 text-xs uppercase mb-2">{v.type}</div><Btn variant="yellow" disabled={own} onClick={() => { if (profile.money < v.price) return toast('Not enough money'); update(p => { p.money -= v.price; p.owned.push(v.id); }); audio.reward(); toast(`Purchased ${v.name}`); }}>{own ? 'Owned' : `$ ${v.price.toLocaleString()}`}</Btn></Panel>; })}
      </div>
    </div>
  );
}
