// Constructed source contracts through real input, guard, equipment, and tty producers.
// No native coverage is claimed for these constructed states.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate, setTimeout} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {gd_move} from '../js/vault.js';
import {teleds} from '../js/teleport.js';
import {newsym, see_monsters, docrt, pline, display_nhwindow_message} from '../js/display.js';
import {resetInputState, pushKey} from '../js/input.js';
import {vision_recalc} from '../js/vision.js';
import {getRngLog} from '../js/rng.js';
import {readobjnam} from '../js/objnam.js';
import {addinv, freeinv} from '../js/invent.js';
import {set_artifact_intrinsic} from '../js/artifact.js';
import {setuwep} from '../js/wield.js';
import {setworn, setnotworn} from '../js/worn.js';
import {oname} from '../js/do_name.js';
import {Ring_on} from '../js/do_wear.js';
import {make_hallucinated, make_blinded, healup} from '../js/potion.js';
import {makemon} from '../js/makemon.js';
import {mongone, newcham, rescham, validspecmon, wakeup} from '../js/mon.js';
import {doapply} from '../js/apply.js';
import {uchangealign} from '../js/attrib.js';
import {dosave0} from '../js/save.js';
import {dorecover} from '../js/restore.js';
import {newgame_moveloop_preamble} from '../js/allmain.js';
import {PMNAMES} from '../js/monst_data.js';
import {NO_COLOR} from '../js/terminal.js';
import {W_ART, W_WEP, W_RINGL, ONAME_NO_FLAGS, NON_PM,
    NHW_TEXT, NHW_MENU, PICK_ONE, MM_NOMSG, A_LAWFUL, A_CG_CONVERT,
    OBJ_FREE, OBJ_MINVENT} from '../js/const.js';
import {tty_create_nhwindow, tty_get_nhwindow, tty_putstr,
    tty_display_nhwindow, tty_destroy_nhwindow, tty_dismiss_nhwindow,
    tty_start_menu, tty_add_menu, tty_end_menu, tty_select_menu} from '../js/tty/wintty.js';

