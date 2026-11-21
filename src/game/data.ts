// Static game data: characters, vehicles, missions, world layout constants
// Works on any host path (GitHub Pages sub-folders included): never start asset URLs with '/'.
const BASE = import.meta.env.BASE_URL;
export const BLOCK = 80;
export const N = 8; // blocks per side
export const HALF = (N * BLOCK) / 2; // 320
export const ROAD_W = 16;

export const blockCenter = (bx: number, bz: number): [number, number] => [-HALF + bx * BLOCK + BLOCK / 2, -HALF + bz * BLOCK + BLOCK / 2];

export type Special = 'hospital' | 'police' | 'petrol' | 'mall' | 'park' | 'parking' | 'playground';
export const SPECIAL_BLOCKS: Record<string, Special> = {
  '1,1': 'hospital', '6,1': 'police', '2,6': 'petrol', '5,4': 'petrol',
  '4,3': 'mall', '3,4': 'park', '6,6': 'park', '1,5': 'parking', '5,6': 'playground',
};

export interface CharacterDef { id: string; name: string; female: boolean; skin: string; shirt: string; pants: string; hair: string; bio: string; file: string }
export const CHARACTERS: CharacterDef[] = [
  { id: 'rafi', name: 'Rafi Khan', female: false, skin: '#c68a5e', shirt: '#151515', pants: '#1c1c22', hair: '#120c08', bio: 'Street-smart hustler', file: BASE + 'models/Characters/x_boy.glb' },
  { id: 'arif', name: 'Arif Hasan', female: false, skin: '#a8724a', shirt: '#e8e8ea', pants: '#2a3550', hair: '#1a120a', bio: 'Tech entrepreneur', file: BASE + 'models/Characters/bc2.glb' },
  { id: 'tanvir', name: 'Tanvir Ali', female: false, skin: '#8d5a3a', shirt: '#b3202a', pants: '#222', hair: '#0a0a0a', bio: 'Racing enthusiast', file: BASE + 'models/Characters/bc3.glb' },
  { id: 'sami', name: 'Sami Roy', female: false, skin: '#d9a47a', shirt: '#1f6fd1', pants: '#3a3a3a', hair: '#3b2414', bio: 'Beach-side cool', file: BASE + 'models/Characters/bc4.glb' },
  { id: 'nadia', name: 'Nadia Rahman', female: true, skin: '#d29b74', shirt: '#e0338a', pants: '#e8e8f0', hair: '#1a0f08', bio: 'Fashion influencer', file: BASE + 'models/Characters/Y_girl.glb' },
  { id: 'mim', name: 'Mim Akter', female: true, skin: '#c18560', shirt: '#f2f2f2', pants: '#3b4a6b', hair: '#2b1a10', bio: 'Medical student', file: BASE + 'models/Characters/gc2.glb' },
  { id: 'riya', name: 'Riya Sen', female: true, skin: '#e0b090', shirt: '#c41a1a', pants: '#111', hair: '#4a2a15', bio: 'Thrill seeker', file: BASE + 'models/Characters/gc3.glb' },
  { id: 'sara', name: 'Sara Islam', female: true, skin: '#9c6644', shirt: '#1d1d1d', pants: '#242424', hair: '#0d0806', bio: 'Undercover detective', file: BASE + 'models/Characters/gc4.glb' },
];

// Mixamo animation clips shared by every character body above (see game/models.ts loadCharacter/setCharState)
export const ANIM_FILES: Record<string, string> = {
  Idle: BASE + 'models/Anims/Idle.fbx', Walk: BASE + 'models/Anims/Walk.fbx', Run: BASE + 'models/Anims/Run.fbx',
  Jump: BASE + 'models/Anims/jump.fbx', Crouch: BASE + 'models/Anims/crouch.fbx', Prone: BASE + 'models/Anims/prone.fbx',
  Death: BASE + 'models/Anims/death.fbx', Kick: BASE + 'models/Anims/kick.fbx', Punch: BASE + 'models/Anims/punch.fbx',
  Getup: BASE + 'models/Anims/Getup.fbx', StandToSit: BASE + 'models/Anims/standtosit.fbx', SitToStand: BASE + 'models/Anims/sittostand.fbx',
};

