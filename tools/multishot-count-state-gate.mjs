#!/usr/bin/env node
// C-derived volley calculations, count setup, and independent native input traces.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {Confusion,Stunned,Fumbling} from '../js/youprop.js';
import {ACURR,acurrstr} from '../js/attrib.js';
import {P_SKILL,weapon_type} from '../js/weapon.js';
import {is_ammo,ammo_and_launcher} from '../js/wield.js';
import {Race_if} from '../js/u_init.js';
import {is_quest_artifact} from '../js/questpgr.js';
import {multishot_class_bonus} from '../js/dothrow.js';
import {ONAMES,OCLASSES,SKILLS} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {ART_LONGBOW_OF_DIANA} from '../js/artilist_data.js';
import {A_DEX,A_STR,FROMOUTSIDE,P_UNSKILLED,P_BASIC,P_SKILLED,P_EXPERT} from '../js/const.js';
import {initRng,enableRngLog,getRngLog,rnd} from '../js/rng.js';

const input=JSON.parse(readFileSync(new URL('gen-sessions/recipes/multishot-count-contracts.json',import.meta.url)));
await runSegment({...input.segments[0],moves:' ',storage:new InMemoryStorage()});
const source=readFileSync(new URL('../js/dothrow.js',import.meta.url),'utf8');
// Execute the exact calculation block, ending before messages and projectile
// release. All property, weapon, role/race, attribute and RNG readers are real.
const start=source.indexOf('    let multishot = 1;',source.indexOf('export async function throw_obj('));
const end=source.indexOf('    const m_shot_s =',start);
assert.ok(start>0&&end>start);
const script=new vm.Script('(function(){\n'+source.slice(start,end)+'\nreturn multishot;})()');
function calculate(sample={}) {
    game.u.intrinsic={}; game.u.uprops={};
    if(sample.intrinsic)game.u.intrinsic[sample.intrinsic]=sample.value??100;
    if(sample.external)game.u.uprops[sample.external]=1;
    game.urole={mnum:sample.role??PMNAMES.PM_RANGER,questarti:ART_LONGBOW_OF_DIANA};
    game.urace={mnum:sample.race??PMNAMES.PM_HUMAN};
    game.u.acurr.a[A_DEX]=sample.dex??14; game.u.acurr.a[A_STR]=sample.strength??18;
    game.u.abon={a:new Array(6).fill(0)}; game.u.atemp.a.fill(0);
    const obj={otyp:sample.ammo??ONAMES.ARROW,quan:sample.quantity??20,
        oclass:sample.oclass??OCLASSES.WEAPON_CLASS};
    const launcher=sample.launcher===null?null:{otyp:sample.launcher??ONAMES.BOW,
        oartifact:sample.quest?ART_LONGBOW_OF_DIANA:0};
    game.u.uwep=launcher;
    game.u.weapon_skills=[];
    game.u.weapon_skills[weapon_type(obj)]={skill:sample.level??P_SKILLED};
    const draws=[];
    initRng(1); enableRngLog();
    const result=script.runInNewContext({game,u:game.u,obj,shotlimit:sample.limit??0,
        ONAMES,OCLASSES,SKILLS,PMNAMES,A_DEX,Confusion,Stunned,Fumbling,ACURR,acurrstr,
        P_SKILL,weapon_type,is_ammo,ammo_and_launcher,Race_if,is_quest_artifact,
        multishot_class_bonus,rnd:n=>{const value=rnd(n);draws.push({n,value});return value;}});
    return {result,draws,rng:getRngLog()};
}
for(const condition of [
    {intrinsic:'HConfusion'}, {intrinsic:'HStun'},
    {external:'CONFUSION'}, {external:'STUNNED'},
])test(`multishot gating: ${condition.intrinsic||condition.external}`,()=>{
    const r=calculate(condition);
    assert.equal(r.result,1); assert.deepEqual(r.draws,[]); assert.deepEqual(r.rng,[]);
});
for(const sample of [
    {name:'one arrow',quantity:1},
    {name:'mismatched launcher',launcher:ONAMES.CROSSBOW},
    {name:'nonweapon stack',ammo:ONAMES.APPLE,oclass:OCLASSES.FOOD_CLASS,launcher:null},
])test(`eligibility: ${sample.name}`,()=>{
    const r=calculate(sample); assert.equal(r.result,1); assert.deepEqual(r.draws,[]);
});
const pairs=[
    {name:'Ranger unskilled',level:P_UNSKILLED,normal:2,weak:2},
    {name:'Ranger basic',level:P_BASIC,normal:2,weak:2},
    {name:'Ranger skilled',level:P_SKILLED,normal:3,weak:2},
    {name:'Ranger expert',level:P_EXPERT,normal:4,weak:3},
    {name:'DEX six',dex:6,normal:2,weak:2},
    {name:'DEX seven',dex:7,normal:3,weak:2},
    {name:'Wizard masks skilled bonus',role:PMNAMES.PM_WIZARD,normal:1,weak:1},
    {name:'Cleric masks skilled bonus',role:PMNAMES.PM_CLERIC,normal:1,weak:1},
    {name:'Healer knife exception',role:PMNAMES.PM_HEALER,ammo:ONAMES.KNIFE,launcher:null,normal:2,weak:1},
    {name:'Healer dagger remains weak',role:PMNAMES.PM_HEALER,ammo:ONAMES.DAGGER,launcher:null,normal:1,weak:1},
    {name:'Tourist dart exception',role:PMNAMES.PM_TOURIST,ammo:ONAMES.DART,launcher:null,normal:2,weak:1},
    {name:'Tourist dagger remains weak',role:PMNAMES.PM_TOURIST,ammo:ONAMES.DAGGER,launcher:null,normal:1,weak:1},
    {name:'Rogue dagger retains role bonus',role:PMNAMES.PM_ROGUE,ammo:ONAMES.DAGGER,launcher:null,normal:3,weak:2},
    {name:'Ranger dagger has no role bonus',ammo:ONAMES.DAGGER,launcher:null,normal:2,weak:1},
    {name:'elven bow bonus',race:PMNAMES.PM_ELF,ammo:ONAMES.ELVEN_ARROW,launcher:ONAMES.ELVEN_BOW,normal:4,weak:2},
    {name:'orcish bow bonus',race:PMNAMES.PM_ORC,ammo:ONAMES.ORCISH_ARROW,launcher:ONAMES.ORCISH_BOW,normal:4,weak:2},
    {name:'gnome crossbow bonus',race:PMNAMES.PM_GNOME,ammo:ONAMES.CROSSBOW_BOLT,launcher:ONAMES.CROSSBOW,strength:16,normal:4,weak:2},
    {name:'quest launcher bonus',quest:true,normal:4,weak:2},
];
for(const sample of pairs)for(const fumbling of [false,true])
test(`${sample.name}, intrinsic fumbling=${fumbling}`,()=>{
    const r=calculate({...sample,...(fumbling?{intrinsic:'HFumbling'}:{})});
    const bound=fumbling?sample.weak:sample.normal;
    assert.deepEqual(r.draws.map(d=>d.n),[bound]);
    assert.equal(r.result,r.draws[0].value);
});
for(const condition of [{external:'FUMBLING'}, {intrinsic:'HFumbling',value:FROMOUTSIDE|1}])
test(`fumbling source ${condition.external||'ice origin'}`,()=>{
    const r=calculate(condition); assert.deepEqual(r.draws.map(d=>d.n),[2]);
});
for(const sample of [
    {name:'human STR17',race:PMNAMES.PM_HUMAN,strength:17,bound:3,two:true},
    {name:'human STR18',race:PMNAMES.PM_HUMAN,strength:18,bound:3,two:false},
    {name:'gnome STR15',race:PMNAMES.PM_GNOME,strength:15,bound:4,two:true},
    {name:'gnome STR16',race:PMNAMES.PM_GNOME,strength:16,bound:4,two:false},
])for(const fumbling of [false,true])test(`crossbow ${sample.name}, fumbling=${fumbling}`,()=>{
    const r=calculate({...sample,ammo:ONAMES.CROSSBOW_BOLT,launcher:ONAMES.CROSSBOW,
        ...(fumbling?{intrinsic:'HFumbling'}:{})});
    assert.equal(r.draws[0].n,fumbling?2:sample.bound);
    assert.equal(r.draws.length,sample.two?2:1);
    if(sample.two)assert.equal(r.draws[1].n,r.draws[0].value,
        'strength reduction roll precedes final volley roll');
    assert.equal(r.result,r.draws.at(-1).value);
});
test('quantity and requested count clamp only after the volley draw',()=>{
    const r=calculate({level:P_EXPERT,quantity:2,limit:1});
    assert.deepEqual(r.draws.map(d=>d.n),[4]); assert.equal(r.result,1);
});

