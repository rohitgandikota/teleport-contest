#!/usr/bin/env node
// screendiff.mjs — Show exactly which cells of a rendered frame disagree with
// the C reference.
//
// Uses frozen/screen-decode.mjs, the same decoder and per-cell comparator the
// scorer uses, so "no differences here" means the scorer agrees.
//
// Usage:
//   node tools/screendiff.mjs <session> <step>   # a specific boundary
//   node tools/screendiff.mjs <session> --first  # first mismatching boundary
//   node tools/screendiff.mjs <session>          # same as --first
//
// Exit status: 0 when the frame matches, 1 when it does not, 2 on error.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SESSIONS_DIR = join(PROJECT_ROOT, 'sessions');

const T = process.stdout.isTTY
    ? { dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m',
        bold: '\x1b[1m', off: '\x1b[0m' }
    : { dim: '', red: '', green: '', cyan: '', bold: '', off: '' };

function resolveSession(arg) {
    if (arg.includes('/') || arg.endsWith('.session.json')) {
        const p = arg.startsWith('/') ? arg : join(PROJECT_ROOT, arg);
        if (existsSync(p) && statSync(p).isFile()) return p;
    }
    const all = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.session.json'));
    const exact = all.find(f => f === `${arg}.session.json`);
    if (exact) return join(SESSIONS_DIR, exact);
    const hits = all.filter(f => f.startsWith(arg));
    if (hits.length === 1) return join(SESSIONS_DIR, hits[0]);
    if (hits.length > 1) throw new Error(`ambiguous session "${arg}":\n  ${hits.join('\n  ')}`);
    throw new Error(`no session matching "${arg}"`);
}

// The scorer rewrites recording-variant lines before decoding. Mirror it, or
// this tool reports differences the scorer deliberately forgives.
const VERSION_BANNER = /Version\s+\d+\.\d+\.\d+[^\n]*/;
function preDecode(s) {
    return String(s ?? '')
        .replace(VERSION_BANNER, '<<VERSION_BANNER>>')
        .replace(/^\d{2}:\d{2}:\d{2}\.$/gm, '<time>.');
}

async function runOurPort(segments) {
    const { runSegment } = await import(join(PROJECT_ROOT, 'js/jsmain.js'));
    const store = new Map();
    const storage = {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => { store.set(k, String(v)); },
        removeItem: k => { store.delete(k); },
        get length() { return store.size; },
        key(i) { let n = 0; for (const k of store.keys()) { if (n === i) return k; n++; } return null; },
    };
    const screens = [];
    const cursors = [];
    let error = null;
    try {
        for (const seg of segments) {
            const game = await runSegment({
                seed: seg.seed, datetime: seg.datetime,
                nethackrc: seg.nethackrc, moves: seg.moves, storage,
            });
            for (const s of game.getScreens?.() || []) screens.push(s);
            for (const c of game.getCursors?.() || []) cursors.push(c);
        }
    } catch (e) { error = e; }
    return { screens, cursors, error };
}

// Render one decoded grid as 24 lines of visible text, with a left gutter.
function renderGrid(grid, renderCell, cursor, highlightRows) {
    const lines = [];
    for (let r = 0; r < grid.length; r++) {
        let text = '';
        for (let c = 0; c < grid[r].length; c++) text += renderCell(grid[r][c]);
        text = text.replace(/\s+$/, '');
        const mark = highlightRows.has(r) ? `${T.red}>${T.off}` : ' ';
        const isCursorRow = Array.isArray(cursor) && cursor[1] === r;
        const gutter = `${String(r).padStart(2)}${isCursorRow ? '*' : ' '}${mark}`;
        lines.push(`${T.dim}${gutter}${T.off}|${text}`);
    }
    return lines;
}

function describeCell(cell, renderCell) {
    const ch = renderCell(cell);
    const shown = ch === ' ' ? '␠' : ch;
    const bits = [];
    if (cell.attr & 0x1) bits.push('inverse');
    if (cell.attr & 0x2) bits.push('bold');
    if (cell.attr & 0x4) bits.push('underline');
    const attrs = bits.length ? ` ${bits.join('+')}` : '';
    const color = cell.color === 8 ? 'default' : `color ${cell.color}`;
    return `'${shown}' ${color}${attrs}`;
}

