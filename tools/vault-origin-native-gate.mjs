// Immutable native oracle and source-derived relocation witnesses.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const bytes=fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-guard-origin.session.json',import.meta.url));
const native=JSON.parse(bytes);
const recipe=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-guard-origin.json',import.meta.url)));
const frame=native.segments[0].steps[129],grid=decodeScreen(frame.screen);
const witness={message:grid[0].map(c=>c.ch).join('').trimEnd(),cursor:frame.cursor,
    origin:grid[6][22],guard:grid[7][22],rng:frame.rng};
function assertPositions(w) {
    assert.equal(w.message,'You see here 365 gold pieces.  "You\'ve been warned, knave!"');
    assert.deepEqual(w.cursor,[23,7,1]);
    assert.deepEqual(w.origin,{ch:'$',color:11,attr:0,decgfx:0});
    assert.deepEqual(w.guard,{ch:'@',color:4,attr:0,decgfx:0});
}
function assertRelocationCalls(w) {
    assert.equal(w.rng.length,193);
    assert.deepEqual(w.rng.slice(13,20),[
        'rn2(8)=4 @ collect_coords(teleport.c:700)',
        'rn2(7)=3 @ collect_coords(teleport.c:700)',
        'rn2(6)=1 @ collect_coords(teleport.c:700)',
        'rn2(5)=4 @ collect_coords(teleport.c:700)',
        'rn2(4)=1 @ collect_coords(teleport.c:700)',
        'rn2(3)=2 @ collect_coords(teleport.c:700)',
        'rn2(2)=0 @ collect_coords(teleport.c:700)',
    ]);
}
test('native bytes, five input fields, integrity and recipe assertions remain exact',()=>{
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
        '8b1c6881e00375725e2a65f48aa506f79b0a9cdc71a2aa32bcc54ea653ca74e3');
    assert.equal(native.version,5);assert.equal(native.source,'c');
    assert.equal(native.segments.length,1);
    const segment=native.segments[0];
    for(const field of ['name','seed','datetime','nethackrc','moves'])
        assert.deepEqual(segment[field],recipe.segments[0][field],field);
    assert.equal(segment.steps.length,132);
    assert.equal(segment.steps.reduce((n,s)=>n+s.rng.length,0),6358);
    assert.equal(segment.steps.reduce((n,s)=>n+(s.animation_frames||[]).length,0),0);
    assert.deepEqual(recordingIntegrityErrors(native),[]);
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
});
test('native fallback redraws the gold and leaves one guard at its destination',()=>assertPositions(witness));
test('native warning boundary retains its real relocation shuffle packet',()=>assertRelocationCalls(witness));
test('negative control rejects a duplicate guard at the relocation origin',()=>{
    assert.throws(()=>assertPositions({...witness,origin:witness.guard}));
});
test('negative control rejects a missing guard at the final destination',()=>{
    assert.throws(()=>assertPositions({...witness,guard:witness.origin}));
});
test('negative control rejects a missing relocation call',()=>{
    const rng=[...witness.rng];rng.splice(13,1);
    assert.throws(()=>assertRelocationCalls({...witness,rng}));
});
