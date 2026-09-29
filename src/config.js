// Global tuning constants, roster and difficulty tables.

export const FIELD = {
  halfWidth: 9,       // side walls at x = ±9 (the back of each net)
  ceiling: 6.5,
  goalX: 7.6,         // goal line / front posts at x = ±7.6
  goalHeight: 2.8,
  goalDepth: 1.9,      // half extent of the goal mouth along z (visual only)
  postRadius: 0.1,
};

export const PHYS = {
  dt: 1 / 120,
  gravity: 26,          // players
  ballGravity: 21,
  ballRadius: 0.34,
  ballBounce: 0.72,
  wallBounce: 0.8,
  ballMaxSpeed: 20,
  ballAirDrag: 0.2,     // fraction of velocity lost per second in the air
  ballRollFriction: 2.4, // m/s² deceleration while rolling
  playerFriction: 14,   // ground deceleration when no input
  playerAccel: 62,
  airControl: 0.55,
  kickDuration: 0.26,
  kickWindow: [0.2, 0.75],  // fraction of kick during which the foot can hit
  chordWindow: 0.09,        // seconds after one kick key in which the other makes a power shot
  fireSpeed: 15,            // ball speed at which the fire trail appears
  powerSpeed: 30,           // launch speed of a power shot
  powerBallMax: 32,         // speed cap while the ball is on fire
};

// Power meter: fills with time and with every touch of the ball.
export const POWER = { perSecond: 0.02, perKick: 0.12, perHeader: 0.08 };

// ---- Player stat → physics mapping (stats are 1..5) ----
export const statMap = {
  headRadius: (size) => 0.47 + (size - 1) * 0.035,
  maxSpeed: (speed) => 5.7 + speed * 0.6,
  jumpVel: (jump) => 10 + jump * 0.55,
  kickPower: (power) => 10 + power * 0.85,
  headBounce: (control) => 0.82 - control * 0.04,
};

export const ROSTER = [
  {
    id: 'mbappe', name: 'Mbappé', full: 'Kylian Mbappé', number: 10, nation: 'FRA',
    colors: { jersey: '#1a2f80', accent: '#e63946', shorts: '#f1f1f1', socks: '#e63946', skin: '#8d5a3b', hair: '#1a1410', eyes: '#3b2412' },
    hair: 'buzz', beard: 'none',
    stats: { speed: 5, jump: 4, power: 4, size: 3, control: 4 },
  },
  {
    id: 'ronaldo', name: 'Ronaldo', full: 'Cristiano Ronaldo', number: 7, nation: 'POR',
    colors: { jersey: '#c8102e', accent: '#006b3f', shorts: '#0f3d2e', socks: '#c8102e', skin: '#dba784', hair: '#171310', eyes: '#3c5a3a' },
    hair: 'quiff', beard: 'none',
    stats: { speed: 4, jump: 5, power: 5, size: 4, control: 3 },
  },
  {
    id: 'messi', name: 'Messi', full: 'Lionel Messi', number: 10, nation: 'ARG',
    colors: { jersey: '#7fb8e6', accent: '#ffffff', shorts: '#12203a', socks: '#ffffff', skin: '#e8b895', hair: '#5a3a22', eyes: '#3b2a1a' },
    hair: 'short', beard: 'full',
    stats: { speed: 4, jump: 3, power: 4, size: 2, control: 5 },
  },
  {
    id: 'ronaldinho', name: 'Ronaldinho', full: 'Ronaldinho Gaúcho', number: 10, nation: 'BRA',
    colors: { jersey: '#a50044', accent: '#004d98', shorts: '#004d98', socks: '#a50044', skin: '#7b4a2d', hair: '#1c140f', eyes: '#2a1a10' },
    hair: 'headband', beard: 'goatee',
    stats: { speed: 3, jump: 4, power: 4, size: 3, control: 5 },
  },
  {
    id: 'yamal', name: 'Yamal', full: 'Lamine Yamal', number: 19, nation: 'ESP',
    colors: { jersey: '#b3151c', accent: '#f6c400', shorts: '#1c2a6b', socks: '#1c2a6b', skin: '#b07850', hair: '#171210', eyes: '#2f1d10' },
    hair: 'curly', beard: 'none',
    stats: { speed: 5, jump: 3, power: 3, size: 2, control: 5 },
  },
  {
    id: 'neymar', name: 'Neymar', full: 'Neymar Jr.', number: 10, nation: 'BRA',
    colors: { jersey: '#1f1f1f', accent: '#b6ff3b', shorts: '#1f1f1f', socks: '#b6ff3b', skin: '#c8946a', hair: '#8a5a2b', eyes: '#3a2614' },
    hair: 'mohawk', beard: 'stubble',
    stats: { speed: 5, jump: 4, power: 3, size: 3, control: 5 },
  },
  {
    id: 'haaland', name: 'Haaland', full: 'Erling Haaland', number: 9, nation: 'NOR',
    colors: { jersey: '#6cabdd', accent: '#ffffff', shorts: '#ffffff', socks: '#6cabdd', skin: '#f0c8a8', hair: '#e9d18a', eyes: '#3f7fbf' },
    hair: 'bun', beard: 'none',
    stats: { speed: 4, jump: 4, power: 5, size: 5, control: 2 },
  },
  {
    id: 'bellingham', name: 'Bellingham', full: 'Jude Bellingham', number: 5, nation: 'ENG',
    colors: { jersey: '#f4f4f4', accent: '#c9a227', shorts: '#f4f4f4', socks: '#f4f4f4', skin: '#8b5a3c', hair: '#15100c', eyes: '#2f1d10' },
    hair: 'short', beard: 'none',
    stats: { speed: 4, jump: 4, power: 4, size: 4, control: 4 },
  },
  {
    id: 'vinicius', name: 'Vinícius', full: 'Vinícius Júnior', number: 7, nation: 'BRA',
    colors: { jersey: '#ffd400', accent: '#009c3b', shorts: '#1f3fa8', socks: '#ffffff', skin: '#6f4326', hair: '#13100d', eyes: '#2a1a10' },
    hair: 'curly', beard: 'none',
    stats: { speed: 5, jump: 4, power: 3, size: 3, control: 4 },
  },
  {
    id: 'modric', name: 'Modrić', full: 'Luka Modrić', number: 10, nation: 'CRO',
    colors: { jersey: '#ffffff', accent: '#e4002b', shorts: '#ffffff', socks: '#1c3f94', skin: '#efc5a4', hair: '#c9a56a', eyes: '#4f7f9f', pattern: 'checkers' },
    hair: 'long', beard: 'stubble',
    stats: { speed: 3, jump: 3, power: 4, size: 3, control: 5 },
  },
];

