// Controller: wires input, simulation, AI, renderer, audio and UI together.

import { ROSTER, DEFAULT_SETTINGS, PHYS, DIFFICULTIES } from './config.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Match } from './physics.js';
import { CpuBrain } from './ai.js';
import { GameRenderer, PreviewRenderer } from './render.js';
import { UI } from './ui.js';
import { Tournament, ROUND_NAMES } from './tournament.js';

const canvas = document.getElementById('game');
const audio = new AudioSys();
const input = new Input();
const ui = new UI(audio);
const renderer = new GameRenderer(canvas);
const previews = [null, null];

const app = {
  settings: { ...DEFAULT_SETTINGS },
  flow: 'quick',            // 'quick' | 'tournament'
  selection: [0, 1],
  match: null,
  brains: [null, null],
  humans: [false, false],
  demo: true,
  paused: false,
  lastParams: null,
  tournament: null,
  currentTie: null,
  tieSlots: [null, null],
  moods: [{ override: null, until: 0 }, { override: null, until: 0 }],
  resultTimer: -1,
  resultShown: false,
  lastCount: null,
  accumulator: 0,
  last: performance.now(),
  clock: 0,
  slowmo: 0,
  streak: [0, 0],
  lastWarnSec: -1,
};

const diffName = () => DIFFICULTIES[app.settings.difficulty - 1].name;

// --------------------------------------------------------------- match setup
function startDemo() {
  const a = Math.floor(Math.random() * ROSTER.length);
  let b = Math.floor(Math.random() * (ROSTER.length - 1));
  if (b >= a) b++;
  const rosters = [ROSTER[a], ROSTER[b]];
  app.match = new Match({ mode: 'goals', target: 9999, minutes: 0, goldenGoal: false }, rosters);
  app.match.countdownLen = 0.5;
  app.brains = [new CpuBrain(4, 0), new CpuBrain(4, 1)];
  app.humans = [false, false];
  app.demo = true;
  app.paused = false;
  app.resultTimer = -1;
  app.resultShown = false;
  renderer.setPlayers(rosters);
  renderer.menuOrbit = true;
  ui.setHud(false);
  ui.setHint(false);
  ui.hideBanner();
  resetMoods();
}

function startMatch(params) {
  const { rosters, humans, settings, tags } = params;
  app.lastParams = params;
  app.match = new Match(settings, rosters);
  app.brains = [0, 1].map((i) => (humans[i] ? null : new CpuBrain(settings.difficulty, i)));
  app.humans = humans;
  app.demo = false;
  app.paused = false;
  app.resultTimer = -1;
  app.resultShown = false;
  app.lastCount = null;
  app.accumulator = 0;
  app.slowmo = 0;
  app.streak = [0, 0];
  app.lastWarnSec = -1;
  input.reset();
  renderer.setPlayers(rosters);
  renderer.menuOrbit = false;
  ui.hideScreens();
  ui.setupHud(rosters, tags);
  ui.setHud(true);
  ui.setHint(true, humans[1]);
  ui.hideBanner();
  audio.unlock();
  audio.resume();
  audio.setCrowd(0.5);
  resetMoods();
}

function goToTitle() {
  startDemo();
  ui.show('title');
  audio.setCrowd(0.15);
}

// -------------------------------------------------------------------- moods
function resetMoods() {
  for (const m of app.moods) { m.override = null; m.until = 0; }
  for (const av of renderer.avatars) if (av) { av.setCelebrate('none'); av.setExpression('neutral'); }
}

function setMood(i, expr, seconds) {
  app.moods[i].override = expr;
  app.moods[i].until = app.clock + seconds;
}

function baseMood(match, i) {
  const diff = match.score[i] - match.score[1 - i];
  if (match.phase === 'ended') return match.winner === i ? 'happy' : match.winner === -1 ? 'neutral' : 'sad';
  if (match.phase === 'countdown') return diff <= -2 ? 'angry' : 'neutral';
  if (diff >= 2) return 'smug';
  if (diff <= -2) return 'angry';
  return 'focus';
}

