// Full-screen HUD editor (Settings → Edit HUD). Drag elements, resize with a slider, hide/show, reset.
// Changes are saved to Settings.hud (sparse overrides) when a drag ends / a control is used.
import { useRef, useState } from 'react';
import type { HudItem, Profile, Settings } from '../game/store';
import { HUD_DEFS, defaultItem, diffHud, modeDefs, resolveHud, type HudDef, type HudLayout } from './hudLayout';
import { mockCtx, renderHudElement, slotStyle } from './hud';
import { cx } from './common';
import keyart from '../assets/keyart.jpg';

export function HudEditor({ profile, onCommit, onClose }: { profile: Profile; onCommit: (over: Settings['hud']) => void; onClose: () => void }) {
  const [layout, setLayout] = useState<HudLayout>(() => resolveHud(profile.settings.hud));
  const lay = useRef(layout); lay.current = layout;
  const [tab, setTab] = useState<'foot' | 'drive'>('foot');
  const [sel, setSel] = useState<string | null>(null);
  const [tb, setTb] = useState({ x: 0.5, y: 0.5 }); // floating toolbar position (fraction of screen)
  const area = useRef<HTMLDivElement>(null); const mini = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const tbDrag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const ctx = mockCtx(profile, mini);

  const patch = (id: string, p: Partial<HudItem>, commit = true) => {
    const next = { ...lay.current, [id]: { ...lay.current[id], ...p } }; lay.current = next; setLayout(next);
    if (commit) onCommit(diffHud(next));
  };
  const resetAll = () => { const next = resolveHud({}); lay.current = next; setLayout(next); onCommit({}); };
  const defs = modeDefs(tab).slice().sort((a, b) => (a.id === 'wheel' ? -1 : b.id === 'wheel' ? 1 : 0)); // big wheel underneath
  const selDef = sel ? HUD_DEFS.find(d => d.id === sel) ?? null : null; const selItem = sel ? layout[sel] : null;
  const rect = () => area.current!.getBoundingClientRect();

  const down = (e: React.PointerEvent<HTMLDivElement>, d: HudDef) => {
    e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setSel(d.id);
    drag.current = { id: d.id, sx: e.clientX, sy: e.clientY, ox: layout[d.id].x, oy: layout[d.id].y };
  };
  const move = (e: React.PointerEvent<HTMLDivElement>, d: HudDef) => {
    const st = drag.current; if (!st || st.id !== d.id) return; const r = rect(); const it = lay.current[d.id];
    const hw = (d.w * it.s) / 2 / r.width, hh = (d.h * it.s) / 2 / r.height; // keep the whole element on screen
    const cl = (v: number, lo: number, hi: number) => Math.min(Math.max(v, Math.min(lo, 0.5)), Math.max(hi, 0.5));
    patch(d.id, { x: cl(st.ox + (e.clientX - st.sx) / r.width, hw, 1 - hw), y: cl(st.oy + (e.clientY - st.sy) / r.height, hh, 1 - hh) }, false);
  };
  const up = () => { if (drag.current) { drag.current = null; onCommit(diffHud(lay.current)); } };

  return (
    <div className="absolute inset-0 z-[60] overflow-hidden bg-[#0a0e16] select-none" ref={area} onPointerDown={() => setSel(null)}>
      <img src={keyart} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

      {defs.map(d => {
        const it = layout[d.id]; const on = sel === d.id;
        return (
          <div key={d.id} className="absolute touch-none cursor-move" style={{ ...slotStyle(d, it), opacity: it.hidden ? 0.3 : 1, outline: on ? '2px solid #ffd400' : '1px dashed rgba(255,255,255,.4)', outlineOffset: 2, zIndex: on ? 5 : 1 }}
            onPointerDown={e => down(e, d)} onPointerMove={e => move(e, d)} onPointerUp={up} onPointerCancel={up}>
            <div className="w-full h-full">{renderHudElement(d.id, ctx)}</div>
            <div className="absolute inset-0 z-10" />{/* swallows taps so mock buttons never fire */}
            {on && <span className="absolute -top-5 left-0 z-20 text-[10px] font-bold bg-[#ffd400] text-black px-1.5 rounded whitespace-nowrap">{d.label}{it.hidden ? ' (hidden)' : ''}</span>}
          </div>);
      })}

      {/* floating toolbar (drag the handle to move it out of the way) */}
      <div className="absolute z-20 w-[min(92vw,460px)] rounded-xl bg-[#0b0f17]/90 border border-white/15 backdrop-blur-md p-2 text-white shadow-2xl" style={{ left: `${tb.x * 100}%`, top: `${tb.y * 100}%`, transform: 'translate(-50%,-50%)' }} onPointerDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <div className="touch-none cursor-grab px-1 text-white/60 text-lg" title="Move toolbar"
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); tbDrag.current = { sx: e.clientX, sy: e.clientY, ox: tb.x, oy: tb.y }; }}
            onPointerMove={e => { const s = tbDrag.current; if (!s) return; const r = rect(); setTb({ x: Math.min(0.95, Math.max(0.05, s.ox + (e.clientX - s.sx) / r.width)), y: Math.min(0.95, Math.max(0.05, s.oy + (e.clientY - s.sy) / r.height)) }); }}
            onPointerUp={() => { tbDrag.current = null; }}>⠿</div>
          <div className="flex rounded-lg overflow-hidden border border-white/15 text-sm font-bold">
            {(['foot', 'drive'] as const).map(t => <button key={t} onClick={() => { setTab(t); setSel(null); }} className={cx('px-3 py-1.5', tab === t ? 'bg-[#ffd400] text-black' : 'bg-black/40')}>{t === 'foot' ? 'On Foot' : 'Driving'}</button>)}
          </div>
          <div className="flex-1" />
          <button onClick={resetAll} className="px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs font-bold">Reset all</button>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-[#ffe14d] to-[#f5b800] text-black text-sm font-black">✓ Done</button>
        </div>
        <div className="mt-2 min-h-9 flex items-center gap-2 text-xs">
          {selDef && selItem ? (<>
            <span className="font-bold text-[#ffd400] w-24 truncate">{selDef.label}</span>
            <span className="text-white/60">Size</span>
            <input type="range" min={0.5} max={2} step={0.05} value={selItem.s} onChange={e => patch(selDef.id, { s: +e.target.value })} className="flex-1 accent-yellow-400 min-w-16" />
            <span className="w-9 text-right tabular-nums">{Math.round(selItem.s * 100)}%</span>
            <button onClick={() => patch(selDef.id, { hidden: !selItem.hidden })} className={cx('px-2 py-1 rounded-md border text-xs font-bold', selItem.hidden ? 'bg-[#ffd400] text-black border-[#ffd400]' : 'bg-black/50 border-white/15')}>{selItem.hidden ? 'Show' : 'Hide'}</button>
            <button onClick={() => patch(selDef.id, defaultItem(selDef))} className="px-2 py-1 rounded-md bg-black/50 border border-white/15 text-xs font-bold">Reset</button>
          </>) : <span className="text-white/60">Drag any element to move it. Tap one to resize, hide or reset it.</span>}
        </div>
      </div>
    </div>
  );
}
