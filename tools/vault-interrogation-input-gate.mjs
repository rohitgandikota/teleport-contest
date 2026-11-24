// Ordinary input observers only. Accepts the proposal or later unchanged C raw.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {Deaf, Blind} from '../js/youprop.js';
import {money_cnt, hidden_gold} from '../js/invent.js';
import {glyph_is_invisible_at} from '../js/display.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';

const input = JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-interrogation-feedback.session.json', import.meta.url)));
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-interrogation-feedback.json', import.meta.url)));
const requirements = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/coverage-requirements.json', import.meta.url)));
const tags = new Set(requirements.requirements.map(r => r.id));
assert.ok(recipe.coverage.every(tag => tags.has(tag)));
assert.deepEqual(branchAssertionErrors(recipe), []);
assert.equal(input.version, 5);
assert.equal(input.source, 'c');
assert.equal(input.segments.length, 9);
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

for (const [index, part] of input.segments.entries()) {
    for (const field of ['name', 'seed', 'datetime', 'nethackrc', 'moves'])
        assert.deepEqual(part[field], recipe.segments[index][field], field);
    const deaf = part.name.includes('deaf'), blind = part.name.includes('blind');
    const hidden = part.name.includes('hidden'), none = part.name.endsWith('none');
    const croesus = part.name.endsWith('croesus');
    const keys = ['__step_snapshot', '__rng_trace_sites'];
    const old = keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
    const states = [];
    let run;
    try {
        globalThis.__rng_trace_sites = true;
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            const guard = g.level?.monsters.find(m => m.isgd && m.mhp > 0);
            states.push({step, deaf: Deaf(), blind: Blind(),
                timer: g.u.intrinsic?.HDeaf || 0, blindTimer: g.u.intrinsic?.HBlinded || 0,
                gold: money_cnt(g.invent), hidden: hidden_gold(g.invent, true),
                text: g._toplines || '', hero: [g.u.ux, g.u.uy],
                guard: guard && {at: [guard.mx, guard.my], female: guard.female,
                    marked: glyph_is_invisible_at(guard.mx, guard.my),
                    drop: guard.mextra.egd.dropgoldcnt,
                    warn: guard.mextra.egd.warncnt, fcend: guard.mextra.egd.fcend || 0,
                    peaceful: guard.mpeaceful}});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        keys.forEach((k, i) => old[i] ? Object.defineProperty(globalThis, k, old[i]) : delete globalThis[k]);
    }
    const prompt = states.find(s => /supply your name|Hello stranger/.test(s.text));
    const final = states.at(-1);
    const screens = run.getScreens();
    const messages = screens.map(s => decodeScreen(s)[0].map(c => c.ch).join('').trimEnd());
    await test(`${part.name}: actual status and inventory reach the name prompt`, () => {
        assert.ok(prompt);
        assert.equal(prompt.deaf, deaf);
        assert.equal(prompt.blind, blind);
        assert.equal(prompt.timer > 0, deaf);
        assert.equal(prompt.blindTimer > 0, blind);
        assert.equal(prompt.gold, hidden || none ? 0 : 500);
        assert.equal(prompt.hidden, hidden ? 500 : 0);
        assert.match(prompt.text, deaf ? /^You are required to supply your name/ : /^"Hello stranger/);
        assert.equal(prompt.guard.fcend, 0);
        assert.equal(prompt.guard.drop, 0);
        assert.equal(prompt.guard.marked, blind);
        if (hidden) assert.ok(messages.some(m => m.includes('You put 500 gold pieces into the bag.')));
    });
    await test(`${part.name}: C-derived feedback assertions`, () => {
        const assertion = recipe.branchAssertions[index];
        const oneRecipe = {...recipe, branches: [assertion.branch],
            branchAssertions: [{...assertion, segment: 0}]};
        // This transient JS view tests assertions, it is never saved as C data.
        const view = {segments: [{steps: screens.map(screen => ({screen}))}]};
        assert.deepEqual(branchAssertionErrors(oneRecipe, view), []);
    });
    await test(`${part.name}: completion preserves dismissal or escort state`, () => {
        assert.deepEqual(final.hero, [23, 5]);
        if (croesus) {
            assert.equal(final.guard, undefined);
            assert.ok(states.some(s => s.guard), 'guard was actually created');
        } else {
            assert.ok(final.guard);
            assert.equal(final.guard.peaceful, 1);
            assert.equal(final.guard.fcend, 1);
            assert.equal(final.guard.warn, 1);
            assert.equal(final.guard.drop, none ? 0 : 1, 'deaf/blind demand still increments');
            assert.equal(final.gold, hidden || none ? 0 : 500);
            assert.equal(final.hidden, hidden ? 500 : 0);
        }
    });
    await test(`${part.name}: complete bounded input and no observer leak`, () => {
        assert.equal(screens.length, part.moves.length + 1);
        assert.equal(run.getCursors().length, screens.length);
        assert.equal(run.getRngSlices().length, screens.length);
        assert.equal(run._display.inputQueueLength, 0);
        assert.ok(game.u.uhp > 0);
        assert.ok(!game.program_state.gameover);
        assert.equal(run.getAnimationFramesByStep().reduce((n, a) => n + a.length, 0), 0);
        assert.deepEqual(keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k)), old);
    });
    console.log(JSON.stringify({name: part.name, prompt, final,
        boundaries: screens.length, calls: run.getRngLog().length,
        outputHashes: {screens: hash(screens), cursors: hash(run.getCursors()),
            rng: hash(run.getRngLog()), slices: hash(run.getRngSlices()),
            animations: hash(run.getAnimationFramesByStep())}}));
}
