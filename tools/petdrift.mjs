#!/usr/bin/env node
// petdrift.mjs — find the FIRST step where our pet stands somewhere C's
// recorded screen doesn't show it.
//
// The dog_move silent-drift family diverges long after the positions
// actually split, because both streams keep drawing the same same-argument
// rolls. The recording carries ground truth the RNG stream hides: every
// step's SCREEN shows the pet's glyph. This decodes each recorded frame,
// reads our pet's position at the same step from the live game via the
// __step_snapshot seam, and reports every step where ours is off-screen.
//
// Usage: node tools/petdrift.mjs <session> [glyphchars]   (default "dfu")
// Drift lines go to stderr; pipe stdout to /dev/null to see them alone.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const { decodeScreen } =
    await import(pathToFileURL(join(PROJECT_ROOT, 'frozen/screen-decode.mjs')));

const arg = process.argv[2];
if (!arg) {
    console.error('usage: node tools/petdrift.mjs <session> [glyphchars]');
    process.exit(2);
}
const petchars = (process.argv[3] || 'dfu').split('');
const sessPath = arg.includes('/') ? arg : join(PROJECT_ROOT, 'sessions', arg);
const sess = JSON.parse(readFileSync(sessPath, 'utf8'));
const seg = (sess.segments ?? [sess])[0];

function recordedPets(stepIdx) {
    const scr = seg.steps[stepIdx]?.screen;
    if (!scr) return null;
    let grid;
    try { grid = decodeScreen(scr); } catch { return null; }
    const out = [];
    let hero = null;
    for (let r = 1; r <= 21 && r < grid.length; r++) {
        const row = grid[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
            const ch = row[c]?.ch;
            if (ch && petchars.includes(ch))
                out.push({ x: c + 1, y: r - 1, ch }); /* tty col = map x-1 */
            else if (ch === '@')
                hero = { x: c + 1, y: r - 1 };
        }
    }
    out.hero = hero;
    return out;
}

let firstDrift = -1, reports = 0, prevMiss = false;
const capture = (g, step) => {
    if (firstDrift >= 0 && step > firstDrift + 6)
        return; /* stop re-arming: enough context reported */
    const pets = (g.level?.monsters ?? [])
        .filter(m => m.mhp > 0 && (m.mtame || m.edog))
        .map(m => ({ x: m.mx, y: m.my,
                     n: g.mons[m.mnum]?.pmnames?.filter(Boolean)[0] }));
    const rec = recordedPets(step);
    /* only judge frames whose @ sits where OUR hero is: menus, overview
       maps and mid-run transients all fail that gate */
    if (rec && pets.length && rec.hero
        && rec.hero.x === g.u.ux && rec.hero.y === g.u.uy) {
        let missNow = false;
        for (const p of pets) {
            if (!rec.some(r => r.x === p.x && r.y === p.y) && rec.length) {
                missNow = true;
                /* a single-step miss is usually a run/occupation display
                   transient; only a SECOND consecutive miss is drift */
                if (prevMiss) {
                    console.error(`DRIFT step ${step}: our ${p.n} at (${p.x},${
                        p.y}); recorded: ${
                        rec.map(r => `${r.ch}@(${r.x},${r.y})`).join(' ')}`);
                    if (firstDrift < 0) firstDrift = step;
                    reports++;
                }
            }
        }
        prevMiss = missNow;
    }
    const next = step + 1;
    if (next < seg.steps.length)
        globalThis.__step_snapshot = { step: next, cb: capture };
    else
        summary();
};
function summary() {
    console.error(firstDrift < 0
        ? 'petdrift: no pet-position drift against recorded screens'
        : `petdrift: FIRST DRIFT at step ${firstDrift} (${reports} reports)`);
}
globalThis.__step_snapshot = { step: 1, cb: capture };
process.argv = [process.argv[0], 'x', sessPath];
await import(pathToFileURL(join(PROJECT_ROOT, 'tools/diverge.mjs')));
if (firstDrift >= 0) summary();
