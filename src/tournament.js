// 8-player knockout tournament. Humans are seeded in opposite halves so two
// human players can only meet in the final. CPU-only ties are simulated.

export const ROUND_NAMES = ['Quarter-finals', 'Semi-finals', 'Final'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Tournament {
  /**
   * @param {Array<{human:number, roster:object}>} humans one or two entrants
   * @param {Array} pool full roster to draw CPU entrants from
   * @param {object} settings match settings (used for score simulation)
   */
  constructor(humans, pool, settings) {
    this.settings = settings;
    const used = new Set(humans.map((h) => h.roster.id));
    const cpuPool = shuffle(pool.filter((r) => !used.has(r.id)));
    const entrants = new Array(8).fill(null);
    entrants[0] = { roster: humans[0].roster, human: humans[0].human };
    if (humans[1]) entrants[7] = { roster: humans[1].roster, human: humans[1].human };
    for (let i = 0; i < 8; i++) if (!entrants[i]) entrants[i] = { roster: cpuPool.pop(), human: -1 };
    this.entrants = entrants;
    this.rounds = [[], [], []];
    for (let i = 0; i < 4; i++) this.rounds[0].push(this.makeMatch(0, i, entrants[i * 2], entrants[i * 2 + 1]));
    for (let i = 0; i < 2; i++) this.rounds[1].push(this.makeMatch(1, i, null, null));
    this.rounds[2].push(this.makeMatch(2, 0, null, null));
    this.roundIndex = 0;
    this.champion = null;
  }

  makeMatch(round, idx, a, b) {
    return { id: `r${round}m${idx}`, round, idx, a, b, scoreA: 0, scoreB: 0, winner: null, played: false };
  }

  isHumanMatch(m) { return !!(m.a && m.b) && (m.a.human >= 0 || m.b.human >= 0); }

  humansAlive() {
    return this.entrants.filter((e) => e.human >= 0 && this.isAlive(e));
  }

  isAlive(e) {
    for (const round of this.rounds) for (const m of round) {
      if (m.played && (m.a === e || m.b === e) && m.winner !== e) return false;
    }
    return true;
  }

  /** Simulated score for a CPU vs CPU tie. */
  simulate(m) {
    const rating = (e) => Object.values(e.roster.stats).reduce((s, v) => s + v, 0) + Math.random() * 10;
    const ra = rating(m.a), rb = rating(m.b);
    const winnerIsA = ra >= rb;
    let hi, lo;
    if (this.settings.mode === 'goals') {
      hi = this.settings.target;
      lo = Math.floor(Math.random() * this.settings.target);
    } else {
      hi = 1 + Math.floor(Math.random() * (2 + this.settings.minutes));
      lo = Math.floor(Math.random() * hi);
    }
    this.report(m, winnerIsA ? hi : lo, winnerIsA ? lo : hi);
  }

  report(m, scoreA, scoreB) {
    m.scoreA = scoreA; m.scoreB = scoreB; m.played = true;
    m.winner = scoreA > scoreB ? m.a : m.b;
    this.propagate();
  }

  propagate() {
    for (let r = 0; r < 2; r++) {
      for (const m of this.rounds[r]) {
        if (!m.played) continue;
        const next = this.rounds[r + 1][Math.floor(m.idx / 2)];
        if (m.idx % 2 === 0) next.a = m.winner; else next.b = m.winner;
      }
    }
    const final = this.rounds[2][0];
    if (final.played) this.champion = final.winner;
    // advance the round pointer
    while (this.roundIndex < 3 && this.rounds[this.roundIndex].every((m) => m.played)) this.roundIndex++;
  }

  /**
   * Returns the next match that involves a human. CPU-only matches that stand
   * in the way are simulated. Returns null when the tournament is over or no
   * human is left (call finish() to simulate the rest).
   */
  nextHumanMatch() {
    while (this.roundIndex < 3) {
      const round = this.rounds[this.roundIndex];
      const human = round.find((m) => !m.played && this.isHumanMatch(m));
      if (human) return human;
      const pending = round.filter((m) => !m.played);
      if (pending.length === 0) break;
      if (pending.some((m) => !m.a || !m.b)) break; // waiting on results (should not happen)
      for (const m of pending) this.simulate(m);
    }
    return null;
  }

  /** Simulate everything that is left. */
  finish() {
    for (const round of this.rounds) for (const m of round) if (!m.played && m.a && m.b) this.simulate(m);
    this.propagate();
    return this.champion;
  }
}
