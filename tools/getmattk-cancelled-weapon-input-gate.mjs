// Actual ordinary keys and read-only observations. Native parity is separate.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {getmattk} from '../js/mhitu.js';
import {canspotmon} from '../js/display.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/cancelled-monster-weapon-attacks.json',import.meta.url)));
const expected=[
    {species:P.PM_BARROW_WIGHT,birth:107,cancel:110,attack:128,count:136,weapon:O.LONG_SWORD,type:A.AD_DRLI,direction:'y'},
    {species:P.PM_NAZGUL,birth:101,cancel:104,attack:116,count:130,weapon:O.LONG_SWORD,type:A.AD_DRLI,direction:'y'},
    {species:P.PM_ERINYS,birth:101,cancel:112,attack:120,count:146,weapon:O.BATTLE_AXE,type:A.AD_DRST,direction:'h'},
    {species:P.PM_BARROW_WIGHT,birth:98,cancel:null,attack:122,count:136,weapon:O.LONG_SWORD,type:A.AD_DRLI},
    {species:P.PM_GOBLIN,birth:101,cancel:104,attack:110,count:130,weapon:null,type:A.AD_PHYS,direction:'y'},
];
const object=o=>o&&({id:o.o_id,type:o.otyp,spe:o.spe,worn:o.owornmask});
for(const [index,part]of recipe.segments.entries())test(`ordinary cancelled weapon route: ${part.name}`,async()=>{
    const rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){rows.push({step,xy:[g.u.ux,g.u.uy],hp:g.u.uhp,
            mortality:g.u.umortality||0,inventory:(g.invent||[]).map(object),
            monsters:g.level.monsters.map(m=>({id:m.m_id,species:m.mnum,canonical:m.data===g.mons[m.mnum],
                xy:[m.mx,m.my],cancelled:!!m.mcan,sleeping:!!m.msleeping,spotted:canspotmon(m),
                weapon:object(m.mw),inventory:(m.minvent||[]).map(object),
                attack:[...m.data.mattk[0]],selected:[...getmattk(m,g.youmonst,0,Array(6).fill(0))]}))});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    const want=expected[index];
    assert.equal(run.getScreens().length,want.count);assert.equal(rows.length,want.count);
    assert.equal(part.moves.length+1,want.count);assert.ok(rows.every(r=>r.mortality===0));
    assert.doesNotMatch(part.moves,/\x07[^\r]*cancel/i,'no invented create modifier');
    const birth=rows.find(r=>r.step===want.birth),target=birth.monsters.find(m=>m.species===want.species);
    assert.ok(target?.canonical&&target.spotted);assert.equal(target.cancelled,false);
    assert.equal(target.attack[0],A.AT_WEAP);assert.equal(target.attack[1],want.type);
    assert.equal(target.sleeping,index!==3);
    const matches=rows.map(r=>({r,m:r.monsters.find(m=>m.id===target.id)})).filter(v=>v.m);
    if(want.cancel!==null){
        const {r,m}=matches.find(v=>v.m.cancelled);
        assert.equal(r.step,want.cancel);assert.equal(part.moves[r.step-1],want.direction);
        assert.equal(Math.max(...m.xy.map((v,i)=>Math.abs(v-r.xy[i]))),1);
        assert.equal(m.sleeping,false);assert.equal(m.selected[1],A.AD_PHYS);
        const initialWand=birth.inventory.find(o=>o.type===O.WAN_CANCELLATION);
        const wand=r.inventory.find(o=>o.id===initialWand?.id);
        assert.ok(wand&&wand.spe<initialWand.spe,'real wand charge was consumed');
        assert.ok(matches.filter(v=>v.r.step>=want.cancel).every(v=>v.m.cancelled));
    }else{
        assert.ok(matches.every(v=>!v.m.cancelled));
        assert.ok(matches.every(v=>v.m.selected[1]===want.type));
    }
    const before=rows.find(r=>r.step===want.attack-1),attacking=before.monsters.find(m=>m.id===target.id);
    assert.ok(attacking.canonical&&attacking.spotted&&!attacking.sleeping);
    assert.equal(Math.max(...attacking.xy.map((v,i)=>Math.abs(v-before.xy[i]))),1);
    if(want.weapon!==null){
        const created=target.inventory.find(o=>o.type===want.weapon);assert.ok(created);
        assert.equal(attacking.weapon?.id,created.id,'wields the naturally created weapon');
        assert.equal(attacking.weapon.type,want.weapon);assert.ok(attacking.weapon.worn);
    }
    if(index<3){
        assert.equal(attacking.cancelled,true);assert.equal(attacking.selected[1],A.AD_PHYS);
        assert.equal(attacking.attack[1],want.type,'live table retains the original special damage');
    }
    const top=run.getScreens().map(s=>decodeScreen(s).slice(0,2).map(r=>r.map(renderCell).join('')).join('\n'));
    for(const phrase of recipe.branchAssertions[index].screenIncludes)assert.ok(top.join('\n').includes(phrase),phrase);
    assert.ok(top[want.attack].includes(index===4?'The goblin hits!':'swings'),'actual attack output');
    assert.ok(rows.some(r=>r.step>=want.attack&&r.hp<before.hp),'attack reaches real HP loss');
});
