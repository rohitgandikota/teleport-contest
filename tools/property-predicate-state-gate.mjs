#!/usr/bin/env node
// C-derived property predicates and independently recorded input traces.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {exerper,ACURR} from '../js/attrib.js';
import {domove} from '../js/cmd.js';
import {initRng,enableRngLog,getRngLog} from '../js/rng.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {ROOM,DOOR,D_CLOSED,A_DEX,FROMOUTSIDE,DOMOVE_WALK} from '../js/const.js';

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/variant-steed.json',import.meta.url)));
async function setup() {
    const run=await runSegment({...recipe.segments[0],moves:'  n',storage:new InMemoryStorage()});
    let dismissals=0;
    run._display.onEmptyQueue=()=>{
        if(++dismissals>40)throw Error('unexpected repeated prompt');
        return 0x20;
    };
    game._preNhgetchHook=null;
    const pony=game.level.monsters.find(m=>m.mnum===PMNAMES.PM_PONY);
    game.level.monsters=[]; game.level.monAt.clear();
    game.level.objects=[]; game.level.traps=[]; game.level.engravings=[]; game.regions=[];
    game.u.ux=31; game.u.uy=10; game.u.dx=1; game.u.dy=0; game.u.dz=0;
    game.u.usteed=null; game.u.utrap=0; game.u.ustuck=null;
    game.u.intrinsic={}; game.u.uprops={}; game.u.blocked={};
    game.u.ublind=0; game.u.ublindf=null; game.u.EWounded_legs=0;
    game.u.aexe.a.fill(0);
    game.u.acurr.a[A_DEX]=14;
    game.u.abon={a:new Array(6).fill(0)}; game.u.atemp.a.fill(0);
    game.invent=[];
    game.flags.autoopen=false; game.context.run=0; game.context.travel=0;
    game.context.forcefight=0; game.context.door_opened=false; game.context.move=1;
    game.multi=0; game.moves=5;
    game.domove_attempting=DOMOVE_WALK;
    for(let x=30;x<=32;x++)for(let y=9;y<=11;y++)
        Object.assign(game.level.at(x,y),{typ:ROOM,doormask:0,lit:1,waslit:1,seenv:255});
    game._toplines=''; game._msg_history=[];
    return pony;
}
function seed() {initRng(3); enableRngLog();}
function calls() {return getRngLog().map(call=>call.split('=')[0]);}
function setCondition(sample,pony) {
    if(sample.intrinsic)game.u.intrinsic[sample.intrinsic]=sample.value??100;
    if(sample.external)game.u.uprops[sample.external]=1;
    if(sample.legs)game.u.EWounded_legs=sample.legs;
    if(sample.mounted)game.u.usteed=pony;
    if(sample.cachedBlind)game.u.ublind=1;
    if(sample.blindfold)game.u.ublindf={otyp:ONAMES.BLINDFOLD};
    if(sample.blockBlind)game.u.blocked.BLINDED=1;
    if(sample.dex)game.u.acurr.a[A_DEX]=sample.dex;
}
const exerciseCases=[
    {name:'healthy',abuse:false},
    {name:'intrinsic fumbling',intrinsic:'HFumbling',abuse:true},
    {name:'ice-origin fumbling',intrinsic:'HFumbling',value:FROMOUTSIDE|1,abuse:true},
    {name:'external fumbling',external:'FUMBLING',abuse:true},
    {name:'intrinsic stun',intrinsic:'HStun',abuse:true},
    {name:'flat compatibility-only stun is not HStun',external:'STUNNED',abuse:false},
    {name:'intrinsic wounded legs',intrinsic:'HWounded_legs',abuse:true},
    {name:'external wounded-leg bits',legs:3,abuse:true},
    {name:'mounted wounded legs belong to steed',intrinsic:'HWounded_legs',mounted:true,abuse:false},
    {name:'mounted fumbling still abuses hero dexterity',intrinsic:'HFumbling',mounted:true,abuse:true},
];
for(const sample of exerciseCases)test(`exerper: ${sample.name}`,async()=>{
    const pony=await setup(); setCondition(sample,pony); seed();
    exerper();
    assert.deepEqual(calls(),sample.abuse?['rn2(2)']:[]);
    assert.equal(game.u.aexe.a[A_DEX],sample.abuse?-1:0);
});
test('exerper does not check status between five-turn boundaries',async()=>{
    await setup(); game.u.intrinsic.HFumbling=100; game.moves=6; seed();
    exerper();
    assert.deepEqual(getRngLog(),[]);
    assert.equal(game.u.aexe.a[A_DEX],0);
});
test('combined wounded/fumbling/stunned status exercises dexterity only once',async()=>{
    await setup();
    Object.assign(game.u.intrinsic,{HWounded_legs:10,HFumbling:10,HStun:10}); seed();
    exerper();
    assert.deepEqual(calls(),['rn2(2)']);
    assert.equal(game.u.aexe.a[A_DEX],-1);
});

