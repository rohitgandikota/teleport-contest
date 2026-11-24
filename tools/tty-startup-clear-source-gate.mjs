// Pinned source contracts, separate from the existing native fixture proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const sources = [];
function body(file, name, javascript = false) {
    const text = read(file);
    const prefix = javascript ? '(?:export )?(?:async )?function ' : '';
    const match = text.match(new RegExp(`^${prefix}${name}\\([^]*?^}`, 'm'));
    assert.ok(match, `${file}:${name}`);
    sources.push({ file, function: name,
        line: text.slice(0, match.index).split('\n').length,
        functionSha256: sha(match[0]), fileSha256: sha(text) });
    return match[0];
}
const cInit = body('nethack-c/recorder/win/tty/wintty.c', 'tty_init_nhwindows');
const cClear = body('nethack-c/recorder/win/tty/wintty.c', 'tty_clear_nhwindow');
const cErase = body('nethack-c/recorder/win/tty/wintty.c', 'erase_tty_screen');
const cScreen = body('nethack-c/recorder/win/tty/termcap.c', 'term_clear_screen');
const cHome = body('nethack-c/recorder/win/tty/termcap.c', 'home');
const cPut = body('nethack-c/recorder/win/tty/wintty.c', 'tty_putstr');
const cMain = body('nethack-c/recorder/sys/unix/unixmain.c', 'main');
const init = body('js/plselect.js', 'tty_init_nhwindows', true);
const startup = body('js/allmain.js', 'newgame', true);
const put = body('js/tty/wintty.js', 'tty_putstr_base', true);
const curs = body('js/tty/wintty.js', 'tty_curs_base', true);
const physical = body('js/tty/wintty.js', 'tty_base_cursor', true);

function ordered(text, ...parts) {
    let position = -1;
    for (const part of parts) {
        const next = text.indexOf(part, position + 1);
        assert.ok(next > position, `missing or misordered: ${part}`);
        position = next;
    }
}
const checks = [];
const failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message.split('\n')[0] });
    }
}

check('the initialized base window is cleared before any startup banner output', () => {
    ordered(cInit, 'tty_create_nhwindow(NHW_BASE)', 'tty_clear_nhwindow(BASE_WINDOW)',
        'tty_curs(BASE_WINDOW, 1, 4)', 'copyright_banner_line(i)');
    ordered(init, 'game.nhDisplay.clearScreen()', 'tty_curs_base(1, 4)', 'tty_putstr_base(line)');
});
check('base clearing resets the logical cursor as well as the physical screen', () => {
    const base = cClear.slice(cClear.indexOf('case NHW_BASE:'), cClear.indexOf('case NHW_MENU:'));
    assert.match(base, /if \(!erasing_tty_screen\)\s*{\s*term_clear_screen\(\)/);
    assert.match(cClear, /cw->curx = cw->cury = 0;\s*\/\* cw->blanked/);
    assert.match(cErase, /tty_curs\(BASE_WINDOW, 1, 0\)/);
    ordered(init, 'game.nhDisplay.clearScreen()', 'tty_curs_base(1, 0)',
        'if (game.flags.splash_screen === false) return');
    assert.match(curs, /base.curx = x - 1/);
    assert.match(curs, /base.cury = y/);
});
check('the existing clear dependency homes the cursor and writes default foreground', () => {
    ordered(cScreen, 'if (CL)', 'xputs(CL)', 'home()', 'nomux_clear_screen()', 'erase_tty_screen()');
    assert.match(cHome, /ttyDisplay->curx = ttyDisplay->cury = 0/);
    const clear = read('js/game_display.js').match(/^    clearScreen\(\) {[^]*?^    }/m)?.[0];
    assert.ok(clear);
    ordered(clear, 'this.terminal.setCell(col, row, \' \', NO_COLOR, 0)', 'this.terminal.setCursor(0, 0)');
});
check('banner rows and the following logical prompt position retain C order', () => {
    ordered(cInit, 'tty_curs(BASE_WINDOW, 1, 4)', 'i <= 4', 'copyright_banner_line(i)',
        'tty_putstr(BASE_WINDOW, 0, "")', 'tty_curs(BASE_WINDOW, 1, 11)');
    ordered(init, 'tty_curs_base(1, 4)', 'for (const line of COPYRIGHT_BANNER)',
        'tty_putstr_base(line)', "tty_putstr_base('')", 'tty_curs_base(1, 11)');
});
check('the existing banner option does not bypass the base-window clear', () => {
    ordered(init, 'game.nhDisplay.clearScreen()',
        'if (game.flags.splash_screen === false) return', 'tty_curs_base(1, 4)');
    assert.doesNotMatch(cInit, /splash_screen/);
});
check('startup precedes name selection and recovery in the actual callers', () => {
    ordered(cMain, 'init_nhwindows(&argc, argv)', 'plnamesuffix()', 'dorecover(');
    ordered(startup, 'tty_init_nhwindows()', 'await plnamesuffix()',
        'await player_selection()', 'await dorecover()');
});
check('banner writes retain the existing base cursor and ordinary character contract', () => {
    const base = cPut.slice(cPut.indexOf('case NHW_BASE:'), cPut.indexOf('case NHW_MENU:'));
    ordered(base, 'tty_curs(window, cw->curx + 1, cw->cury)', 'while (*str)',
        'nomux_putch(*str)', 'cw->curx = 0;', 'cw->cury++;', 'term_end_attr(attr)');
    ordered(put, 'display.setCell(col, base.cury, s[i], NO_COLOR, attr)',
        'base.curx = 0', 'base.cury++');
    assert.match(physical, /display.setCursor\(base.curx, base.cury\)/);
});
check('the startup owner adds no input, RNG, asynchronous or serialization work', () => {
    assert.ok(init.startsWith('export function tty_init_nhwindows()'));
    assert.doesNotMatch(init, /\b(?:await|async|nhgetch|rn2|rnd|rn1|serialize|decodeScreen|seed)\b/);
});

console.log(JSON.stringify({ evidence: 'source-only', passed: checks.length,
    total: checks.length + failures.length, checks, failures, sources,
    limits: [
        'The existing JS splash_screen policy remains; C tty_init_nhwindows has no such gate.',
        'TTY platform setup, terminal modes and cursor visibility are outside this patch.',
        'The physical prompt cursor is applied by the existing tty_base_cursor input path.',
        'Raw-score blank attributes and map-glyph blank foregrounds remain separate owners.',
    ] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
