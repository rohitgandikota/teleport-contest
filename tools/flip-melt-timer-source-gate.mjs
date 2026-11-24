#!/usr/bin/env node
// Static pinned-source contracts only. This neither executes C nor measures coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const sources = [];
const bodies = new Map();
for (const [file, names] of Object.entries({
    sp_lev: ['flip_level'],
    mkmaze: ['get_level_extends'],
    wizcmds: ['wiz_flip_level'],
    pager: ['ice_descr'],
    zap: ['start_melt_ice_timeout', 'melt_ice_away', 'melt_ice'],
    timeout: ['start_timer', 'run_timers', 'spot_time_expires', 'spot_time_left']
})) {
    const path = `nethack-c/recorder/src/${file}.c`;
    const source = read(path);
    for (const name of names) {
        const match = source.match(new RegExp(`^${name}\\([^]*?^}`, 'm'));
        assert.ok(match, `${path}: ${name}`);
        bodies.set(`${file}.${name}`, match[0]);
        sources.push({ file: path, function: name,
            line: source.slice(0, match.index).split('\n').length,
            functionSha256: sha(match[0]), fileSha256: sha(source) });
    }
}

const passed = [];
const failures = [];
function check(name, fn) {
    try {
        fn();
        passed.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}
const cFlip = bodies.get('sp_lev.flip_level');
const cLoop = cFlip.slice(cFlip.indexOf('/* timed effects */'),
    cFlip.indexOf('/* exclusion zones */'));
const jsSource = read('js/sp_lev.js');
const jsFlip = jsSource.match(/^export async function flip_level\([^]*?^}/m)[0];
const jsLoop = jsFlip.match(/\/\* timed effects[^]*?(?=    \/\* exclusion zones)/)?.[0] || '';

check('C walks every live timer and selects only the melt function', () => {
    assert.match(cLoop, /timer = gt\.timer_base; timer; timer = timer->next/);
    assert.match(cLoop, /if \(timer->func_index == MELT_ICE_AWAY\)/);
    assert.doesNotMatch(cLoop, /extras|inFlipArea|kind|timeout\s*=|start_timer|stop_timer/);
});
check('C unpacks and repacks coordinates with independent axis flags', () => {
    assert.match(cLoop, /ty = timer->arg\.a_long & 0xffff/);
    assert.match(cLoop, /tx = \(timer->arg\.a_long >> 16\) & 0xffff/);
    assert.match(cLoop, /if \(flp & 1\)\s*ty = FlipY\(ty\)/);
    assert.match(cLoop, /if \(flp & 2\)\s*tx = FlipX\(tx\)/);
    assert.match(cLoop, /timer->arg\.a_long = \(\(tx << 16\) \| ty\)/);
});
check('C places the timer pass after cell swaps and before exclusions', () => {
    assert.ok(cFlip.indexOf('/* the map */') < cFlip.indexOf('/* timed effects */'));
    assert.ok(cFlip.indexOf('/* timed effects */') < cFlip.indexOf('/* exclusion zones */'));
    assert.ok(cFlip.indexOf('if ((flp & 3) == 0)') < cFlip.indexOf('/* timed effects */'));
});
check('ordinary creation uses a packed TIMER_LEVEL deadline', () => {
    const create = bodies.get('zap.start_melt_ice_timeout');
    assert.match(create, /where = \(\(long\) x << 16\) \| \(long\) y/);
    assert.match(create, /start_timer\(\(long\) when, TIMER_LEVEL, MELT_ICE_AWAY/);
    assert.match(bodies.get('timeout.start_timer'), /gnu->timeout = svm\.moves \+ when/);
});
check('dispatch removes the due head and passes its original argument', () => {
    const dispatch = bodies.get('timeout.run_timers');
    assert.match(dispatch, /gt\.timer_base->timeout <= svm\.moves/);
    assert.match(dispatch, /gt\.timer_base = curr->next/);
    assert.match(dispatch, /f\)\(&curr->arg, curr->timeout\)/);
});
check('the real callback decodes the square and invokes melt_ice', () => {
    const callback = bodies.get('zap.melt_ice_away');
    assert.match(callback, /where & 0xFFFF/);
    assert.match(callback, /\(where >> 16\) & 0xFFFF/);
    assert.match(callback, /melt_ice\(x, y, "Some ice melts away\."\)/);
    assert.match(bodies.get('zap.melt_ice'), /spot_stop_timers\(x, y, MELT_ICE_AWAY\)/);
});
check('timer lookup uses the packed square and reports the original remaining time', () => {
    assert.match(bodies.get('timeout.spot_time_expires'), /curr->arg\.a_long == where/);
    assert.match(bodies.get('timeout.spot_time_expires'), /return curr->timeout/);
    assert.match(bodies.get('timeout.spot_time_left'), /expires - svm\.moves/);
});
check('the first visible effect comes from the real ice description lookup', () => {
    const description = bodies.get('pager.ice_descr');
    assert.match(description, /spot_time_left\(x, y, MELT_ICE_AWAY\)/);
    assert.match(description, /!time_left \? 0/);
    assert.match(description, /time_left > 100L\) \? 2/);
    assert.match(read('js/pager.js'), /spot_time_left\(x, y, MELT_ICE_AWAY\)/);
});
check('the ordinary explicit wizard choice reaches the extras arm', () => {
    assert.match(bodies.get('wizcmds.wiz_flip_level'), /flip_level\(\(int\) c, TRUE\)/);
});
check('JS imports the numeric melt function and changes only packed timer arguments', () => {
    assert.match(jsSource, /import \{ start_timer,[^}]*MELT_ICE_AWAY,[^}]*\} from '\.\/timeout\.js'/);
    assert.match(jsLoop, /for \(const timer of \(game\.timer_base \|\| \[\]\)\)/);
    assert.match(jsLoop, /if \(timer\.func_index === MELT_ICE_AWAY\)/);
    assert.match(jsLoop, /timer\.arg = \(tx << 16\) \| ty/);
    assert.deepEqual([...jsLoop.matchAll(/timer\.(\w+)\s*=(?!=)/g)].map(match => match[1]), ['arg']);
    assert.doesNotMatch(jsLoop, /extras|inFlipArea|\.kind|\brn2\b|\brnd\b|start_timer|stop_timer|sort|splice/);
});
check('JS keeps the C phase order and both independent axis transforms', () => {
    assert.ok(jsLoop.length > 0);
    assert.ok(jsFlip.indexOf('/* the map */') < jsFlip.indexOf('/* timed effects'));
    assert.ok(jsFlip.indexOf('/* timed effects') < jsFlip.indexOf('/* exclusion zones'));
    assert.match(jsLoop, /if \(flp & 1\)\s*ty = FlipY\(ty\)/);
    assert.match(jsLoop, /if \(flp & 2\)\s*tx = FlipX\(tx\)/);
});

console.log(JSON.stringify({ evidence: 'static pinned C and JS source',
    passed: passed.length, total: passed.length + failures.length,
    functions: sources.length, checks: passed, failures, sources,
    touchedJsFunction: { function: 'flip_level', sha256: sha(jsFlip) }
}, null, 4));
if (failures.length)
    process.exitCode = 1;
