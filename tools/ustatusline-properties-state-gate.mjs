// Constructed state controls. Every condition comes from a real producer.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate,setTimeout} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {nh_timeout} from '../js/timeout.js';
import {gamestate_encode,gamestate_decode} from '../js/save.js';
import {ustatusline,piousness} from '../js/insight.js';
import {make_sick,make_stoned,make_slimed,make_vomiting,make_confused,
    make_stunned,make_blinded,make_glib,incr_itimeout} from '../js/potion.js';
import {set_wounded_legs,heal_legs} from '../js/do.js';
import {set_utrap} from '../js/trap.js';
import {makemon,MM_NOMSG} from '../js/makemon.js';
import {set_ustuck,seemimic} from '../js/mon.js';
import {christen_monst} from '../js/do_name.js';
import {polymon,dohide} from '../js/polyself.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {Blindf_on} from '../js/do_wear.js';
import {tamedog} from '../js/dog.js';
import {put_saddle_on_mon,mount_steed} from '../js/steed.js';
import {gulpmu} from '../js/mhitu.js';
import {create_gas_cloud,visible_region_at,reg_damg} from '../js/region.js';
import {adjalign} from '../js/attrib.js';
import {display_nhwindow_message,pline} from '../js/display.js';
import {PMNAMES,ATTKS} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {SICK_VOMITABLE,SICK_NONVOMITABLE,KILLED_BY,BOTH_SIDES,LEFT_SIDE,
    TT_PIT,W_ARMG,BUFSZ,FROMFORM} from '../js/const.js';

