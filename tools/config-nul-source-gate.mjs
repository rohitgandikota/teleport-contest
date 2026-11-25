import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3, 'optional argument: compact report path');
const root = new URL('../', import.meta.url), js = new URL('js/', root);
const evidence = new URL('tools/gen-sessions/evidence/config-nul-contract/', root);
const sha = value => createHash('sha256').update(value).digest('hex');
const bytes = readFileSync(new URL('original-recipe.json', evidence));
assert.equal(sha(bytes), '2c913699672463ad044a9c09c277b92d2fee0a5af8fb30cb48ca38039dcb2775');
const recipe = JSON.parse(bytes);
const lockBytes = readFileSync(new URL('input-lock.json', evidence));
assert.equal(sha(lockBytes), 'd0e9a81fac019ca0d0ce5cb10f4d5114ffd40a65150927dd59201d4eb2549205');
const lock = JSON.parse(lockBytes);
assert.equal(lock.recipeSHA256, sha(bytes));
assert.deepEqual(lock.fields, ['seed', 'datetime', 'nethackrc', 'moves', 'name']);
assert.equal(recipe.segments.length, 4);
assert.equal(recipe.expectations.length, 4);
assert.equal(lock.segments.length, 4);
const tuples = recipe.segments.map((part, i) => {
    const tuple = lock.fields.map(field => {
        assert.ok(Object.hasOwn(part, field)); return [field, part[field]];
    });
    assert.equal(sha(JSON.stringify(tuple)), lock.segments[i].inputSHA256);
    assert.equal(part.name, lock.segments[i].name);
    assert.equal(part.name, recipe.expectations[i].name);
    assert.equal(part.moves.length, lock.segments[i].keys);
    return tuple;
});
assert.equal(sha(JSON.stringify(tuples)), lock.inputFieldsSHA256);
const primaryBytes = readFileSync(new URL('tools/gen-sessions/recipes/config-nul-contract.json', root));
assert.equal(sha(primaryBytes), 'fb29aa4a94ab7ed6e57a43aa49d174a25ccf2860b3fd7560a8b465637f4ef07c');
const primary = JSON.parse(primaryBytes);
const derivationBytes = readFileSync(new URL('primary-derivation.json', evidence));
assert.equal(sha(derivationBytes), 'e4dad99b3f21e8656b21506ebf85066edc8b21116abd4f5401190b349db35ed4');
const derivation = JSON.parse(derivationBytes);
assert.equal(derivation.originalRecipeSHA256, sha(bytes));
assert.equal(derivation.primaryRecipeSHA256, sha(primaryBytes));
assert.equal(derivation.inputLockSHA256, sha(lockBytes));
assert.deepEqual(derivation.preservedKeys, Object.keys(recipe));
assert.ok(Object.keys(derivation.addedMetadata).every(key => !Object.hasOwn(recipe, key)));
assert.deepEqual(primary, {...recipe, ...derivation.addedMetadata});
assert.equal(primary.requireBranchAssertions, true);
assert.equal(primary.branchAssertions.length, 4);
assert.deepEqual(primary.branches, recipe.segments.map(part => `config-nul-contract.${part.name}`));
assert.deepEqual(primary.branchAssertions, recipe.expectations.map((expected, i) => {
    const assertion = {branch: primary.branches[i], segment: i,
        screenCells: [{step: 0, x: 0, y: 1, equals: 'U'}]};
    assertion.screenCells.push({step: 0, x: i < 2 ? 3 : 8, y: i < 2 ? 4 : 12,
        equals: expected.roomOverride === 0 ? '.' : 'Z'});
    if (expected.prefix.length) assertion.rngIncludes = expected.prefix;
    return assertion;
}));
assert.deepEqual(branchAssertionErrors(primary), []);
const canonicalBytes = readFileSync(new URL('canonical-inputs.json', evidence));
assert.equal(sha(canonicalBytes), '6f0d1cc12129d288bfaafbdb64c96b5a4441c9077f78e33dad90b273adbd21fd');
const canonical = JSON.parse(canonicalBytes);
const negativeBytes = readFileSync(new URL('negative-hashes.json', evidence));
assert.equal(sha(negativeBytes), 'e2138cf99c41e1c5796030b4ede5a34e86db471cadd081f6d39d63c21ca458c4');

