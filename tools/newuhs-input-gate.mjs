// Ordinary keyboard producers only; the snapshot hook observes without changing state.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {NOT_HUNGRY,SATIATED} from '../js/const.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/hunger-active-polymorph-hp.json',import.meta.url)));
const outputs=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
for(const [index,part]of recipe.segments.entries())test(part.name,async()=>{
    const rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){rows.push({step,hp:g.u.uhp,mh:g.u.mh,
            form:g.u.umonnum,original:g.u.umonster,stoned:g.u.uprops?.STONED||0,
            hunger:g.u.uhunger,hs:g.u.uhs,mortality:g.u.umortality||0,moves:g.moves,
            inventory:(g.invent||[]).map(o=>({type:o.otyp,letter:o.invlet,quan:o.quan,eaten:o.oeaten})),
            killerExists:!!g.killer,occupation:g.occupation?.name||null});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    const observed=outputs(run),unobserved=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    for(const key of Object.keys(observed))assert.deepEqual(observed[key],unobserved[key],key+' observer neutrality');
    assert.equal(observed.screens.length,part.moves.length+1);assert.equal(rows.length,part.moves.length+1);
    assert.equal(run._display.inputQueueLength,0);assert.equal(observed.frames.flat().length,0);
    const mealStep=part.moves.indexOf('eb')+2,before=rows[mealStep-1],after=rows[mealStep],last=rows.at(-1);
    assert.equal(part.moves.slice(mealStep-2,mealStep),'eb');
    assert.deepEqual(before.inventory,[{type:O.SLIME_MOLD,letter:'b',quan:1,eaten:0}]);
    assert.equal(before.hs,NOT_HUNGRY);assert.equal(before.hunger,index<2?898:899);
    assert.equal(after.hs,SATIATED);assert.equal(after.inventory.length,0);
    assert.equal(after.hunger,index<2?1147:1148);assert.equal(last.mortality,0);
    assert.equal(last.occupation,null);assert.equal(last.stoned,0);
    if(index<2){
        assert.ok(rows.some(row=>row.stoned>0),'real wizintrinsic starts petrification');
        assert.ok(rows.some(row=>row.form===P.PM_STONE_GOLEM&&row.stoned===0&&row.killerExists),
            'real polymorph cures petrification and retains initialized killer structure');
        assert.equal(before.form,P.PM_HILL_GIANT);assert.ok(before.mh>0);assert.ok(last.mh>0);
        assert.equal(before.killerExists,true);assert.equal(last.form,P.PM_HILL_GIANT);
    }else assert.equal(before.form,before.original);
    assert.equal(before.hp,index===0?-1:12);assert.equal(last.hp,before.hp);
    const texts=observed.screens.map(s=>decodeScreen(s).map(r=>r.map(renderCell).join('')).join('\n'));
    for(const phrase of recipe.branchAssertions[index].screenIncludes)assert.ok(texts.some(s=>s.includes(phrase)),phrase);
    assert.doesNotMatch(texts.join('\n'),/die from hunger and exhaustion|Die\? \[yn\]/);
    if(index!==0)assert.doesNotMatch(texts.join('\n'),/Wiped out all humans|feel dead inside/);
});