const recipe=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/ustatusline-canonical-properties.json',import.meta.url)));
const base=recipe.segments.find(s=>s.name==='ustatusline-healthy');
const quiet=async()=>{await setImmediate();return 32;};
async function boot(moves=' ') {
    const run=await runSegment({...base,moves,storage:new InMemoryStorage()});
    game._preNhgetchHook=null;resetInputState();run._display.onEmptyQueue=quiet;
    await display_nhwindow_message();
    return run;
}
async function status() {
    await display_nhwindow_message();
    const rng=[...getRngLog()], result=await ustatusline();
    assert.equal(result,undefined);assert.deepEqual(getRngLog(),rng);
    return game._prevmsg;
}
const intrinsic=letter=>`#wizintrinsic\r100${letter}\r\x1b\x1b`;
const name62='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
// src/pline.c vpline(): this oracle is applied after the local info capacity.
const plineText=s=>s.length<BUFSZ?s:s.slice(0,BUFSZ-7)+'...'+s.slice(-3);
async function longConditions({invisible=false,gloves=false,name=name62}={}) {
    await boot(' '+intrinsic('d')+intrinsic('r'));
    if(invisible)incr_itimeout('HInvis',100);
    if(gloves){incr_itimeout('HDetect_monsters',100);await make_blinded(100,false);}
    await make_sick(100,'#wizintrinsic',false,SICK_VOMITABLE|SICK_NONVOMITABLE);
    await make_stoned(100,null,KILLED_BY,'#wizintrinsic');
    await make_slimed(100,null);await make_vomiting(100,false);
    await make_confused(100,false);await make_stunned(100,false);
    await set_wounded_legs(BOTH_SIDES,100);make_glib(100);set_utrap(100,TT_PIT);
    if(gloves){const obj=mksobj(ONAMES.GAUNTLETS_OF_POWER,false,false);addinv(obj);setworn(obj,W_ARMG);}
    const mon=makemon(game.mons[PMNAMES.PM_LARGE_MIMIC],9,12,MM_NOMSG);
    assert.ok(mon);christen_monst(mon,name);seemimic(mon);set_ustuck(mon);
    // ustatusline's local suffix is not recoverable from a clipped _prevmsg.
    // Build the C-ordered expectation for the unchanged real producers above.
    const info=', dying from food poisoning and illness, solidifying, becoming slimy'
        +', being strangled, nauseated, confused'+(gloves?', blind':'')
        +', stunned, injured legs, slippery '+(gloves?'gloves':'fingers')
        +', trapped, very fast'+(invisible?', invisible':'')+', held by '+mon.mgivenname;
    const rendered=await status();
    assert.ok(rendered.includes(', dying'));
    const before=rendered.slice(0,rendered.indexOf(', dying'))+info+'.';
    assert.equal(rendered,plineText(before));
    assert.ok(info.length<=255,'avoid undefined C overflow before snprintf');
    return {before,info};
}
for(const [key,phrase,set] of [
    ['SICK','dying from food poisoning',n=>make_sick(n,'#wizintrinsic',false,SICK_VOMITABLE)],
    ['STONED','solidifying',n=>make_stoned(n,null,KILLED_BY,'#wizintrinsic')],
    ['SLIMED','becoming slimy',n=>make_slimed(n,null)],
    ['VOMITING','nauseated',n=>make_vomiting(n,false)],
]) await test(`${key}: real set and cure use the live flat timer`,async()=>{
    await boot();await set(100);assert.equal(game.u.uprops[key],100);
    assert.ok(!game.u.intrinsic?.['H'+key[0]+key.slice(1).toLowerCase()]);
    assert.ok((await status()).includes(phrase));
    await set(0);assert.equal(game.u.uprops[key],0);
    assert.ok(!(await status()).includes(phrase));
});
await test('both sickness types retain C order and a partial cure retains illness',async()=>{
    await boot();await make_sick(100,'#wizintrinsic',false,SICK_VOMITABLE);
    await make_sick(100,'#wizintrinsic',false,SICK_NONVOMITABLE);
    assert.match(await status(),/, dying from food poisoning and illness\.$/);
    await make_sick(0,null,false,SICK_VOMITABLE);
    assert.equal(game.u.uprops.SICK,200);
    assert.match(await status(),/, dying from illness\.$/);
});
await test('real timeout processing decrements all four live timer slots',async()=>{
    await boot();await make_sick(100,'#wizintrinsic',false,SICK_VOMITABLE);
    await make_stoned(100,null,KILLED_BY,'#wizintrinsic');
    await make_slimed(100,null);await make_vomiting(100,false);
    await nh_timeout();
    for(const key of ['SICK','STONED','SLIMED','VOMITING'])assert.equal(game.u.uprops[key],99);
    assert.match(await status(),/, dying from food poisoning, solidifying, becoming slimy, nauseated\.$/);
});
await test('the real save codec preserves producer timers without migrating them to H aliases',async()=>{
    await boot();await make_sick(100,'#wizintrinsic',false,SICK_VOMITABLE);
    await make_stoned(101,null,KILLED_BY,'#wizintrinsic');
    await make_slimed(102,null);await make_vomiting(103,false);
    const copy=gamestate_decode(JSON.parse(JSON.stringify(gamestate_encode(game))));
    for(const [i,key] of ['SICK','STONED','SLIMED','VOMITING'].entries()){
        assert.equal(copy.u.uprops[key],100+i);
        assert.ok(!copy.u.intrinsic?.['H'+key[0]+key.slice(1).toLowerCase()]);
    }
});
await test('real ghoul form suppresses sickness through the producer',async()=>{
    await boot();assert.equal(await polymon(PMNAMES.PM_GHOUL),1);
    await make_sick(100,'#wizintrinsic',false,SICK_VOMITABLE);
    assert.ok(!game.u.uprops.SICK);assert.ok(!(await status()).includes('dying from'));
});
await test('canonical confusion and stun come from real setters and clear independently',async()=>{
    await boot();await make_confused(100,false);await make_stunned(100,false);
    assert.match(await status(),/, confused, stunned\.$/);
    await make_confused(0,false);assert.match(await status(),/, stunned\.$/);
    await make_stunned(0,false);assert.doesNotMatch(await status(),/confused|stunned/);
});
await test('bat form supplies canonical stun without a timed stun',async()=>{
    await boot();assert.equal(await polymon(PMNAMES.PM_BAT),1);
    assert.ok(game.u.intrinsic.HStun&FROMFORM);assert.match(await status(),/, stunned/);
});
await test('real cream pie distinguishes blinded-by-goop from covered-by-goop',async()=>{
    await boot(' \x17cream pie\r\x1b\x1baa\x1b\x1b');
    assert.ok(game.u.ucreamed>0);assert.equal(game.u.ucreamed,game.u.intrinsic.HBlinded);
    assert.match(await status(),/, blinded by sticky goop\.$/);
    await make_blinded(game.u.ucreamed+100,false);
    assert.match(await status(),/, blind, covered by sticky goop\.$/);
});
await test('blindfold adds blindness through the actual facewear owner',async()=>{
    await boot();const obj=mksobj(ONAMES.BLINDFOLD,false,false);addinv(obj);
    await Blindf_on(obj);assert.equal(game.u.ublindf,obj);
    assert.match(await status(),/, blind\.$/);
});
await test('eyeless form supplies blindness and polymorphed level and hit points',async()=>{
    await boot();assert.equal(await polymon(PMNAMES.PM_GELATINOUS_CUBE),1);
    const msg=await status();assert.match(msg,/, blind/);
    assert.ok(msg.includes(`Level ${game.youmonst.data.mlevel}  HP ${game.u.mh}(${game.u.mhmax})`));
});
await test('one and both real leg wounds use singular and plural anatomy',async()=>{
    await boot();await set_wounded_legs(LEFT_SIDE,100);
    assert.match(await status(),/, injured leg\.$/);
    await set_wounded_legs(BOTH_SIDES,100);assert.match(await status(),/, injured legs\.$/);
    await heal_legs(2);assert.doesNotMatch(await status(),/injured/);
});
await test('real dog form uses rear-leg anatomy',async()=>{
    await boot();assert.equal(await polymon(PMNAMES.PM_DOG),1);
    await set_wounded_legs(BOTH_SIDES,100);assert.match(await status(),/, injured rear legs/);
});
await test('mounted wounds belong to the real steed and are omitted from hero status',async()=>{
    await boot();let pony=makemon(game.mons[PMNAMES.PM_PONY],9,12,MM_NOMSG);
    assert.equal(await tamedog(pony,null,false),true);assert.ok(pony.mtame);
    put_saddle_on_mon(mksobj(ONAMES.SADDLE,false,false),pony);
    assert.equal(await mount_steed(pony,true),true);assert.equal(game.u.usteed,pony);
    await set_wounded_legs(BOTH_SIDES,100);
    assert.doesNotMatch(await status(),/injured/);
});
await test('glibness names fingers or the real worn gloves',async()=>{
    await boot();make_glib(100);assert.match(await status(),/, slippery fingers\.$/);
    const gloves=mksobj(ONAMES.LEATHER_GLOVES,false,false);addinv(gloves);setworn(gloves,W_ARMG);
    assert.match(await status(),/, slippery gloves\.$/);
});
await test('real trap state is reported and clears through its owner',async()=>{
    await boot();set_utrap(100,TT_PIT);assert.match(await status(),/, trapped\.$/);
    set_utrap(0,0);assert.doesNotMatch(await status(),/trapped/);
});
await test('timed speed and invisibility use the same canonical predicates',async()=>{
    await boot(' '+intrinsic('r'));incr_itimeout('HInvis',100);
    assert.match(await status(),/, very fast, invisible\.$/);
});
await test('real mimic hiding supplies disguise',async()=>{
    await boot();assert.equal(await polymon(PMNAMES.PM_SMALL_MIMIC),1);await dohide();
    assert.match(await status(),/, disguised\.$/);
});
await test('real holder naming and hero sticky form choose held-by versus holding',async()=>{
    await boot();const mon=makemon(game.mons[PMNAMES.PM_LARGE_MIMIC],9,12,MM_NOMSG);
    seemimic(mon);christen_monst(mon,'Keeper');set_ustuck(mon);
    assert.match(await status(),/, held by Keeper\.$/);
    set_ustuck(null);assert.equal(await polymon(PMNAMES.PM_LARGE_MIMIC),1);set_ustuck(mon);
    assert.ok(game.u.intrinsic.HBlinded&FROMFORM);
    assert.match(await status(),/, blind, holding it\.$/);
});
for(const [form,phrase] of [['PM_PURPLE_WORM','being digested by the purple worm'],
    ['PM_FOG_CLOUD','engulfed by the fog cloud']])
