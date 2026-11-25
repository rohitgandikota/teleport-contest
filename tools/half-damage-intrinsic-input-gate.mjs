// Actual menu/equipment keys and read-only observations, without runtime overrides.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {observe, unobserved, hashes} from './half-damage-intrinsic-observe.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {ART_ORB_OF_FATE, ART_EYE_OF_THE_AETHIOPICA} from '../js/artilist_data.js';
import {W_ART, W_AMUL} from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/half-damage-intrinsic.json',import.meta.url)));
assert.equal(recipe.name,'half-damage-intrinsic');
assert.equal(recipe.requireBranchAssertions,true);
assert.deepEqual(branchAssertionErrors(recipe),[]);
const tuple=p=>['name','seed','datetime','nethackrc','moves'].map(field=>
    ({field,present:Object.hasOwn(p,field),value:p[field]}));
const text=screen=>decodeScreen(screen).map(row=>row.map(renderCell).join('').trimEnd()).join('\n');
function feedback(index,texts) {
    if(index===0) {
        assert.match(texts[41],/half physical damage +\[5\]/);
        assert.match(texts[41],/half spell damage +\[3\]/);
        assert.match(texts[47],/You take half physical damage\./);
        assert.match(texts[47],/You take half spell damage\./);
        assert.doesNotMatch(texts[64],/You take half (physical|spell) damage/);
    } else if(index===1) {
        assert.match(texts[57],/You take half physical damage\./);
        assert.match(texts[57],/You take half spell damage\./);
        assert.doesNotMatch(texts[70],/You take half (physical|spell) damage/);
    } else if(index===2) {
        assert.match(texts[58],/You take half physical damage because of the Orb of Fate\./);
        assert.match(texts[58],/You take half spell damage because of the Orb of Fate\./);
    } else if(index===3) {
        for(const step of [70,87]) assert.match(texts[step],/You take half spell damage because of the Eye of the Aethiopica\./);
    }
}
if(process.argv[2]) {
    const input=JSON.parse(readFileSync(process.argv[2]));
    assert.equal(input.source,'c'); assert.equal(input.version,5);
    assert.equal(input.segments.length,6);
    for(const [i,p] of input.segments.entries()) {
        assert.deepEqual(tuple(p),tuple(recipe.segments[i]));
        if(p.steps.length) {
            assert.deepEqual(p.steps.map(s=>s.key),[null,...p.moves]);
            feedback(i,p.steps.map(s=>text(s.screen)));
        }
    }
    if(input.segments.some(p=>p.steps.length)) {
        assert.deepEqual(recordingIntegrityErrors(input),[]);
        assert.deepEqual(branchAssertionErrors(recipe,input),[]);
    }
}
for(const [i,part] of recipe.segments.entries()) test(`${part.name}: real source lifecycle and all-five neutrality`,async()=>{
    const seen=await observe(part,true), plain=await unobserved(part);
    assert.deepEqual(seen.output,plain); assert.deepEqual(seen.hashes,hashes(plain));
    const branch=recipe.branchAssertions[i];
    const generated={source:'js',version:5,segments:[]};
    generated.segments[i]={steps:seen.output.screens.map((screen,step)=>
        ({screen,cursor:seen.output.cursors[step],rng:seen.output.slices[step]}))};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[branch.branch],branchAssertions:[branch]},generated),[]);
    feedback(i,seen.texts);
    const states=seen.states, end=states.at(-1);
    for(const s of states) {
        assert.equal(s.mortality,0); assert.ok(s.hp>0);
        assert.deepEqual(s.legacy,[0,0], 'no wizard timeout aliases into equipment storage');
        assert.equal(s.role,[1,2,4].includes(i)?PMNAMES.PM_VALKYRIE:PMNAMES.PM_WIZARD);
    }
    assert.deepEqual(end.intrinsic,[0,0]);
    if(i===0) {
        assert.ok(states.some(s=>s.intrinsic[0]===5 && s.intrinsic[1]===3));
        assert.ok(states.some(s=>s.intrinsic[0]===2 && s.intrinsic[1]===0));
        assert.ok(states.every(s=>s.extrinsic.every(v=>v===0)));
    } else if(i===1) {
        assert.ok(states.some(s=>s.intrinsic.every(v=>v===3) && s.extrinsic.every(v=>v===W_ART)));
        assert.ok(states.some(s=>s.intrinsic.every(v=>v===2) && s.extrinsic.every(v=>v===0)
            && s.floor.some(o=>o.artifact===ART_ORB_OF_FATE)));
        assert.equal(end.inventory.length,0); assert.deepEqual(end.extrinsic,[0,0]);
    } else if(i===2) {
        assert.ok(states.some(s=>s.intrinsic.every(v=>v===3) && s.extrinsic.every(v=>v===0)));
        assert.ok(states.some(s=>s.intrinsic.every(v=>v>0) && s.extrinsic.every(v=>v===W_ART)));
        assert.ok(end.inventory.some(o=>o.artifact===ART_ORB_OF_FATE));
        assert.deepEqual(end.extrinsic,[W_ART,W_ART]);
    } else if(i===3) {
        assert.ok(states.some(s=>s.intrinsic[1]===5 && s.extrinsic[1]===W_ART));
        assert.ok(states.some(s=>s.amulet && s.inventory.some(o=>o.artifact===ART_EYE_OF_THE_AETHIOPICA && (o.worn&W_AMUL))));
        assert.equal(end.amulet,0); assert.deepEqual(end.extrinsic,[0,W_ART]);
        assert.ok(end.inventory.some(o=>o.artifact===ART_EYE_OF_THE_AETHIOPICA && !o.worn));
    } else if(i===4) {
        assert.ok(states.every(s=>s.intrinsic.every(v=>v===0)));
        assert.deepEqual(end.extrinsic,[W_ART,W_ART]);
    } else {
        assert.ok(states.every(s=>[...s.intrinsic,...s.extrinsic].every(v=>v===0)));
    }
    if(recipe.unchangedOutputHashes[i]) assert.deepEqual(seen.hashes,recipe.unchangedOutputHashes[i]);
});
