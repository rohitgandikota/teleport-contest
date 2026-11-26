import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reportPath, js, root, sha, original, nativePreflight, sourcePreflight, readEvidence } from './fruit-text-preflight.mjs';
const controlsBytes = fs.readFileSync(new URL('marker/controls/marker-cases.json', root));
const controls = JSON.parse(controlsBytes).cases;
const recipe = original.initial11.recipe;
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const state = await import(new URL('gstate.js', js));
const tty = await import(new URL('tty/wintty.js', js));
const {display_nhwindow_message, TOPLINE_NEED_MORE} = await import(new URL('display.js', js));
const {add_menu_coloring} = await import(new URL('coloratt.js', js));
const {MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPMENUCOLORS,
       MENU_BEHAVE_STANDARD} = await import(new URL('const.js', js));
const deadline = setTimeout(() => process.exit(124), 55_000);
const rows = [];
try {
    for (const c of controls) {
        const checks = [];
        const check = (name, fn) => {
            try { fn(); checks.push({name, pass: true}); }
            catch (e) { checks.push({name, pass: false, error: String(e.message).slice(0, 500)}); }
        };
        await runSegment({...recipe.segments[1], storage: new InMemoryStorage()});
        // Keep the namespace binding live across runSegment's resetGame().
        const g = state.game, d = g.nhDisplay;
        assert.equal(g._toplin, TOPLINE_NEED_MORE);
        d.pushKey(32); await display_nhwindow_message();
        g.menu_colorings = [];
        if (c.rule) add_menu_coloring(c.rule);
        g.iflags.menucolors = c.menucolors ?? false;
        const win = tty.tty_create_nhwindow(tty.NHW_MENU);
        tty.tty_start_menu(win, MENU_BEHAVE_STANDARD);
        const flags = (c.selected ? MENU_ITEMFLAGS_SELECTED : 0)
            | (c.skipMenucolors ? MENU_ITEMFLAGS_SKIPMENUCOLORS : 0);
        tty.tty_add_menu(win, null, 1, 'a', 0, c.attr, c.color, 'marker entry', flags);
        tty.tty_end_menu(win, null);
        const item = tty.menu_page_items(win, 0)[0];
        check('actual producer stores color and attribute', () => {
            assert.equal(item.color, c.expectedStoredColor ?? c.color);
            assert.equal(item.attr, c.expectedStoredAttr ?? c.attr);
            assert.equal(item.itemflags & MENU_ITEMFLAGS_SKIPMENUCOLORS, 0);
        });
        await tty.tty_display_nhwindow(win);
        const before = structuredClone(d.terminal.grid);
        const x = before[0].findIndex((cell, i, row) => cell.ch === 'a'
            && row[i + 1]?.ch === ' ' && row[i + 3]?.ch === ' ');
        assert.ok(x > 0, 'real selector prefix is present');
        const markerX = x + 2;
        check('initial full-page marker has unhighlighted prefix', () => {
            assert.deepEqual(before[0][markerX], {ch: c.selected ? '*' : '-', color: 8, attr: 0});
        });
        item.selected = c.selected; item.count = c.count;
        const fields = {selected: item.selected, count: item.count, color: item.color, attr: item.attr};
        tty.set_item_state(win, 0, item);
        const after = structuredClone(d.terminal.grid);
        check('repaint uses C marker character color and attribute', () => {
            assert.deepEqual(after[0][markerX], {ch: c.expectedChar, color: c.expectedColor, attr: c.expectedAttr});
        });
        check('all other styled cells unchanged', () => {
            for (let y = 0; y < 24; y++) for (let col = 0; col < 80; col++)
                if (y !== 0 || col !== markerX) assert.deepEqual(after[y][col], before[y][col]);
        });
        check('repaint does not mutate selection count or style metadata', () => {
            assert.deepEqual({selected: item.selected, count: item.count, color: item.color, attr: item.attr}, fields);
        });
        rows.push({name: c.name, negative: c.negative, pass: checks.every(x => x.pass), checks,
            marker: {x: markerX, y: 0, before: before[0][markerX], after: after[0][markerX]},
            gridSHA256: sha(JSON.stringify(after))});
    }
    const baseline = readEvidence('marker/reports/source-baseline.json');
    const negatives = rows.filter(r => r.negative);
    assert.equal(negatives.length, 6);
    for (const row of negatives)
        assert.equal(row.gridSHA256, baseline.rows.find(r => r.name === row.name).gridSHA256, row.name);
    const report = { classification: 'Original12 real-menu producer controls; six unaffected complete-grid hashes enforced.',
        sourcePreflight, nativePreflight, controlsSHA256: sha(controlsBytes),
        passed: rows.filter(r => r.pass).length, total: rows.length, rows };
    if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, total: report.total, negativeGrids: negatives.length }));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