await test(`real ${form} engulf attack selects its hold verb and suppresses the cloud`,async()=>{
    await boot(' #levelchange\r30\r\x1b\x1b');
    const mon=makemon(game.mons[PMNAMES[form]],9,12,MM_NOMSG);
    const attack=mon.data.mattk.find(a=>a[0]===ATTKS.AT_ENGL);assert.ok(attack);
    await gulpmu(mon,attack);assert.equal(game.u.ustuck,mon);assert.ok(game.u.uswallow);
    await create_gas_cloud(game.u.ux,game.u.uy,1,0);
    const msg=await status();assert.ok(msg.endsWith(', '+phrase+'.'));
    assert.doesNotMatch(msg,/, in a cloud/);
});
for(const [damage,word] of [[1,'poison gas'],[0,'vapor']])
await test(`short real ${word} cloud suffix stays complete`,async()=>{
    await boot();const cloud=await create_gas_cloud(game.u.ux,game.u.uy,1,damage);
    assert.equal(visible_region_at(game.u.ux,game.u.uy),cloud);assert.equal(reg_damg(cloud),damage);
    assert.ok((await status()).endsWith(', in a cloud of '+word+'.'));
});
for(const [damage,word] of [[1,'poison gas'],[0,'vapor']])
await test(`long real conditions bound the ${word} append to info[BUFSZ]`,async()=>{
    const {before,info}=await longConditions();assert.equal(info.length,239);
    await create_gas_cloud(game.u.ux,game.u.uy,1,damage);
    const expected=before.slice(0,-1)+(', in a cloud of '+word).slice(0,BUFSZ-info.length-1)+'.';
    assert.equal(await status(),plineText(expected));
});
await test('a fully occupied valid C suffix leaves only the terminating NUL',async()=>{
    const {before,info}=await longConditions({invisible:true,gloves:true,name:name62.slice(0,61)});
    assert.equal(info.length,255);await create_gas_cloud(game.u.ux,game.u.uy,1,1);
    assert.equal(await status(),plineText(before));
});
await test('piousness uses real alignment adjustments including the zero and three boundaries',async()=>{
    await boot();
    for(const [record,word] of [[9,'fervently'],[4,'stridently'],[3,''],[1,'haltingly'],[0,'nominally'],[-1,'insufficiently'],[-8,'insufficiently'],[-9,'insufficiently']]){
        adjalign(record-game.u.ualign.record);assert.equal(game.u.ualign.record,record);
        assert.equal(piousness(false,'neutral'),word?word+' neutral':'neutral');
        assert.ok((await status()).includes('('+piousness(false,'neutral')+')'));
    }
});
await test('ustatusline awaits real pending More before its caller can continue',async()=>{
    const run=await boot();await pline('Awaiting acknowledgement before self-probing.');
    let release,entered=false,complete=false;
    run._display.onEmptyQueue=async()=>{entered=true;await new Promise(r=>{release=r;});return 32;};
    const rng=[...getRngLog()],pending=ustatusline().then(()=>{complete=true;});
    try{
        for(let i=0;i<200&&!entered&&!complete;i++)await setTimeout(1);
        assert.equal(entered,true);assert.equal(complete,false);
        assert.ok(game.nhDisplay.grid.flat().map(c=>c.ch).join('').includes('--More--'));
    }finally{
        run._display.onEmptyQueue=quiet;release?.();await pending;
    }
    assert.equal(complete,true);assert.match(game._prevmsg,/^Status of wizard/);
    assert.deepEqual(getRngLog(),rng);
});
