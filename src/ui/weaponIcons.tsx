import type { WeaponId } from '../game/weapons';

/** Weapon silhouette drawn in a 100×50 box, filled with currentColor. Usable inside any <svg>. */
export function WeaponGlyph({ id }: { id: WeaponId }) {
  switch (id) {
    case 'pistol': return <g fill="currentColor"><rect x="14" y="10" width="64" height="13" rx="2.5" /><path d="M22 23h34l-3 8-4 15H33l2-15-1-8z" transform="translate(-4 0)" /><rect x="66" y="23" width="10" height="4" /><rect x="10" y="13" width="5" height="4" /></g>;
    case 'rifle': return <g fill="currentColor"><path d="M4 15l16 2v12L8 33z" /><rect x="20" y="17" width="48" height="11" rx="2" /><rect x="40" y="9" width="14" height="8" rx="1" /><rect x="68" y="19" width="28" height="4" /><path d="M42 28h10l5 18H46z" /><path d="M28 28h8l-2 12h-7z" /><rect x="58" y="13" width="10" height="4" /></g>;
    case 'sniper': return <g fill="currentColor"><path d="M2 20l18 1v10L6 36z" /><rect x="20" y="22" width="54" height="8" rx="1.5" /><rect x="74" y="24" width="24" height="3.5" /><rect x="30" y="10" width="28" height="7" rx="3" /><rect x="34" y="17" width="3" height="5" /><rect x="52" y="17" width="3" height="5" /><path d="M42 30l-6 14M48 30l4 14" stroke="currentColor" strokeWidth="2.5" fill="none" /></g>;
    case 'knife': return <g fill="currentColor"><path d="M10 42L64 12l6 6-42 28z" /><path d="M62 10l24-6 4 8-22 12z" opacity=".75" /></g>;
    case 'grenade': return <g fill="currentColor"><ellipse cx="50" cy="29" rx="15" ry="17" /><rect x="44" y="6" width="12" height="8" rx="1.5" /><path d="M56 8l16 4-2 5-14-3z" /></g>;
    case 'bomb': return <g fill="currentColor"><circle cx="46" cy="30" r="17" /><path d="M58 17l8-8 6 2" stroke="currentColor" strokeWidth="3.5" fill="none" /><circle cx="76" cy="10" r="3.5" opacity=".7" /></g>;
    case 'mine': return <g fill="currentColor"><ellipse cx="50" cy="32" rx="30" ry="11" /><ellipse cx="50" cy="26" rx="30" ry="11" opacity=".8" /><ellipse cx="50" cy="24" rx="12" ry="4" opacity=".5" /></g>;
    default: return <text x="50" y="41" textAnchor="middle" fontSize="40">👊</text>;
  }
}

export function WeaponIcon({ id, className }: { id: WeaponId; className?: string }) {
  return <svg viewBox="0 0 100 50" className={className} aria-hidden><WeaponGlyph id={id} /></svg>;
}