const part = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-exit-corridor.json', import.meta.url))).segments[0];
const ordinary = {seed:99812, datetime:'20000110090000', moves:' ',
    nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'};
async function setup(parked = true, beforePark) {
    const input = parked ? {...part,moves:part.moves.slice(0,part.moves.indexOf('d$lll')+4)} : ordinary;
    const run = await runSegment({...input,storage:new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    run._display.onEmptyQueue = async () => {await setImmediate(); return 32;};
    let guard;
    if (parked) {
        guard = game.level.monsters.find(m=>m.isgd);
        assert.deepEqual([guard.mx,guard.my],[27,5]);
        await teleds(26,5,0);
        vision_recalc(0);
        await beforePark?.(guard);
        assert.equal(await gd_move(guard),1);
        assert.deepEqual([guard.mx,guard.my],[0,0]);
        assert.ok(guard.mhp > 0 && game.level.monsters.includes(guard));
    }
    await display_nhwindow_message();
    return {run,guard};
}

// Hold actual nhgetch, without replacing the producer or a runtime helper.
async function held(run, action, check, pause = () => true, answer = () => 32) {
    let release, done=false, value, error;
    const prompts=[];
    run._display.onEmptyQueue = () => !pause() ? answer() : new Promise(resolve => {
        prompts.push(game._toplines);
        release=resolve;
    });
    const operation=Promise.resolve().then(action).then(v=>{value=v;done=true;},e=>{error=e;done=true;});
    try {
        for(let n=0;n<200 && !release && !done;n++) await setTimeout(1);
        assert.ok(release,`producer reached a real pending input: ${game._toplines}`);
        assert.equal(done,false,'owner must remain pending at More');
        await check?.();
    } finally {
        run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
        release?.(32);
        await operation;
        // Give any baseline floating continuation a chance to drain before reset.
        for(let n=0;n<15;n++) await setImmediate();
    }
    if(error)throw error;
    return {value,prompts};
}
const padding='A previous message fills the line and waits for its acknowledgment.';
async function pendingLine() {await pline(padding);}

await test('valid and suppressed redraws preserve the synchronous void contract',async()=>{
    await setup(false);
    const rng=[...getRngLog()];
    assert.equal(newsym(game.u.ux,game.u.uy),undefined);
    for(const key of ['saving','restoring','done_hup']) {
        const old=game.program_state[key];
        try {game.program_state[key]=1;assert.equal(newsym(0,0),undefined);}
        finally {game.program_state[key]=old;}
    }
    assert.deepEqual(getRngLog(),rng);
    assert.equal(game.impossible_log?.length||0,0);
});
await test('invalid column zero pages through canonical impossible before returning',async()=>{
    const {run}=await setup();await pendingLine();const rng=[...getRngLog()];
    await held(run,()=>newsym(0,0),()=>assert.equal(game.program_state.in_impossible,1));
    assert.equal(game.program_state.in_impossible,0);
    assert.deepEqual(game.impossible_log,['newsym: attempting screen update for <0,0>']);
    assert.match(game._toplines,/Please report these messages/);
    assert.deepEqual(getRngLog(),rng);
});
await test('outside the map panics before producing a message; suppression still comes first',async()=>{
    await setup(false);const rng=[...getRngLog()];
    assert.throws(()=>newsym(-1,0),/newsym: attempting screen update/);
    game.in_mklev=true;
    try {assert.equal(newsym(-1,0),undefined);} finally {game.in_mklev=false;}
    assert.deepEqual(getRngLog(),rng);
});
await test('see_monsters waits for a live parked guard and preserves its ownership',async()=>{
    const {run,guard}=await setup();await pendingLine();
    await held(run,()=>see_monsters(),()=>{
        assert.equal(game.program_state.in_impossible,1);
        assert.ok(game.level.monsters.includes(guard));
    });
    assert.equal(game.program_state.in_impossible,0);
    assert.deepEqual([guard.mx,guard.my],[0,0]);
});
await test('ring sensing callback waits rather than returning from its switch during paging',async()=>{
    const {run}=await setup();const ring=await readobjnam('ring of warning',null);
    await addinv(ring);await setworn(ring,W_RINGL);await pendingLine();
    await held(run,()=>Ring_on(ring),()=>assert.equal(game.program_state.in_impossible,1));
    assert.equal(game.u.uleft,ring);
});
await test('hallucination feedback does not overtake sensing diagnostic pages',async()=>{
    const {run}=await setup();await pendingLine();
    await held(run,()=>make_hallucinated(5,true,0),()=>{
        assert.equal(game.program_state.in_impossible,1);
        assert.doesNotMatch(game._toplines,/cosmic/);
    });
    assert.match(game._toplines,/cosmic/);
});
await test('artifact pickup waits before insertion and later half-damage property updates',async()=>{
    const {run}=await setup();const orb=await readobjnam('The Orb of Detection',null);
    assert.ok(orb.oartifact);await pendingLine();
    const {value}=await held(run,()=>addinv(orb),()=>{
        assert.equal(game.program_state.in_impossible,1);
        assert.equal(game.invent.includes(orb),false);
        assert.ok(game.u.uprops.TELEPAT&W_ART);
        assert.equal((game.u.uprops.HALF_SPDAM||0)&W_ART,0);
    });
    assert.equal(value,orb);assert.equal(game.invent.includes(orb),true);
    assert.ok(game.u.uprops.HALF_SPDAM&W_ART);
});
await test('artifact removal awaits sensing before finishing later property removal',async()=>{
    const {run}=await setup();const orb=await readobjnam('The Orb of Detection',null);
    await addinv(orb);await pendingLine();
    await held(run,()=>freeinv(orb),()=>{
        assert.equal(game.invent.includes(orb),false);
        assert.equal((game.u.uprops.TELEPAT||0)&W_ART,0);
        assert.ok(game.u.uprops.HALF_SPDAM&W_ART);
    });
    assert.equal((game.u.uprops.HALF_SPDAM||0)&W_ART,0);
});
await test('applying Merlin\'s mirror waits for carried sensing before monster ownership transfer',async()=>{
    const {run}=await setup();
    await uchangealign(A_LAWFUL,A_CG_CONVERT);
    await healup(100,40,false,false);
    const mirror=await readobjnam('The Magic Mirror of Merlin',null);
    await addinv(mirror);assert.ok(mirror.oartifact);
    const nymph=await makemon(game.mons[PMNAMES.PM_WOOD_NYMPH],27,5,MM_NOMSG);
    assert.ok(nymph);await wakeup(nymph,false);vision_recalc(0);
    await display_nhwindow_message();
    const before=game.impossible_log?.length||0;
    pushKey(mirror.invlet.charCodeAt(0));
    await held(run,()=>doapply(),()=>{
        assert.equal(mirror.where,OBJ_FREE);
        assert.equal(game.invent.includes(mirror),false);
        assert.equal(nymph.minvent.includes(mirror),false);
        assert.deepEqual([nymph.mx,nymph.my],[27,5]);
    },()=>!!game.program_state.in_impossible,
      ()=>game._pending_message.includes('In what direction?') ? 'l'.charCodeAt(0) : 32);
    assert.equal(mirror.where,OBJ_MINVENT);
    assert.ok(nymph.minvent.includes(mirror));
    assert.equal(game.impossible_log.length,before+1);
});
await test('ordinary mirror transfer has no carried sensing diagnostic',async()=>{
    const {run}=await setup();const mirror=await readobjnam('mirror',null);
    await addinv(mirror);assert.equal(mirror.oartifact||0,0);
    const nymph=await makemon(game.mons[PMNAMES.PM_WOOD_NYMPH],27,5,MM_NOMSG);
    assert.ok(nymph);await wakeup(nymph,false);vision_recalc(0);
    await display_nhwindow_message();
    const before=game.impossible_log?.length||0;
    run._display.onEmptyQueue=()=>game._pending_message.includes('In what direction?')
        ? 'l'.charCodeAt(0) : 32;
    pushKey(mirror.invlet.charCodeAt(0));await doapply();
    assert.equal(mirror.where,OBJ_MINVENT);assert.ok(nymph.minvent.includes(mirror));
    assert.equal(game.impossible_log?.length||0,before);
});
await test('quiet artifact and ordinary insertion keep their synchronous return identities',async()=>{
    await setup(false);const dagger=await readobjnam('dagger',null);
    assert.equal(set_artifact_intrinsic(dagger,true,W_ART),undefined);
    assert.equal(addinv(dagger),dagger);
    const frost=await readobjnam('Frost Brand',null);
    assert.equal(set_artifact_intrinsic(frost,true,W_ART),undefined);
});
await test('Sting warning changes await the old-count message before publishing the new count',async()=>{
    const {run}=await setup(false);
    const sting=await readobjnam('Sting',null);await addinv(sting);
    const orc=await makemon(game.mons[PMNAMES.PM_ORC],game.u.ux,game.u.uy,MM_NOMSG);
    assert.ok(orc);await pendingLine();
    await held(run,()=>setuwep(sting),()=>assert.equal(game.warn_obj_cnt||0,0));
    assert.equal(game.warn_obj_cnt,1);assert.match(game._toplines,/Sting.*blue/);
    await make_blinded(5,false);
    assert.match(game._toplines,/Sting is quivering/);
    await mongone(orc);await pendingLine();
    await held(run,()=>see_monsters(),()=>assert.equal(game.warn_obj_cnt,1));
    assert.equal(game.warn_obj_cnt,0);assert.match(game._toplines,/stops quivering/);
});

function textWindow() {
    const win=tty_create_nhwindow(NHW_TEXT);
    tty_putstr(win,0,'A full-screen text window.');
    return win;
}
await test('active text destroy retains the window until canonical redraw feedback completes',async()=>{
    const {run}=await setup();const win=textWindow();
    await tty_display_nhwindow(win);const cw=tty_get_nhwindow(win);
    assert.equal(cw.offx,0);
    await held(run,()=>tty_destroy_nhwindow(win),()=>{
        assert.equal(tty_get_nhwindow(win),cw);assert.equal(cw.active,1);
        assert.equal(game.program_state.in_impossible,1);
    });
    assert.equal(cw.active,0);assert.equal(tty_get_nhwindow(win),undefined);
});
await test('direct dismissal retains the data and waits before clearing active',async()=>{
    const {run}=await setup();const win=textWindow();
    await tty_display_nhwindow(win);const cw=tty_get_nhwindow(win);
    await held(run,()=>tty_dismiss_nhwindow(win),()=>assert.equal(cw.active,1));
    assert.equal(cw.active,0);assert.equal(tty_get_nhwindow(win),cw);
    assert.equal(tty_destroy_nhwindow(win),undefined);
});
await test('inactive and overlay destroys stay synchronous without whole-map redraw',async()=>{
    const {run}=await setup();const fresh=textWindow();
    assert.equal(tty_destroy_nhwindow(fresh),undefined);
    const win=tty_create_nhwindow(NHW_MENU);tty_putstr(win,0,'Short');
    await tty_display_nhwindow(win);assert.ok(tty_get_nhwindow(win).offx>0);
    const rng=[...getRngLog()];assert.equal(tty_destroy_nhwindow(win),undefined);
    assert.deepEqual(getRngLog(),rng);assert.equal(game.impossible_log?.length||0,0);
    assert.ok(run);
});
for(const key of [97,27]) await test(`menu ${key===97?'selection':'cancellation'} finishes redraw before returning metadata`,async()=>{
    const {run}=await setup();const win=tty_create_nhwindow(NHW_MENU);
    tty_start_menu(win,0);tty_add_menu(win,null,42,'a',0,0,NO_COLOR,'x'.repeat(75),0);
    tty_end_menu(win,'Choose');run._display.pushKey(key);
    await held(run,()=>tty_select_menu(win,PICK_ONE),()=>{
        assert.equal(game.bot_disabled,true);assert.equal(tty_get_nhwindow(win).active,1);
    }).then(({value})=>{
        assert.equal(value.cancelled,key===27);
        assert.deepEqual([...value],key===97?[42]:[]);
        if(key===97)assert.equal(value.counts.get(42),-1);
    });
    assert.equal(game.bot_disabled,false);assert.equal(tty_get_nhwindow(win).active,0);
    assert.equal(tty_destroy_nhwindow(win),undefined);
});
await test('ordinary full redraw completes its sensing feedback before returning',async()=>{
    const {run}=await setup();await held(run,()=>docrt(),()=>assert.equal(game.program_state.in_impossible,1));
});
await test('real recovery defers sensing until the preamble clears the producer flag',async()=>{
    const {run}=await setup(false);
    const sting=await readobjnam('Sting',null);await addinv(sting);await setuwep(sting);
    await makemon(game.mons[PMNAMES.PM_ORC],game.u.ux,game.u.uy,MM_NOMSG);
    await see_monsters();assert.equal(game.warn_obj_cnt,1);
    await display_nhwindow_message();assert.equal(await dosave0(),true);
    assert.equal(await dorecover(),true);assert.equal(game.defer_see_monsters,true);
    const count=game.warn_obj_cnt, log=[...getRngLog()], msg=game._toplines;
    await see_monsters();
    assert.equal(game.warn_obj_cnt,count);assert.equal(game._toplines,msg);
    assert.deepEqual(getRngLog(),log);
    await newgame_moveloop_preamble(true);
    assert.equal(game.defer_see_monsters,false);
    assert.equal(game.warn_obj_cnt,1);
    assert.ok(run);
});

await test('parked vampire reversion waits before normal_shape resets its shape identity',async()=>{
    const {run,guard}=await setup(true,async mon=>{
        assert.equal(validspecmon(mon,PMNAMES.PM_VAMPIRE),true);
        assert.equal(await newcham(mon,game.mons[PMNAMES.PM_VAMPIRE],0),1);
        assert.equal(await newcham(mon,game.mons[PMNAMES.PM_VAMPIRE_BAT],0),1);
    });
    await pendingLine();
    await held(run,()=>rescham(),()=>{
        assert.equal(guard.mnum,PMNAMES.PM_VAMPIRE);
        assert.equal(guard.cham,PMNAMES.PM_VAMPIRE);
    });
    assert.equal(guard.mnum,PMNAMES.PM_VAMPIRE);assert.equal(guard.cham,NON_PM);
    assert.equal(game.impossible_log.length,2);
    assert.equal(game.program_state.in_impossible,0);
});
for(const form of [PMNAMES.PM_WEREWOLF,PMNAMES.PM_PYTHON])
    await test(`guard target-form validation rejects ${form}; no forced-form reach claim`,async()=>{
        const {guard}=await setup(true,async mon=>assert.equal(validspecmon(mon,form),false));
        assert.equal(guard.mnum,PMNAMES.PM_GUARD);
        assert.equal(game.impossible_log?.length||0,0);
    });
for(const operation of ['setter','setworn','setnotworn','setuwep','oname'])
    await test(`quiet Sting ${operation} preserves the original synchronous result`,async()=>{
        await setup(false);
        const blade=await readobjnam(operation==='oname'?'elven dagger':'Sting',null);
        await addinv(blade);
        if(operation==='setnotworn'||operation==='oname') await setuwep(blade);
        let result;
        switch(operation) {
        case 'setter':result=set_artifact_intrinsic(blade,true,W_WEP);break;
        case 'setworn':result=setworn(blade,W_WEP);break;
        case 'setnotworn':result=setnotworn(blade);break;
        case 'setuwep':result=setuwep(blade);break;
        case 'oname':result=oname(blade,'Sting',ONAME_NO_FLAGS);break;
        }
        assert.equal(typeof result?.then,'undefined');
        assert.equal(result,operation==='oname'?blade:operation==='setuwep'?null:undefined);
    });