// src/dothrow.c:299: count setup precedes body-form and capacity refusals.
// Isolate that prefix; the native cases below exercise both full entry points.
const okStart = source.indexOf('async function ok_to_throw(');
const okBody = source.indexOf('{', okStart) + 1;
const okGuard = source.indexOf('    if (notake(', okBody);
assert.ok(okStart > 0 && okGuard > okBody);
const countSetup = new vm.Script('(function(shotlimit_p){\n'
    + source.slice(okBody, okGuard) + '\n})(out)');
for (const [count, expected] of [[undefined,0],[-1,0],[0,0],[1,1],[2,2],[32767,32767],[32768,32767]]) {
    test(`shot count is captured and repetition reset: ${count}`, () => {
        const state = {command_count:count, multi:25};
        const out = {value:-1};
        countSetup.runInNewContext({game:state, out, LARGEST_INT:32767});
        assert.equal(out.value, expected);
        assert.equal(state.multi, 0);
    });
}

const native = JSON.parse(readFileSync(new URL(
    'gen-sessions/generated/multishot-count-contracts.session.json', import.meta.url)));
const stripCaller = call => call.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
test('native volleys distinguish impaired rolls and post-roll count limits', () => {
    const samples = [
        [0,36,'rnd(4)=1','You shoot 1 elven arrow.'],
        [0,41,'rnd(4)=3','You shoot 3 elven arrows.'],
        [1,41,'rnd(2)=1','You shoot 1 elven arrow.'],
        [1,46,'rnd(2)=1','You shoot 1 elven arrow.'],
        [2,40,null,'You shoot 1 elven arrow.'],
        [3,40,null,'You shoot 1 elven arrow.'],
        [4,41,'rnd(4)=3','You shoot 1 elven arrow.'],
        [5,43,'rnd(4)=3','You shoot 2 elven arrows.'],
        [6,35,'rnd(4)=1',''],
        [6,39,'rnd(4)=3','You shoot 3 elven arrows.'],
    ];
    for (const [segment,step,roll,message] of samples) {
        const frame = native.segments[segment].steps[step];
        assert.deepEqual(frame.rng.filter(call => call.includes('@ throw_obj(')).map(stripCaller),
            roll ? [roll] : [], `segment ${segment}, input ${step}`);
        assert.equal(frame.screen.split('\n')[0], message);
    }
    assert.ok(native.segments[7].steps.every(frame =>
        frame.rng.every(call => !call.includes('@ throw_obj('))), 'cancellation never rolls a volley');
});
for (const [index, segment] of native.segments.entries()) {
    test(`native volley case ${index}: every input retains its RNG slice`, async () => {
        const run = await runSegment({...segment, storage:new InMemoryStorage()});
        const slices = run.getRngSlices();
        for (const [step, expected] of segment.steps.entries())
            assert.deepEqual((slices[step] || []).map(stripCaller),
                expected.rng.map(stripCaller), `input ${step}`);
        assert.equal(run.getRngLog().length, segment.steps.reduce((n,s) => n+s.rng.length, 0));
        assert.deepEqual(run.getCursors(), segment.steps.map(s => s.cursor));
    });
}