export type VType = 'sports' | 'car' | 'bike' | 'bus' | 'truck' | 'ambulance' | 'police';
export interface VehicleDef { id: string; name: string; type: VType; color: string; maxSpeed: number; accel: number; handling: number; len: number; wid: number; hgt: number; price: number }
export const VEHICLES: VehicleDef[] = [
  { id: 'sedan', name: 'Civic Line', type: 'car', color: '#d8d8dc', maxSpeed: 42, accel: 12, handling: 1.6, len: 4.4, wid: 1.9, hgt: 1.4, price: 0 },
  { id: 'hatch', name: 'Mira Hatch', type: 'car', color: '#2e7d32', maxSpeed: 38, accel: 11, handling: 1.8, len: 3.8, wid: 1.8, hgt: 1.5, price: 2500 },
  { id: 'gt', name: 'Vortex GT', type: 'sports', color: '#1e4fd8', maxSpeed: 68, accel: 22, handling: 1.9, len: 4.6, wid: 2.0, hgt: 1.15, price: 12000 },
  { id: 'fury', name: 'Fury R8', type: 'sports', color: '#d81e1e', maxSpeed: 75, accel: 25, handling: 2.0, len: 4.5, wid: 2.0, hgt: 1.1, price: 25000 },
  { id: 'bike', name: 'Dash 250', type: 'bike', color: '#ff8a00', maxSpeed: 55, accel: 20, handling: 2.4, len: 2.1, wid: 0.7, hgt: 1.1, price: 4000 },
  { id: 'cruiser', name: 'Nomad Cruiser', type: 'bike', color: '#222', maxSpeed: 48, accel: 16, handling: 2.1, len: 2.4, wid: 0.8, hgt: 1.1, price: 6500 },
  { id: 'bus', name: 'City Bus', type: 'bus', color: '#f2b705', maxSpeed: 26, accel: 6, handling: 0.9, len: 11, wid: 2.6, hgt: 3.2, price: 9000 },
  { id: 'truck', name: 'Hauler', type: 'truck', color: '#6d4c41', maxSpeed: 28, accel: 6, handling: 0.9, len: 8, wid: 2.5, hgt: 3.0, price: 8000 },
  { id: 'amb', name: 'Ambulance', type: 'ambulance', color: '#ffffff', maxSpeed: 40, accel: 11, handling: 1.3, len: 5.6, wid: 2.2, hgt: 2.6, price: 7000 },
  { id: 'cop', name: 'Interceptor', type: 'police', color: '#101820', maxSpeed: 60, accel: 18, handling: 1.7, len: 4.8, wid: 2.0, hgt: 1.45, price: 15000 },
];

export interface MissionDef { id: string; name: string; desc: string; type: 'walk' | 'drive' | 'hike'; reward: number; time?: number; points: [number, number][]; icon: string }
const hc = blockCenter(1, 1), pc = blockCenter(6, 1), pet = blockCenter(2, 6), mall = blockCenter(4, 3);
export const MISSIONS: MissionDef[] = [
  { id: 'tour', name: 'City Tour', desc: 'Walk through downtown and visit the mall, park and plaza.', type: 'walk', reward: 500, icon: '🚶', points: [[mall[0], mall[1] + 36], blockCenter(3, 4), [0, 0]] },
  { id: 'hospital', name: 'Hospital Run', desc: 'Get to the hospital within 90 seconds. Grab any vehicle!', type: 'drive', reward: 1500, time: 90, icon: '🚑', points: [[hc[0], hc[1] + 36]] },
  { id: 'fuel', name: 'Fuel Up', desc: 'Drive to the petrol station in the south-west district.', type: 'drive', reward: 400, icon: '⛽', points: [[pet[0], pet[1]]] },
  { id: 'patrol', name: 'Night Patrol', desc: 'Drive the patrol route past the police station in 150 seconds.', type: 'drive', reward: 2200, time: 150, icon: '🚓', points: [[pc[0], pc[1] + 36], [280, 0], [0, 280], [-280, 0]] },
  { id: 'hike', name: 'Summit Trail', desc: 'Hike the eastern trail and reach the mountain summit.', type: 'hike', reward: 1200, icon: '⛰️', points: [[380, -40], [440, -90], [500, -60], [560, -120]] },
  { id: 'bridge', name: 'Over The River', desc: 'Cross the southern bridge and reach the river lookout.', type: 'walk', reward: 800, icon: '🌉', points: [[0, 345], [0, 470], [60, 520]] },
];

// Hiking exploration viewpoints (free collectibles)
export const VIEWPOINTS: [number, number][] = [[420, 120], [520, 40], [600, -200], [470, -260], [-480, -420], [-120, 560]];

export const SHOP_ITEMS = [
  { id: 'med', name: 'Medkit x3', desc: 'Restore full health instantly', price: 300, currency: 'coins' as const, icon: '🩹' },
  { id: 'energy', name: 'Energy Drink x3', desc: 'Refill stamina instantly', price: 150, currency: 'coins' as const, icon: '🥤' },
  { id: 'repair', name: 'Repair Kit', desc: 'Fully repair your garage vehicle', price: 500, currency: 'coins' as const, icon: '🔧' },
  { id: 'conv', name: '5,000 Coins', desc: 'Exchange 10 gems for coins', price: 10, currency: 'gems' as const, icon: '💰' },
  { id: 'gems', name: '25 Gems (Free Demo)', desc: 'Demo build — no real payment', price: 0, currency: 'coins' as const, icon: '💎' },
];
