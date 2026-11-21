// Every movable HUD element: default centre position (0..1 of the screen), base size in px.
// Players only store what they changed (Settings.hud), so new elements always get sane defaults.
import type { HudItem, Settings } from '../game/store';

export type HudMode = 'foot' | 'drive' | 'both';
export interface HudDef { id: string; label: string; mode: HudMode; x: number; y: number; w: number; h: number }

export const HUD_DEFS: HudDef[] = [
  // --- shared ---
  { id: 'minimap', label: 'Minimap', mode: 'both', x: 0.115, y: 0.19, w: 130, h: 130 },
  { id: 'pause', label: 'Pause', mode: 'both', x: 0.03, y: 0.07, w: 44, h: 44 },
  { id: 'bars', label: 'Health & Stamina', mode: 'both', x: 0.275, y: 0.075, w: 190, h: 44 },
  { id: 'zone', label: 'Zone & Time', mode: 'both', x: 0.5, y: 0.07, w: 240, h: 56 },
  { id: 'money', label: 'Money', mode: 'both', x: 0.745, y: 0.065, w: 190, h: 40 },
  { id: 'mission', label: 'Mission Tracker', mode: 'both', x: 0.87, y: 0.3, w: 210, h: 84 },
  { id: 'mapBtn', label: 'Map Button', mode: 'both', x: 0.04, y: 0.37, w: 50, h: 50 },
  { id: 'shop', label: 'Shop Button', mode: 'both', x: 0.04, y: 0.47, w: 50, h: 50 },
  { id: 'camera', label: 'Camera', mode: 'both', x: 0.645, y: 0.925, w: 64, h: 78 },
  // --- on foot ---
  { id: 'weapon', label: 'Weapon Panel', mode: 'foot', x: 0.9, y: 0.12, w: 200, h: 92 },
  { id: 'wheel', label: 'Weapon Wheel', mode: 'foot', x: 0.74, y: 0.5, w: 420, h: 420 },
  { id: 'joystick', label: 'Joystick', mode: 'foot', x: 0.115, y: 0.77, w: 160, h: 160 },
  { id: 'fire', label: 'Fire / Use', mode: 'foot', x: 0.865, y: 0.68, w: 112, h: 112 },
  { id: 'aim', label: 'Aim', mode: 'foot', x: 0.945, y: 0.45, w: 78, h: 78 },
  { id: 'grenade', label: 'Quick Grenade', mode: 'foot', x: 0.775, y: 0.7, w: 58, h: 58 },
  { id: 'jump', label: 'Jump', mode: 'foot', x: 0.82, y: 0.89, w: 76, h: 76 },
  { id: 'vehicle', label: 'Vehicle', mode: 'foot', x: 0.365, y: 0.925, w: 64, h: 78 },
  { id: 'run', label: 'Run', mode: 'foot', x: 0.115, y: 0.6, w: 64, h: 78 }, // just above the joystick
  { id: 'crouch', label: 'Crouch', mode: 'foot', x: 0.505, y: 0.925, w: 64, h: 78 },
  { id: 'lie', label: 'Lie Down', mode: 'foot', x: 0.575, y: 0.925, w: 64, h: 78 },
  { id: 'medkit', label: 'Medkit', mode: 'foot', x: 0.04, y: 0.57, w: 50, h: 50 },
  { id: 'energy', label: 'Energy Drink', mode: 'foot', x: 0.1, y: 0.57, w: 50, h: 50 },
  // --- driving ---
  { id: 'steer', label: 'Steering', mode: 'drive', x: 0.14, y: 0.85, w: 190, h: 84 },
  { id: 'pedals', label: 'Gas & Brake', mode: 'drive', x: 0.9, y: 0.78, w: 160, h: 130 },
  { id: 'driveTools', label: 'Lights / Horn / Exit', mode: 'drive', x: 0.76, y: 0.74, w: 52, h: 232 },
  { id: 'speedo', label: 'Speedometer', mode: 'drive', x: 0.9, y: 0.3, w: 112, h: 112 },
  { id: 'vehicleInfo', label: 'Vehicle Info', mode: 'drive', x: 0.5, y: 0.925, w: 150, h: 40 },
];

export type HudLayout = Record<string, HudItem>;
const DEF_BY_ID = new Map(HUD_DEFS.map(d => [d.id, d]));
export const defaultItem = (d: HudDef): HudItem => ({ x: d.x, y: d.y, s: 1, hidden: false });

/** Saved overrides + defaults → full layout. */
export function resolveHud(over: Settings['hud'] | undefined): HudLayout {
  const out: HudLayout = {};
  for (const d of HUD_DEFS) {
    const o = over?.[d.id]; const base = defaultItem(d);
    out[d.id] = { x: clamp01(o?.x ?? base.x), y: clamp01(o?.y ?? base.y), s: Math.min(2.5, Math.max(0.4, o?.s ?? 1)), hidden: !!o?.hidden };
  }
  return out;
}

/** Full layout → sparse overrides (only elements that differ from the defaults). */
export function diffHud(layout: HudLayout): Settings['hud'] {
  const out: Settings['hud'] = {};
  for (const [id, it] of Object.entries(layout)) {
    const d = DEF_BY_ID.get(id); if (!d) continue; const b = defaultItem(d);
    if (Math.abs(it.x - b.x) > 1e-4 || Math.abs(it.y - b.y) > 1e-4 || Math.abs(it.s - 1) > 1e-3 || it.hidden) out[id] = { x: +it.x.toFixed(4), y: +it.y.toFixed(4), s: +it.s.toFixed(2), hidden: it.hidden };
  }
  return out;
}

export const modeDefs = (mode: 'foot' | 'drive') => HUD_DEFS.filter(d => d.mode === 'both' || d.mode === mode);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