export const DIFFICULTIES = [
  { level: 1, name: 'Rookie',  desc: 'Slow reactions, sloppy positioning.', reaction: 0.48, noise: 2.2, speed: 0.6, jumpP: 0.25, kickP: 0.4, idle: 0.35, powerP: 0.2 },
  { level: 2, name: 'Amateur', desc: 'Chases the ball but mistimes challenges.', reaction: 0.34, noise: 1.4, speed: 0.72, jumpP: 0.45, kickP: 0.6, idle: 0.18, powerP: 0.4 },
  { level: 3, name: 'Pro',     desc: 'Solid all round. A fair fight.', reaction: 0.22, noise: 0.85, speed: 0.85, jumpP: 0.65, kickP: 0.8, idle: 0.06, powerP: 0.6 },
  { level: 4, name: 'Star',    desc: 'Reads the ball early and punishes mistakes.', reaction: 0.13, noise: 0.42, speed: 0.95, jumpP: 0.85, kickP: 0.92, idle: 0.0, powerP: 0.8 },
  { level: 5, name: 'Legend',  desc: 'Near-perfect prediction. Good luck.', reaction: 0.08, noise: 0.15, speed: 1.0, jumpP: 0.95, kickP: 0.9, idle: 0.0, powerP: 0.95 },
];

export const CONTROLS = [
  { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'], low: ['KeyG'], high: ['KeyH'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], low: ['Slash'], high: ['Period'] },
];
export const CONTROL_LABELS = [
  { move: 'A / D', jump: 'W', low: 'G', high: 'H', power: 'G + H' },
  { move: '← / →', jump: '↑', low: '/', high: '.', power: '/ + .' },
];

export const TIME_OPTIONS = [1, 2, 3, 5];
export const GOAL_OPTIONS = [3, 5, 7, 10];

export const DEFAULT_SETTINGS = {
  p2Human: false,
  difficulty: 3,
  mode: 'time',      // 'time' | 'goals'
  minutes: 2,
  target: 5,
  goldenGoal: true,
};

export const EXPRESSIONS = ['neutral', 'focus', 'happy', 'sad', 'angry', 'shock', 'smug'];
