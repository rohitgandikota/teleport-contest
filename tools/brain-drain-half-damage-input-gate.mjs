// Ordinary keys and read-only state; independent native scoring remains separate.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {observe, unobserved, hashes} from './brain-drain-half-damage-observe.mjs';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {ART_MITRE_OF_HOLINESS} from '../js/artilist_data.js';
import {W_ARMH} from '../js/const.js';

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/brain-drain-half-damage.json',import.meta.url)));
assert.equal(recipe.requireBranchAssertions,true);
assert.deepEqual(branchAssertionErrors(recipe),[]);
const tuple=part=>['name','seed','datetime','nethackrc','moves'].map(field=>
    ({field,present:Object.hasOwn(part,field),value:part[field]}));
if(process.argv[2]) {
    const input=JSON.parse(readFileSync(process.argv[2]));
    assert.equal(input.source,'c');assert.equal(input.version,5);
    assert.equal(input.segments.length,4);
    for(const [i,part] of input.segments.entries()) {
        assert.deepEqual(tuple(part),tuple(recipe.segments[i]));
        if(part.steps.length)assert.deepEqual(part.steps.map(step=>step.key),[null,...part.moves]);
    }
    if(input.segments.some(part=>part.steps.length)) {
        assert.deepEqual(recordingIntegrityErrors(input),[]);
        assert.deepEqual(branchAssertionErrors(recipe,input),[]);
    }
}
const at=(states,step)=>states.findLast(state=>state.step<=step);
for(const [index,part] of recipe.segments.entries()) test(`${part.name}: actual producer and all-five neutrality`,async()=>{
    const seen=await observe(part,true), plain=await unobserved(part);
    assert.deepEqual(seen.output,plain);assert.deepEqual(seen.hashes,hashes(plain));
    assert.equal(seen.boundaries,part.moves.length+1);
    assert.deepEqual(seen.output.calls,seen.output.slices.flat());
    const branch=recipe.branchAssertions[index];
    const generated={source:'js',version:5,segments:[]};
    generated.segments[index]={steps:seen.output.screens.map((screen,i)=>
        ({screen,cursor:seen.output.cursors[i],rng:seen.output.slices[i]}))};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[branch.branch],branchAssertions:[branch]},generated),[]);
    assert.ok(seen.states.every(state=>(state.mortality||0)===0));
    assert.ok(seen.states.at(-1).hp>0);
    assert.doesNotMatch(seen.lines.map(line=>line.text).join('\n'),/Die\?|OK, so you don't die/);

    const hits=seen.lines.filter(line=>/\[HP -\d+, \d+ left\]/.test(line.text));
    assert.equal(hits.length,index===2?1:2);
    for(const line of hits) {
        const prior=at(seen.states,line.step-1), current=at(seen.states,line.step);
        assert.equal(prior.role,P.PM_CLERIC);assert.equal(prior.questarti,ART_MITRE_OF_HOLINESS);
        assert.equal(prior.intrinsicHalf,0);assert.equal(prior.extrinsicHalf,0);
        const item=prior.inventory.find(obj=>obj.type===O.HELM_OF_BRILLIANCE);
        assert.ok(item);assert.equal(item.blessed||0,0);assert.equal(item.cursed||0,0);
        assert.equal(item.artifact||0,index===1?0:ART_MITRE_OF_HOLINESS);
        assert.equal(item.worn||0,index===2?0:W_ARMH);
        assert.equal(prior.helmet??null,index===2?null:O.HELM_OF_BRILLIANCE);
        const target=prior.monsters.find(mon=>mon.type===(index===3?P.PM_SEWER_RAT:P.PM_KOBOLD_ZOMBIE));
        assert.ok(target && !target.peaceful && target.hp>0);
        assert.ok(Math.abs(target.x-prior.hero[0])<=1 && Math.abs(target.y-prior.hero[1])<=1);
        const calls=seen.output.slices[line.step];
        const damage=calls.filter(call=>/^d\(1,[34]\)=/.test(call));
        assert.equal(damage.length,1);
        const raw=Number(damage[0].split('=')[1]);
        const applied=index===0?Math.floor((raw+1)/2):raw;
        const displayed=/\[HP -(\d+), (\d+) left\]/.exec(line.text);
        assert.equal(Number(displayed[1]),applied);
        assert.equal(current.hp,prior.hp-applied);assert.equal(Number(displayed[2]),current.hp);
    }
    if(index>0)assert.deepEqual(seen.hashes,recipe.negativeOutputHashes[index]);
});