function updateMoods() {
  const m = app.match;
  for (let i = 0; i < 2; i++) {
    const av = renderer.avatars[i];
    if (!av) continue;
    const mood = app.moods[i];
    if (mood.override && app.clock > mood.until) mood.override = null;
    av.setExpression(mood.override || baseMood(m, i));
  }
}

// ------------------------------------------------------------------- events
function handleEvents() {
  const m = app.match;
  const live = !app.demo;
  for (const ev of m.drainEvents()) {
    renderer.onEvent(ev);
    switch (ev.type) {
      case 'whistle':
        if (live) { audio.whistle(); ui.banner('GO!', '', '', 650); }
        break;
      case 'goal': {
        const s = ev.scorer, c = 1 - s;
        const name = m.players[s].roster.name;
        setMood(s, 'happy', 3.5);
        const diff = m.score[c] - m.score[s];
        setMood(c, diff <= -3 ? 'angry' : 'sad', 3.5);
        renderer.avatars[s].setCelebrate('win');
        renderer.avatars[c].setCelebrate('lose');
        app.streak[s]++; app.streak[c] = 0;
        if (live) {
          audio.goal();
          app.slowmo = 0.9;
          let sub = `${name} scores`;
          const n = app.streak[s];
          if (m.overtime) sub = `Golden goal · ${name}!`;
          else if (m.settings.mode === 'time' && m.timeLeft() < 10) sub = `Late drama! ${name}`;
          else if (m.score[s] === m.score[c]) sub = `${name} equalises!`;
          else if (n >= 4) sub = `${name} is unstoppable! ${n} in a row`;
          else if (n === 3) sub = `Hat-trick! ${name}`;
          else if (n === 2) sub = `${name} · two in a row`;
          else if (m.score[s] - m.score[c] === 1 && m.score[c] > 0) sub = `${name} takes the lead!`;
          ui.banner('GOAL!', sub, 'goal', 2200);
        }
        break;
      }
      case 'reset':
        renderer.avatars[0].setCelebrate('none');
        renderer.avatars[1].setCelebrate('none');
        if (live) ui.banner('GET READY', '', '', 1200);
        break;
      case 'overtime':
        if (live) { audio.whistle(); ui.banner('GOLDEN GOAL', 'next goal wins', 'golden', 2600); }
        setMood(0, 'shock', 1.5); setMood(1, 'shock', 1.5);
        break;
      case 'end': {
        if (ev.winner >= 0) {
          renderer.avatars[ev.winner].setCelebrate('win');
          renderer.avatars[1 - ev.winner].setCelebrate('lose');
        }
        if (live) {
          audio.whistle(true);
          const n = ev.winner >= 0 ? m.players[ev.winner].roster.name : '';
          ui.banner(ev.winner >= 0 ? 'FULL TIME' : 'DRAW', ev.winner >= 0 ? `${n} wins` : 'honours even', ev.winner >= 0 ? 'goal' : '', 2600);
          app.resultTimer = 2.8;
          const humanWon = ev.winner >= 0 && app.humans[ev.winner];
          const humanLost = ev.winner >= 0 && !app.humans[ev.winner] && app.humans.some(Boolean);
          if (humanWon || (app.humans[0] && app.humans[1])) audio.fanfare(); else if (humanLost) audio.lose();
        }
        break;
      }
      case 'kick':
        if (live) audio.kick(Math.min(1, ev.power));
        break;
      case 'bounce':
        if (live) audio.bounce(ev.strength);
        break;
      case 'post':
        if (live) audio.bounce(1);
        setMood(0, 'shock', 0.8); setMood(1, 'shock', 0.8);
        break;
      case 'head':
        if (live) audio.head(ev.strength);
        if (ev.strength > 0.6) setMood(ev.slot, 'shock', 0.5);
        break;
      case 'jump':
        if (live && app.humans[ev.slot]) audio.jump();
        break;
      case 'drop':
        if (live) { audio.whistle(); ui.banner('DROP BALL', 'ball was stuck', '', 1400); }
        break;
      case 'powershot':
        setMood(ev.slot, 'angry', 1.2);
        setMood(1 - ev.slot, 'shock', 1.2);
        if (live) { audio.power(); ui.banner('POWER SHOT!', m.players[ev.slot].roster.name, 'golden', 1000); }
        break;
      case 'knock':
        setMood(ev.slot, 'shock', 1.2);
        if (live) audio.head(1);
        break;
      case 'powerReady':
        if (live && app.humans[ev.slot]) audio.ready();
        break;
    }
  }
}

