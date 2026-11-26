import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const root = new URL('../', import.meta.url), variant = process.argv[2];
assert.ok(['baseline', 'candidate'].includes(variant));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const mapBytes = fs.readFileSync(new URL(`source/${variant === 'baseline' ? 'base' : 'candidate'}-runtime.json`, root));
const map = JSON.parse(mapBytes);
assert.equal(Object.keys(map).length, 280);
for (const [name, hash] of Object.entries(map))
    assert.equal(sha(fs.readFileSync(new URL(`${variant}/${name}`, root))), hash, name);
const js = new URL(`${variant}/js/`, root);
const { runSegment } = await import(new URL('jsmain.js', js));
const state = await import(new URL('gstate.js', js));
const { InMemoryStorage } = await import(new URL('storage.js', js));
const opt = await import(new URL('options.js', js));
const { get_menu_coloring, status_update } = await import(new URL('windows.js', js));
const { pmatch, pmatchi } = await import(new URL('hacklib.js', js));
const tty = await import(new URL('tty/wintty.js', js));
const { paint_topline } = await import(new URL('display.js', js));
const { bot } = await import(new URL('botl.js', js));
const { regex_match } = await import(new URL('posixregex.js', js));
const { BL_TITLE, BL_FLUSH, PICK_NONE, MENU_BEHAVE_STANDARD,
        MSGTYP_NOSHOW, MSGTYP_NORMAL } = await import(new URL('const.js', js));
