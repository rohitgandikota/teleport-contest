// Actual inputs only. Observations never mutate runtime state or production helpers.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {canseemon} from '../js/display.js';
import {ONAMES} from '../js/objects_data.js';
import {OBJ_MINVENT, M_AP_TYPE} from '../js/const.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/zap-map-glyph-identity.json',import.meta.url)));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const output=run=>({screens:run.getScreens(),cursors:run.getCursors(),calls:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const hashes=out=>Object.fromEntries(Object.entries(out).map(([key,value])=>[key,hash(value)]));
const plain=screen=>decodeScreen(screen).map(row=>row.map(renderCell).join('')).join('\n');

test('recipe has three supported inputs and only registered coverage tags',()=>{
    assert.equal(recipe.name,'zap-map-glyph-identity');assert.equal(recipe.segments.length,3);
    assert.equal(recipe.branchAssertions.length,3);assert.deepEqual(branchAssertionErrors(recipe),[]);
    const registered=new Set(coverage.requirements.map(r=>r.id));
    assert.ok(recipe.coverage.every(tag=>registered.has(tag)));
    assert.ok(recipe.segments.every(s=>typeof s.moves==='string'&&!Object.hasOwn(s,'steps')));
});

for(const [index,part] of recipe.segments.entries())test(part.name,async()=>{
    const expected=recipe.jsReach[index],states=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const mon=g.level.monsters.find(m=>m.m_id===expected.target.id);
            const cell=mon?g.gbuf?.[mon.my]?.[mon.mx]:null;
            states.push({step,hp:g.u.uhp,mortality:g.u.umortality||0,
                hero:[g.u.ux,g.u.uy],hit:g.bhitpos?{...g.bhitpos}:null,
                known:!!g.objects[ONAMES.WAN_PROBING].oc_name_known,
                mon:mon?{id:mon.m_id,species:mon.mnum,xy:[mon.mx,mon.my],
                    visible:!!canseemon(mon),asleep:!!mon.msleeping,peaceful:!!mon.mpeaceful,
                    hp:mon.mhp,appearance:M_AP_TYPE(mon),
                    inventory:(mon.minvent||[]).map(o=>({id:o.o_id,type:o.otyp,
                        where:o.where,carrierIsMonster:o.ocarry===mon,dknown:!!o.dknown})),
                    glyphKind:cell?.disp_glyph?.kind,glyphNumber:cell?.disp_glyphnum,
                    descriptorCarriesMonster:cell?.disp_glyph?.mon===mon}:null,
                inventory:(g.invent||[]).map(o=>({type:o.otyp,letter:o.invlet,charges:o.spe}))});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const out=output(run),actualHashes=hashes(out);
    assert.deepEqual(actualHashes,hashes(output(await runSegment({...part,storage:new InMemoryStorage()}))),
        'read-only observations preserve all five original output hashes');
    assert.deepEqual(actualHashes,expected.originalOutputHashes);
    if(expected.negative)assert.deepEqual(actualHashes,expected.baselineNegativeHashes);
    assert.equal(out.screens.length,part.moves.length+1);assert.equal(out.screens.length,expected.boundaries);
    assert.equal(out.cursors.length,expected.boundaries);assert.equal(out.slices.length,expected.boundaries);
    assert.equal(out.calls.length,expected.calls);assert.equal(out.frames.flat().length,expected.frames);
    assert.deepEqual(out.slices.flat(),out.calls);
    for(const call of out.calls)assert.match(call.replace(/\s+@\s*.*$/,''),/^(?:~d)?(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(-?\d+(?:,\s*-?\d+)*\)=-?\d+$/);
    assert.ok(states.every(s=>s.hp>0&&s.mortality===0));
    const selected=states.find(s=>s.step===expected.selectedStep);
    assert.ok(selected);assert.deepEqual(selected.mon,expected.target);
    assert.deepEqual(selected.hero,expected.hero);assert.equal(selected.hp,expected.hp);
    assert.deepEqual(selected.hit,{x:9,y:12});
    assert.equal(part.moves[expected.commandDirectionStep-1],'l');
    assert.ok(plain(out.screens[expected.selectedStep]).includes('--More--'));
    if(index<2){
        assert.ok(states.some(s=>s.inventory.some(o=>o.type===ONAMES.WAN_PROBING&&o.letter==='a'&&o.charges===8)));
        assert.ok(selected.inventory.some(o=>o.type===ONAMES.WAN_PROBING&&o.letter==='a'&&o.charges===7));
        assert.equal(selected.known,false,'mapping has not spuriously discovered an unchanged monster glyph');
        assert.equal(states.at(-1).known,true,'monster probing finishes wand discovery');
    }
    if(index===0){
        assert.equal(selected.mon.inventory.length,1);
        const item=selected.mon.inventory[0];assert.equal(item.where,OBJ_MINVENT);assert.equal(item.carrierIsMonster,true);
        assert.equal(selected.mon.descriptorCarriesMonster,true);
        assert.deepEqual(states.at(-1).mon.inventory,selected.mon.inventory,'probing retains real ownership');
        assert.ok(plain(out.screens[expected.inventoryStep]).includes("The hill orc's possessions:"));
        assert.ok(plain(out.screens[expected.inventoryStep]).includes('an iron skull cap (being worn)'));
    }else assert.deepEqual(selected.mon.inventory,[]);
    const generated={segments:recipe.segments.map((_s,i)=>i===index?{
        steps:out.screens.map((screen,step)=>({screen,rng:out.slices[step]}))}:{steps:[]})};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[recipe.branches[index]],
        branchAssertions:[recipe.branchAssertions[index]]},generated),[]);
    console.log(JSON.stringify({name:part.name,boundaries:out.screens.length,calls:out.calls.length,
        frames:out.frames.flat().length,selectedStep:expected.selectedStep,
        negativeFiveHashesExact:expected.negative,observerFiveHashesExact:true,hashes:actualHashes,
        evidence:'JS actual input; the separate native gate verifies independent C output.'}));
});