async function main() {
    const argv = process.argv.slice(2);
    const targets = argv.filter(a => !a.startsWith('-'));
    const wantFirst = argv.includes('--first') || targets.length < 2;
    if (targets.length === 0) {
        console.error('usage: node tools/screendiff.mjs <session> [step|--first]');
        process.exit(2);
    }

    const sessionPath = resolveSession(targets[0]);
    const { decodeScreen, diffCell, renderCell, ROWS_24, COLS_80 } =
        await import(join(PROJECT_ROOT, 'frozen/screen-decode.mjs'));

    const raw = JSON.parse(readFileSync(sessionPath, 'utf8'));
    const { normalizeSession } = await import(join(PROJECT_ROOT, 'frozen/session_loader.mjs'));
    const segments = normalizeSession(raw).segments;

    // Flatten the recorded boundaries, keeping provenance for the header.
    const cScreens = [], cCursors = [], origin = [];
    segments.forEach((seg, segIdx) => {
        (seg.steps || []).forEach((step, stepIdx) => {
            if (!step.screen) return;
            cScreens.push(step.screen);
            cCursors.push(Array.isArray(step.cursor) ? step.cursor : null);
            origin.push({ seg: segIdx, step: stepIdx, key: step.key });
        });
    });

    const ours = await runOurPort(segments);
    if (ours.error) {
        console.log(`${T.red}Our port threw:${T.off} ${ours.error.message}`);
        console.log(`${T.dim}${(ours.error.stack || '').split('\n').slice(1, 6).join('\n')}${T.off}`);
    }

    const cellsDiffer = (i) => {
        const a = decodeScreen(preDecode(ours.screens[i]));
        const b = decodeScreen(preDecode(cScreens[i]));
        const bad = [];
        for (let r = 0; r < ROWS_24; r++) {
            for (let c = 0; c < COLS_80; c++) {
                const kind = diffCell(a[r][c], b[r][c]);
                if (kind) bad.push({ r, c, kind, ours: a[r][c], canon: b[r][c] });
            }
        }
        return { bad, a, b };
    };
    const cursorOk = (i) => {
        const c = cCursors[i], j = ours.cursors[i];
        if (!Array.isArray(c)) return true;
        if (!Array.isArray(j)) return false;
        return c[0] === j[0] && c[1] === j[1] && c[2] === j[2];
    };

    let index;
    if (wantFirst) {
        index = -1;
        for (let i = 0; i < cScreens.length; i++) {
            if (cellsDiffer(i).bad.length || !cursorOk(i)) { index = i; break; }
        }
        if (index < 0) {
            console.log(`${T.green}All ${cScreens.length} frames match.${T.off}`);
            process.exit(0);
        }
    } else {
        index = Number(targets[1]);
        if (!Number.isInteger(index) || index < 0 || index >= cScreens.length) {
            throw new Error(`step out of range: 0..${cScreens.length - 1}`);
        }
    }

    const { bad, a, b } = cellsDiffer(index);
    const o = origin[index];
    const keyLabel = o.key === null || o.key === undefined
        ? 'initial frame, before any input'
        : `after key ${JSON.stringify(o.key)}`;

    console.log(`${T.bold}${basename(sessionPath).replace('.session.json', '')}${T.off}` +
        `  step ${index} of ${cScreens.length - 1}  (seg ${o.seg + 1}, ${keyLabel})`);

    const rows = new Set(bad.map(d => d.r));
    console.log(`\n${T.cyan}C reference${T.off}   ${T.dim}(row gutter: * = cursor row, > = has differences)${T.off}`);
    for (const line of renderGrid(b, renderCell, cCursors[index], rows)) console.log(line);
    console.log(`\n${T.cyan}ours${T.off}`);
    for (const line of renderGrid(a, renderCell, ours.cursors[index], rows)) console.log(line);

    const cOk = cursorOk(index);
    console.log(`\ncursor  C ${JSON.stringify(cCursors[index])}  ` +
        `ours ${JSON.stringify(ours.cursors[index] ?? null)}  ` +
        (cOk ? `${T.green}ok${T.off}` : `${T.red}MISMATCH${T.off}`));

    if (!bad.length) {
        console.log(`${T.green}cells   all 1920 match${T.off}`);
    } else {
        console.log(`${T.red}cells   ${bad.length} of 1920 differ${T.off}` +
            `  (${bad.filter(d => d.kind === 'ch').length} glyph, ` +
            `${bad.filter(d => d.kind === 'attr').length} colour/attribute)\n`);
        const LIMIT = 40;
        for (const d of bad.slice(0, LIMIT)) {
            console.log(`  r${String(d.r).padStart(2)} c${String(d.c).padStart(2)}  ` +
                `${d.kind.padEnd(4)}  C ${describeCell(d.canon, renderCell).padEnd(30)} ` +
                `ours ${describeCell(d.ours, renderCell)}`);
        }
        if (bad.length > LIMIT) console.log(`  ${T.dim}… ${bad.length - LIMIT} more${T.off}`);
    }

    process.exit(bad.length || !cOk ? 1 : 0);
}

main().catch(e => {
    console.error(`screendiff: ${e.message}`);
    process.exit(2);
});