function updateTension() {
  const m = app.match;
  if (app.demo || m.settings.mode !== 'time' || m.overtime || m.phase !== 'play') return;
  const left = Math.ceil(m.timeLeft());
  if (left <= 10 && left !== app.lastWarnSec && left > 0) {
    app.lastWarnSec = left;
    if (left === 10) ui.banner('10 SECONDS', 'make it count', 'golden', 1200);
    if (left <= 5) audio.countdown(left === 1);
  }
}

function updateCountdown() {
  const m = app.match;
  if (app.demo) return;
  if (m.phase !== 'countdown' || m.countdownLen < 3) { app.lastCount = null; return; }
  const n = Math.ceil(3 - m.phaseT);
  if (n !== app.lastCount && n >= 1) {
    app.lastCount = n;
    ui.banner(String(n), n === 3 ? `${m.players[0].roster.name} vs ${m.players[1].roster.name}` : '', '', 900);
    audio.countdown(false);
  }
}

// ------------------------------------------------------------------- result
function showResult() {
  app.resultShown = true;
  const m = app.match;
  const w = m.winner;
  const names = m.players.map((p) => p.roster.name);
  let verdict, cls;
  const twoHumans = app.humans[0] && app.humans[1];
  if (w === -1) { verdict = 'DRAW'; cls = 'draw'; }
  else if (twoHumans) { verdict = `PLAYER ${w + 1} WINS`; cls = 'win'; }
  else if (app.humans[w]) { verdict = 'YOU WIN!'; cls = 'win'; }
  else { verdict = 'YOU LOSE'; cls = 'lose'; }

  let sub = `${names[0]} vs ${names[1]}`;
  let buttons;
  if (app.flow === 'tournament') {
    sub = `${ROUND_NAMES[app.currentTie.round]} · ${sub}`;
    buttons = [{ label: 'Continue', action: 'tournamentContinue', cls: 'primary big' }];
  } else {
    buttons = [
      { label: 'Rematch', action: 'rematch', cls: 'primary big' },
      { label: 'Change players', action: 'reselect' },
      { label: 'Main menu', action: 'menu', cls: 'ghost' },
    ];
  }
  ui.renderResult({ verdict, verdictCls: cls, sub, rosters: m.players.map((p) => p.roster), score: m.score, winner: w, stats: m.stats, buttons });
  ui.show('result');
}

// --------------------------------------------------------------- selection
function selectSlots() {
  const s = app.settings;
  const slot0 = { who: 'Player 1', cls: 'p1', keys: 'A / D · W / S to browse', index: app.selection[0] };
  let slot1 = null;
  if (app.flow === 'quick') {
    slot1 = s.p2Human
      ? { who: 'Player 2', cls: 'p2', keys: '← → ↑ ↓ to browse', index: app.selection[1] }
      : { who: `CPU · ${diffName()}`, cls: 'p2', keys: 'Pick the opponent', index: app.selection[1] };
  } else if (s.p2Human) {
    slot1 = { who: 'Player 2', cls: 'p2', keys: '← → ↑ ↓ to browse', index: app.selection[1] };
  }
  return [slot0, slot1];
}

function openSelect() {
  const slots = selectSlots();
  ui.renderSelect(slots, (si, ri) => {
    app.selection[si] = ri;
    ui.updateSlot(si, ri);
    if (previews[si]) previews[si].setPlayer(ROSTER[ri]);
  }, app.flow === 'tournament' ? 'Enter tournament' : 'Kick off!');
  for (let i = 0; i < 2; i++) {
    const cv = ui.previewCanvases[i];
    if (!cv || !slots[i]) continue;
    if (!previews[i]) previews[i] = new PreviewRenderer(cv);
    previews[i].setPlayer(ROSTER[app.selection[i]]);
  }
  ui.show('select');
}

