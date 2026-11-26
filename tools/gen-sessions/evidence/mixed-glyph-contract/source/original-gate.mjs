import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reportPath, js, sha } from './fruit-text-preflight.mjs';
const warmBytes = fs.readFileSync(new URL('../../fixtures/pager-lookat-terrain.session.json', import.meta.url));
assert.equal(sha(warmBytes), '697396be1fec25734f8ebc5ced7e93c4b6d2531268c3728ad7cf7d36a8ff3dc5');
const warmSegment = JSON.parse(warmBytes).segments[0];
const { runSegment } = await import(new URL('jsmain.js', js));
const { InMemoryStorage } = await import(new URL('storage.js', js));
const state = await import(new URL('gstate.js', js));
const { parseNethackrc } = await import(new URL('options.js', js));
const { do_screen_description } = await import(new URL('pager.js', js));
const { update_topl } = await import(new URL('tty/topl.js', js));
const tty = await import(new URL('tty/wintty.js', js));
const { display_nhwindow_message, TOPLINE_EMPTY, TOPLINE_NEED_MORE } =
    await import(new URL('display.js', js));
const { NO_COLOR } = await import(new URL('terminal.js', js));
const rows = [], timer = setTimeout(() => process.exit(124), 55_000);
const cell = ch => ({ ch, color: NO_COLOR, attr: 0 });
async function warm() {
    await runSegment({ ...warmSegment, moves: warmSegment.moves.slice(0, 1), storage: new InMemoryStorage() });
    const g = state.game, d = g.nhDisplay;
    assert.equal(g._toplin, TOPLINE_NEED_MORE);
    d.pushKey(32); await display_nhwindow_message();
    const producers = {};
    for (let y = 0; y < 21; y++) for (let x = 1; x < 80; x++) {
        const loc = g.level.at(x, y);
        if (!loc?.disp_decgfx || !['x', '~'].includes(loc.disp_ch)) continue;
        const result = do_screen_description({ x, y }, true, 0);
        const name = loc.disp_ch === 'x' ? 'wall' : 'floor';
        if (result.found && !producers[name]) producers[name] = {
            x, y, original: result.out_str, text: result.out_str[0] + ' map glyph',
        };
    }
    assert.equal(producers.wall?.text[0], '\u2502', 'real wall producer');
    assert.equal(producers.floor?.text[0], '\u00b7', 'real floor producer');
    // Construct the source branch boundary. This is not an ordinary input case.
    g._toplin = TOPLINE_EMPTY; g._toplines = ''; g._pending_message = '';
    g._topline_physical_prefix = ''; g._topl_curx = g._topl_cury = 0;
    g._win_stop = g._win_nostop = false;
    (g.ttyDisplay ||= {}).mixed = g.ttyDisplay.topl_utf8 = 0;
    for (let x = 0; x < 80; x++) d.setCell(x, 0, 'Z', 2, 2);
    return { g, d, producers };
}
async function check(name, body) {
    const { g, d, producers } = await warm();
    const before = structuredClone(d.terminal.grid);
    try {
        await body(g, d, producers, before);
        rows.push({ name, pass: true, gridSHA256: sha(JSON.stringify(d.terminal.grid)) });
    } catch (e) {
        rows.push({ name, pass: false, error: String(e.message).slice(0, 400),
            gridSHA256: sha(JSON.stringify(d.terminal.grid)) });
    }
}
function line(d, text, before, retainedColumns = []) {
    for (let x = 0; x < 80; x++) {
        const ch = text[x] ?? ' ';
        const expected = retainedColumns.includes(x) ? before[0][x] : cell(ch);
        assert.deepEqual(d.terminal.grid[0][x], expected, `cell ${x},0`);
    }
    for (let y = 1; y < 24; y++) assert.deepEqual(d.terminal.grid[y], before[y]);
    assert.equal(d.cursorCol, text.length); assert.equal(d.cursorRow, 0);
}
try {
    for (const kind of ['floor', 'wall']) await check(`consumer/mixed-${kind}`, async (g, d, p, before) => {
        g.ttyDisplay.mixed = 1;
        await update_topl(p[kind].text);
        line(d, p[kind].text, before);
    });
    for (const [name, text, retainedColumns] of [
        ['plain-middle-dot', '\xb7 byte text', [0]], ['plain-UTF8-first', '\xc3\xa9 byte text', [0, 1]],
        ['plain-UTF8-interior', 'A\xc3\xa9 byte text', [1, 2]], ['plain-ASCII', 'ASCII text', []],
    ]) await check(`consumer/${name}`, async (g, d, p, before) => {
        await update_topl(text); line(d, text, before, retainedColumns);
    });
    await check('consumer/topl-utf8-guard', async (g, d, p, before) => {
        // Explicit guard construction only, not an enhanced-UTF8 conversion claim.
        g.ttyDisplay.mixed = g.ttyDisplay.topl_utf8 = 1;
        await update_topl(p.floor.text); line(d, p.floor.text, before, [0]);
    });
    for (const kind of ['floor', 'wall']) await check(`message/actual-${kind}`, async (g, d, p, before) => {
        assert.equal(typeof tty.tty_putmixed_message, 'function', 'actual reached message owner');
        await tty.tty_putmixed_message(p[kind].text);
        line(d, p[kind].text, before);
        assert.equal(g._toplin, TOPLINE_NEED_MORE);
        assert.equal(g._toplines, p[kind].text);
        assert.equal(g.ttyDisplay.mixed, 0); assert.equal(g.ttyDisplay.topl_utf8, 0);
    });
    await check('message/ASCII-attr-zero', async (g, d, p, before) => {
        await tty.tty_putmixed_message('ordinary ASCII');
        line(d, 'ordinary ASCII', before);
        assert.equal(g._toplin, TOPLINE_NEED_MORE); assert.equal(g._toplines, 'ordinary ASCII');
    });
    await check('message/STOP-retains-screen', async (g, d, p, before) => {
        g._win_stop = true;
        await tty.tty_putmixed_message(p.floor.text);
        assert.deepEqual(d.terminal.grid, before);
        assert.equal(g._toplines, '  ' + p.floor.text);
        assert.equal(g._toplin, TOPLINE_EMPTY); assert.equal(g._win_stop, true);
        assert.equal(g.ttyDisplay.mixed, 0); assert.equal(g.ttyDisplay.topl_utf8, 0);
    });
    await check('message/NOSTOP-overrides-once', async (g, d, p, before) => {
        g._win_stop = g._win_nostop = true;
        await tty.tty_putmixed_message(p.floor.text);
        line(d, p.floor.text, before);
        assert.equal(g._win_stop, true, 'attr0 does not clear persistent STOP');
        assert.equal(g._win_nostop, false, 'tty_putstr clears the one-shot flag');
        const shown = structuredClone(d.terminal.grid);
        await tty.tty_putmixed_message('next suppressed');
        assert.deepEqual(d.terminal.grid, shown);
    });
    await check('message/join-keeps-interior-as-text', async (g, d, p, before) => {
        await update_topl('A');
        await tty.tty_putmixed_message(p.floor.text);
        line(d, 'A  ' + p.floor.text, [Array.from({length: 80}, (_, x) => cell(x ? ' ' : 'A')), ...before.slice(1)], [3]);
        assert.equal(g._toplines, 'A  ' + p.floor.text);
    });
    await check('message/ESC-more-stops-output', async (g, d, p) => {
        await update_topl('A'.repeat(70));
        d.pushKey(27);
        await tty.tty_putmixed_message(p.floor.text);
        assert.equal(g._win_stop, true); assert.equal(g._win_nostop, false);
        assert.equal(g.ttyDisplay.mixed, 0); assert.equal(g.ttyDisplay.topl_utf8, 0);
    });
    await check('message/bypass-pline-policy', async (g, d, p, before) => {
        assert.equal(parseNethackrc('MSGTYPE=hide ".*"\n').errors.length, 0);
        g._prevmsg = 'previous ordinary';
        g.a11y.msg_loc = { x: 3, y: 4 };
        await tty.tty_putmixed_message(p.floor.text);
        line(d, p.floor.text, before);
        assert.equal(g._prevmsg, 'previous ordinary');
        assert.deepEqual(g.a11y.msg_loc, { x: 3, y: 4 });
    });
    await check('message/full-producer-wrapped-acknowledgement', async (g, d, p) => {
        assert.ok(p.floor.original.length >= 80);
        d.pushKey(32);
        await tty.tty_putmixed_message(p.floor.original);
        assert.ok(g._toplines.includes('\n'));
        assert.equal(g._toplin, TOPLINE_EMPTY);
        assert.equal(g.morc, ' ');
        assert.equal(g.ttyDisplay.mixed, 0); assert.equal(g.ttyDisplay.topl_utf8, 0);
    });
    const negatives = JSON.parse(fs.readFileSync(new URL('../../reports/source-regressed-v3.json', import.meta.url))).rows;
    for (const row of rows.filter(r => r.name.startsWith('consumer/plain-') || r.name === 'consumer/topl-utf8-guard'))
        assert.equal(row.gridSHA256, negatives.find(r => r.name === row.name).gridSHA256, row.name);
    const report = { classification: 'Constructed source boundaries with real game, option and description producers. No ordinary reach claim.',
        passed: rows.filter(r => r.pass).length, total: rows.length, rows };
    if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total, failed: rows.filter(r => !r.pass)}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(timer); }
