#!/usr/bin/env node
// C-derived landing controls and native dismount state/RNG checks.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {register} from 'node:module';
import {game} from '../js/gstate.js';

register('./steed-landing-state-loader.mjs', import.meta.url);
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {audit_landing_spot,mount_steed,dismount_steed} = await import('../js/steed.js');
const {remove_monster,place_monster} = await import('../js/makemon.js');
const {which_armor} = await import('../js/worn.js');
const {initRng,enableRngLog,getRngLog} = await import('../js/rng.js');
const {PMNAMES: PM} = await import('../js/monst_data.js');
const {ROOM,STONE,PIT,TT_PIT,W_SADDLE,DISMOUNT_BYCHOICE,
    DISMOUNT_FELL,FROMOUTSIDE} = await import('../js/const.js');

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/variant-steed.json',import.meta.url)));
const cx=31,cy=10;
async function setup({mounted=false,known=true,safe=true}={}) {
    const run=await runSegment({...recipe.segments[0],moves:'  n',storage:new InMemoryStorage()});
    let dismissals=0;
    run._display.onEmptyQueue=()=>{
        if(++dismissals>40)throw Error('unexpected repeated prompt');
        return 0x20;
    };
    const pony=game.level.monsters.find(m=>m.mnum===PM.PM_PONY);
    assert.ok(pony);
    remove_monster(pony.mx,pony.my);
    game.level.monAt.clear(); game.level.objects=[]; game.level.traps=[];
    game.level.engravings=[]; game.regions=[];
    for(let x=cx-2;x<=cx+2;x++)for(let y=cy-2;y<=cy+2;y++)
        Object.assign(game.level.at(x,y),{typ:STONE,doormask:0,seenv:255,lit:1,waslit:1});
    game.level.at(cx,cy).typ=ROOM;
    game.level.at(cx-1,cy).typ=ROOM;
    if(safe)game.level.at(cx,cy-1).typ=ROOM;
    game.u.ux=mounted?cx-1:cx; game.u.uy=cy;
    game.u.dx=1; game.u.dy=0;
    game.u.ulevel=30; game.u.uhp=game.u.uhpmax=200;
    const saddle=which_armor(pony,W_SADDLE); saddle.cursed=false;
    if(mounted) {
        place_monster(pony,cx,cy);
        assert.equal(await mount_steed(pony,true),true);
        assert.equal(game.u.ux,cx); assert.equal(game.u.uy,cy);
    }
    game.level.traps=[{tx:cx-1,ty:cy,ttyp:PIT,tseen:known?1:0}];
    game.u.intrinsic.HStun=0; game.u.intrinsic.HConfusion=0;
    game.u.intrinsic.HFumbling=0; game.u.intrinsic.HBlinded=0;
    game.u.uprops.STUNNED=0; game.u.uprops.CONFUSION=0; game.u.uprops.FUMBLING=0;
    game._toplines=''; game._msg_history=[];
    initRng(1); enableRngLog();
    return pony;
}
function setProperty(sample) {
    if(sample.intrinsic)game.u.intrinsic[sample.intrinsic]=sample.value??100;
    if(sample.external)game.u.uprops[sample.external]=100;
}
const impaired=[
    {name:'intrinsic stun',intrinsic:'HStun'},
    {name:'intrinsic fumbling',intrinsic:'HFumbling'},
    {name:'ice fumbling bit and timeout',intrinsic:'HFumbling',value:FROMOUTSIDE|1},
    {name:'intrinsic confusion',intrinsic:'HConfusion'},
    {name:'external stun',external:'STUNNED'},
    {name:'external confusion',external:'CONFUSION'},
    {name:'external fumbling',external:'FUMBLING'},
];
for(const sample of impaired) test(`voluntary landing: ${sample.name} starts with traps allowed`,async()=>{
    await setup(); setProperty(sample);
    const spot={x:0,y:0};
    assert.equal(await audit_landing_spot(spot,DISMOUNT_BYCHOICE,0),true);
    assert.deepEqual(spot,{x:cx-1,y:cy});
    assert.deepEqual(getRngLog(),['rn2(2)=1'],
        'west trap competes with equally distant north floor on the first pass');
});
for(const blind of [false,true]) test(`unimpaired landing avoids a known pit, blind=${blind}`,async()=>{
    await setup(); game.u.intrinsic.HBlinded=blind?100:0;
    const spot={x:0,y:0};
    assert.equal(await audit_landing_spot(spot,DISMOUNT_BYCHOICE,0),true);
    assert.deepEqual(spot,{x:cx,y:cy-1});
    assert.deepEqual(getRngLog(),[]);
});
test('an unknown pit is allowed without impairment',async()=>{
    await setup({known:false}); const spot={x:0,y:0};
    assert.equal(await audit_landing_spot(spot,DISMOUNT_BYCHOICE,0),true);
    assert.deepEqual(spot,{x:cx-1,y:cy});
    assert.deepEqual(getRngLog(),['rn2(2)=1']);
});
test('healthy fallback still permits a known pit when no safe square exists',async()=>{
    await setup({safe:false}); const spot={x:0,y:0};
    assert.equal(await audit_landing_spot(spot,DISMOUNT_BYCHOICE,0),true);
    assert.deepEqual(spot,{x:cx-1,y:cy});
    assert.deepEqual(getRngLog(),[]);
});
test('an involuntary fall starts with traps allowed without impairment',async()=>{
    await setup(); const spot={x:0,y:0};
    assert.equal(await audit_landing_spot(spot,DISMOUNT_FELL,0),true);
    assert.deepEqual(spot,{x:cx-1,y:cy});
    assert.deepEqual(getRngLog(),['rn2(2)=1']);
});
for(const sample of [{name:'healthy'},...impaired.slice(0,2)]) test(`actual dismount: ${sample.name}`,async()=>{
    const pony=await setup({mounted:true}); setProperty(sample);
    await dismount_steed(DISMOUNT_BYCHOICE);
    assert.equal(game.u.usteed,null);
    assert.equal(game.level.monAt.get(`${cx},${cy}`),pony);
    if(sample.intrinsic) {
        assert.deepEqual([game.u.ux,game.u.uy],[cx-1,cy]);
        assert.equal(game.u.utraptype,TT_PIT);
        assert.ok(game.u.utrap>0);
        assert.ok(game.u.uhp<200);
        assert.equal(getRngLog()[0],'rn2(2)=1');
    } else {
        assert.deepEqual([game.u.ux,game.u.uy],[cx,cy-1]);
        assert.equal(game.u.utrap||0,0);
        assert.equal(game.u.uhp,200);
    }
});

