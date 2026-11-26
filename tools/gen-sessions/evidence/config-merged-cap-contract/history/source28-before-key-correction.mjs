import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url), variant = process.argv[2];
assert.ok(['baseline', 'candidate'].includes(variant));
const sha = b => createHash('sha256').update(b).digest('hex');
const read = name => readFileSync(new URL(name, root));
const pins = JSON.parse(read('source/parent-native-pins.json'));
for (const [name, digest] of Object.entries(pins.files)) assert.equal(sha(read(name)), digest, name);
assert.equal(pins.rawSHA256, '384cd13b3cc862459640cebe944e6c704c623fee3a60abe154b218e23f0b6cf2');
const recipeBytes = read('recipes/partial-symbol-proposals.json');
assert.equal(sha(recipeBytes), 'ce51f43c9fa948482830926260a72e6f4e7a489702523b524990713c59eee93b');
const recipe = JSON.parse(recipeBytes), native = JSON.parse(read('source/partial-symbol-native.session.json'));
assert.equal(native.version, 5); assert.equal(native.source, 'c'); assert.equal(native.jsGroundTruth, undefined);
assert.equal(native.segments.length, 3);
for (const [i, part] of recipe.segments.entries()) {
    for (const field of ['seed', 'datetime', 'nethackrc', 'moves', 'name']) {
        assert.ok(Object.hasOwn(native.segments[i], field));
        assert.deepEqual(native.segments[i][field], part[field]);
    }
    assert.deepEqual(native.segments[i].steps.slice(1).map(s => s.key), Array.from(part.moves, c => c.charCodeAt(0)));
}
const {recordingIntegrityErrors, branchAssertionErrors} = await import(new URL('source/assertions.mjs', root));
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(recipe, native), []);
const mapBytes = read(`source/${variant}-runtime.json`), map = JSON.parse(mapBytes);
if (variant === 'baseline') assert.equal(sha(mapBytes), '227567f7163bcc49aa09addaaac59478a05d0f7799404dd662d13bf133519f5a');
assert.equal(Object.keys(map).length, 280);
for (const [name, digest] of Object.entries(map)) assert.equal(sha(read(`${variant}/${name}`)), digest, name);
const canonical = JSON.parse(read('source/original6/canonical-inputs.json')).plain;
const js = new URL(`${variant}/js/`, root);
const {runSegment} = await import(new URL('jsmain.js', js));
const {InMemoryStorage} = await import(new URL('storage.js', js));
const {game} = await import(new URL('gstate.js', js));
const opt = await import(new URL('options.js', js));
const sym = await import(new URL('symbols.js', js));
const {cmdbind_get} = await import(new URL('cmd.js', js));
const {regex_match} = await import(new URL('posixregex.js', js));
const {get_menu_coloring} = await import(new URL('windows.js', js));
const {MSGTYP_NOSHOW, MSGTYP_NORMAL} = await import(new URL('const.js', js));
const raw = text => new TextEncoder().encode(text);
const hex = text => Array.from(text ?? '', c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
const rows = [], timer = setTimeout(() => process.exit(124), 55000);
async function check(name, body) {
    try { await body(); rows.push({name, pass: true}); }
    catch (error) { rows.push({name, pass: false, error: error.message.slice(0, 600)}); }
}
async function warm() { await runSegment({...canonical, storage: new InMemoryStorage()}); }
function rc(text) {
    const result = opt.parseNethackrc(text);
    assert.deepEqual(result.errors, []); assert.deepEqual(result.unhandled, []);
    return result;
}
try {
    await warm();
    // Constructed C-byte buffers, not ordinary caller reach. e2/f0/c4 expose
    // double encoding that an isolated c3 byte would not expose.
    for (const [name, value, expected] of [
        ['e2-partial', [0xe2], -30], ['f0-partial', [0xf0], -16],
        ['c4-partial', [0xc4], -60], ['quoted-byte', [39, 0xe2, 39], -30],
        ['unclosed-quote', [39, 0xe2], 0], ['NUL', [0, 0xe2], 0],
        ['ASCII-negative', [65], 65], ['escape-negative', [92, 50, 50, 54], -30],
    ]) await check(`raw-sym_val/${name}`, () => assert.equal(sym.sym_val(Uint8Array.from(value)), expected));
    for (const [name, value, expected] of [
        ['meta-c4', [77, 45, 0xc4], 68], ['single-e2', [0xe2], 226],
        ['ASCII-negative', [126], 126], ['escape-negative', [92, 50, 50, 54], 226],
    ]) await check(`raw-txt2key/${name}`, () => assert.equal(opt.txt2key(Uint8Array.from(value)), expected));
    for (const which of [sym.PRIMARYSET, sym.ROGUESET]) await check(`raw-parsesymbols/${which}/e2`, async () => {
        await warm();
        const text = Uint8Array.from([...raw('S_room:'), 0xe2]);
        assert.equal(sym.parsesymbols(text, which), true);
        const store = which === sym.PRIMARYSET ? sym.go_ov_primary_syms : sym.go_ov_rogue_syms;
        assert.equal(store[sym.match_sym('S_room').idx], 226);
    });
    await check('raw-parseoptions/name-recursion', async () => {
        await warm(); const result = {opts: {}};
        assert.equal(opt.parseoptions(Uint8Array.from([...raw('name:'), 0xe2, ...raw(',time')]), true, true, result), true);
        assert.equal(hex(result.opts.name), 'e2'); assert.equal(result.opts.time, true);
    });
    await check('raw-parseoptions/fruit-recursion-and-sanitizer', async () => {
        await warm(); const result = {opts: {}};
        assert.equal(opt.parseoptions(raw('fruit:€,eight_bit_tty'), true, true, result), true);
        assert.equal(hex(game.svp.pl_fruit), 'e22eac');
    });
    await check('raw-parsebindings/right-to-left', async () => {
        await warm();
        assert.equal(opt.parsebindings(Uint8Array.from([...raw('M-'), 0xc4, ...raw(':inventory,~:toggle(time)')])), true);
        assert.equal(cmdbind_get(68).cmd.ef_txt, 'inventory');
        assert.equal(cmdbind_get(126).param, 'time');
    });
    for (const [label, text, expected] of [
        ['three-byte', '€', 'e282ac'], ['four-byte', '😀', 'f09f9880'], ['ASCII-negative', 'ABC', '414243'],
    ]) await check(`rc/patterns-and-binding-param/${label}`, async () => {
        await warm(); game.plinemsg_types = []; game.menu_colorings = []; game.apelist = [];
        rc(`MSGTYPE=hide "^${text}$"\nMENUCOLOR="${text}"=red&bold\nAUTOPICKUP_EXCEPTION=">${text}"\nBIND=~:toggle(${text})\n`);
        assert.equal(hex(game.plinemsg_types[0].pattern), '5e' + expected + '24');
        assert.equal(hex(game.menu_colorings[0].origstr), expected);
        assert.equal(hex(game.apelist[0].pattern), expected);
        assert.equal(hex(cmdbind_get(126).param), expected);
        const bytes = String.fromCharCode(...raw(text));
        assert.equal(opt.msgtype_type(bytes, false), MSGTYP_NOSHOW);
        assert.equal(opt.msgtype_type('unrelated', false), MSGTYP_NORMAL);
        assert.equal(get_menu_coloring(bytes).color, 1);
        assert.ok(regex_match(raw(text), game.apelist[0].regex));
    });
    await check('rc/binding-param-30-byte-truncation', async () => {
        await warm(); rc('BIND=~:toggle(' + 'A'.repeat(29) + '€)\n');
        assert.equal(hex(cmdbind_get(126).param), '41'.repeat(29) + 'e2');
    });
    for (const [name, lead, tail, expected] of [
        ['quoted-partial', 1020, "'é'", 0], ['literal-partial', 1021, 'é', 195],
        ['quoted-fit', 1018, "'é'", 195], ['e2-partial', 1021, '€', 226],
        ['f0-partial', 1021, '😀', 240], ['ASCII-fit-negative', 1021, 'A', 65],
    ]) await check(`rc/merged-cap/${name}`, async () => {
        await warm(); const prefix = 'SYMBOLS=S_room:';
        rc(prefix + ' '.repeat(lead - prefix.length) + '\\\n' + tail + '\n');
        assert.equal(sym.go_ov_primary_syms[sym.match_sym('S_room').idx] || 0, expected);
    });
    await check('rc/symbol-and-key-Unicode-entry-negatives', async () => {
        await warm(); rc('SYMBOLS=S_room:€\nROGUESYMBOLS=S_room:😀\nBIND=M-Ā:inventory\n');
        const room = sym.match_sym('S_room').idx;
        assert.equal(sym.go_ov_primary_syms[room], 226);
        assert.equal(sym.go_ov_rogue_syms[room], 240);
        assert.equal(cmdbind_get(68).cmd.ef_txt, 'inventory');
    });
    const report = {classification: 'Constructed raw-byte API/limit controls plus actual RC producer controls; ordinary3 is separately recorded',
        variant, total: rows.length, passed: rows.filter(row => row.pass).length, rows};
    writeFileSync(new URL(`reports/raw-byte-source-${variant}.json`, root), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({passed: report.passed, total: report.total, failures: rows.filter(r => !r.pass).map(r => r.name)}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(timer); }