const { NO_COLOR: defaultColor } = await import(new URL('terminal.js', js));
const recipe = JSON.parse(fs.readFileSync(new URL('recipes/initial-ordinary.json', root)));
const ascii = recipe.segments[1];
const bytes = s => Uint8Array.from(s, c => c.charCodeAt(0));
const hex = s => Array.from(s ?? '', c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
const cell = (d, x, y) => structuredClone(d.terminal.grid[y][x]);
const checks = [];
const timer = setTimeout(() => process.exit(124), 55_000);
async function check(name, body) {
    try { await body(); checks.push({ name, pass: true }); }
    catch (e) { checks.push({ name, pass: false, error: String(e.message).slice(0, 550) }); }
}
async function warm() {
    await runSegment({ ...ascii, storage: new InMemoryStorage() });
    return state.game;
}
await warm();
try {
    for (const [name, rc, expected, enabled] of [
        ['before', 'OPTIONS=eight_bit_tty\nOPTIONS=fruit:é\n', 'c3a9', true],
        ['after', 'OPTIONS=fruit:é\nOPTIONS=eight_bit_tty\n', '5f5f', true],
        ['partial', 'OPTIONS=eight_bit_tty\nOPTIONS=fruit:' + 'A'.repeat(30) + 'é\n', '41'.repeat(30) + 'c3', true],
        ['low-seven-enabled', 'OPTIONS=eight_bit_tty\nOPTIONS=fruit:€\n', 'e22eac', true],
        ['low-seven-disabled', 'OPTIONS=!eight_bit_tty\nOPTIONS=fruit:€\n', '5f2e5f', false],
        ['ASCII', 'OPTIONS=fruit:bytefruit\n', '627974656672756974', false],
    ]) await check(`fruit/${name}/statement-and-deferred-registration`, async () => {
        const g = await warm(), chain = g.ffruit;
        const rcResult = opt.parseNethackrc(rc);
        assert.equal(hex(g.svp.pl_fruit), expected);
        assert.equal(g.iflags.wc_eight_bit_input, enabled);
        assert.equal(opt.boolean_option('eight_bit_tty'), enabled);
        assert.equal(g.ffruit, chain, 'initial setter does not register a fruit');
        assert.equal(rcResult.errors.length, 0);
    });
    await check('fruit/right-to-left-same-statement-order', async () => {
        const g = await warm();
        opt.parseNethackrc('OPTIONS=fruit:é,eight_bit_tty\n');
        assert.equal(hex(g.svp.pl_fruit), 'c3a9');
        opt.parseNethackrc('OPTIONS=eight_bit_tty,fruit:é\n');
        assert.equal(hex(g.svp.pl_fruit), '5f5f');
    });
    await check('fruit/negation-restores-default', async () => {
        const g = await warm();
        opt.parseNethackrc('OPTIONS=eight_bit_tty\nOPTIONS=fruit:é\nOPTIONS=!fruit\n');
        assert.equal(g.svp.pl_fruit, 'slime mold');
    });
    await check('name/byte-limit-retains-partial-sequence', () => {
        const rc = opt.parseNethackrc('OPTIONS=name:' + 'A'.repeat(30) + 'é\n');
        assert.equal(hex(rc.opts.name), '41'.repeat(30) + 'c3');
    });
    await check('name/string-for-opt-preserves-leading-value-space', () => {
        assert.equal(opt.parseNethackrc('OPTIONS=name:  Abel\n').opts.name, '  Abel');
    });
    await check('msgtype/byte-target-match-and-reject', async () => {
        const g = await warm(); g.plinemsg_types = [];
        opt.parseNethackrc('MSGTYPE=hide "^X..Y$"\n');
        assert.equal(opt.msgtype_type('X\xc3\xa9Y', false), MSGTYP_NOSHOW);
        assert.equal(opt.msgtype_type('X_Y', false), MSGTYP_NORMAL);
    });
    await check('msgtype/partial-pattern-metadata-retains-byte', async () => {
        const g = await warm(); g.plinemsg_types = [];
        opt.parseNethackrc('MSGTYPE=hide "' + 'x'.repeat(254) + 'é"\n');
        assert.equal(hex(g.plinemsg_types[0].pattern), '78'.repeat(254) + 'c3');
        assert.ok(regex_match(bytes('x'.repeat(254) + '\xc3'), g.plinemsg_types[0].regex));
    });
    await check('menucolor/byte-label-and-byte-target', async () => {
        const g = await warm(); g.menu_colorings = [];
        opt.parseNethackrc('MENUCOLOR="é"=red&bold\n');
        assert.equal(hex(g.menu_colorings[0].origstr), 'c3a9');
        assert.equal(get_menu_coloring('a \xc3\xa9').color, 1);
        assert.equal(get_menu_coloring('a _'), null);
    });
    await check('autopickup/byte-pattern-scanf-boundary', async () => {
        const g = await warm(); g.apelist = [];
        opt.parseNethackrc('AUTOPICKUP_EXCEPTION=">' + 'x'.repeat(252) + 'é"\n');
        assert.equal(hex(g.apelist[0].pattern), '78'.repeat(252) + 'c3');
        assert.equal(g.apelist[0].grab, false);
        assert.ok(regex_match(bytes('x'.repeat(252) + '\xc3'), g.apelist[0].regex));
    });
    await check('menu/ASCII-case-and-wildcards', () => {
        assert.ok(pmatchi('*BYTE?RUIT', 'a bytefruit'));
        assert.ok(!pmatch('*BYTE?RUIT', 'a bytefruit'));
        assert.ok(pmatchi('', '')); assert.ok(!pmatchi('?', ''));
    });
    await check('menu/high-bytes-do-not-casefold', () => {
        assert.ok(!pmatchi('*\xe3\xa9*', 'a \xc3\xa9'));
        assert.ok(pmatchi('*\xc3\xa9*', 'a \xc3\xa9'));
    });
    await check('topline/signed-bytes-preserve-styled-cells-and-advance', async () => {
        const g = await warm(), d = g.nhDisplay;
        d.setCell(1, 0, 'X', 2, 4); d.setCell(2, 0, 'Y', 6, 1);
        const old = [cell(d, 1, 0), cell(d, 2, 0)];
        g._topline_physical_prefix = ''; g._pending_message = 'A\xc3\xa9Z';
        paint_topline();
        assert.deepEqual([cell(d, 1, 0), cell(d, 2, 0)], old);
        assert.equal(cell(d, 0, 0).ch, 'A'); assert.equal(cell(d, 3, 0).ch, 'Z');
        assert.equal(cell(d, 4, 0).ch, ' ');
        assert.equal(d.cursorCol, 4); assert.equal(d.cursorRow, 0);
    });
    await check('topline/ASCII-and-newline-control', async () => {
        const g = await warm(), d = g.nhDisplay;
        g._topline_physical_prefix = ''; g._pending_message = 'AB\nCD';
        paint_topline();
        assert.equal(cell(d, 0, 0).ch, 'A'); assert.equal(cell(d, 1, 1).ch, 'D');
        assert.equal(d.cursorCol, 2); assert.equal(d.cursorRow, 1);
    });
    await check('base/signed-byte-preserves-cell-and-next-row-position', async () => {
        const g = await warm(), d = g.nhDisplay;
        d.setCell(1, 3, 'Q', 5, 4); const old = cell(d, 1, 3);
        tty.tty_curs_base(1, 3); tty.tty_putstr_base('A\xc3B', 2);
        assert.deepEqual(cell(d, 1, 3), old);
        assert.equal(cell(d, 2, 3).ch, 'B'); assert.equal(cell(d, 2, 3).attr, 2);
        assert.deepEqual(tty.tty_base_pos(), { x: 0, y: 4 });
    });
    await check('status/signed-byte-capture-and-backed-byte-comparison', async () => {
        const g = await warm(), d = g.nhDisplay;
        d.setCell(1, 22, 'P', 3, 4); d.setCell(2, 22, 'Q', 6, 1);
        const old = [cell(d, 1, 22), cell(d, 2, 22)];
        g.plname = 'X\xc3\xa9Y'; g.update_all = true; g.disp.botl = true;
        await bot();
        assert.deepEqual([cell(d, 1, 22), cell(d, 2, 22)], old);
        assert.equal(cell(d, 3, 22).ch, 'Y');
        const title = g._genl_status.status_vals[BL_TITLE];
        assert.equal(title.length, 30); assert.ok(title.startsWith('X\xc3\xa9Y the '));
        // A repeated byte field must match cw.data and avoid repainting it.
        d.setCell(0, 22, 'M', 2, 4);
        status_update(BL_TITLE, title, 0, 0, defaultColor, null);
        status_update(BL_FLUSH, null, 0, 0, defaultColor, null);
        assert.equal(cell(d, 0, 22).ch, 'M');
    });
    await check('menu/corner-clear-precedes-skipped-bytes', async () => {
        const g = await warm(), d = g.nhDisplay;
        for (let x = 0; x < 80; x++) d.setCell(x, 0, 'M', 5, 4);
        const win = tty.tty_create_nhwindow(tty.NHW_MENU);
        tty.tty_start_menu(win, MENU_BEHAVE_STANDARD);
        tty.tty_add_menu(win, null, 0, 0, 0, tty.ATR_NONE, defaultColor, 'X\xc3\xa9Z', 0);
        tty.tty_end_menu(win, null); d.pushKey(32);
        let shown;
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        try {
            globalThis.__step_snapshot = { step: '*', cb() { shown = structuredClone(d.terminal.grid[0]); } };
            await tty.tty_select_menu(win, PICK_NONE);
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
        const x = shown.findIndex(c => c.ch === 'X');
        assert.ok(x > 0);
        assert.equal(shown[x + 1].ch, ' '); assert.equal(shown[x + 2].ch, ' ');
        assert.equal(shown[x + 1].attr, 0); assert.equal(shown[x + 3].ch, 'Z');
    });
    await check('text/first-byte-glyph-and-later-signed-byte', async () => {
        const g = await warm(), d = g.nhDisplay;
        g.iflags.wc_eight_bit_input = true;
        const win = tty.tty_create_nhwindow(tty.NHW_TEXT);
        await tty.tty_putstr(win, tty.ATR_NONE, '\xc3\xa9Z');
        let shown;
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        try {
            globalThis.__step_snapshot = { step: '*', cb() { shown = structuredClone(d.terminal.grid[0]); } };
            d.pushKey(32); await tty.tty_display_nhwindow(win, true);
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
        assert.equal(shown[0].ch, ' ');
        assert.equal(shown[1].ch, 'C'); assert.equal(shown[2].ch, 'Z');
    });
    const report = { classification: 'Constructed real-owner states after a locked ordinary ASCII setup. No mocks, native proof, or test-only runtime exports.',
        variant, runtimeMapSHA256: sha(mapBytes), total: checks.length, passed: checks.filter(c => c.pass).length, checks };
    fs.writeFileSync(new URL(`reports/source-${variant}.json`, root), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: report.passed, total: report.total, failed: checks.filter(c => !c.pass) }));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(timer); }