const native = JSON.parse(readFileSync(new URL(
    'gen-sessions/generated/dismount-impaired-landing.session.json', import.meta.url)));
const stripCaller = call => call.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
for (const [index, hp] of [130, 127, 128, 127].entries()) {
    test(`native dismount ${index}: landing, damage and every input RNG slice`, async () => {
        const segment = native.segments[index];
        const run = await runSegment({...segment, storage:new InMemoryStorage()});
        const slices = run.getRngSlices();
        for (const [step, expected] of segment.steps.entries())
            assert.deepEqual((slices[step] || []).map(stripCaller),
                expected.rng.map(stripCaller), `input ${step}`);
        assert.equal(run.getRngLog().length, segment.steps.reduce((n, s) => n + s.rng.length, 0));
        assert.deepEqual(run.getCursors(), segment.steps.map(s => s.cursor));
        const finalCursor = segment.steps.at(-1).cursor;
        assert.deepEqual([game.u.ux, game.u.uy], [finalCursor[0] + 1, finalCursor[1] - 1]);
        assert.equal(game.u.uhp, hp);
        assert.equal(game.u.usteed, null);
        if (index === 2) {
            assert.equal(game.u.intrinsic.HFumbling, 100);
            assert.equal(game.u.uprops.FUMBLING || 0, 0);
            assert.equal(game.u.utrap, 7);
        }
    });
}
