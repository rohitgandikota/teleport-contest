// Ordinary C input provenance and option effects at the real position picker.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/cursor-description-coordinates.json',import.meta.url)));
const raw=readFileSync(new URL('gen-sessions/generated/cursor-description-coordinates.session.json',import.meta.url));
const native=JSON.parse(raw);
const top=s=>decodeScreen(s)[0].map(c=>c.ch).join('').trimEnd();
const expected=['floor of a room','floor of a room (east)','floor of a room (east)',
    'floor of a room <17,15>','floor of a room [17,17]',
    "Where do you want to be teleported?  (For instructions type a '?')"];

test('unchanged C inputs, registered coverage and native branch assertions',()=>{
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '9acbc44ba71ff7b55a699597b4142340c89a0ab055de5a3f4e7a99ac86aac36e');
    assert.equal(native.source,'c');assert.equal(native.version,5);
    assert.equal(native.segments.length,6);assert.equal(recipe.segments.length,6);
    assert.deepEqual(recordingIntegrityErrors(native),[]);
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
    const registered=new Set(tags.requirements.map(r=>r.id));
    for(const id of recipe.coverage)assert.ok(registered.has(id));
    for(const [i,part] of native.segments.entries()) {
        for(const field of ['name','seed','datetime','nethackrc','moves'])
            assert.deepEqual(part[field],recipe.segments[i][field]);
        assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
        assert.equal(part.steps.length,7);
        assert.equal(part.steps.reduce((n,s)=>n+(s.rng||[]).length,0),2539);
        assert.equal(part.steps.reduce((n,s)=>n+(s.animation_frames||[]).length,0),0);
        assert.equal(top(part.steps[3].screen),expected[i]);
    }
});

for(const [i,part] of recipe.segments.entries()) test(part.name,async()=>{
    const run=await runSegment({...part,storage:new InMemoryStorage()});
    assert.equal(run.getScreens().length,7);
    assert.equal(top(run.getScreens()[3]),expected[i]);
    assert.deepEqual(run.getCursors()[3],native.segments[i].steps[3].cursor);
    assert.equal(game.iflags.getpos_coords,['n','c','f','m','s','m'][i]);
    assert.equal(game.iflags.autodescribe!==false,i!==5);
    assert.deepEqual([game.u.ux,game.u.uy],[17,15]);
});
