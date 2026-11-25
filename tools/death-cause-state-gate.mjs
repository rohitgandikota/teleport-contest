// Constructed countdowns and HP boundaries use real owners, objects and RNG.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test as nodeTest } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { getRngLog } from '../js/rng.js';
import { pline, display_nhwindow_message } from '../js/display.js';
import { losehp } from '../js/hack.js';
import { losexp } from '../js/exper.js';
import { make_stoned } from '../js/potion.js';
import { delayed_killer, find_delayed_killer, formatkiller } from '../js/end.js';
import { nh_timeout } from '../js/timeout.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { Amulet_on } from '../js/do_wear.js';
import { polymon } from '../js/polyself.js';
import { resists_drli } from '../js/mondata.js';
import { ONAMES as O } from '../js/objects_data.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { STONED, SLIMED, SICK, POLYMORPH, KILLED_BY, KILLED_BY_AN,
    STONING, W_AMUL, A_CON, Upolyd } from '../js/const.js';
const rc='OPTIONS=name:Cause,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,debug_mongen\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=symset:plain\n';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'),
    'Usage: node tools/death-cause-state-gate.mjs [compact-report.json]');
const results=[];
const deadline=setTimeout(()=>{console.error('55 second state limit');process.exit(1);},55000);deadline.unref();
async function test(name,body){await nodeTest(name,async()=>{
    try{await body();results.push({name,pass:true});}
    catch(e){results.push({name,pass:false,error:e.message.slice(0,800)});throw e;}
});}
let seen=[];
function feed(run,allowRefusal=false){
    let count=0;seen=[];
    run._display.onEmptyQueue=async()=>{
        await setImmediate();assert.ok(count++<128,'physical input limit');
        const text=game._toplines||'';
        seen.push({text,pending:game._pending_message,formatted:formatkiller(STONING,false),
            mortality:game.u.umortality||0,killer:game.killer.name});
        if(text.includes('Die?')){assert.ok(allowRefusal,'real life saving must not ask for wizard refusal');return 110;}
        return 32;
    };
}
async function boot(){
    const run=await runSegment({seed:13001,datetime:'20000112093000',nethackrc:rc,moves:' ',storage:new InMemoryStorage()});
    resetInputState();feed(run);await display_nhwindow_message();feed(run);return run;
}
async function settle(run,allow=false){feed(run,allow);await display_nhwindow_message();feed(run,allow);}
async function amulet(){const obj=mksobj(O.AMULET_OF_LIFE_SAVING,true,false);addinv(obj);await Amulet_on(obj);
    assert.equal(game.u.uprops.LIFESAVED,W_AMUL);assert.equal(game.u.uamul,obj);return obj;}
const cause=()=>find_delayed_killer(STONED);
async function stone(time=9){await make_stoned(time,null,KILLED_BY_AN,'cockatrice egg');assert.equal(cause()?.name,'cockatrice egg');}
const actions={hp:async()=>losehp(game.u.uhp+1,'test injury',KILLED_BY_AN),xp:async()=>losexp('life drainage')};
function saved(obj){assert.equal(game.u.umortality,1);assert.ok(game.u.uhp>0);assert.equal(game.u.uamul,null);
    assert.ok(!game.u.uprops.LIFESAVED);assert.ok(!game.invent.includes(obj));
    assert.equal(game.killer.name,'');assert.equal(game.killer.format,KILLED_BY_AN);
    assert.ok(game.objects[O.AMULET_OF_LIFE_SAVING].oc_name_known);assert.ok(!seen.some(s=>s.text.includes("don't die")));}
