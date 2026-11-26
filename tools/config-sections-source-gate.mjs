import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const reportPath = process.argv[2];
assert.ok(process.argv.length <= 3, 'optional argument: compact report path');
const root = new URL('../', import.meta.url), js = new URL('js/', root);
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
        check(`${key}/selected-and-invalid-inactive-body`, () => {
            const got = parse(`CHOOSE=keep\n[keep]\n${key}=${value}\n[skip]\n${key}=invalid\n[]\n`);
            valid(got); observe(got.effects); assert.deepEqual(got.effects, canonical.effects);
        });
        check(`${key}/skipped-handler-has-no-effect`, () => {
            const got = parse(`CHOOSE=keep\n[skip]\n${key}=${value}\n[]\n`);
            valid(got); assert.deepEqual(got.effects, empty.effects);
        });
    }
    for (const [name, seed, choice, header, calls, selected] of [
        ['two-left', 9771, 'left,right', 'left', ['rn2(2)=0'], true],
        ['two-right', 9770, 'left,right', 'right', ['rn2(2)=1'], true],
        ['leading-comma-walk', 9771, ',left', 'left', ['rn2(2)=0'], true],
        ['trailing-comma-first', 9771, 'left,', 'left', ['rn2(2)=0'], true],
        ['literal-leading-space', 9770, ' keep', 'keep', ['rn2(1)=0'], false],
        ['literal-space-before-comma', 9771, 'left ,right', 'left', ['rn2(2)=0'], false],
        ['literal-case', 9770, 'Keep', 'keep', ['rn2(1)=0'], false],
        ['literal-internal-spaces', 9770, 'two  words', 'two  words', ['rn2(1)=0'], true],
        ['literal-hash', 9770, 'left#comment', 'left#comment', ['rn2(1)=0'], true],
    ]) check(`choice/${name}`, () => {
        const got = parse(`CHOOSE=${choice}\n[${header}]\nOPTIONS=!accessiblemsg\n[]`, seed);
        valid(got, calls);
        assert.deepEqual(got.effects.opts, selected ? {accessiblemsg: false} : {});
        assert.deepEqual(got.effects.presence, selected ? {accessiblemsg: true} : {});
    });
    for (const [name, choice, seed, calls] of [
        ['empty', '', 9770, ['rn2(1)=0']],
        ['leading-comma-second', ',left', 9770, ['rn2(2)=1']],
        ['trailing-comma-second', 'left,', 9770, ['rn2(2)=1']],
    ]) check(`source-only-error/${name}`, () => {
        const got = parse(`CHOOSE=${choice}\nOPTIONS=!accessiblemsg`, seed);
        assert.deepEqual(got.calls, calls);
        assert.deepEqual(got.errors, ['No config section to choose']);
        assert.deepEqual(got.unhandled, []); assert.equal(got.sectionStateCleared, true);
        assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    for (const [name, keyword] of [['ascii-case', 'cHoOsE'], ['space-before-delimiter', 'CHOOSE \t']])
        check(`keyword/${name}`, () => {
            const got = parse(`${keyword}=keep\n[keep]\nOPTIONS=!accessiblemsg`);
            valid(got); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
        });
    for (const [name, choice, header] of [
        ['colon-before-equals', ':left=tail', 'left=tail'],
        ['equals-before-colon', '=left:tail', 'left:tail'],
    ]) check(`keyword/${name}`, () => {
        const got = parse(`CHOOSE${choice}\n[${header}]\nOPTIONS=!accessiblemsg`);
        valid(got); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    for (const keyword of ['CHOOS', 'CHOOSES', 'CHOOſE'])
        check(`keyword/reject-${keyword}`, () => {
            const line = `${keyword}=keep`, got = parse(`${line}\nOPTIONS=!accessiblemsg`);
            assert.deepEqual(got.calls, []);
            // src/cfgfiles.c:1844 reads file bytes before keyword matching.
            assert.deepEqual(got.unhandled, [Buffer.from(line, 'utf8').toString('latin1')]);
            assert.deepEqual(got.effects.opts, {accessiblemsg: false});
        });
    check('source-only-error/missing-delimiter-does-not-draw', () => {
        const got = parse('CHOOSE\nOPTIONS=!accessiblemsg');
        assert.deepEqual(got.calls, []);
        assert.deepEqual(got.errors, ['Format is CHOOSE=section1,section2,...']);
        assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('inactive-choose-and-invalid-line-do-not-run', () => {
        const got = parse('CHOOSE=keep\n[skip]\nCHOOSE=ignored\nnot a directive\n[keep]\nOPTIONS=!accessiblemsg');
        valid(got); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('active-rechoose-retains-current-until-new-header', () => {
        const got = parse('CHOOSE=first\n[first]\nCHOOSE=second\nSYMBOLS=S_unexplored:Z\n[second]\nSYMBOLS=S_unexplored:U');
        valid(got, ['rn2(1)=0', 'rn2(1)=0']);
        assert.deepEqual(got.effects.symbols, ['S_unexplored:U']);
    });
    check('source-only-error/empty-rechoose-skips-until-header-clears-current', () => {
        const got = parse('CHOOSE=keep\n[keep]\nCHOOSE=\nSYMBOLS=S_unexplored:Z\n[keep]\nSYMBOLS=S_unexplored:U');
        assert.deepEqual(got.calls, ['rn2(1)=0', 'rn2(1)=0']);
        assert.deepEqual(got.errors, ['No config section to choose', 'Section "[keep]" without CHOOSE']);
        assert.deepEqual(got.effects.symbols, ['S_unexplored:U']);
        assert.equal(got.sectionStateCleared, true);
    });
    check('source-only-error/missing-delimiter-retains-prior-choice', () => {
        const got = parse('CHOOSE=keep\n[keep]\nCHOOSE\nOPTIONS=!accessiblemsg');
        assert.deepEqual(got.calls, ['rn2(1)=0']);
        assert.deepEqual(got.errors, ['Format is CHOOSE=section1,section2,...']);
        assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('unsectioned-body-after-choose-is-active', () => {
        const got = parse('CHOOSE=keep\nOPTIONS=!accessiblemsg');
        valid(got); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('empty-header-in-ignored-section-restores-unsectioned-body', () => {
        const got = parse('CHOOSE=keep\n[skip]\n[]\nOPTIONS=!accessiblemsg');
        valid(got); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('empty-header-clears-chosen-as-well-as-current', () => {
        const got = parse('CHOOSE=keep\n[keep]\n[]\n[keep]\nOPTIONS=!accessiblemsg');
        assert.deepEqual(got.calls, ['rn2(1)=0']);
        assert.deepEqual(got.errors, ['Section "[keep]" without CHOOSE']);
        assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    check('empty-header-without-choose-is-recognized-error', () => {
        const got = parse('[]\nOPTIONS=!accessiblemsg');
        assert.deepEqual(got.calls, []);
        assert.deepEqual(got.errors, ['Section "[]" without CHOOSE']);
        assert.deepEqual(got.effects.opts, {accessiblemsg: false});
    });
    for (const header of ['[keep]', '[ keep \t]', '[keep]#comment', '[keep]  #comment'])
        check(`header/valid-${header}`, () => {
            const got = parse(`CHOOSE=keep\n[skip]\n${header}\nOPTIONS=!accessiblemsg`);
            valid(got); assert.deepEqual(got.effects.opts, {accessiblemsg: false});
        });
    for (const header of ['[keep', '[keep]tail', '[keep]\t#comment', '[keep]]'])
        check(`header/invalid-stays-in-skipped-body-${header}`, () => {
            const got = parse(`CHOOSE=keep\n[skip]\n${header}\nOPTIONS=!accessiblemsg`);
            valid(got); assert.deepEqual(got.effects.opts, {});
        });
    for (const option of ['symset', 'roguesymset'])
        check(`nested-read/${option}-clears-both-shared-fields`, () => {
            const got = parse(`CHOOSE=keep\n[keep]\nOPTIONS=${option}:DECgraphics\nCHOOSE=next\nBIND=~:versionshort`);
            valid(got, ['rn2(1)=0', 'rn2(1)=0']);
            assert.equal(got.effects.bind, 'versionshort');
        });
    check('parse-return-clears-state-before-next-nonempty-or-empty-call', () => {
        const got = parse('CHOOSE=keep\n[skip]'); valid(got);
        const next = options.parseNethackrc('OPTIONS=!accessiblemsg');
        assert.deepEqual(next.errors, []); assert.deepEqual(next.opts, {accessiblemsg: false});
        assert.deepEqual(options.parseNethackrc('').errors, []);
        assert.ok(!state.game.config_section_chosen && !state.game.config_section_current);
        assert.deepEqual(rng.getRngLog(), ['rn2(1)=0']);
    });
    check('comments-do-not-select-or-draw-negative', () => {
        assert.deepEqual(parse('# CHOOSE=keep\n# [skip]\n# OPTIONS=!accessiblemsg\n# []'), empty);
    });
    const owners = ['options.js', 'jsmain.js', 'symbols.js', 'cfgfiles.js'];
    const ownerSHA256 = Object.fromEntries(owners.map(name => [name,
        createHash('sha256').update(readFileSync(new URL(name, js))).digest('hex')]));
    const report = {ownerSHA256, total: cases.length, passed: cases.filter(c => c.pass).length,
        scope: 'Real parser and handlers; source-only malformed edges do not assert diagnostic rendering', cases};
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
