// Ordinary JS input reach; no C parity claim until independently recorded.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {FIRE_TRAP} from '../js/const.js';
import {canseemon} from '../js/display.js';
import {cansee} from '../js/vision.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type: 'json'};

const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/rock-fire-feedback.json', import.meta.url)));
await test('recipe name, registered coverage tags and assertions', () => {
    assert.equal(recipe.name, 'rock-fire-feedback');
    assert.deepEqual(branchAssertionErrors(recipe), []);
    for (const tag of recipe.coverage)
        assert.ok(coverage.requirements.some(r => r.id === tag), tag);
});
for (const [index, part] of recipe.segments.entries()) await test(part.name, async () => {
    const invisible = part.name.includes('invisible');
    const accessible = part.name.endsWith('accessible');
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [], monsters = new Map();
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            for (const mon of g.level?.monsters || [])
                if (mon.mnum === P.PM_PAPER_GOLEM) monsters.set(mon.m_id, mon);
            states.push({step, hp: g.u.uhp, mortality: g.u.umortality || 0,
                text: g._toplines || '', monsters: [...monsters.values()].map(mon => ({
                    hp: mon.mhp, minvis: !!mon.minvis, inSight: canseemon(mon),
                    seeSquare: cansee(mon.mx, mon.my),
                    fireTrap: g.level.traps.some(t => t.ttyp === FIRE_TRAP
                        && t.tx === mon.mx && t.ty === mon.my)}))});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length, part.moves.length + 1);
    assert.ok(states.every(s => s.hp > 0 && s.mortality === 0));
    assert.ok(states.some(s => s.monsters.some(m => m.hp > 0 && m.minvis === invisible)));
    const fire = states.find(s => /tower of flame/.test(s.text));
    assert.ok(fire, 'the actual monster triggers the fire trap');
    assert.ok(fire.monsters.some(m => m.hp <= 0 && m.fireTrap
        && m.minvis === invisible && m.seeSquare && m.inSight === !invisible));
    const text = invisible ? 'You see a tower of flame erupt from the floor!'
        : 'A tower of flame erupts from the floor under the paper golem!';
    assert.ok(fire.text.includes(text));
    assert.equal(fire.text.includes('(south): ' + text), accessible);
    assert.equal(game.u.uhp, 36);
    assert.equal(game.u.umortality || 0, 0);
    assert.ok(!game.program_state?.gameover);
    const screens = run.getScreens().map(s => decodeScreen(s)
        .map(row => row.map(c => c.ch).join('')).join('\n')).join('\n');
    for (const wanted of recipe.branchAssertions[index].screenIncludes)
        assert.ok(screens.includes(wanted), wanted);
    for (const unwanted of recipe.branchAssertions[index].screenExcludes)
        assert.ok(!screens.includes(unwanted), unwanted);
});
