// Source-only interrupt prerequisite. Calls the real producer during a real pending reader.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {getlin, hooked_tty_getlin} from '../js/cmd.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {pline, display_nhwindow_message, TOPLINE_NEED_MORE} from '../js/display.js';
import {tty_wait_synch} from '../js/tty/wintty.js';

const base = {seed: 9770, datetime: '20000112093000', moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
        + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=symset:plain\n'};
async function boot(mode = 'single') {
    const run = await runSegment({...base, nethackrc: base.nethackrc + `OPTIONS=msg_window:${mode}\n`,
        storage: new InMemoryStorage()});
    resetInputState(); run._display.onEmptyQueue = () => 32;
    await display_nhwindow_message();
    for (const message of ['Earlier message.', 'Before the prompt.']) {
        await pline(message);
        await display_nhwindow_message();
    }
    return run;
}
const snapshot = run => ({inread: game.ttyDisplay?.inread || 0,
    intr: game.ttyDisplay?.intr || 0, toplin: game._toplin,
    visible: run._display.grid[0].map(c => c.ch).join('').trimEnd(),
    logical: game._toplines, maxcol: game._msg_maxcol});

for (const core of [false, true]) test(`wait_synch is the actual intr producer for a pending ${core ? 'core' : 'tty'} reader`, async () => {
    const run = await boot(), before = [...getRngLog()], states = [];
    const keys = 'Edx\n';
    let used = 0;
    run._display.onEmptyQueue = async () => {
        assert.ok(used < keys.length);
        if (used === 2) {
            const prior = snapshot(run);
            await tty_wait_synch();
            states.push({prior, after: snapshot(run)});
        }
        return keys.charCodeAt(used++);
    };
    const value = core ? await getlin('Name?') : await hooked_tty_getlin('Name?');
    assert.equal(value, 'Edx');
    assert.equal(used, keys.length);
    assert.equal(states[0].prior.inread, 1);
    assert.equal(states[0].after.inread, 1);
    assert.equal(states[0].after.intr, 1);
    // redotoplin sets NEED_MORE after wait_synch sets SPECIAL_PROMPT.
    assert.equal(states[0].after.toplin, TOPLINE_NEED_MORE);
    assert.equal(states[0].after.visible, 'Before the prompt.');
    assert.equal(states[0].after.logical, 'Name? Ed');
    assert.equal(game.ttyDisplay.intr, 0, 'parent reader consumes the real producer flag');
    assert.equal(game.ttyDisplay.inread, 0);
    assert.deepEqual(getRngLog(), before);
});

test('no active reader leaves text, counters and RNG unchanged', async () => {
    const run = await boot(), before = snapshot(run), rng = [...getRngLog()];
    run._display.onEmptyQueue = () => { throw Error('unexpected read'); };
    await tty_wait_synch();
    assert.deepEqual(snapshot(run), before);
    assert.deepEqual(getRngLog(), rng);
});

test('full mode retains C inread suppression while producing intr', async () => {
    const run = await boot('full');
    let used = 0, after;
    run._display.onEmptyQueue = async () => {
        assert.ok(used < 2);
        if (!used) { await tty_wait_synch(); after = snapshot(run); }
        return 'X\n'.charCodeAt(used++);
    };
    assert.equal(await hooked_tty_getlin('Name?'), 'X');
    assert.equal(after.inread, 1);
    assert.equal(after.intr, 1);
    assert.equal(after.visible, 'Name?');
    assert.equal(game.ttyDisplay.intr, 0);
});