function moveSelection(si, delta) {
  if (ui.current !== 'select') return;
  const slots = selectSlots();
  if (!slots[si]) return;
  const n = ROSTER.length;
  const ri = ((app.selection[si] + delta) % n + n) % n;
  app.selection[si] = ri;
  ui.updateSlot(si, ri);
  if (previews[si]) previews[si].setPlayer(ROSTER[ri]);
  audio.click();
}

function launchFromSelect() {
  const s = app.settings;
  if (app.flow === 'quick') {
    startMatch({
      rosters: [ROSTER[app.selection[0]], ROSTER[app.selection[1]]],
      humans: [true, s.p2Human],
      settings: { ...s },
      tags: ['Player 1', s.p2Human ? 'Player 2' : `CPU · ${diffName()}`],
    });
  } else {
    const humans = [{ human: 0, roster: ROSTER[app.selection[0]] }];
    if (s.p2Human) humans.push({ human: 1, roster: ROSTER[app.selection[1]] });
    app.tournament = new Tournament(humans, ROSTER, { ...s, goldenGoal: true });
    showBracket();
  }
}

// --------------------------------------------------------------- tournament
function showBracket() {
  const t = app.tournament;
  const tie = t.nextHumanMatch();
  app.currentTie = tie;
  let status, label;
  if (tie) {
    status = `${ROUND_NAMES[tie.round]}: ${tie.a.roster.name} vs ${tie.b.roster.name}`;
    label = 'Play match';
  } else if (t.champion) {
    const humanChamp = t.champion.human >= 0;
    status = humanChamp ? `Champion: Player ${t.champion.human + 1}!` : `${t.champion.roster.name} lifts the trophy.`;
    label = 'Back to menu';
  } else {
    status = 'You are out of the tournament.';
    label = 'Simulate the rest';
  }
  if (app.demo === false) startDemo();
  ui.renderBracket(t, tie, status, label);
  ui.show('bracket');
}

function playTie(tie) {
  const s = app.settings;
  const rosters = [null, null];
  const humans = [false, false];
  const slots = [null, null];
  const [a, b] = [tie.a, tie.b];
  // humans keep their own controls / side; the CPU takes the remaining slot
  const slotOf = (e, other) => (e.human >= 0 ? e.human : (other.human >= 0 ? 1 - other.human : null));
  let sa = slotOf(a, b), sb = slotOf(b, a);
  if (sa === null && sb === null) { sa = 0; sb = 1; }
  rosters[sa] = a.roster; rosters[sb] = b.roster;
  humans[sa] = a.human >= 0; humans[sb] = b.human >= 0;
  slots[sa] = a; slots[sb] = b;
  app.tieSlots = slots;
  const tags = slots.map((e) => (e.human >= 0 ? `Player ${e.human + 1}` : `CPU · ${diffName()}`));
  startMatch({ rosters, humans, settings: { ...s, goldenGoal: true }, tags });
}