for(const [owner,act] of Object.entries(actions)){
    await test(`${owner}: actual amulet preserves the head and the produced stoning node`,async()=>{
        const run=await boot();const obj=await amulet();await stone();const head=game.killer,node=cause();
        await settle(run);game.wizard=false;await act();saved(obj);
        assert.equal(game.killer,head);assert.equal(cause(),node);assert.equal(game.u.uprops.STONED,9);
    });
    await test(`${owner}: all constructed unrelated nodes survive the same real amulet`,async()=>{
        const run=await boot();const obj=await amulet();await stone();
        for(const id of [SICK,SLIMED,POLYMORPH])delayed_killer(id,KILLED_BY,`cause ${id}`);
        const ids=[STONED,SICK,SLIMED,POLYMORPH],nodes=ids.map(find_delayed_killer);
        await settle(run);game.wizard=false;await act();saved(obj);
        assert.deepEqual(ids.map(find_delayed_killer),nodes);
    });
    await test(`${owner}: surviving once still attributes later expiry to the egg`,async()=>{
        const run=await boot();const obj=await amulet();await stone();
        delayed_killer(POLYMORPH,KILLED_BY,'self-genocide');const other=find_delayed_killer(POLYMORPH);
        await settle(run);game.wizard=false;await act();saved(obj);
        game.wizard=true;await settle(run,true);await make_stoned(1,null,KILLED_BY_AN,null);await nh_timeout();
        assert.ok(seen.some(s=>s.formatted==='petrified by a cockatrice egg'));
        assert.equal(game.u.umortality,2);assert.equal(cause(),null);
        assert.equal(find_delayed_killer(POLYMORPH),other);
    });
    await test(`${owner}: full stoning cure removes only the surviving target node`,async()=>{
        const run=await boot();const obj=await amulet();await stone();
        delayed_killer(POLYMORPH,KILLED_BY,'self-genocide');const other=find_delayed_killer(POLYMORPH);
        await settle(run);game.wizard=false;await act();saved(obj);await make_stoned(0,null,KILLED_BY_AN,null);
        assert.equal(cause(),null);assert.equal(find_delayed_killer(POLYMORPH),other);
    });
    await test(`${owner}: healthy real amulet still restores HP and consumes the object`,async()=>{
        const run=await boot();const obj=await amulet();await settle(run);game.wizard=false;await act();saved(obj);
        assert.equal(cause(),null);assert.ok(!game.killer.next);assert.equal(game.u.uprops.STONED||0,0);
    });
}
await test('hp: nonfatal damage leaves causes and stops running and travel',async()=>{
    await boot();await stone();const head=game.killer,node=cause(),hp=game.u.uhp;
    Object.assign(game.context,{run:1,travel:1,travel1:1,mv:1});game.multi=3;
    await losehp(1,'injury',KILLED_BY_AN);assert.equal(game.u.uhp,hp-1);assert.equal(cause(),node);
    assert.equal(game.killer,head);assert.equal(game.multi,0);
    assert.deepEqual([game.context.run,game.context.travel,game.context.travel1,game.context.mv],[0,0,0,0]);
});
await test('hp: negative damage increases both current and maximum HP without death',async()=>{
    await boot();await stone();const node=cause(),hp=game.u.uhp,head=game.killer;
    await losehp(-20,null,KILLED_BY);assert.equal(game.u.uhp,hp+20);assert.equal(game.u.uhpmax,hp+20);
    assert.equal(cause(),node);assert.equal(game.killer,head);assert.equal(game.u.umortality||0,0);
});
await test('hp: zero damage preserves HP and existing cause',async()=>{
    await boot();await stone();const hp=game.u.uhp,node=cause(),draws=getRngLog().length;
    await losehp(0,null,KILLED_BY);assert.equal(game.u.uhp,hp);assert.equal(cause(),node);assert.equal(getRngLog().length,draws);
});
await test('hp: a real polymorph loses monster HP without consuming life saving',async()=>{
    const run=await boot();assert.equal(await polymon(P.PM_NEWT),1);const obj=await amulet();await stone();await settle(run);
    const hp=game.u.uhp,node=cause();game.u.mh=game.u.mhmax=20;
    await losehp(1,'injury',KILLED_BY_AN);assert.equal(game.u.mh,19);assert.equal(game.u.uhp,hp);
    assert.ok(Upolyd(game.u));assert.equal(game.u.uamul,obj);assert.equal(cause(),node);
});
await test('hp: normal rehumanization preserves causes and the unused amulet',async()=>{
    const run=await boot();await polymon(P.PM_NEWT);const obj=await amulet();await stone();await settle(run);
    const node=cause();await losehp(game.u.mh+1,'injury',KILLED_BY_AN);
    assert.ok(!Upolyd(game.u));assert.equal(game.u.uamul,obj);assert.equal(cause(),node);assert.equal(game.u.umortality||0,0);
});
await test('xp: nonfatal level loss retains cause and uses the recorded HP and energy increments',async()=>{
    await boot();await stone();const u=game.u,node=cause();u.ulevel=2;u.uhp=u.uhpmax=30;u.uen=u.uenmax=20;
    u.uhpinc[1]=5;u.ueninc[1]=4;u.uexp=80;
    await losexp('life drainage');assert.equal(u.ulevel,1);assert.equal(u.uexp,19);
    assert.deepEqual([u.uhp,u.uhpmax,u.uen,u.uenmax],[25,25,16,16]);assert.equal(cause(),node);
});
await test('xp: no drainer at level one clears experience without killing',async()=>{
    await boot();await stone();game.u.uexp=10;const node=cause();await losexp(null);
    assert.equal(game.u.ulevel,1);assert.equal(game.u.uexp,0);assert.equal(game.u.umortality||0,0);assert.equal(cause(),node);
});
await test('xp: real vampire form resists before messages and random draws',async()=>{
    const run=await boot();await polymon(P.PM_VAMPIRE);await stone();await settle(run);
    assert.ok(resists_drli(game.youmonst));const before=JSON.stringify(game.killer),rng=getRngLog().length,top=game._toplines,hp=game.u.uhp;
    await losexp('life drainage');assert.equal(JSON.stringify(game.killer),before);assert.equal(getRngLog().length,rng);
    assert.equal(game._toplines,top);assert.equal(game.u.uhp,hp);assert.equal(game.u.umortality||0,0);
});
await test('xp: explicit wizard level change bypasses resistance but is not fatal',async()=>{
    const run=await boot();await polymon(P.PM_VAMPIRE);await stone();await settle(run);game.u.uexp=10;
    const node=cause();await losexp('#levelchange');assert.equal(game.u.uexp,0);assert.equal(game.u.umortality||0,0);assert.equal(cause(),node);
});
await test('hp: pending urgent death preserves nodes while actual life saving waits',async()=>{
    const run=await boot();const obj=await amulet();await stone();await settle(run);game.wizard=false;
    await pline('A preceding message which is long enough to force a real More prompt before dying.');
    let release,entered,complete=false;const input=new Promise(r=>release=r),pending=new Promise(r=>entered=r);
    run._display.onEmptyQueue=async()=>{entered();return await input;};
    const node=cause(),head=game.killer;const work=actions.hp().then(()=>complete=true);await pending;
    const rng=[...getRngLog()],before=JSON.stringify(game.killer);let failure;
    try{await setImmediate();assert.equal(complete,false);assert.equal(game.u.uamul,obj);assert.equal(game.u.umortality,1);
        assert.deepEqual(getRngLog(),rng);assert.equal(JSON.stringify(game.killer),before);assert.equal(game.killer,head);assert.equal(cause(),node);
    }catch(e){failure=e;}finally{feed(run);release(32);await work;}
    if(failure)throw failure;saved(obj);assert.equal(cause(),node);
});
clearTimeout(deadline);
const report={total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
if(report.passed!==report.total)process.exitCode=1;