const doorCases=[
    {name:'healthy dexterity 14',bump:false},
    {name:'intrinsic fumbling',intrinsic:'HFumbling',bump:true},
    {name:'external fumbling',external:'FUMBLING',bump:true},
    {name:'intrinsic stun',intrinsic:'HStun',bump:true,stun:true},
    {name:'flat stun compatibility',external:'STUNNED',bump:true,stun:true},
    {name:'timed blindness without cache',intrinsic:'HBlinded',bump:true},
    {name:'blindfold without cache',blindfold:true,bump:true},
    {name:'blocked blindness despite stale cache',intrinsic:'HBlinded',cachedBlind:true,blockBlind:true,bump:false},
    {name:'expired blindness with stale cache',cachedBlind:true,bump:false},
    {name:'dexterity 9',dex:9,bump:true},
    {name:'dexterity 10',dex:10,bump:false},
    {name:'mounted fumbling refuses and consumes time',intrinsic:'HFumbling',mounted:true,bump:true},
];
for(const sample of doorCases)test(`closed door: ${sample.name}`,async()=>{
    const pony=await setup(); setCondition(sample,pony);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])
        Object.assign(game.level.at(31+dx,10+dy),{typ:DOOR,doormask:D_CLOSED});
    assert.equal(ACURR(A_DEX),sample.dex||14);
    seed();
    await domove();
    assert.deepEqual([game.u.ux,game.u.uy],[31,10]);
    const message=game.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd();
    if(sample.mounted)assert.match(message,/can't lead .* through that closed door\./);
    else assert.equal(message,sample.bump?'Ouch!  You bump into a door.':'That door is closed.');
    assert.equal(!!game.context.door_opened,sample.bump);
    assert.equal(game.context.move,sample.bump?1:0);
    assert.deepEqual(calls(),[...(sample.stun?['rn2(8)']:[]),
        ...(sample.bump&&!sample.mounted?['rn2(2)']:[])]);
});


const native = JSON.parse(readFileSync(new URL(
    'gen-sessions/generated/property-predicate-contracts.session.json', import.meta.url)));
const stripCaller = call => call.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
test('native controls distinguish the periodic draw and door turn', () => {
    const exerciseCalls = (segment,step) => native.segments[segment].steps[step].rng
        .filter(call => call.includes('@ exercise('));
    assert.deepEqual(exerciseCalls(0,21), []);
    assert.deepEqual(exerciseCalls(1,26), ['rn2(2)=0 @ exercise(attrib.c:509)']);
    assert.ok(native.segments[2].steps[45].screen.startsWith('That door is closed.'));
    assert.ok(native.segments[3].steps[50].screen.startsWith('Ouch!  You bump into a door.'));
});
for (const [index, segment] of native.segments.entries()) {
    test(`native property case ${index}: every input retains its RNG slice`, async () => {
        const run = await runSegment({...segment, storage:new InMemoryStorage()});
        const slices = run.getRngSlices();
        for (const [step, expected] of segment.steps.entries())
            assert.deepEqual((slices[step] || []).map(stripCaller),
                expected.rng.map(stripCaller), `input ${step}`);
        assert.equal(run.getRngLog().length, segment.steps.reduce((n,s) => n+s.rng.length, 0));
        assert.deepEqual(run.getCursors(), segment.steps.map(s => s.cursor));
    });
}
