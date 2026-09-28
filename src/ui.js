// DOM layer: screens, HUD, banners, setup/select/bracket/result rendering.
// Emits high-level actions back to the controller through `on(action, fn)`.

import { ROSTER, DIFFICULTIES, TIME_OPTIONS, GOAL_OPTIONS } from './config.js';
import { portrait } from './faces.js';
import { ROUND_NAMES } from './tournament.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

const STAT_LABELS = [['speed', 'Speed'], ['jump', 'Jump'], ['power', 'Power'], ['size', 'Head'], ['control', 'Control']];

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.handlers = new Map();
    this.screens = ['title', 'setup', 'select', 'bracket', 'pause', 'result', 'help'];
    this.current = 'title';
    this.bannerTimer = null;
    this.previewCanvases = [null, null];

    // generic action buttons
    document.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      this.audio.unlock();
      this.audio.resume();
      this.audio.click();
      this.emit(b.dataset.action, b.dataset);
    });
    document.body.addEventListener('mouseover', (e) => {
      if (e.target.closest('.btn, .seg button, .roster button')) this.audio.hover();
    });
    $('#btn-mute').addEventListener('click', () => {
      const muted = this.audio.toggleMute();
      $('#btn-mute').textContent = muted ? '🔇' : '🔊';
    });
    $('#btn-mute').textContent = this.audio.muted ? '🔇' : '🔊';
    $('#btn-pause').addEventListener('click', () => this.emit('pause'));
  }

  on(action, fn) { this.handlers.set(action, fn); }
  emit(action, data) { const fn = this.handlers.get(action); if (fn) fn(data); }

  show(name) {
    for (const s of this.screens) $(`#screen-${s}`).classList.toggle('hidden', s !== name);
    this.current = name;
  }
  hideScreens() { this.show(null); }
  isMenuVisible() { return this.current !== null && this.current !== 'pause' && this.current !== 'result'; }

  // ------------------------------------------------------------------ HUD
  setHud(visible) { $('#hud').classList.toggle('hidden', !visible); }
  setHint(visible, twoPlayers) {
    $('#hint').classList.toggle('hidden', !visible);
    $('#hint-p2').style.display = twoPlayers ? '' : 'none';
    if (visible) {
      $('#hint').style.opacity = '1';
      clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => { $('#hint').style.opacity = '0'; }, 6000);
    }
  }

  setupHud(rosters, tags) {
    for (let i = 0; i < 2; i++) {
      $(`#hud-portrait-${i}`).src = portrait(rosters[i], 'neutral', 128);
      $(`#hud-name-${i}`).textContent = rosters[i].name;
      $(`#hud-tag-${i}`).textContent = tags[i];
    }
    this.lastScore = [0, 0];
  }

  updateHud(match) {
    for (let i = 0; i < 2; i++) {
      const e = $(`#hud-score-${i}`);
      if (this.lastScore[i] !== match.score[i]) {
        e.textContent = match.score[i];
        e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop');
        this.lastScore[i] = match.score[i];
      }
    }
    const t = $('#hud-timer');
    const s = match.settings;
    if (s.mode === 'time') {
      const left = match.overtime ? match.time - s.minutes * 60 : match.timeLeft();
      const m = Math.floor(left / 60), sec = Math.floor(left % 60);
      t.textContent = (match.overtime ? '+' : '') + `${m}:${sec.toString().padStart(2, '0')}`;
      t.classList.toggle('warn', !match.overtime && left <= 10 && match.phase === 'play');
      $('#hud-rule').textContent = match.overtime ? 'GOLDEN GOAL' : `${s.minutes} min · most goals wins${s.goldenGoal ? ' · golden goal if tied' : ''}`;
    } else {
      const m = Math.floor(match.time / 60), sec = Math.floor(match.time % 60);
      t.textContent = `${m}:${sec.toString().padStart(2, '0')}`;
      t.classList.remove('warn');
      $('#hud-rule').textContent = `First to ${s.target} goals`;
    }
  }

  // --------------------------------------------------------------- banner
  banner(main, sub = '', cls = '', duration = 1200) {
    const b = $('#banner');
    b.classList.remove('hidden', 'out');
    const m = $('#banner-main');
    m.textContent = main;
    m.className = 'banner-main ' + cls;
    $('#banner-sub').textContent = sub;
    // restart animation
    m.style.animation = 'none'; void m.offsetWidth; m.style.animation = '';
    clearTimeout(this.bannerTimer);
    if (duration > 0) {
      this.bannerTimer = setTimeout(() => {
        b.classList.add('out');
        this.bannerTimer = setTimeout(() => b.classList.add('hidden'), 350);
      }, duration);
    }
  }
  hideBanner() { clearTimeout(this.bannerTimer); $('#banner').classList.add('hidden'); }

  // ---------------------------------------------------------------- setup
  renderSetup(settings, { tournament }) {
    $('#setup-title').textContent = tournament ? 'Tournament Setup' : 'Match Setup';
    const body = $('#setup-body');
    body.innerHTML = '';

    const seg = (options, value, onPick, cls = '') => {
      const wrap = el('div', 'seg ' + cls);
      for (const o of options) {
        const b = el('button', o.value === value ? 'on' : '', o.label);
        b.addEventListener('click', () => {
          this.audio.click();
          onPick(o.value);
          [...wrap.children].forEach((c, i) => c.classList.toggle('on', options[i].value === o.value));
        });
        wrap.appendChild(b);
      }
      return wrap;
    };
    const field = (label, small, node, desc) => {
      const f = el('div', 'field');
      f.appendChild(el('div', 'field-label', `<span>${label}</span>${small ? `<small>${small}</small>` : ''}`));
      f.appendChild(node);
      if (desc) f.appendChild(desc);
      return f;
    };

    // players
    const playersSeg = seg([
      { value: false, label: tournament ? '1 Player' : '1 Player vs CPU' },
      { value: true, label: tournament ? '2 Players' : '2 Players (local)' },
    ], settings.p2Human, (v) => { settings.p2Human = v; diffField.style.display = ''; });
    body.appendChild(field('Players', tournament ? 'Player 2 joins the same bracket' : 'Share one keyboard', playersSeg));

    // difficulty (always shown: tournaments always contain CPU opponents)
    const desc = el('div', 'desc', DIFFICULTIES[settings.difficulty - 1].desc);
    const diffSeg = seg(DIFFICULTIES.map((d) => ({ value: d.level, label: `${d.name}<span class="stars">${'★'.repeat(d.level)}${'☆'.repeat(5 - d.level)}</span>` })), settings.difficulty, (v) => {
      settings.difficulty = v;
      desc.textContent = DIFFICULTIES[v - 1].desc;
    }, 'levels');
    const diffField = field('CPU difficulty', '5 levels', diffSeg, desc);
    body.appendChild(diffField);

    // win condition
    const modeWrap = el('div');
    const modeSeg = seg([
      { value: 'time', label: '⏱ Most goals in a time limit' },
      { value: 'goals', label: '🎯 First to reach a goal count' },
    ], settings.mode, (v) => { settings.mode = v; refreshMode(); });
    modeWrap.appendChild(modeSeg);
    const timeOpts = el('div', 'seg');
    const timeSeg = seg(TIME_OPTIONS.map((m) => ({ value: m, label: `${m} min` })), settings.minutes, (v) => { settings.minutes = v; });
    timeOpts.appendChild(timeSeg);
    const golden = el('label', 'toggle' + (settings.goldenGoal ? ' on' : ''), '<span class="sw"></span><span>Golden goal if tied at full time</span>');
    golden.addEventListener('click', () => { settings.goldenGoal = !settings.goldenGoal; golden.classList.toggle('on', settings.goldenGoal); this.audio.click(); });
    const goalSeg = seg(GOAL_OPTIONS.map((g) => ({ value: g, label: `${g} goals` })), settings.target, (v) => { settings.target = v; });
    const sub = el('div');
    sub.style.marginTop = '12px';
    sub.style.display = 'grid';
    sub.style.gap = '10px';
    sub.append(timeOpts, golden, goalSeg);
    const refreshMode = () => {
      const isTime = settings.mode === 'time';
      timeOpts.style.display = isTime ? '' : 'none';
      golden.style.display = isTime ? '' : 'none';
      goalSeg.style.display = isTime ? 'none' : '';
    };
    refreshMode();
    modeWrap.appendChild(sub);
    body.appendChild(field('Win condition', '', modeWrap));
  }

  // --------------------------------------------------------------- select
  /**
   * slots: [{who:'Player 1', cls:'p1', keys, human:true, index}, {…} | null]
   * onChange(slotIdx, rosterIdx)
   */
  renderSelect(slots, onChange, startLabel = 'Kick off!') {
    const body = $('#select-body');
    body.innerHTML = '';
    this.slotEls = [];
    $('#btn-select-start').textContent = startLabel;
    slots.forEach((slot, si) => {
      if (!slot) return;
      const box = el('div', 'slot' + (slots.filter(Boolean).length === 1 ? ' single' : ''));
      box.appendChild(el('div', 'slot-head', `<span class="who ${slot.cls}">${slot.who}</span><span class="keys">${slot.keys || ''}</span>`));
      const prev = el('div', 'preview');
      // one persistent canvas per slot so WebGL contexts are reused
      const canvas = this.previewCanvases[si] || document.createElement('canvas');
      prev.appendChild(canvas);
      this.previewCanvases[si] = canvas;
      box.appendChild(prev);
      const info = el('div', 'info');
      box.appendChild(info);
      const grid = el('div', 'roster');
      box.appendChild(grid);
      const buttons = ROSTER.map((r, ri) => {
        const b = el('button', ri === slot.index ? `on ${slot.cls}` : '');
        b.innerHTML = `<img src="${portrait(r, 'neutral', 96)}" alt="${r.name}"><span>${r.name}</span>`;
        b.addEventListener('click', () => { this.audio.click(); onChange(si, ri); });
        grid.appendChild(b);
        return b;
      });
      body.appendChild(box);
      this.slotEls[si] = { info, buttons, cls: slot.cls };
      this.updateSlot(si, slot.index);
    });
  }

  updateSlot(si, ri) {
    const s = this.slotEls[si];
    if (!s) return;
    const r = ROSTER[ri];
    s.buttons.forEach((b, i) => { b.className = i === ri ? `on ${s.cls}` : ''; });
    s.info.innerHTML = `<div class="name">${r.full}</div><div class="sub">${r.nation} · #${r.number}</div>` +
      STAT_LABELS.map(([k, label]) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${r.stats[k] * 20}%"></i></div><span>${r.stats[k]}</span></div>`).join('');
  }

  // -------------------------------------------------------------- bracket
  renderBracket(t, nextMatch, status, nextLabel) {
    const body = $('#bracket-body');
    body.innerHTML = '';
    t.rounds.forEach((round, ri) => {
      const col = el('div', 'round');
      col.appendChild(el('h3', '', ROUND_NAMES[ri]));
      for (const m of round) {
        const tie = el('div', 'tie' + (m === nextMatch ? ' next' : ''));
        for (const side of ['a', 'b']) {
          const e = m[side];
          const team = el('div', 'team');
          if (!e) {
            team.classList.add('tbd');
            team.innerHTML = '<img alt=""><span class="n">TBD</span><span class="s"></span>';
          } else {
            const score = side === 'a' ? m.scoreA : m.scoreB;
            if (m.played) team.classList.add(m.winner === e ? 'win' : 'lose');
            const cls = e.human === 0 ? 'human' : e.human === 1 ? 'human2' : '';
            const tag = e.human === 0 ? ' (P1)' : e.human === 1 ? ' (P2)' : '';
            team.innerHTML = `<img src="${portrait(e.roster, m.played && m.winner !== e ? 'sad' : 'neutral', 64)}" alt=""><span class="n ${cls}">${e.roster.name}${tag}</span><span class="s">${m.played ? score : ''}</span>`;
          }
          tie.appendChild(team);
        }
        col.appendChild(tie);
      }
      body.appendChild(col);
    });
    if (t.champion) {
      const c = el('div', 'champion');
      c.style.gridColumn = '1 / -1';
      c.style.textAlign = 'center';
      c.innerHTML = `🏆 ${t.champion.roster.full} is the champion!`;
      body.appendChild(c);
    }
    $('#bracket-status').textContent = status;
    $('#btn-bracket-next').textContent = nextLabel;
  }

  // --------------------------------------------------------------- result
  renderResult({ verdict, verdictCls, sub, rosters, score, winner, stats, buttons }) {
    const body = $('#result-body');
    body.innerHTML = '';
    body.appendChild(el('div', 'muted', sub || ''));
    body.appendChild(el('div', `verdict ${verdictCls}`, verdict));
    const fin = el('div', 'final');
    const face = (i) => `<div><img class="${winner === i ? 'winner' : ''}" src="${portrait(rosters[i], winner === i ? 'happy' : winner === -1 ? 'neutral' : 'sad', 128)}" alt=""><div class="pname">${rosters[i].name}</div></div>`;
    fin.innerHTML = `${face(0)}<div class="score">${score[0]} – ${score[1]}</div>${face(1)}`;
    body.appendChild(fin);
    if (stats) {
      const poss = stats.possession[0] + stats.possession[1] || 1;
      body.appendChild(el('div', 'stats',
        `<span>Kicks <b>${stats.kicks[0]}</b> · <b>${stats.kicks[1]}</b></span>` +
        `<span>Headers <b>${stats.headers[0]}</b> · <b>${stats.headers[1]}</b></span>` +
        `<span>Ball side <b>${Math.round((stats.possession[0] / poss) * 100)}%</b> · <b>${Math.round((stats.possession[1] / poss) * 100)}%</b></span>`));
    }
    const menu = el('div', 'menu');
    for (const b of buttons) {
      const btn = el('button', `btn ${b.cls || ''}`, b.label);
      btn.dataset.action = b.action;
      menu.appendChild(btn);
    }
    body.appendChild(menu);
  }
}
