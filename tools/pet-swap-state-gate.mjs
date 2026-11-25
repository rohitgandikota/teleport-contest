// Constructed controls through normal imports and real producers.
// Trap/death helper controls do not claim ordinary swap reach.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { getRngLog } from '../js/rng.js';
import { display_nhwindow_message, pline, newsym, is_safemon } from '../js/display.js';
import { rhack, domove_swap_with_pet } from '../js/cmd.js';
import { makemon, mongets, monsndx } from '../js/makemon.js';
import { tamedog, abuse_dog } from '../js/dog.js';
import { minliquid, mondead, mlifesaver, m_at, setmangry } from '../js/mon.js';
import { mintrap, migrate_monster, Trap_Effect_Finished, Trap_Caught_Mon,
    Trap_Moved_Mon, Trap_Killed_Mon } from '../js/trap.js';
import { maketrap } from '../js/mklev.js';
import { set_levltyp } from '../js/mkmaze.js';
import { m_dowear } from '../js/worn.js';
import { experience, more_experienced, newexplevel, newuexp } from '../js/exper.js';
import { adjalign } from '../js/attrib.js';
import { christen_monst } from '../js/do_name.js';
import { PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';
import { ROOM, FOUNTAIN, POOL, WEB, TELEP_TRAP, TRAPDOOR, FIRE_TRAP, NO_MM_FLAGS,
    NO_TRAP_FLAGS, FORCETRAP, MIGR_RANDOM } from '../js/const.js';

const rc='OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
let reads, messages;
function feed(run, text=' '.repeat(64)) {
    reads=0; messages=[];
    run._display.onEmptyQueue=async()=>{
        await setImmediate();
        messages.push(game._pending_message||game._toplines);
        assert.ok(reads<text.length,'unexpected physical input');
        return text.charCodeAt(reads++);
    };
}
async function settle(run) {
    feed(run); await display_nhwindow_message(); feed(run);
}
async function boot(fountain=true,seed=12001) {
    const run=await runSegment({seed,moves:' \x17fountain\n',
        datetime:'20000112093000',nethackrc:rc,storage:new InMemoryStorage()});
    resetInputState(); await settle(run);
    assert.equal(game.level.at(game.u.ux,game.u.uy).typ,FOUNTAIN);
    if(!fountain) assert.ok(set_levltyp(game.u.ux,game.u.uy,ROOM));
    return run;
}
const directions=[[1,0,'l'],[-1,0,'h'],[0,1,'j'],[0,-1,'k'],
    [1,1,'n'],[-1,1,'b'],[1,-1,'u'],[-1,-1,'y']];
async function pet(mnum, diagonal=false, tame=true) {
    const entry=directions.find(([dx,dy])=>!!(dx&&dy)===diagonal
        && game.level.at(game.u.ux+dx,game.u.uy+dy)?.typ===ROOM
        && !game.level.objectsAt(game.u.ux+dx,game.u.uy+dy).length
        && !m_at(game.u.ux+dx,game.u.uy+dy));
    assert.ok(entry,'a real adjacent room cell is required');
    const [dx,dy,key]=entry;
    const mon=await makemon(game.mons[mnum],game.u.ux+dx,game.u.uy+dy,NO_MM_FLAGS);
    assert.ok(mon);
    if(tame) assert.ok(await tamedog(mon,null,false));
    else await setmangry(mon,false);
    newsym(mon.mx,mon.my); assert.equal(is_safemon(mon),tame);
    return {mon,key};
}
async function swap(run,key,limit=8) {
    const xy=[game.u.ux,game.u.uy];
    for(let i=0;i<limit;i++) {
        feed(run); await rhack(key.charCodeAt(0));
        if(game.u.ux!==xy[0]||game.u.uy!==xy[1]) return;
    }
    assert.fail('no successful swap in eight actual attempts');
}
const gremlins=()=>game.level.monsters.filter(m=>m.mnum===PMNAMES.PM_GREMLIN&&m.mhp>0);

await test('floor dog swap preserves both identities and gives no death credit',async()=>{
    const run=await boot(false),{mon,key}=await pet(PMNAMES.PM_DOG);
    const hero=[game.u.ux,game.u.uy],dest=[mon.mx,mon.my],id=mon.m_id,hp=mon.mhp;
    const conduct=game.u.uconduct.killer||0,xp=game.u.uexp||0;
    await swap(run,key);
    assert.deepEqual([game.u.ux,game.u.uy],dest);
    assert.deepEqual([mon.mx,mon.my],hero);assert.equal(m_at(...hero),mon);
    assert.equal(mon.m_id,id);assert.equal(mon.mhp,hp);
    assert.equal(game.u.uconduct.killer||0,conduct);assert.equal(game.u.uexp||0,xp);
});
await test('actual gremlin displacement immediately runs the liquid producer',async()=>{
    const run=await boot(),{mon,key}=await pet(PMNAMES.PM_GREMLIN);
    const start=getRngLog().length,hero=[game.u.ux,game.u.uy];
    await swap(run,key);
    assert.deepEqual([mon.mx,mon.my],hero);
    assert.ok(getRngLog().slice(start).some(s=>s.startsWith('rn2(3)=')),
        'minliquid must run within the swap command');
    assert.equal(game.iflags.sad_feeling,false);
});
await test('grid bug diagonal refusal keeps the fountain and pet position',async()=>{
    const run=await boot(),{mon,key}=await pet(PMNAMES.PM_GRID_BUG,true);
    const hero=[game.u.ux,game.u.uy],dest=[mon.mx,mon.my],start=getRngLog().length;
    for(let i=0;i<8&&!game._toplines.includes("can't move diagonally");i++) {
        feed(run);await rhack(key.charCodeAt(0));
    }
    assert.ok(game._toplines.includes("can't move diagonally"));
    assert.deepEqual([game.u.ux,game.u.uy],hero);assert.deepEqual([mon.mx,mon.my],dest);
    assert.equal(game.level.at(...hero).typ,FOUNTAIN);
    assert.ok(!getRngLog().slice(start).some(s=>s.startsWith('rn2(3)=')));
});
await test('real destination trap refuses the peaceful swap before mintrap',async()=>{
    const run=await boot(false),{mon,key}=await pet(PMNAMES.PM_DOG);
    const hero=[game.u.ux,game.u.uy],dest=[mon.mx,mon.my];
    const trap=await maketrap(...hero,WEB);assert.ok(trap);
    for(let i=0;i<8&&!game._toplines.includes("doesn't want to swap");i++) {
        feed(run);await rhack(key.charCodeAt(0));
    }
    assert.ok(game._toplines.includes("doesn't want to swap"));
    assert.deepEqual([game.u.ux,game.u.uy],hero);assert.deepEqual([mon.mx,mon.my],dest);
    assert.ok(!mon.mtrapped);assert.equal(trap.tseen,false);
});
await test('swap message holds liquid effects behind a real pending More',async()=>{
    const run=await boot(),{mon,key}=await pet(PMNAMES.PM_GREMLIN);
    await settle(run);
    await pline('An earlier long message still occupies this top line while the pet waits.');
    const hp=mon.mhp,count=gremlins().length,start=getRngLog().length;
    let release,entered=false,done=false;
    const wait=new Promise(resolve=>release=resolve);
    run._display.onEmptyQueue=async()=>{entered=true;await wait;return 32;};
    const pending=rhack(key.charCodeAt(0)).then(()=>done=true);
    await setImmediate();
    try {
        assert.ok(entered);assert.equal(done,false);
        assert.equal(mon.mhp,hp);assert.equal(gremlins().length,count);
        const before=[...getRngLog()];await setImmediate();assert.deepEqual(getRngLog(),before);
    } finally { release(); }
    await pending;
    assert.deepEqual([mon.mx,mon.my],[game.u.ux0,game.u.uy0]);
    assert.ok(getRngLog().slice(start).some(s=>s.startsWith('rn2(3)=')),
        'the liquid helper must run after the swap message completes');
});

// The caller rejects these destinations for peaceful swaps. These exercise
// existing helper contracts, not the new owner's caught/moved/killed cases.
await test('helper: an empty floor returns finished with no trap draw',async()=>{
    await boot(false);const {mon}=await pet(PMNAMES.PM_DOG),log=[...getRngLog()];
    assert.equal(await mintrap(mon,NO_TRAP_FLAGS),Trap_Effect_Finished);
    assert.deepEqual(getRngLog(),log);
});
await test('helper: real web returns caught; abuse completes before alignment',async()=>{
    await boot(false);const {mon}=await pet(PMNAMES.PM_DOG);
    assert.ok(await maketrap(mon.mx,mon.my,WEB));
    assert.equal(await mintrap(mon,NO_TRAP_FLAGS),Trap_Caught_Mon);assert.ok(mon.mtrapped);
    const tame=mon.mtame,abuse=mon.edog.abuse,record=game.u.ualign.record;
    await abuse_dog(mon);assert.equal(mon.mtame,tame-1);assert.equal(mon.edog.abuse,abuse+1);
    assert.equal(game.u.ualign.record,record);adjalign(-3);assert.equal(game.u.ualign.record,record-3);
});
await test('helper: real teleport trap returns moved and preserves monster identity',async()=>{
    await boot(false);const {mon}=await pet(PMNAMES.PM_DOG),id=mon.m_id;
    assert.ok(await maketrap(mon.mx,mon.my,TELEP_TRAP));
    assert.equal(await mintrap(mon,NO_TRAP_FLAGS),Trap_Moved_Mon);
    assert.equal(mon.m_id,id);assert.ok(mon.mhp>0);
});
await test('helper: migrated pet abuse suppresses on-level sound and draws',async()=>{
    await boot(false);const {mon}=await pet(PMNAMES.PM_DOG),tame=mon.mtame;
    migrate_monster(mon,{dnum:game.u.uz.dnum,dlevel:game.u.uz.dlevel+1},MIGR_RANDOM);
    const log=[...getRngLog()],top=game._toplines;
    await abuse_dog(mon);assert.equal(mon.mtame,tame-1);assert.equal(mon.mx,0);
    assert.deepEqual(getRngLog(),log);assert.equal(game._toplines,top);
});
await test('helper: real fire trap returns killed, with the current death ledger',async()=>{
    await boot(false);const {mon}=await pet(PMNAMES.PM_PAPER_GOLEM),mndx=monsndx(mon.data);
    const died=game.mvitals[mndx].died||0;
    assert.ok(await maketrap(mon.mx,mon.my,FIRE_TRAP));
    const result=await mintrap(mon,FORCETRAP);
    assert.equal(result,Trap_Killed_Mon);assert.ok(mon.mhp<=0);
    assert.equal(game.mvitals[mndx].died,died+1);assert.equal(mon.mnum,mndx);
});
await test('helper: liquid death returns one and retains data for experience',async()=>{
    await boot(false);const {mon}=await pet(PMNAMES.PM_DOG),mndx=monsndx(mon.data);
    const died=game.mvitals[mndx].died||0;assert.ok(set_levltyp(mon.mx,mon.my,POOL));
    assert.equal(await minliquid(mon),1);assert.ok(mon.mhp<=0);
    assert.equal(game.mvitals[mndx].died,died+1);assert.ok(experience(mon,died+1)>0);
    assert.equal(game.iflags.sad_feeling,false);
});
await test('helper: real worn life saving makes the liquid result a survivor',async()=>{
    await boot(false);const {mon}=await pet(PMNAMES.PM_GNOME),mndx=monsndx(mon.data);
    mongets(mon,ONAMES.AMULET_OF_LIFE_SAVING);await m_dowear(mon,true);
    const amulet=mlifesaver(mon);assert.ok(amulet);
    const died=game.mvitals[mndx].died||0;assert.ok(set_levltyp(mon.mx,mon.my,POOL));
    assert.equal(await minliquid(mon),0);assert.ok(mon.mhp>0);
    assert.equal(game.mvitals[mndx].died||0,died);assert.equal(mlifesaver(mon),null);
    assert.ok(!mon.minvent?.includes(amulet));assert.equal(game.iflags.sad_feeling,false);
});
await test('helper: experience from a real death awaits the level message before completion',async()=>{
    const run=await boot(false),{mon}=await pet(PMNAMES.PM_OWLBEAR);
    await mondead(mon);await settle(run);
    const oldlevel=game.u.ulevel,oldmax=game.u.ulevelmax;
    more_experienced(experience(mon,game.mvitals[monsndx(mon.data)].died),0);
    await pline('An earlier long message still occupies this top line before the level gain.');
    let release,entered=false,done=false;
    const wait=new Promise(resolve=>release=resolve);
    run._display.onEmptyQueue=async()=>{entered=true;await wait;return 32;};
    const pending=newexplevel().then(()=>done=true);await setImmediate();
    try {
        assert.ok(entered);assert.equal(done,false);assert.equal(game.u.ulevel,oldlevel+1);
        assert.equal(game.u.ulevelmax,oldmax);
    } finally { release(); }
    await pending;assert.equal(game.u.ulevelmax,oldlevel+1);
});

// The test-only import hook exports the whole private owner unchanged.
// Hostile monsters bypass the owner's peaceful safety gate, but the ordinary
// caller will not pass them here. These are constructed owner contracts,
// not claims of reachable ordinary caught/moved/killed swaps.
function ownerSwap(mon) {
    game.u.ux0=game.u.ux;game.u.uy0=game.u.uy;
    game.u.ux=mon.mx;game.u.uy=mon.my;
    return domove_swap_with_pet(mon,mon.mx,mon.my);
}
await test('owner: a real web catches a hostile monster and applies alignment only',async()=>{
    const run=await boot(false),{mon}=await pet(PMNAMES.PM_DOG,false,false);
    const origin=[game.u.ux,game.u.uy],record=game.u.ualign.record,
        abuse=game.u.ualign.abuse||0,killer=game.u.uconduct.killer||0,xp=game.u.uexp;
    assert.ok(await maketrap(...origin,WEB));await settle(run);
    assert.equal(await ownerSwap(mon),true);
    assert.deepEqual([mon.mx,mon.my],origin);assert.ok(mon.mtrapped);
    assert.equal(game.u.ualign.record,record-3);assert.equal(game.u.ualign.abuse,abuse+3);
    assert.equal(game.u.uconduct.killer||0,killer);assert.equal(game.u.uexp,xp);
});
await test('owner: a real teleport trap moves the monster before the alignment penalty',async()=>{
    const run=await boot(false),{mon}=await pet(PMNAMES.PM_DOG,false,false);
    const origin=[game.u.ux,game.u.uy],record=game.u.ualign.record,id=mon.m_id;
    assert.ok(await maketrap(...origin,TELEP_TRAP));await settle(run);
    assert.equal(await ownerSwap(mon),true);
    assert.notDeepEqual([mon.mx,mon.my],origin);assert.equal(mon.m_id,id);
    assert.equal(m_at(mon.mx,mon.my),mon);assert.ok(mon.mhp>0);
    assert.equal(game.u.ualign.record,record-3);assert.equal(game.u.uconduct.killer||0,0);
});
await test('owner: blocked fixed teleport still returns moved and applies alignment',async()=>{
    const run=await boot(false),{mon}=await pet(PMNAMES.PM_DOG,false,false);
    const origin=[game.u.ux,game.u.uy],record=game.u.ualign.record;
    const trap=await maketrap(...origin,TELEP_TRAP);assert.ok(trap);
    // Construct the fixed-destination input. The real mtele_trap refuses the
    // hero-occupied target, but trapeffect_telep_trap still returns Moved.
    trap.teledest={x:mon.mx,y:mon.my};await settle(run);
    assert.equal(await ownerSwap(mon),true);
    assert.deepEqual([mon.mx,mon.my],origin);assert.equal(m_at(...origin),mon);
    assert.equal(game.u.ualign.record,record-3);assert.equal(game.u.uconduct.killer||0,0);
});
await test('owner: a real trap door migrates before the alignment penalty',async()=>{
    const run=await boot(false),{mon}=await pet(PMNAMES.PM_DOG,false,false);
    const origin=[game.u.ux,game.u.uy],record=game.u.ualign.record,id=mon.m_id;
    assert.ok(await maketrap(...origin,TRAPDOOR));await settle(run);
    assert.equal(await ownerSwap(mon),true);
    assert.equal(mon.m_id,id);assert.equal(mon.mx,0);assert.ok(mon.mhp>0);
    assert.ok(!game.level.monsters.includes(mon));assert.ok(game.migrating_mons.includes(mon));
    assert.equal(game.u.ualign.record,record-3);assert.equal(game.u.uconduct.killer||0,0);
});
await test('owner: real fire deaths credit experience before both guilt outcomes',async()=>{
    const outcomes=new Set();
    for(const seed of [12001,12002,12003,12004]) {
        const run=await boot(false,seed),{mon}=await pet(PMNAMES.PM_PAPER_GOLEM,false,false);
        const mndx=monsndx(mon.data),died=game.mvitals[mndx].died||0,
            record=game.u.ualign.record,abuse=game.u.ualign.abuse||0,
            xp=experience(mon,died+1),startLevel=game.u.ulevel;
        const priorXp=newuexp(startLevel)-1;
        more_experienced(priorXp,0);
        assert.ok(await maketrap(game.u.ux,game.u.uy,FIRE_TRAP));await settle(run);
        const start=getRngLog().length;
        assert.equal(await ownerSwap(mon),true);
        assert.ok(mon.mhp<=0);assert.equal(game.mvitals[mndx].died,died+1);
        assert.equal(game.u.uconduct.killer,1);
        assert.equal(game.gamelog.filter(e=>e.text==='killed for the first time').length,1);
        assert.equal(game.u.urexp,4*(priorXp+xp));
        assert.equal(game.u.uexp,Math.min(priorXp+xp,newuexp(startLevel+1)-1));
        assert.equal(game.u.ulevel,startLevel+1);assert.equal(game.u.ulevelmax,startLevel+1);
        const tail=getRngLog().slice(start),last=tail.at(-1);
        assert.match(last,/^rn2\(4\)=[0-3]$/);
        const guilty=last!=='rn2(4)=0';outcomes.add(guilty);
        assert.equal(game.u.ugangr||0,Number(guilty));
        assert.equal(game.u.ualign.record,record-(guilty?15:0));
        assert.equal(game.u.ualign.abuse||0,abuse+(guilty?15:0));
        assert.equal([game._toplines,...messages].some(s=>s?.includes('guilty about losing')),guilty);
    }
    assert.equal(outcomes.size,2,'both actual guilt rolls are required');
});
await test('owner: drowning preserves the C helper credit and short-circuits a trap',async()=>{
    const run=await boot(false),{mon}=await pet(PMNAMES.PM_DOG,false,false);
    const origin=[game.u.ux,game.u.uy],mndx=monsndx(mon.data),died=game.mvitals[mndx].died||0;
    const xp=experience(mon,died+1);
    const trap=await maketrap(...origin,WEB);assert.ok(trap);
    assert.ok(set_levltyp(...origin,POOL));await settle(run);
    assert.equal(await ownerSwap(mon),true);
    assert.ok(mon.mhp<=0);assert.equal(game.mvitals[mndx].died,died+1);
    assert.equal(game.u.uconduct.killer,2,'xkilled and the owner each credit the kill in this C path');
    assert.equal(game.gamelog.filter(e=>e.text==='killed for the first time').length,1);
    assert.equal(game.u.urexp,8*xp);assert.equal(mon.mtrapped,0);
    assert.equal(trap.tseen,false,'dead monster must not enter mintrap');
    assert.equal(game.iflags.sad_feeling,false);
});
await test('owner: real liquid life saving gives no owner death credit or guilt',async()=>{
    const run=await boot(false),{mon}=await pet(PMNAMES.PM_GNOME,false,false);
    mongets(mon,ONAMES.AMULET_OF_LIFE_SAVING);await m_dowear(mon,true);
    assert.ok(mlifesaver(mon));const mndx=monsndx(mon.data),died=game.mvitals[mndx].died||0;
    assert.ok(set_levltyp(game.u.ux,game.u.uy,POOL));await settle(run);
    const record=game.u.ualign.record,start=getRngLog().length;
    assert.equal(await ownerSwap(mon),true);
    assert.ok(mon.mhp>0);assert.equal(mlifesaver(mon),null);
    assert.equal(game.mvitals[mndx].died||0,died);assert.equal(game.u.uexp,0);
    assert.equal(game.u.uconduct.killer,1,'the xkilled attempt precedes life saving in C');
    assert.equal(game.u.ualign.record,record);assert.equal(game.u.ugangr||0,0);
    assert.ok(!getRngLog().slice(start).some(s=>s.startsWith('rn2(4)=')));
    assert.equal(game.iflags.sad_feeling,false);
});
await test('owner: pending level and guilt messages block later consequences',async()=>{
    const held=new Set();
    for(const seed of [12001,12002,12003,12004]) {
        const run=await boot(false,seed),{mon}=await pet(PMNAMES.PM_PAPER_GOLEM,false,false);
        christen_monst(mon,'The paper companion with a deliberately long descriptive name');
        more_experienced(newuexp(game.u.ulevel)-1,0);
        assert.ok(await maketrap(game.u.ux,game.u.uy,FIRE_TRAP));await settle(run);
        const record=game.u.ualign.record,level=game.u.ulevel;
        let done=false,n=0;
        const state=()=>({rng:[...getRngLog()],level:game.u.ulevel,max:game.u.ulevelmax,
            xp:game.u.uexp,anger:game.u.ugangr||0,record:game.u.ualign.record,
            killer:game.u.uconduct.killer,hp:mon.mhp,pending:game._pending_message});
        run._display.onEmptyQueue=async()=>{
            assert.ok(n++<16,'bounded real More acknowledgments');
            const before=state();await setImmediate();
            assert.equal(done,false);assert.deepEqual(state(),before);
            // _pending_message is the displayed message being acknowledged,
            // not the incoming pline. Level increments before its pline;
            // ulevelmax updates only after that pline finishes.
            if(before.level===level+1&&before.max===level) {
                held.add('level');assert.equal(before.level,level+1);assert.equal(before.max,level);
                assert.equal(before.killer,1);assert.equal(before.anger,0);assert.equal(before.record,record);
            }
            if(before.pending?.startsWith('Welcome ')&&before.max===level+1) {
                held.add('guilt');assert.equal(before.level,level+1);assert.equal(before.max,level+1);
                assert.equal(before.killer,1);assert.equal(before.anger,0);assert.equal(before.record,record);
                assert.match(before.rng.at(-1),/^rn2\(4\)=[1-3]$/);
            }
            return 32;
        };
        assert.equal(await ownerSwap(mon).then(r=>{done=true;return r;}),true);
    }
    assert.deepEqual([...held].sort(),['guilt','level']);
});
