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
const {MSGTYP_NOSHOW, ATR_BOLD} = await import(new URL('const.js', js));
const {CLR_RED} = await import(new URL('terminal.js', js));
const deadline = setTimeout(() => process.exit(2), 55000);
const cases = [];
function check(name, fn) {
    try { fn(); cases.push({name, pass: true}); }
    catch (error) { cases.push({name, pass: false, error: error.message.slice(0, 1200)}); }
}
function parse(rc) {
    state.resetGame();
    symbols.clear_symsetentry(symbols.PRIMARYSET, true);
    symbols.clear_symsetentry(symbols.ROGUESET, true);
    symbols.init_symbols(); symbols.savedsym_free(); commands.reset_commands(true);
    const result = options.parseNethackrc(rc);
    return {result, effects: {
        opts: result.opts, presence: result.optSetInConfig || {},
        bind: commands.cmdbind_get('~'.charCodeAt(0))?.cmd?.ef_txt || null,
        primary: symbols.go_ov_primary_syms.map((v, i) => [i, v]).filter(([, v]) => v),
        rogue: symbols.go_ov_rogue_syms.map((v, i) => [i, v]).filter(([, v]) => v),
        menu: (state.game.menu_colorings || []).map(({origstr, color, attr}) => ({origstr, color, attr})),
        msg: (state.game.plinemsg_types || []).map(({pattern, msgtype}) => ({pattern, msgtype})),
        ape: (state.game.apelist || []).map(({pattern, grab}) => ({pattern, grab})),
    }};
}
// C cfgfiles.c config_line_stmt and the actual handlers' observable results.
const directives = [
    ['OPTIONS', 4, '!accessiblemsg', e => {
        assert.deepEqual(e.opts, {accessiblemsg: false});
        assert.deepEqual(e.presence, {accessiblemsg: true});
    }],
    ['AUTOPICKUP_EXCEPTION', 5, '"<quarterstaff"', e => assert.deepEqual(e.ape, [{pattern: 'quarterstaff', grab: true}])],
    ['BINDINGS', 4, '~:versionshort', e => assert.equal(e.bind, 'versionshort')],
    ['MSGTYPE', 7, 'hide "^You sit on"', e => assert.deepEqual(e.msg, [{pattern: '^You sit on', msgtype: MSGTYP_NOSHOW}])],
    ['MENUCOLOR', 9, '"quarterstaff"=red&bold', e => assert.deepEqual(e.menu, [{origstr: 'quarterstaff', color: CLR_RED, attr: ATR_BOLD}])],
    ['ROGUESYMBOLS', 4, 'S_human:R', e => assert.ok(e.rogue.some(([, v]) => v === 82))],
    ['SYMBOLS', 4, 'S_unexplored:U', e => assert.ok(e.primary.some(([, v]) => v === 85))],
];
try {
    const empty = parse('').effects;
    for (const [name, min, value, observe] of directives) {
        const canonical = parse(`${name}=${value}\n`);
        check(`${name}/canonical-real-handler`, () => {
            assert.deepEqual(canonical.result.errors, []); observe(canonical.effects);
        });
        const forms = new Set([`${name}:${value}`, `${name.slice(0, min)}=${value}`,
            `${name.slice(0, min)}:${value}`, `${name.toLowerCase()}:${value}`,
            ` \t${name.slice(0, min).toLowerCase()} \t : \t${value}\t `]);
        for (const [i, line] of [...forms].entries())
            check(`${name}/accepted-${i}`, () => {
                const got = parse(line + '\n');
                assert.deepEqual(got.result.errors, []); assert.deepEqual(got.result.unhandled, []);
                observe(got.effects); assert.deepEqual(got.effects, canonical.effects);
            });
        for (const [kind, key] of [['short', name.slice(0, min - 1)], ['overlong', name + 'X'], ['unrelated', 'X' + name]])
            check(`${name}/reject-${kind}`, () => assert.deepEqual(parse(`${key}=${value}\n`).effects, empty));
    }
    check('OPTIONS/value-keeps-internal-spaces', () => {
        const got = parse('OPTI:name:Two  Words\n');
        assert.equal(got.effects.opts.name, 'Two  Words');
        assert.deepEqual(got.result.errors, []);
    });
    check('OPTIONS/earliest-equals-keeps-later-colon', () => {
        assert.equal(parse('OPTI=name:Two:Words\n').effects.opts.name, 'Two:Words');
    });
    check('OPTIONS/earliest-colon-keeps-later-equals', () => {
        assert.equal(parse('OPTI:name=Two:Words\n').effects.opts.name, 'Two:Words');
    });
    check('MSGTYPE/munged-pattern', () => {
        assert.equal(parse('MSGTYPE: hide "^Two\t  Words"\n').effects.msg[0].pattern, '^Two Words');
    });
    check('MENUCOLOR/value-equals-not-directive-delimiter', () => {
        assert.equal(parse('MENUCOLOR:"a:b"=red\n').effects.menu[0].origstr, 'a:b');
    });
    check('OPTIONS/false-is-present-absent-is-not', () => {
        assert.deepEqual(parse('OPTIONS:!tutorial\n').effects.presence, {tutorial: true});
        assert.deepEqual(parse('# comment\n\n').effects.presence, {});
    });
    check('OPTIONS/statement-order-and-final-line', () => {
        assert.equal(parse('OPTI:accessiblemsg\nOPTI=!accessiblemsg').effects.opts.accessiblemsg, false);
    });
    check('unsupported-directive-keeps-existing-unhandled-path', () => {
        const got = parse('AUTOCOMPLETE=version\n');
        assert.deepEqual(got.effects, empty);
        assert.deepEqual(got.result.unhandled, ['AUTOCOMPLETE=version']);
    });
    check('missing-delimiter-keeps-existing-error-path', () => {
        const got = parse('OPTIONS !accessiblemsg\n');
        assert.deepEqual(got.effects, empty); assert.equal(got.result.errors.length, 1);
    });
    for (const line of ['\u017fYMBOLS=S_unexplored:U', 'B\u0131ND=~:versionshort',
        'BIND\u0131NGS=~:versionshort', 'OPT\u0130=!accessiblemsg'])
        check(`ASCII-only/reject-${line}`, () => assert.deepEqual(parse(line + '\n').effects, empty));
    const ownerSHA256 = createHash('sha256').update(readFileSync(new URL('options.js', js))).digest('hex');
    const report = {ownerSHA256, total: cases.length, passed: cases.filter(c => c.pass).length, cases};
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
