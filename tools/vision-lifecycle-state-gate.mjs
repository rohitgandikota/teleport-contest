#!/usr/bin/env node
// C-derived lifecycle controls, alongside the native ending-vision fixture.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {cansee, vision_recalc} from '../js/vision.js';

const recipe = name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url)));
const ending = recipe('ending-vision-freeze');

for (const guard of ['vision_inited', 'in_getlev', 'in_mklev']) {
    test(`vision remains unchanged while ${guard} blocks recalculation`, async () => {
        await runSegment({...ending.segments[1], moves:' ', storage:new InMemoryStorage()});
        assert.ok(cansee(game.u.ux, game.u.uy));
        const before = game.viz_array.map(row => [...row]);
        const owner = guard === 'vision_inited' ? game.iflags
            : guard === 'in_getlev' ? game.program_state : game;
        owner[guard] = guard !== 'vision_inited';
        game.vision_full_recalc = 1;
        vision_recalc(2);
        assert.equal(game.vision_full_recalc, 0);
        assert.deepEqual(game.viz_array.map(row => [...row]), before);
        owner[guard] = guard === 'vision_inited';
        vision_recalc(2);
        assert.ok(game.viz_array.every(row => row.every(cell => cell === 0)));
        vision_recalc(0);
        assert.ok(cansee(game.u.ux, game.u.uy));
    });
}

test('final disclosure preserves sight until another game starts', async () => {
    const storage = new InMemoryStorage();
    await runSegment({...ending.segments[0], storage});
    assert.equal(game.iflags.vision_inited, false);
    assert.ok(cansee(44, 13), 'native disclosure still shows the kitten');
    await runSegment({...ending.segments[1], storage});
    assert.equal(game.iflags.vision_inited, true);
    assert.ok(cansee(game.u.ux, game.u.uy));
});

test('restoring a save rebuilds vision after an intervening game', async () => {
    const saved = recipe('shirt-birthday-save-restore');
    const storage = new InMemoryStorage();
    await runSegment({...saved.segments[0], storage});
    await runSegment({...ending.segments[0], storage:new InMemoryStorage()});
    await runSegment({...saved.segments[1], storage});
    assert.equal(game.iflags.vision_inited, true);
    assert.ok(cansee(game.u.ux, game.u.uy));
});
