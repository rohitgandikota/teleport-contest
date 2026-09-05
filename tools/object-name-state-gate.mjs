#!/usr/bin/env node

// C name_from_player() preserves cancellation but accepts an all-spaces name.
// Its PL_PSIZ limit is longer than the visible inventory row. killer_xname()
// must suppress a user name temporarily and restore the object's state.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { ONAME, has_oname } from '../js/const.js';
import { ONAMES } from '../js/objects_data.js';
import { killer_xname } from '../js/objnam.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/object-name-editing.json', import.meta.url), 'utf8'));
const names = ['Alpha', 'Alpha', '', 'Beta Note', 'Q'.repeat(62), 'Pebble'];
for (const [i, segment] of recipe.segments.entries()) {
    await runSegment({ ...segment, storage: new InMemoryStorage() });
    const obj = game.invent.find(o => o.otyp === (i === 5 ? ONAMES.CORPSE : ONAMES.DART));
    assert.ok(obj, segment.name);
    assert.equal(ONAME(obj), names[i], segment.name + ': stored name');
    assert.equal(has_oname(obj), !!names[i], segment.name + ': name allocation');
    if (i === 5) {
        const before = { ...obj };
        const known = game.objects[obj.otyp].oc_name_known;
        assert.equal(killer_xname(obj), 'a cockatrice corpse');
        assert.deepEqual(obj, before, 'killer formatting restores every object field');
        assert.equal(game.objects[obj.otyp].oc_name_known, known);
    }
}
console.log('object name state: PASS (six C scenarios)');
