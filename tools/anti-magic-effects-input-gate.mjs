// Ordinary C inputs reach canonical form resistance and located monster feedback.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {Antimagic} from '../js/youprop.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ANTI_MAGIC} from '../js/const.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {recordingIntegrityErrors, branchAssertionErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};

const file = process.argv[2] || new URL(
    'gen-sessions/generated/anti-magic-effects.session.json', import.meta.url);
const bytes = fs.readFileSync(file);
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '9d502ee7adb52ec404457cb2ec0ca69ea7eb0ecf89c5d793283e0f56a2460d1b');
const raw = JSON.parse(bytes);
assert.equal(raw.version, 5);
assert.equal(raw.source, 'c');
assert.equal(raw.segments.length, 5);
test('recipe categories, input fields and branch witnesses match the native recording', () => {
    const recipe = JSON.parse(fs.readFileSync(new URL(
        'gen-sessions/recipes/anti-magic-effects.json', import.meta.url)));
    const known = new Set(tags.requirements.map(r=>r.id));
    for (const category of recipe.coverage) assert.ok(known.has(category), category);
    assert.deepEqual(recordingIntegrityErrors(raw), []);
    assert.deepEqual(branchAssertionErrors(recipe), []);
    assert.deepEqual(branchAssertionErrors(recipe, raw), []);
    assert.equal(recipe.segments.length, raw.segments.length);
    for (const [i, part] of raw.segments.entries())
        for (const key of ['name','seed','datetime','nethackrc','moves']) {
            assert.equal(Object.hasOwn(part,key), Object.hasOwn(recipe.segments[i],key));
            assert.deepEqual(part[key], recipe.segments[i][key]);
        }
});
const text = screens => screens.map(screen => decodeScreen(screen).map(row =>
    row.map(renderCell).join('')).join('\n')).join('\n');
for (const [index, part] of raw.segments.entries()) {
    test(`${part.name}: ordinary inputs reach the selected anti-magic effect`, async () => {
        assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
        const run = await runSegment({...part, storage:new InMemoryStorage()});
        assert.equal(run.getScreens().length, part.steps.length);
        const native = text(part.steps.map(step=>step.screen));
        const actual = text(run.getScreens());
        if (index < 3) {
            assert.equal(game.u.umonnum,
                [P.PM_GRAY_DRAGON,P.PM_BABY_GRAY_DRAGON,P.PM_BLUE_DRAGON][index]);
            assert.equal(Antimagic(), index < 2);
            assert.ok(!game.u.uprops.ANTIMAGIC, 'form resistance has no equipment mask');
            assert.equal(game.u.mh, [91,53,95][index]);
            assert.equal(game.u.uen, [0,1,0][index]);
            assert.ok(game.level.traps.some(t=>t.ttyp===ANTI_MAGIC && t.tseen
                && t.tx===game.u.ux && t.ty===game.u.uy));
            for (const value of [native,actual]) {
                assert.equal(value.includes('You feel sluggish.'), index < 2);
                assert.ok(value.includes('magical energy drain away'));
            }
        } else {
            const monster = game.level.monsters.find(m=>m.mnum===P.PM_KOBOLD_SHAMAN);
            assert.ok(monster && monster.mspec_used > 0);
            for (const value of [native,actual]) {
                assert.ok(value.includes('The kobold shaman seems lethargic.'));
                assert.equal(value.includes('(north): The kobold shaman seems lethargic.'), index===3);
                assert.ok(!value.includes('(west): The kobold shaman seems lethargic.'));
            }
        }
    });
}
