// Only actual input and read-only observations. No seeded helper calls or mocks.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {observe, unobserved, hashes} from './accessory-eating-effects-observe.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import {ONAMES, MATERIALS} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {FROMOUTSIDE, TIMEOUT, A_CHA, A_STR, A_CON, W_RINGR} from '../js/const.js';

const load=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const recipe=load('gen-sessions/recipes/accessory-eating-effects.json');
const expected=load('gen-sessions/evidence/accessory-eating-effects.json');
const proposal=load('gen-sessions/generated/accessory-eating-effects.session.json');
const receipts=[];

test('recorded inputs have registered tags, exact five fields and keys',()=>{
    assert.equal(recipe.name,'accessory-eating-effects');
    assert.equal(proposal.source,'c');assert.equal(proposal.version,5);
    assert.equal(recipe.segments.length,18);assert.equal(recipe.branchAssertions.length,18);
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    const tags=new Set(load('gen-sessions/coverage-requirements.json').requirements.map(x=>x.id));
    assert.ok(recipe.coverage.every(x=>tags.has(x)));
    for(const [i,part] of recipe.segments.entries()) {
        for(const key of ['name','seed','datetime','nethackrc','moves']) {
            assert.equal(Object.hasOwn(part,key),Object.hasOwn(proposal.segments[i],key));
            assert.deepEqual(part[key],proposal.segments[i][key]);
        }
        assert.deepEqual(proposal.segments[i].steps.map(step=>step.key),[null,...part.moves]);
    }
});

test('canonical material ranges explain the bone rejection without changing a form',()=>{
    assert.ok(MATERIALS.BONE>MATERIALS.WOOD);
    assert.ok(MATERIALS.BONE<MATERIALS.IRON);
    assert.ok(MATERIALS.IRON<=MATERIALS.MITHRIL);
});

function mealStates(result,index) {
    const meal=result.meals[index],before=meal.before;
    const obj=before.objects.filter(o=>before.inventory.includes(o.id)
        && o.id!==before.left && o.id!==before.right).at(-1);
    assert.ok(obj,'a real carried accessory precedes the meal');
    const after=result.states.find(s=>s.step>=meal.during.step
        && s.objects.some(o=>o.id===obj.id&&o.deallocated));
    assert.ok(after,'the same object completes disposal');
    assert.equal(obj.edible,true);
    return {before,after,obj,step:meal.during.step};
}