const gapBytes = readFileSync(new URL('tools/gen-sessions/evidence/config-nul-contract/open-byte-gaps.json', root));
assert.equal(sha(gapBytes), '127fca0e44e1bcaa2c140813c2c4a1e86f3b70ae0ddaa7d0583da30a642b8cd3');
const openGaps = JSON.parse(gapBytes);
assert.equal(openGaps.originalSix.candidateExact, 4);
assert.equal(openGaps.originalSix.cases, 6);
assert.equal(openGaps.originalSix.gateExit, 1);
assert.deepEqual(openGaps.expectedFailures.map(row => row.name),
    ['config-bytes-merged-ascii-cap', 'config-bytes-merged-utf8-cap']);

// Exact original C evidence is mandatory before importing the tested runtime.
const rawBytes = readFileSync(new URL('tools/gen-sessions/generated/config-nul-contract.session.json', root));
assert.equal(sha(rawBytes), 'de9db54ca299824437f0ffe66a24b99418bf68fedb980714c37a62ddf9c0a17e');
const native = JSON.parse(rawBytes);
assert.equal(native.version, 5);
assert.equal(native.source, 'c');
assert.ok(Array.isArray(native.segments));
assert.equal(native.segments.length, 4);
let boundaries = 0, calls = 0, frames = 0, keys = 0;
for (const [i, segment] of native.segments.entries()) {
    for (const field of lock.fields) {
        assert.ok(Object.hasOwn(segment, field), `native ${i}: missing ${field}`);
        assert.deepEqual(segment[field], recipe.segments[i][field], `native ${i}: ${field}`);
    }
    assert.ok(Array.isArray(segment.steps));
    assert.equal(segment.steps.length, segment.moves.length + 1);
    keys += segment.moves.length;
    for (const [stepIndex, step] of segment.steps.entries()) {
        assert.ok(Object.hasOwn(step, 'key'));
        assert.equal(step.key, stepIndex ? segment.moves[stepIndex - 1] : null);
        assert.equal(typeof step.screen, 'string');
        assert.ok(Array.isArray(step.cursor) && step.cursor.length === 3);
        assert.ok(Array.isArray(step.rng) && step.rng.every(call => typeof call === 'string'));
        if (Object.hasOwn(step, 'animation_frames')) assert.ok(Array.isArray(step.animation_frames));
        boundaries++;
        calls += step.rng.length;
        frames += (step.animation_frames || []).length;
    }
    for (const [j, prefix] of recipe.expectations[i].prefix.entries()) {
        const call = segment.steps[0].rng[j];
        assert.ok(call === prefix || call?.startsWith(prefix + ' @ '), 'C CHOOSE prefix precedes gameplay');
    }
}
assert.deepEqual({boundaries, calls, frames, keys}, {boundaries: 16, calls: 11768, frames: 0, keys: 12});
assert.deepEqual(recordingIntegrityErrors(native), []);
assert.deepEqual(branchAssertionErrors(primary, native), []);
const nativePreflight = {sha256: sha(rawBytes), version: 5, source: 'c',
    segments: 4, fields: lock.fields, boundaries, calls, frames, keys,
    primaryBranchAssertions: 4, integrityErrors: [], branchErrors: []};
