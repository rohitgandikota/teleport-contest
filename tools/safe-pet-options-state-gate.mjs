// Run: node --loader ./tools/stormbringer-routing-state-loader.mjs --test tools/safe-pet-options-state-gate.mjs
// C optlist.h:634, options.c:5286/7166/9287, save.c:281, restore.c:571.
// Startup, real interactive inputs and save/restore use the actual port.
// Source-derived expectations; these extra option probes are not native recordings.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { stormbringerSetup } from './stormbringer-routing-cases.mjs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { boolean_option, parseoptions_interactive } from '../js/options.js';
import { gamestate_decode } from '../js/save.js';

const restoreRecipe = JSON.parse(readFileSync(new URL('./gen-sessions/recipes/instance-options-save-restore.json', import.meta.url)));
const base = stormbringerSetup;
const binding = 'BIND=^T:toggle(safe_pet)\n';
const rc = setting => base.nethackrc.replace('OPTIONS=safe_pet,confirm\n',
    `OPTIONS=confirm${setting ? ',' + setting : ''}\n`) + binding;
let observation;
function stored(value) {
    assert.equal(game.flags.safe_dog, value, 'gameplay flag has the expected stored value');
    assert.equal(boolean_option('safe_pet'), value, 'option reader uses the same field');
    assert.equal(Object.hasOwn(game.flags, 'safe_pet'), false, 'no duplicate runtime option field');
}
async function replay(setting, moves, storage = new InMemoryStorage()) {
    const transitions = [], messages = []; let previous;
    globalThis.__step_snapshot = { step: '*', cb(g, step) {
        const state = [g.flags.safe_dog ?? null, boolean_option('safe_pet')];
        const encoded = JSON.stringify(state);
        if (encoded !== previous) { transitions.push(state); previous = encoded; }
        const message = g.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd();
        if (message) messages.push({ step, message });
    } };
    let run;
    try { run = await runSegment({ ...base, nethackrc: rc(setting), moves, storage }); }
    finally { delete globalThis.__step_snapshot; }
    observation = { transitions, messages, rng: run.getRngLog().length };
    assert.deepEqual(game.rc.errors, []);
    return run;
}

for (const [setting, expected] of [['', true], ['safe_pet', true], ['!safe_pet', false],
    ['safe_pet:true', true], ['safe_pet:false', false]])
test(`startup ${setting || 'default On'}`, async () => {
    await replay(setting, ' V\x1b'); stored(expected);
    assert.equal(game.rc.opts.safe_pet, setting ? expected : undefined,
        'parsed config remains keyed by option name');
    assert.equal(game.flags.confirm, true);
});

for (const [setting, value] of [['', true], ['safe_pet', true], ['!safe_pet', false]])
test(`bound toggle twice from ${setting || 'default On'}`, async () => {
    await replay(setting, ' \x14\x1b\x14\x1bV\x1b'); stored(value);
    assert.deepEqual(observation.transitions, [[value, value], [!value, !value], [value, value]]);
    assert.ok(observation.messages.some(m => m.message.includes("'safe_pet' option toggled on.")));
    assert.ok(observation.messages.some(m => m.message.includes("'safe_pet' option toggled off.")));
    assert.equal(game.rc.opts.safe_pet, setting ? value : undefined,
        'runtime toggle must not rewrite the parsed startup setting');
});
for (const [setting, value] of [['safe_pet', true], ['!safe_pet', false]])
test(`full option menu toggles ${setting}`, async () => {
    const run = await replay(setting, ' mO:safe_pet\r\r\x1bV\x1b'); stored(!value);
    assert.deepEqual(observation.transitions, [[value, value], [!value, !value]]);
    assert.ok(run.getScreens().some(s => s.includes('safe_pet')));
    assert.equal(game.flags.confirm, true);
});
test('canceling full-menu selection preserves safe_pet', async () => {
    await replay('!safe_pet', ' mO:safe_pet\r\x1bV\x1b'); stored(false);
    assert.deepEqual(observation.transitions, [[false, false]]);
});

// The typed compound-option wrapper can also parse comma-separated booleans.
// Test its live-store path directly; the normal menus use set_bool_optval.
test('interactive parsed boolean uses the same live field', async () => {
    const run = await replay('safe_pet', ' ');
    let prompts = 0; run._display.onEmptyQueue = () => {
        if (++prompts > 20) throw Error('unexpected prompt loop'); return 27;
    };
    game._preNhgetchHook = null;
    await parseoptions_interactive('!safe_pet'); stored(false);
    await parseoptions_interactive('safe_pet'); stored(true);
    assert.equal(game.rc.opts.safe_pet, true);
});

for (const saved of [false, true]) for (const toggleSave of [false, true])
test(`restore saved ${saved}, toggle before save=${toggleSave}`, async () => {
    const storage = new InMemoryStorage();
    const first = restoreRecipe.segments[0], second = restoreRecipe.segments[1];
    const setting = value => `OPTIONS=${value ? '' : '!'}safe_pet\n`;
    const run = await runSegment({ ...first, storage,
        nethackrc: first.nethackrc + binding + setting(saved),
        moves: ' i\x1b' + (toggleSave ? '\x14\x1b' : '') + 'Sy' });
    const persisted = toggleSave ? !saved : saved;
    stored(persisted);
    assert.ok(run.getScreens().some(s => s.includes('Be seeing you')), 'actual save reached');
    const snap = gamestate_decode(JSON.parse(storage.getItem(`save:${game.plname}`)));
    assert.equal(snap.flags.safe_dog, persisted);
    assert.equal(Object.hasOwn(snap.flags, 'safe_pet'), false);
    const restored = await runSegment({ ...second, storage,
        nethackrc: second.nethackrc + binding + setting(!persisted), moves: 'i\x1bV\x1b' });
    assert.ok(restored.getScreens().some(s => s.includes('welcome back')), 'actual restore reached');
    stored(persisted);
    assert.equal(game.rc.opts.safe_pet, !persisted, 'fresh config differs from restored live flag');
    assert.equal(game.flags.autopickup, false, 'neighboring saved flag still wins');
    assert.deepEqual(game.iflags.menu_headings, { color: 4, attr: 4 }, 'fresh instance option still wins');
    observation = { saved, toggleSave, persisted, startupAfterRestore: !persisted };
});
for (const saved of [false, true])
test(`bound toggle after restoring ${saved}`, async () => {
    const storage = new InMemoryStorage();
    const first = restoreRecipe.segments[0], second = restoreRecipe.segments[1];
    await runSegment({ ...first, storage,
        nethackrc: first.nethackrc + binding + `OPTIONS=${saved ? '' : '!'}safe_pet\n`, moves: ' i\x1bSy' });
    const transitions = []; let previous;
    globalThis.__step_snapshot = { step: '*', cb(g) {
        if (g.flags.safe_dog !== previous) { transitions.push(g.flags.safe_dog); previous = g.flags.safe_dog; }
    } };
    let run;
    try { run = await runSegment({ ...second, storage,
        nethackrc: second.nethackrc + binding + `OPTIONS=${saved ? '!' : ''}safe_pet\n`,
        moves: 'i\x1b\x14\x1bV\x1b' }); }
    finally { delete globalThis.__step_snapshot; }
    assert.ok(run.getScreens().some(s => s.includes('welcome back')));
    stored(!saved);
    assert.ok(transitions.includes(saved), 'saved value visible before toggle');
    assert.equal(transitions.at(-1), !saved);
    observation = { saved, afterToggle: !saved, transitions };
});
