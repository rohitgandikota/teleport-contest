#!/usr/bin/env node
// render.mjs — Render recorded session screens as plain 24x80 text.
//
// Decodes the session screen serialization (the same one the scorer
// compares): '\n' line separators, '\x1b[NC' cursor-forward runs,
// SGR color escapes (stripped here), and '\x0e'/'\x0f' shift-in/out
// for the DEC line-drawing charset (mapped to Unicode box glyphs).
//
// Usage:
//   node tools/gen-sessions/render.mjs <session.json> [step|all|last|msgs] [segIdx]
//
//   step N      render step N of the segment (default: last)
//   all         render every step
//   last        render the final step (default)
//   msgs        one line per step: step index, key, row-0 message text
//
// Useful while iterating on a recipe's key plan: record, then look at
// what the game actually showed at each input boundary.

import { promises as fs } from 'node:fs';
import { decodeScreen } from './screen-decode.mjs';

function keyName(k) {
    if (k == null) return '(start)';
    const code = k.codePointAt(0);
    if (k === '\x1b') return 'ESC';
    if (k === '\r') return 'RET';
    if (k === '\n') return 'RET';
    if (k === ' ') return 'SPC';
    if (k === '\x7f') return 'DEL';
    if (code < 32) return '^' + String.fromCharCode(code + 64);
    return k;
}

function renderStep(seg, idx) {
    const step = seg.steps[idx];
    if (!step) { console.log(`(no step ${idx})`); return; }
    const rows = decodeScreen(step.screen);
    const [cx, cy, vis] = step.cursor || [0, 0, 0];
    console.log(`--- step ${idx}  key=${keyName(step.key)}  cursor=[${cx},${cy},${vis}]  rng=${(step.rng || []).length} ---`);
    console.log('    ' + '0123456789'.repeat(8));
    rows.forEach((r, y) => {
        let line = r;
        if (vis && y === cy) {
            line = r.slice(0, cx) + '█' + r.slice(cx + 1);
        }
        console.log(String(y).padStart(2) + '  |' + line + '|');
    });
}

async function main() {
    const [file, what = 'last', segIdxArg = '0'] = process.argv.slice(2);
    if (!file) {
        console.error('Usage: node tools/gen-sessions/render.mjs <session.json> [stepN|all|last|msgs] [segIdx]');
        process.exit(2);
    }
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    const segments = data.segments || [data];
    const segIdx = parseInt(segIdxArg, 10) || 0;
    const seg = segments[segIdx];
    if (!seg) { console.error(`no segment ${segIdx}`); process.exit(1); }
    console.log(`# ${file} seg ${segIdx}/${segments.length}: seed=${seg.seed} steps=${seg.steps.length} moves=${(seg.moves || '').length}`);
    if (what === 'msgs') {
        seg.steps.forEach((s, i) => {
            const row0 = decodeScreen(s.screen)[0].trimEnd();
            console.log(String(i).padStart(3) + '  ' + keyName(s.key).padEnd(7) + ' |' + row0);
        });
    } else if (what === 'all') {
        seg.steps.forEach((_, i) => renderStep(seg, i));
    } else if (what === 'last') {
        renderStep(seg, seg.steps.length - 1);
    } else {
        renderStep(seg, parseInt(what, 10) || 0);
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