// ---------------------------------------------------------------- UI wiring
ui.on('quick', () => { app.flow = 'quick'; ui.renderSetup(app.settings, { tournament: false }); ui.show('setup'); });
ui.on('tournament', () => { app.flow = 'tournament'; ui.renderSetup(app.settings, { tournament: true }); ui.show('setup'); });
ui.on('help', () => ui.show('help'));
ui.on('closeHelp', () => ui.show('title'));
ui.on('back', () => {
  if (ui.current === 'setup') ui.show('title');
  else if (ui.current === 'select') { ui.renderSetup(app.settings, { tournament: app.flow === 'tournament' }); ui.show('setup'); }
});
ui.on('setupNext', () => openSelect());
ui.on('randomAll', () => {
  const a = Math.floor(Math.random() * ROSTER.length);
  let b = Math.floor(Math.random() * (ROSTER.length - 1));
  if (b >= a) b++;
  app.selection = [a, b];
  openSelect();
});
ui.on('selectStart', () => launchFromSelect());
ui.on('bracketNext', () => {
  const t = app.tournament;
  if (app.currentTie) playTie(app.currentTie);
  else if (t.champion) goToTitle();
  else { t.finish(); showBracket(); }
});
ui.on('quitTournament', () => goToTitle());
ui.on('tournamentContinue', () => {
  const m = app.match;
  const tie = app.currentTie;
  const scoreOf = (e) => m.score[app.tieSlots.indexOf(e)];
  app.tournament.report(tie, scoreOf(tie.a), scoreOf(tie.b));
  showBracket();
});
ui.on('rematch', () => startMatch(app.lastParams));
ui.on('reselect', () => { startDemo(); openSelect(); });
ui.on('menu', () => goToTitle());
ui.on('pause', () => togglePause(true));
ui.on('resume', () => togglePause(false));
ui.on('restart', () => startMatch(app.lastParams));
ui.on('quit', () => goToTitle());

function togglePause(force) {
  if (app.demo || app.resultShown || !app.match) return;
  const next = force === undefined ? !app.paused : force;
  if (next === app.paused) return;
  app.paused = next;
  if (next) ui.show('pause'); else { ui.hideScreens(); input.reset(); }
}

input.onPress((code, e) => {
  audio.unlock();
  if (code === 'Escape' || code === 'KeyP') {
    if (ui.current === 'help') { ui.show('title'); return; }
    togglePause();
    return;
  }
  if (ui.current === 'select') {
    if (code === 'KeyA') moveSelection(0, -1);
    else if (code === 'KeyD') moveSelection(0, 1);
    else if (code === 'KeyW') moveSelection(0, -5);
    else if (code === 'KeyS') moveSelection(0, 5);
    else if (code === 'ArrowLeft') moveSelection(1, -1);
    else if (code === 'ArrowRight') moveSelection(1, 1);
    else if (code === 'ArrowUp') moveSelection(1, -5);
    else if (code === 'ArrowDown') moveSelection(1, 5);
    else if (code === 'Enter' || code === 'Space') { e.preventDefault(); audio.click(); launchFromSelect(); }
  } else if (ui.current === 'title' && (code === 'Enter' || code === 'Space')) {
    ui.emit('quick');
  } else if (ui.current === 'result' && code === 'Enter') {
    const first = document.querySelector('#result-body [data-action]');
    if (first) first.click();
  }
});

document.addEventListener('visibilitychange', () => { if (document.hidden) togglePause(true); });

// --------------------------------------------------------------------- loop
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - app.last) / 1000;
  app.last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;

  const m = app.match;
  if (m && !app.paused) {
    app.clock += dt;
    // slow motion right after a goal (wall-clock controlled)
    let simDt = dt;
    if (app.slowmo > 0) { app.slowmo -= dt; simDt = dt * 0.3; }
    app.accumulator += simDt;
    let steps = 0;
    while (app.accumulator >= PHYS.dt && steps < 8) {
      const commands = [0, 1].map((i) => (app.humans[i] ? input.commandFor(i) : app.brains[i].decide(m, PHYS.dt)));
      m.step(commands);
      app.accumulator -= PHYS.dt;
      steps++;
    }
    handleEvents();
    updateCountdown();
    updateTension();
    updateMoods();
    if (!app.demo) {
      ui.updateHud(m);
      if (app.resultTimer > 0) {
        app.resultTimer -= dt;
        if (app.resultTimer <= 0 && !app.resultShown) showResult();
      }
    }
    renderer.update(m, app.slowmo > 0 ? dt * 0.3 : dt);
  } else if (m) {
    renderer.update(m, 0);
  }

  if (ui.current === 'select') {
    for (const p of previews) if (p) p.render(dt);
  }
}

// debugging hook (harmless in production)
window.__hs3d = { app, ui, renderer, startMatch, ROSTER };

async function boot() {
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* ignore */ }
  goToTitle();
  requestAnimationFrame((t) => { app.last = t; frame(t); });
}

boot();