await import(new URL('jsmain.js', js));
const state = await import(new URL('gstate.js', js));
const options = await import(new URL('options.js', js));
const symbols = await import(new URL('symbols.js', js));
const commands = await import(new URL('cmd.js', js));
const rng = await import(new URL('rng.js', js));
const {MSGTYP_NOSHOW, ATR_BOLD} = await import(new URL('const.js', js));
const {CLR_RED} = await import(new URL('terminal.js', js));
const deadline = setTimeout(() => process.exit(2), 55000);
const cases = [];
function check(name, fn) {
    try { fn(); cases.push({name, pass: true}); }
    catch (error) { cases.push({name, pass: false, error: error.message.slice(0, 1000)}); }
}
function parse(rc, seed = 9770) {
    state.resetGame();
    symbols.clear_symsetentry(symbols.PRIMARYSET, true);
    symbols.clear_symsetentry(symbols.ROGUESET, true);
    symbols.init_symbols(); symbols.savedsym_free(); commands.reset_commands(true);
    // C initoptions_init seeds before reading config. No gameplay runs here.
    rng.initRng(seed); rng.enableRngLog();
    const result = options.parseNethackrc(rc);
    return {errors: result.errors, unhandled: result.unhandled,
        calls: [...rng.getRngLog()], sectionStateCleared:
            !state.game.config_section_chosen && !state.game.config_section_current,
        effects: {
            opts: result.opts, presence: result.optSetInConfig || {},
            symbols: result.symbols, bindings: result.bindings,
            bind: commands.cmdbind_get('~'.charCodeAt(0))?.cmd?.ef_txt || null,
            primary: symbols.go_ov_primary_syms.map((v, i) => [i, v]).filter(([, v]) => v),
            rogue: symbols.go_ov_rogue_syms.map((v, i) => [i, v]).filter(([, v]) => v),
            menu: (state.game.menu_colorings || []).map(({origstr, color, attr}) => ({origstr, color, attr})),
            msg: (state.game.plinemsg_types || []).map(({pattern, msgtype}) => ({pattern, msgtype})),
            ape: (state.game.apelist || []).map(({pattern, grab}) => ({pattern, grab})),
        }};
}
function valid(got, calls = ['rn2(1)=0']) {
    assert.deepEqual(got.errors, []); assert.deepEqual(got.unhandled, []);
    assert.deepEqual(got.calls, calls); assert.equal(got.sectionStateCleared, true);
}
const directives = [
    ['OPTIONS', '!accessiblemsg', e => {
        assert.deepEqual(e.opts, {accessiblemsg: false});
        assert.deepEqual(e.presence, {accessiblemsg: true});
    }],
    ['AUTOPICKUP_EXCEPTION', '"<quarterstaff"', e => assert.deepEqual(e.ape, [{pattern: 'quarterstaff', grab: true}])],
    ['BINDINGS', '~:versionshort', e => assert.equal(e.bind, 'versionshort')],
    ['MSGTYPE', 'hide "^You sit on"', e => assert.deepEqual(e.msg, [{pattern: '^You sit on', msgtype: MSGTYP_NOSHOW}])],
    ['MENUCOLOR', '"quarterstaff"=red&bold', e => assert.deepEqual(e.menu, [{origstr: 'quarterstaff', color: CLR_RED, attr: ATR_BOLD}])],
    ['ROGUESYMBOLS', 'S_human:R', e => assert.ok(e.rogue.some(([, v]) => v === 82))],
    ['SYMBOLS', 'S_unexplored:U', e => assert.ok(e.primary.some(([, v]) => v === 85))],
];
try {
    const empty = parse('');
    for (const [key, value, observe] of directives) {
        const canonical = parse(`${key}=${value}\n`);
        check(`${key}/canonical-negative`, () => { valid(canonical, []); observe(canonical.effects); });
        check(`${key}/invisible-value-suffix`, () => {
            const got = parse(`${key}=${value}\0invisible\n`);
            valid(got, []); assert.deepEqual(got.effects, canonical.effects);
        });
        check(`${key}/hidden-backslash-keeps-next-directive-separate`, () => {
            const expected = parse(`${key}=${value}\nSYMBOLS=S_room:Z\n`);
            const got = parse(`${key}=${value}\0invisible\\\nSYMBOLS=S_room:Z\n`);
            valid(got, []); assert.deepEqual(got.effects, expected.effects);
        });
        check(`${key}/visible-backslash-before-NUL-continues`, () => {
            const expected = parse(`${key}=\\\n${value}\n`);
            const got = parse(`${key}=\\\0invisible\n${value}\n`);
            valid(got, []); assert.deepEqual(got.effects, expected.effects);
            assert.deepEqual(got.effects, canonical.effects);
        });
    }
    check('empty-visible-fragment-terminates-pending-statement', () => {
        const got = parse('OPTIONS=!accessiblemsg\\\n\0hidden\\\nSYMBOLS=S_room:Z\n');
        const expected = parse('OPTIONS=!accessiblemsg\nSYMBOLS=S_room:Z\n');
        valid(got, []); assert.deepEqual(got.effects, expected.effects);
    });
    check('NUL-visible-empty-at-EOF-dispatches-prior-pending', () => {
        const got = parse('OPTIONS=!accessiblemsg\\\n\0');
        valid(got, []); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('NUL-does-not-discard-later-physical-lines', () => {
        const got = parse('\0OPTIONS=invalid\nOPTIONS=!accessiblemsg\nSYMBOLS=S_room:Z');
        valid(got, []);
        assert.deepEqual(got.effects, parse('OPTIONS=!accessiblemsg\nSYMBOLS=S_room:Z').effects);
    });
    check('comment-visible-backslash-retains-pending', () => {
        const got = parse('OPTIONS=\\\n#comment\\\0hidden\n!accessiblemsg');
        valid(got, []); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('comment-hidden-backslash-terminates-pending', () => {
        const got = parse('OPTIONS=!accessiblemsg\\\n#comment\0hidden\\\nSYMBOLS=S_room:Z');
        valid(got, []);
        assert.deepEqual(got.effects, parse('OPTIONS=!accessiblemsg\nSYMBOLS=S_room:Z').effects);
    });
    check('header-NUL-suffix-is-invisible-even-inside-skipped-section', () => {
        const got = parse('CHOOSE=keep\n[skip]\n[keep]\0hidden\nOPTIONS=!accessiblemsg');
        valid(got); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('empty-header-NUL-suffix-clears-section-state', () => {
        const got = parse('CHOOSE=keep\n[skip]\n[]\0hidden\nOPTIONS=!accessiblemsg');
        valid(got); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('CHOOSE-visible-continuation-before-NUL-uses-joined-list', () => {
        const got = parse('CHOOSE=\\\0hidden\nkeep,other\n[other]\nOPTIONS=!accessiblemsg');
        valid(got, ['rn2(2)=1']); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('NUL-only-and-hidden-comment-have-no-handler-effect', () => {
        assert.deepEqual(parse('\0hidden\n\0#comment\\\n'), empty);
    });
    const additional = recipe;
    for (const [index, name] of ['partial-UTF8-is-not-replacement-header', 'complete-UTF8-matches-literal-header'].entries())
        check(name, () => {
            const part = additional.segments[index], expected = additional.expectations[index];
            const got = parse(part.nethackrc, part.seed);
            valid(got, expected.prefix);
            const room = symbols.match_sym('S_room'); assert.ok(room);
            assert.equal(symbols.go_ov_primary_syms[room.idx] || 0, expected.roomOverride);
        });
    const report = {ownerSHA256: sha(readFileSync(new URL('options.js', js))), nativePreflight,
        primaryRecipeSHA256: sha(primaryBytes), openGapManifestSHA256: sha(gapBytes),
        scope: 'NUL visibility within existing physical entries; byte fragment/cap closure explicitly excluded',
        total: cases.length, passed: cases.filter(row => row.pass).length, cases};
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total, fullByteContract: 'open, original6 remains4/6 exit1'}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
