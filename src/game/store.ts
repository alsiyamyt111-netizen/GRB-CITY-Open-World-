// Persistent profile & settings (localStorage save/load)
import { CHARACTERS } from './data';

export type Preset = 'low' | 'medium' | 'high' | 'ultra';
export interface HudItem { x: number; y: number; s: number; hidden: boolean } // x,y = centre as a 0..1 fraction of the screen, s = scale
export interface Settings { preset: Preset; sfx: number; ambient: number; sensitivity: number; showFps: boolean; dayLength: number; vibrate: boolean; hud: Record<string, Partial<HudItem>> } // hud = only the elements the player changed
export interface Custom { skin: string; shirt: string; pants: string; hair: string; hat: boolean }
export interface Profile {
  name: string; money: number; gems: number; xp: number; level: number;
  charId: string; custom: Record<string, Custom>;
  owned: string[]; selectedVehicle: string; vehicleDamage: Record<string, number>; vehicleColor: Record<string, string>;
  completed: string[]; viewpoints: number[]; medkits: number; energy: number;
  settings: Settings; savedPos?: { x: number; z: number; time: number }; weapon: string;
}

const KEY = 'richcity_save_v1';
export const defaultSettings: Settings = { preset: 'medium', sfx: 0.7, ambient: 0.5, sensitivity: 1, showFps: false, dayLength: 8, vibrate: true, hud: {} };

export function newProfile(): Profile {
  return { name: 'Player', money: 10000, gems: 50, xp: 0, level: 1, charId: CHARACTERS[0].id, custom: {}, owned: ['sedan', 'bike'], selectedVehicle: 'sedan', vehicleDamage: {}, vehicleColor: {}, completed: [], viewpoints: [], medkits: 1, energy: 1, settings: { ...defaultSettings, hud: {} }, weapon: 'fist' };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const p = JSON.parse(raw); return { ...newProfile(), ...p, settings: { ...defaultSettings, ...p.settings } }; }
  } catch { /* ignore corrupt saves */ }
  return newProfile();
}
export function saveProfile(p: Profile) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* quota */ } }
export function hasSave() { return !!localStorage.getItem(KEY); }
export function resetSave() { localStorage.removeItem(KEY); }

export function getLook(p: Profile) {
  const c = CHARACTERS.find(c => c.id === p.charId) || CHARACTERS[0];
  const cu = p.custom[c.id];
  return { female: c.female, skin: cu?.skin ?? c.skin, shirt: cu?.shirt ?? c.shirt, pants: cu?.pants ?? c.pants, hair: cu?.hair ?? c.hair, hat: cu?.hat ?? false };
}
export function addXp(p: Profile, xp: number) { p.xp += xp; while (p.xp >= p.level * 1000) { p.xp -= p.level * 1000; p.level++; } }
