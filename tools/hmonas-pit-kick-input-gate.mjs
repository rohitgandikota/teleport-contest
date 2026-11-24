// Actual keyboard producers and read-only observations. Native parity is separate.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {mtrapped_in_pit} from '../js/mhitu.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import * as C from '../js/const.js';

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/polymorph-pit-kicks.json',import.meta.url)));
const expected=[
    {birth:79,attack:82,count:93,trap:C.PIT,utraptype:C.TT_PIT,swings:1,hp:18},
    {birth:86,attack:89,count:100,trap:C.SPIKED_PIT,utraptype:C.TT_PIT,swings:1,hp:11},
    {birth:65,attack:68,count:79,trap:null,utraptype:null,swings:2,hp:23},
    {birth:85,attack:88,count:99,trap:C.BEAR_TRAP,utraptype:C.TT_BEARTRAP,swings:2,hp:4},
];
for(const [index,part]of recipe.segments.entries())test(`ordinary pit kick: ${part.name}`,async()=>{
    const rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){rows.push({step,hero:[g.u.ux,g.u.uy],
            form:g.u.umonnum,canonical:g.youmonst.data===g.mons[g.u.umonnum],
            attacks:g.youmonst.data.mattk.map(a=>[...a]),mortality:g.u.umortality||0,
            utrap:g.u.utrap||0,utraptype:g.u.utraptype,pit:mtrapped_in_pit(g.youmonst),
            traps:g.level.traps.map(t=>({type:t.ttyp,xy:[t.tx,t.ty],seen:!!t.tseen})),
            monsters:g.level.monsters.map(m=>({id:m.m_id,type:m.mnum,canonical:m.data===g.mons[m.mnum],
                xy:[m.mx,m.my],hp:m.mhp,sleeping:!!m.msleeping,peaceful:!!m.mpeaceful}))});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    const want=expected[index],pre=rows[want.attack-1],last=rows.at(-1);
    assert.equal(rows.length,want.count);assert.equal(run.getScreens().length,want.count);
    assert.equal(part.moves.length+1,want.count);assert.ok(rows.every(r=>r.mortality===0));
    assert.equal(pre.form,P.PM_WARHORSE);assert.equal(pre.canonical,true);
    assert.deepEqual(pre.attacks.slice(0,2),[[A.AT_KICK,A.AD_PHYS,1,10],[A.AT_BITE,A.AD_PHYS,1,4]]);
    const target=rows[want.birth].monsters.find(m=>m.type===P.PM_RUST_MONSTER);
    assert.ok(target?.canonical&&target.sleeping&&!target.peaceful);
    assert.equal(Math.max(...target.xy.map((v,i)=>Math.abs(v-pre.hero[i]))),1);
    assert.ok(pre.monsters.find(m=>m.id===target.id).sleeping);
    const trap=pre.traps.find(t=>t.xy.every((v,i)=>v===pre.hero[i]));
    if(want.trap===null){assert.equal(trap,undefined);assert.equal(pre.utrap,0);}
    else{
        assert.equal(trap.type,want.trap);assert.equal(trap.seen,true);
        assert.ok(pre.utrap>0);assert.equal(pre.utraptype,want.utraptype);
        assert.equal(last.utrap,pre.utrap);assert.equal(last.utraptype,pre.utraptype);
        assert.ok(part.moves.includes('#sit\r'));
    }
    assert.equal(pre.pit,index<2);assert.equal(last.pit,pre.pit);
    assert.deepEqual(last.hero,pre.hero);
    const after=last.monsters.find(m=>m.id===target.id);
    assert.equal(after.hp,want.hp);assert.equal(after.sleeping,false);
    const calls=run.getRngSlices().slice(want.attack).flat();
    assert.equal(calls.filter(c=>/^rnd\(20\)=/.test(c)).length,want.swings);
    assert.equal(calls.filter(c=>/^d\(1,4\)=/.test(c)).length,1,'later bite remains');
    assert.equal(calls.filter(c=>/^d\(1,10\)=/.test(c)).length,0,'pit skips kick; controls miss it');
    const top=run.getScreens().map(s=>decodeScreen(s).slice(0,2).map(row=>row.map(renderCell).join('')).join('\n'));
    for(const phrase of recipe.branchAssertions[index].screenIncludes)
        assert.ok(top.join('\n').includes(phrase),phrase);
    if(index<2){
        assert.ok(top[want.attack].includes('You bite the rust monster.'));
        assert.ok(!top.slice(want.attack).some(t=>t.includes('You miss')||t.includes('You kick')));
    }else{
        assert.ok(top[want.attack].includes('You miss the rust monster.'));
        assert.ok(top[want.attack+1].includes('You bite the rust monster.'));
    }
});