for(const [index,part] of recipe.segments.entries())test(part.name,async()=>{
    const intent=expected[index].intent;
    const result=await observe(part,{keepOutput:true});
    const plain=await unobserved(part);
    assert.deepEqual(result.output,plain,'observer preserves every output entry, including blank styles');
    assert.deepEqual(result.hashes,hashes(plain));
    // C output is checked by the native gate; this receipt retains source state.
    // Observation receipts are JSON, which omits undefined object fields.
    // The five gameplay output collections above are compared directly.
    assert.equal(JSON.stringify(result.states),JSON.stringify(expected[index].result.states));
    const out=result.output;
    assert.equal(out.screens.length,part.moves.length+1);
    assert.equal(out.cursors.length,out.screens.length);
    assert.equal(out.slices.length,out.screens.length);
    assert.equal(out.frames.length,out.screens.length);
    assert.deepEqual(out.slices.flat(),out.calls);
    for(const call of out.calls)
        assert.match(call.replace(/\s+@\s*.*$/,''),/^(?:~d)?(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(-?\d+(?:,\s*-?\d+)*\)=-?\d+$/);
    const final=result.states.at(-1);
    assert.equal(final.mortality,0);
    assert.ok(final.hp>0);
    if(intent==='bone-rejection') {
        assert.equal(result.meals.length,0);assert.equal(final.food,0);
        assert.equal(final.form,PMNAMES.PM_GELATINOUS_CUBE);
        const obj=final.objects[0];assert.equal(obj.material,'BONE');assert.equal(obj.edible,false);
        assert.ok(final.inventory.includes(obj.id));assert.equal(obj.deallocated,false);
        assert.equal(result.effectMessages.length,0);
    } else {
        const meals=result.meals.map((_m,i)=>mealStates(result,i));
        assert.equal(final.food,intent==='thresholds'?5:1);
        for(const {obj,before,step} of meals) {
            const bound=obj.type>=ONAMES.AMULET_OF_ESP?5:3;
            assert.match(out.slices[step][0],new RegExp(`^rn2\\(${bound}\\)=[0-${bound-1}]$`));
            assert.equal(before.form,obj.material==='WOOD'?PMNAMES.PM_GELATINOUS_CUBE:PMNAMES.PM_XORN);
        }
        const {before,after,obj,step}=meals[0];
        if(intent==='thresholds') {
            assert.deepEqual(meals.map(m=>[m.before.hit,m.after.hit,m.obj.spe]),
                [[0,8,8],[8,8,8],[8,16,8],[16,17,15],[17,17,40]]);
            assert.deepEqual(meals.map(m=>out.slices[m.step][0]),
                ['rn2(3)=0','rn2(3)=2','rn2(3)=0','rn2(3)=0','rn2(3)=0']);
            assert.match(out.slices[meals[2].step+1][0],/^rnd\(8\)=8$/);
            assert.deepEqual(out.slices[meals[3].step+1].slice(0,2),['rn2(15)=12','rnd(4)=1']);
            assert.ok(meals[4].before.hit+meals[4].obj.spe>=40);
            assert.equal(result.effectMessages.length,4);
        } else if(intent==='worn-contribution') {
            const worn=before.objects.find(o=>o.id===before.right);
            assert.equal(worn.type,obj.type);assert.equal(worn.spe,30);assert.equal(worn.worn,W_RINGR);
            assert.equal(before.hit,30);assert.equal(after.hit,38);
            assert.equal(after.right,worn.id);assert.ok(after.inventory.includes(worn.id));
        } else if(intent==='damage') assert.equal(after.damage-before.damage,8);
        else if(intent==='protection'||intent==='guarding') {
            assert.equal(after.protection-before.protection,intent==='protection'?8:2);
            assert.equal(after.intrinsic.HProtection&FROMOUTSIDE,FROMOUTSIDE);
        } else if(['adornment','strength','constitution'].includes(intent)) {
            const attr={adornment:A_CHA,strength:A_STR,constitution:A_CON}[intent];
            assert.equal(after.attributes.a[attr]-before.attributes.a[attr],obj.spe);
            assert.equal(after.objects.find(o=>o.id===obj.id).discovered,true);
        } else if(intent==='levitation') {
            assert.equal(before.intrinsic.HLevitation||0,0);
            assert.equal(after.intrinsic.HLevitation&FROMOUTSIDE,0);
            assert.ok((after.intrinsic.HLevitation&TIMEOUT)>0);
            assert.ok(out.calls.some(call=>call.startsWith('d(10,20)=')));
        } else if(['see-invisible','shape-protection','telepathy'].includes(intent)) {
            const prop={'see-invisible':'HSee_invisible','shape-protection':'HProtection_from_shape_changers',telepathy:'HTelepat'}[intent];
            assert.equal((before.intrinsic[prop]||0)&FROMOUTSIDE,0);
            assert.equal(after.intrinsic[prop]&FROMOUTSIDE,FROMOUTSIDE);
        } else if(intent==='change') assert.notEqual(after.female,before.female);
        else if(intent==='unchanging') {
            assert.equal(before.form,PMNAMES.PM_XORN);assert.notEqual(after.form,before.form);
            assert.equal(after.mh,0);
        } else if(intent==='sleep') {
            assert.equal((before.intrinsic.HSleepy||0)&FROMOUTSIDE,0);
            assert.equal(after.intrinsic.HSleepy&FROMOUTSIDE,FROMOUTSIDE);
            assert.ok((after.intrinsic.HSleepy&TIMEOUT)>0);
            assert.ok((after.intrinsic.HSleepy&TIMEOUT)<=100);
        } else if(intent==='reflection-negative') {
            assert.equal(obj.type,ONAMES.AMULET_OF_REFLECTION);
            assert.equal(out.slices[step][0],'rn2(5)=0');
            assert.equal((after.intrinsic.HReflecting||0)&FROMOUTSIDE,0);
            assert.equal(result.effectMessages.length,0);
        } else if(intent==='wood-consumed-no-effect') {
            assert.equal(obj.material,'WOOD');assert.equal(obj.type,ONAMES.RIN_INCREASE_DAMAGE);
            assert.notEqual(out.slices[step][0],'rn2(3)=0');
            assert.equal(after.damage,before.damage);assert.equal(result.effectMessages.length,0);
        }
    }
    const generated={segments:recipe.segments.map((_s,i)=>i===index?{
        steps:out.screens.map((screen,step)=>({screen,rng:out.slices[step]}))}:{steps:[]})};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[recipe.branches[index]],
        branchAssertions:[recipe.branchAssertions[index]]},generated),[]);
    receipts.push({name:part.name,intent,boundaries:out.screens.length,calls:out.calls.length,
        frames:out.frames.flat().length,hashes:result.hashes,allFiveCollectionsObserverExact:true,
        sourceStateAssertions:true,evidence:'ordinary JS keys; original C outputs are checked by the separate native gate'});
    console.log(JSON.stringify(receipts.at(-1)));
});
