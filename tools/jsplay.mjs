#!/usr/bin/env node
// jsplay.mjs — run our port over one recorded session and look at OUR side.
//
// diverge.mjs shows C's call-site annotation for every draw, but when the
// port draws something C never drew there is no C line to blame and the
// frozen runner only reports the mismatch. This replays a session through
// the same NethackGame/GameDisplay path the runner uses and prints, from the
// port's own run: the JS stack at a given RNG index (js/rng.js's
// __rng_stack_at hook), the decoded screen after the last processed step,
// and hero/level state. Keys beyond --until are withheld so the game stops
// exactly where you want to look.
//
//   node tools/jsplay.mjs <session.json> [--seg N] [--until STEP]
//                          [--rng-at INDEX] [--screen] [--state]
//
// --rng-at counts draws within the chosen segment, 0-based, the same index
// diverge.mjs prints for a single-segment session.

import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const sessionPath = args.find((a) => a.endsWith('.json'));
if (!sessionPath) { console.error('usage: node tools/jsplay.mjs <session.json> [--seg N] [--until STEP] [--rng-at INDEX] [--screen] [--state]'); process.exit(2); }

const { NethackGame, runSegment } = await import(pathToFileURL(join(ROOT, 'js/jsmain.js')).href);
const { GameDisplay } = await import(pathToFileURL(join(ROOT, 'js/game_display.js')).href);
const { moveloop_core } = await import(pathToFileURL(join(ROOT, 'js/allmain.js')).href);
/* keep the namespace: destructuring copies the current value of `game`,
   and resetGame() replaces the object when the game starts */
const gstate = await import(pathToFileURL(join(ROOT, 'js/gstate.js')).href);
const C = await import(pathToFileURL(join(ROOT, 'js/const.js')).href);
const { decodeScreen } = await import(pathToFileURL(join(ROOT, 'tools/gen-sessions/screen-decode.mjs')).href);

const session = JSON.parse(readFileSync(sessionPath, 'utf8'));
const segIdx = Number(opt('--seg', 0));
const seg = session.segments[segIdx];
const until = flag('--until') ? Number(opt('--until')) : (seg.moves || '').length;

const store = new Map();
const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
    clear: () => store.clear(),
};

for (let i = 0; i < segIdx; i++) {
    const s = session.segments[i];
    await runSegment({ seed: s.seed, datetime: s.datetime, nethackrc: s.nethackrc, moves: s.moves, storage });
}

if (flag('--rng-at')) globalThis.__rng_stack_at = Number(opt('--rng-at'));

const moves = (seg.moves || '').slice(0, until);
const nhGame = new NethackGame({ seed: seg.seed, datetime: seg.datetime, nethackrc: seg.nethackrc, storage });
const display = new GameDisplay(null);
display.onEmptyQueue = () => { throw new Error('Input queue empty'); };
nhGame._pendingDisplay = display;
for (const ch of moves) display.pushKey(ch.charCodeAt(0));

let stopped = '';
try {
    await nhGame.start();
    for (let iter = 0; iter < Math.max(moves.length * 8, 1024); iter++) {
        try {
            await moveloop_core();
        } catch (e) {
            if (e && e.__nh_gameover) continue;
            if (String(e?.message || '').includes('Input queue empty')) { stopped = 'queue empty'; break; }
            throw e;
        }
    }
} catch (e) {
    stopped = `threw: ${e?.message}\n${(e?.stack || '').split('\n').slice(1, 8).join('\n')}`;
}

const screens = nhGame.getScreens();
const rng = nhGame.getRngLog() || [];
console.log(`segment ${segIdx}: fed ${moves.length} keys, recorded ${screens.length} screens, ${rng.length} rng draws${stopped ? `, stopped: ${stopped}` : ''}`);

if (flag('--screen')) {
    const raw = display.term?.serialize ? display.term.serialize() : screens[screens.length - 1];
    const rows = decodeScreen(raw);
    (Array.isArray(rows) ? rows : String(rows).split('\n')).forEach((r, i) => console.log(`${String(i).padStart(2)} |${r}`));
}

if (flag('--state')) {
    const game = gstate.game;
    const u = game.u || {};
    console.log(`hero (${u.ux},${u.uy}) uac=${u.uac} uhp=${u.uhp} moves=${game.moves} uz=${JSON.stringify(u.uz)}`);
    console.log('level.flags:', JSON.stringify(game.level?.flags || {}));
    const counts = {};
    for (let x = 1; x < C.COLNO; x++) {
        for (let y = 0; y < C.ROWNO; y++) {
            const loc = game.level?.at?.(x, y) ?? game.level?.locations?.[x]?.[y];
            if (!loc) continue;
            if (loc.typ === C.FOUNTAIN || loc.typ === C.SINK || loc.typ === C.ALTAR || loc.typ === C.THRONE)
                console.log(`  feature typ=${loc.typ} at (${x},${y})`);
            counts[loc.typ] = (counts[loc.typ] || 0) + 1;
        }
    }
    console.log('typ histogram:', JSON.stringify(counts));
}
