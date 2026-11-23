#!/usr/bin/env node
// C trap.c:3035 known-trap escape and intrinsic timeout controls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {dotrap} from '../js/trap.js';
import {nh_timeout} from '../js/timeout.js';
import {initRng,enableRngLog,getRngLog} from '../js/rng.js';
import {ROOM,PIT,TT_PIT,FROMOUTSIDE,FORCETRAP} from '../js/const.js';

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/variant-steed.json',import.meta.url)));
async function setup({intrinsic=0,external=0,known=true}={}) {
    const run=await runSegment({...recipe.segments[0],moves:'  n',storage:new InMemoryStorage()});
    let dismissals=0;
    run._display.onEmptyQueue=()=>{
        if(++dismissals>40)throw Error('unexpected repeated prompt');
        return 0x20;
    };
    game._preNhgetchHook=null;
    game.level.monsters=[]; game.level.monAt.clear();
    game.level.objects=[];game.level.objAt.clear(); game.level.engravings=[]; game.regions=[];
    game.u.ux=31; game.u.uy=10; game.u.ux0=30; game.u.uy0=10;
    game.u.usteed=null; game.u.utrap=0; game.u.utraptype=0;
    game.u.dx=1; game.u.dy=0; game.u.umoved=false;
    game.u.uhp=game.u.uhpmax=200; game.moves=1;
    game.u.intrinsic.HFumbling=intrinsic;
    game.u.uprops.FUMBLING=external;
    for(let x=30;x<=32;x++)for(let y=9;y<=11;y++)
        Object.assign(game.level.at(x,y),{typ:ROOM,lit:1,waslit:1,doormask:0});
    const trap={tx:31,ty:10,ttyp:PIT,tseen:known?1:0};
    game.level.traps=[trap];
    game._toplines=''; game._msg_history=[];
    initRng(1); enableRngLog();
    return trap;
}
function assertPit() {
    assert.equal(game.u.utraptype,TT_PIT);
    assert.ok(game.u.utrap>0);
    assert.ok(game.u.uhp<200);
    // C trap.c:1920,1950,1963-1964: duration, damage, two exercises.
    assert.deepEqual(getRngLog().map(call=>call.split('=')[0]),
        ['rn2(6)','rnd(6)','rn2(2)','rn2(2)']);
}
function assertEscape() {
    assert.equal(game.u.utrap,0);
    assert.equal(game.u.uhp,200);
    assert.deepEqual(getRngLog(),['rn2(5)=0']);
}
for(const sample of [
    {name:'timed intrinsic',intrinsic:100},
    {name:'ice-origin intrinsic',intrinsic:FROMOUTSIDE|1},
    {name:'external compatibility field',external:100},
    {name:'both sources',intrinsic:100,external:100},
]) test(`${sample.name} prevents the known-pit escape roll`,async()=>{
    const trap=await setup(sample);
    await dotrap(trap,0);
    assertPit();
});
test('healthy hero retains the successful known-pit escape roll',async()=>{
    const trap=await setup();
    await dotrap(trap,0);
    assertEscape();
});
test('unknown pit skips the escape roll without fumbling',async()=>{
    const trap=await setup({known:false});
    await dotrap(trap,0);
    assertPit();
});
test('forced trap skips the escape roll without fumbling',async()=>{
    const trap=await setup();
    await dotrap(trap,FORCETRAP);
    assertPit();
});
test('a non-expired intrinsic remains effective after one timeout tick',async()=>{
    const trap=await setup({intrinsic:100});
    await nh_timeout();
    assert.equal(game.u.intrinsic.HFumbling,99);
    assert.deepEqual(getRngLog(),[]);
    await dotrap(trap,0);
    assertPit();
});
for(const intrinsic of [1,FROMOUTSIDE|1])
test(`expiration without movement clears intrinsic ${intrinsic} before escape selection`,async()=>{
    const trap=await setup({intrinsic});
    await nh_timeout();
    assert.equal(game.u.intrinsic.HFumbling,0);
    assert.deepEqual(getRngLog(),[]);
    await dotrap(trap,0);
    assertEscape();
});
