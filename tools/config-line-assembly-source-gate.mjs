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
    catch (error) { cases.push({name, pass: false, error: error.message.slice(0, 900)}); }
}
function parse(rc) {
    state.resetGame();
    symbols.clear_symsetentry(symbols.PRIMARYSET, true);
    symbols.clear_symsetentry(symbols.ROGUESET, true);
    symbols.init_symbols(); symbols.savedsym_free(); commands.reset_commands(true);
    const result = options.parseNethackrc(rc);
    return {errors: result.errors, unhandled: result.unhandled, effects: {
        opts: result.opts, presence: result.optSetInConfig || {},
        bind: commands.cmdbind_get('~'.charCodeAt(0))?.cmd?.ef_txt || null,
        primary: symbols.go_ov_primary_syms.map((v, i) => [i, v]).filter(([, v]) => v),
        rogue: symbols.go_ov_rogue_syms.map((v, i) => [i, v]).filter(([, v]) => v),
        menu: (state.game.menu_colorings || []).map(({origstr, color, attr}) => ({origstr, color, attr})),
        msg: (state.game.plinemsg_types || []).map(({pattern, msgtype}) => ({pattern, msgtype})),
        ape: (state.game.apelist || []).map(({pattern, grab}) => ({pattern, grab})),
    }};
}
// These are effects of real handlers, not a replacement parser or callback.
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
        check(`${key}/canonical-negative`, () => {
            assert.deepEqual(canonical.errors, []); assert.deepEqual(canonical.unhandled, []);
            observe(canonical.effects);
        });
        const forms = {
            'continued-value': `${key}=\\\n${value}\n`,
            'final-no-newline': `${key}=\\\n${value}`,
            'comment-continues': `${key}=\\\n \t# ignore this fragment\\\n${value}\n`,
            'empty-marker-continues': `${key}=\\\n \t\\\n${value}\n`,
            'comment-terminates': `${key}=\\\n${value}\\\n# end the pending statement\n`,
            'blank-terminates': `${key}=\\\n${value}\\\n \t\n`,
        };
        for (const [name, rc] of Object.entries(forms))
            check(`${key}/${name}`, () => {
                const got = parse(rc); observe(got.effects); assert.deepEqual(got, canonical);
            });
        for (const end of ['', '\n'])
            check(`${key}/discard-pending-at-EOF-${end ? 'LF' : 'no-LF'}`, () => {
                assert.deepEqual(parse(`${key}=${value}\\${end}`), empty);
            });
    }
    const names = [
        ['merge-space', 'OPTIONS=name:One\\\nTwo\n', 'One Two'],
        ['retain-space-before-marker', 'OPTIONS=name:One  \\\nTwo\n', 'One   Two'],
        ['retain-tab-before-marker', 'OPTIONS=name:One\t\\\nTwo\n', 'One\t Two'],
        ['strip-leading-fragment-space-tab', 'OPTIONS=name:One\\\n \t Two\n', 'One Two'],
        ['multiple-fragments', 'OPTIONS=name:One\\\nTwo\\\nThree\n', 'One Two Three'],
        ['comment-without-marker-dispatches', 'OPTIONS=name:One\\\n# stop\n', 'One'],
        ['blank-without-marker-dispatches', 'OPTIONS=name:One\\\n\n', 'One'],
        ['spaces-after-marker-disable-continuation', 'OPTIONS=name:One\\ \t\n', 'One\\'],
        ['CRLF-after-marker-disables-continuation', 'OPTIONS=name:One\\\r\n', 'One\\'],
        ['ordinary-CRLF-negative', 'OPTIONS=name:One\r\n', 'One'],
        ['inline-hash-is-value-negative', 'OPTIONS=name:One#Two\n', 'One#Two'],
        ['hash-after-continued-value-is-value', 'OPTIONS=name:One#\\\nTwo\n', 'One# Two'],
    ];
    for (const [name, rc, expected] of names)
        check(name, () => {
            const got = parse(rc); assert.deepEqual(got.errors, []);
            assert.equal(got.effects.opts.name, expected);
        });
    check('separate-statement-after-comment-termination', () => {
        const got = parse('OPTIONS=name:One\\\n# stop\nOPTIONS=!accessiblemsg\n');
        assert.deepEqual(got.errors, []);
        assert.deepEqual(got.effects.opts, {name: 'One', accessiblemsg: false});
        assert.deepEqual(got.effects.presence, {accessiblemsg: true});
    });
    check('comment-marker-with-no-pending-does-not-join-next', () => {
        assert.deepEqual(parse('# ignored\\\nOPTIONS=!accessiblemsg\n'), parse('OPTIONS=!accessiblemsg\n'));
    });
    check('blank-and-comment-only-negative', () => assert.deepEqual(parse(' \t\n# comment\r\n\n'), empty));
    check('pending-is-local-to-one-parse-call', () => {
        assert.deepEqual(parse('OPTIONS=name:Discard\\\n'), empty);
        assert.deepEqual(parse('OPTIONS=!accessiblemsg\n'), parse('OPTIONS:!accessiblemsg'));
    });
    check('munged-quoted-pattern-after-merge', () => {
        const got = parse('MSGTYPE=hide "^One  \\\n Two#"\n');
        assert.deepEqual(got.errors, []);
        assert.deepEqual(got.effects.msg, [{pattern: '^One Two#', msgtype: MSGTYP_NOSHOW}]);
    });
    const ownerSHA256 = createHash('sha256').update(readFileSync(new URL('options.js', js))).digest('hex');
    const report = {ownerSHA256, total: cases.length, passed: cases.filter(c => c.pass).length,
        scope: 'Ordinary short physical lines, no sections, NUL or truncation claims', cases};
    if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, total: report.total}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(deadline); }
