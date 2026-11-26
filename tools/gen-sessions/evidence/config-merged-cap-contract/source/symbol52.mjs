import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const variant = process.argv[2];
assert.ok(['baseline', 'candidate'].includes(variant));
const root = new URL('../', import.meta.url), js = new URL(`${variant}/js/`, root);
await import(new URL('jsmain.js', js));
const symbols = await import(new URL('symbols.js', js));
const state = await import(new URL('gstate.js', js));
const {txt2key} = await import(new URL('options.js', js));
const deadline = setTimeout(() => process.exit(2), 55000);
const rows = [];
function check(name, fn) {
    try { fn(); rows.push({name, pass: true}); }
    catch (error) { rows.push({name, pass: false, error: error.message.slice(0, 700)}); }
}
function reset() {
    state.resetGame();
    symbols.clear_symsetentry(symbols.PRIMARYSET, true);
    symbols.clear_symsetentry(symbols.ROGUESET, true);
    symbols.init_symbols();
    symbols.savedsym_free();
}

// src/options.c:9385, QBUFSZ=128, signed-char return proven in the pinned binary.
// These are constructed helper/limit controls, separate from native ordinary9.
const values = [
    ['empty', '', 0], ['space', ' ', 0], ['tab', '\t', 0],
    ['ASCII-single', 'A', 65], ['ASCII-multiple', 'AB', 65],
    ['NUL-first', '\0é', 0], ['NUL-after-space', ' \0Z', 0],
    ['NUL-after-quote', "'\0A'", 39], ['NUL-after-ASCII', 'A\0B', 65],
    ['UTF8-two-byte', 'é', -61], ['UTF8-three-byte', '€', -30],
    ['UTF8-four-byte', '😀', -16], ['non-ASCII-space-is-byte', '\u00a0', -62],
    ['single-quote-character', "'", 39], ['simple-quoted-ASCII', "'A'", 65],
    ['triple-quote', "'''", 39], ['simple-quoted-backslash', "'\\'", 92],
    ['escaped-quote', "'\\''", 39], ['escaped-double-quote', "'\\\"'", 34],
    ['quoted-UTF8', "'é'", -61], ['unclosed-quote', "'é", 0],
    ['ASCII-closing-quote-fits127', "'" + 'A'.repeat(126) + "'", 65],
    ['ASCII-closing-quote-beyond127', "'" + 'A'.repeat(127) + "'", 0],
    ['UTF8-closing-quote-fits127', "'" + 'é'.repeat(63) + "'", -61],
    ['UTF8-closing-quote-beyond127', "'" + 'é'.repeat(64) + "'", 0],
    ['decimal-127', '\\127', 127], ['decimal-128', '\\128', -128],
    ['decimal-195', '\\195', -61], ['decimal-255', '\\255', -1],
    ['hex-byte', '\\xE9', -23], ['octal-byte', '\\o377', -1],
    ['meta-byte', '\\MA', -63], ['control-byte', '^A', 1],
    ['C-newline-escape', '\\n', 10], ['trailing-backslash', '\\', 92],
];

try {
    for (const [name, value, expected] of values)
        check(`sym_val/${name}`, () => assert.equal(symbols.sym_val(value), expected));
    const room = symbols.match_sym('S_room'); assert.ok(room);
    // src/symbols.c:295-317, all four actual nhsym destinations are uchar.
    for (const [setter, array] of [
        ['update_ov_primary_symset', 'go_ov_primary_syms'],
        ['update_ov_rogue_symset', 'go_ov_rogue_syms'],
        ['update_primary_symset', 'gp_primary_syms'],
        ['update_rogue_symset', 'gr_rogue_syms'],
    ]) {
        for (const [label, value, expected] of [['signed-byte', -61, 195], ['ASCII-negative', 65, 65]])
            check(`${setter}/${label}`, () => {
                reset(); symbols[setter](room, value);
                assert.equal(symbols[array][room.idx], expected);
            });
    }
    for (const which of [symbols.PRIMARYSET, symbols.ROGUESET]) {
        const override = which === symbols.PRIMARYSET ? 'go_ov_primary_syms' : 'go_ov_rogue_syms';
        const loaded = which === symbols.PRIMARYSET ? 'gp_primary_syms' : 'gr_rogue_syms';
        check(`parsesymbols/${which}/literal-byte`, () => {
            reset(); assert.equal(symbols.parsesymbols('S_room:é', which), true);
            assert.equal(symbols[override][room.idx], 195);
        });
        check(`parsesymbols/${which}/decimal-negative`, () => {
            reset(); assert.equal(symbols.parsesymbols('S_room:\\195', which), true);
            assert.equal(symbols[override][room.idx], 195);
        });
        check(`parse_sym_line/${which}/real-start-and-value`, () => {
            reset(); symbols.gs_symset[which].name = 'ByteProbe';
            assert.equal(symbols.parse_sym_line('start:ByteProbe', which), 1);
            assert.equal(symbols.parse_sym_line('S_room:é', which), 1);
            assert.equal(symbols[loaded][room.idx], 195);
            assert.equal(symbols.parse_sym_line('finish', which), 1);
        });
    }
    for (const [value, expected] of [['M-Ā', 68], ['\\195', 195], ['~', 126]])
        check(`existing-txt2key/${JSON.stringify(value)}`, () => assert.equal(txt2key(value), expected));
    const report = {classification: 'Constructed source controls, not ordinary reach. No mocks or new runtime exports.',
        variant, total: rows.length, passed: rows.filter(row => row.pass).length, rows,
        symbolsSHA256: createHash('sha256').update(readFileSync(new URL('symbols.js', js))).digest('hex')};
    writeFileSync(new URL(`reports/symbol-source-${variant}.json`, root), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({variant, passed: report.passed, total: report.total,
        failures: rows.filter(row => !row.pass).map(row => row.name)}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
