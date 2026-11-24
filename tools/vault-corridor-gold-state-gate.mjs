// Constructed source controls. The guard and corridor come from ordinary input.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {gd_move} from '../js/vault.js';
import * as mon from '../js/mon.js';
import {mkgold, mksobj, add_to_minv} from '../js/mkobj.js';
import {addinv, obj_extract_self, sobj_at, money_cnt} from '../js/invent.js';
import {drop} from '../js/do.js';
import {litroom} from '../js/read.js';
import {makemon} from '../js/makemon.js';
import {enexto, rloc_to, teleds} from '../js/teleport.js';
import {make_blinded, make_deaf} from '../js/potion.js';
import {cansee, vision_recalc} from '../js/vision.js';
import {Blind, Deaf} from '../js/youprop.js';
import {pline} from '../js/display.js';
import {resetInputState} from '../js/input.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {MM_NOMSG, NO_MINVENT, MM_NOGRP, OBJ_MINVENT, OBJ_FLOOR,
    MON_LIMBO, MON_MIGRATING, STONE, CORR} from '../js/const.js';
const foundation=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-interrogation-feedback.json',import.meta.url))).segments[0];
const goldAt=(x,y)=>sobj_at(O.GOLD_PIECE,x,y);
const coords=m=>[m.mx,m.my];
const grid=m=>[...game.level.monAt].filter(([,v])=>v===m).map(([k])=>k);
const resetRng=()=>{initRng(401);enableRngLog();};
async function setup() {
    const run=await runSegment({...foundation,moves:foundation.moves+'d$ll\x1b\x1b',storage:new InMemoryStorage()});
    game._preNhgetchHook=null;
    resetInputState();
    const messages=[];
    let reads=0;
    run._display.onEmptyQueue=async()=>{
        assert.ok(++reads<40,'bounded real message reads');
        messages.push(game._toplines);
        await setImmediate();return 32;
    };
    const guard=game.level.monsters.find(m=>m.isgd);
    assert.deepEqual(coords(guard),[27,5]);
    assert.deepEqual([game.u.ux,game.u.uy],[25,5]);
    assert.equal(guard.mextra.egd.fcend,3);
    assert.equal(guard.mextra.egd.fcbeg,0);
    assert.equal(money_cnt(game.invent),0);
    return {guard,run,messages};
}
function checkTransfer(guard,gold,amount=50) {
    assert.equal(money_cnt(guard.minvent),amount);
    assert.equal(gold.where,OBJ_MINVENT);
    assert.equal(gold.ocarry,guard);
    assert.ok(!game.level.objects.includes(gold));
    assert.ok(!game.level.objectsAt(gold.ox,gold.oy).includes(gold));
    assert.equal(guard.mextra.egd.warncnt,5);
    assert.equal(guard.mpeaceful,1);
    assert.deepEqual(grid(guard),[`${guard.mx},${guard.my}`]);
}
await test('visible gold under the hero uses ten real enexto searches and restores the guard',async()=>{
    const {guard}=await setup();
    const gold=mkgold(50,25,5);
    resetRng();
    for(let i=0;i<10;i++)assert.ok(enexto({},25,5,guard.data));
    const expected=[...getRngLog()];
    assert.ok(expected.length>0);
    resetRng();
    assert.equal(await gd_move(guard),0);
    assert.deepEqual(getRngLog(),expected);
    checkTransfer(guard,gold);
    assert.deepEqual(coords(guard),[27,5]);
    assert.equal(game._toplines,'The guard picks up the gold from beneath you.');
});
await test('an adjacent guard collects from the hero without a placement search',async()=>{
    const {guard}=await setup();await rloc_to(guard,26,5);
    const gold=mkgold(50,25,5);resetRng();
    assert.equal(await gd_move(guard),0);checkTransfer(guard,gold);
    assert.deepEqual(coords(guard),[26,5]);assert.deepEqual(getRngLog(),[]);
});
await test('real blindness skips the visual approach and feedback but still collects underfoot',async()=>{
    const {guard}=await setup();await make_blinded(100,false);
    assert.ok(Blind()&&!cansee(25,5));
    const before=game._toplines,gold=mkgold(50,25,5);resetRng();
    assert.equal(await gd_move(guard),0);checkTransfer(guard,gold);
    assert.equal(game._toplines,before);assert.deepEqual(getRngLog(),[]);
    assert.deepEqual(coords(guard),[27,5]);
});
await test('real deafness does not suppress visible gold pickup feedback',async()=>{
    const {guard}=await setup();await make_deaf(100,false);
    assert.ok(Deaf()&&cansee(25,5));
    const gold=mkgold(50,25,5);
    assert.equal(await gd_move(guard),0);checkTransfer(guard,gold);
    assert.match(game._toplines,/picks up the gold from beneath you/);
});
await test('gold on the guard square transfers without movement or random draws',async()=>{
    const {guard}=await setup();await litroom(true,null);vision_recalc(0);
    assert.ok(cansee(27,5));const gold=mkgold(50,27,5);resetRng();
    assert.equal(await gd_move(guard),0);checkTransfer(guard,gold);
    assert.deepEqual(coords(guard),[27,5]);assert.deepEqual(getRngLog(),[]);
    assert.equal(game._toplines,'A lit field surrounds you!  The guard picks up the gold.');
});
await test('visible third-square gold is collected and the guard grid is restored',async()=>{
    const {guard}=await setup();const gold=mkgold(50,26,5);resetRng();
    assert.ok(cansee(26,5));assert.equal(await gd_move(guard),0);checkTransfer(guard,gold);
    assert.equal(mon.m_at(26,5),null);assert.deepEqual(coords(guard),[27,5]);
    assert.deepEqual(getRngLog(),[]);
});
await test('unseen third-square gold stays put, matching the C coordinate quirk',async()=>{
    const {guard}=await setup();await make_blinded(100,false);
    const gold=mkgold(50,26,5),before=game._toplines;resetRng();
    assert.equal(await gd_move(guard),0);
    assert.equal(goldAt(26,5),gold);assert.equal(gold.where,OBJ_FLOOR);
    assert.equal(money_cnt(guard.minvent),0);assert.equal(game._toplines,before);
    assert.equal(guard.mextra.egd.warncnt,5);assert.deepEqual(coords(guard),[27,5]);
    assert.deepEqual(getRngLog(),[]);
});
await test('corridor order wins over global floor order and only one pile is collected',async()=>{
    const {guard}=await setup();const first=mkgold(50,26,5),second=mkgold(70,27,5);
    assert.ok(game.level.objects.indexOf(second)<game.level.objects.indexOf(first));
    assert.equal(await gd_move(guard),0);checkTransfer(guard,first);
    assert.equal(goldAt(27,5),second);assert.equal(second.where,OBJ_FLOOR);
});
await test('collected gold merges with the real monster inventory stack',async()=>{
    const {guard}=await setup();const held=mkgold(20,27,5);
    obj_extract_self(held);add_to_minv(guard,held);
    const gold=mkgold(50,26,5);
    assert.equal(await gd_move(guard),0);
    assert.equal(money_cnt(guard.minvent),70);
    assert.equal(guard.minvent.find(o=>o.otyp===O.GOLD_PIECE),held);
    assert.equal(held.ocarry,guard);assert.ok(!game.level.objects.includes(gold));
    assert.equal(goldAt(26,5),null);
});
for(const deaf of [false,true])await test(`occupied gold square uses real relocation, deaf=${deaf}`,async()=>{
    const {guard,messages}=await setup();
    const occupant=await makemon(game.mons[P.PM_KITTEN],26,5,MM_NOMSG|NO_MINVENT|MM_NOGRP);
    assert.deepEqual(coords(occupant),[26,5]);
    if(deaf)await make_deaf(100,false);
    const gold=mkgold(50,26,5);resetRng();
    assert.equal(await gd_move(guard),0);checkTransfer(guard,gold);
    assert.notDeepEqual(coords(occupant),[26,5]);assert.ok(getRngLog().length>0);
    assert.equal(mon.m_at(26,5),null);assert.equal(mon.m_at(...coords(occupant)),occupant);
    const text=[...messages,game._toplines].join('\n');
    assert.equal(text.includes('Out of my way, scum!'),!deaf);
    assert.ok(text.includes('picks up the gold.'));
});
await test('a real controlled relocation which stays in place takes the limbo fallback',async()=>{
    const {guard,run}=await setup();
    const occupant=await makemon(game.mons[P.PM_KITTEN],26,5,MM_NOMSG|NO_MINVENT|MM_NOGRP);
    game.iflags.mon_telecontrol=true;
    let reads=0;
    run._display.onEmptyQueue=async()=>{
        assert.ok(++reads<15);await setImmediate();
        const screen=run._display.grid.slice(0,3).map(row=>row.map(c=>c.ch).join('')).join('\n');
        if(screen.includes('--More--'))return 32;
        return /force anyway/.test(game._toplines)?121:46;
    };
    const gold=mkgold(50,26,5);
    assert.equal(await gd_move(guard),0);checkTransfer(guard,gold);
    assert.ok(occupant.mstate&MON_LIMBO);assert.ok(occupant.mstate&MON_MIGRATING);
    assert.ok(game.migrating_mons.includes(occupant));assert.ok(!game.level.monsters.includes(occupant));
    assert.equal(mon.m_at(26,5),null);
});
await test('real carried-gold warning then drop produces calming feedback without hostility',async()=>{
    const {guard}=await setup();const gold=mksobj(O.GOLD_PIECE,false,false);
    gold.quan=50;await addinv(gold);
    assert.equal(await gd_move(guard),0);assert.equal(guard.mextra.egd.warncnt,6);
    assert.match(game._toplines,/Drop all your gold/);
    await drop(gold);
    assert.equal(await gd_move(guard),0);checkTransfer(guard,gold);
    assert.equal(game._toplines,'The guard calms down and picks up the gold from beneath you.');
});
await test('refusing the real warning makes the guard hostile before corridor gold is considered',async()=>{
    const {guard}=await setup();const held=mksobj(O.GOLD_PIECE,false,false);await addinv(held);
    const floor=mkgold(50,26,5);
    assert.equal(await gd_move(guard),0);assert.equal(guard.mextra.egd.warncnt,6);
    assert.equal(await gd_move(guard),-1);assert.equal(guard.mpeaceful,0);
    assert.equal(goldAt(26,5),floor);assert.equal(money_cnt(guard.minvent),0);
    assert.match(game._toplines,/So be it, rogue/);
    assert.equal(await gd_move(guard),-1);assert.equal(goldAt(26,5),floor);
});
await test('ordinary vault gold outside the active corridor is not collected',async()=>{
    const {guard}=await setup();const gold=goldAt(24,5),amount=gold.quan;
    assert.equal(await gd_move(guard),0);
    assert.equal(goldAt(24,5),gold);assert.equal(gold.quan,amount);
    assert.equal(money_cnt(guard.minvent),0);assert.equal(guard.mextra.egd.warncnt,1);
});
await test('gold revealed by carving is collected in the movement turn',async()=>{
    const {guard}=await setup();await teleds(26,5,false);
    assert.equal(game.level.at(28,5).typ,STONE);
    await litroom(true,null);vision_recalc(0);
    const gold=mkgold(50,28,5);
    assert.equal(await gd_move(guard),1);
    assert.deepEqual(coords(guard),[28,5]);assert.equal(game.level.at(28,5).typ,CORR);
    assert.equal(gold.where,OBJ_MINVENT);assert.equal(gold.ocarry,guard);
    assert.equal(guard.mextra.egd.warncnt,1);
    assert.equal(guard.mextra.egd.fcend,4);
    assert.equal(game._toplines,'A lit field surrounds you!  The guard picks up some gold.');
});
await test('pickup feedback suspends with temporary coordinates and restores only after input',async()=>{
    const {guard,run}=await setup();const gold=mkgold(50,25,5);
    await pline('A message before the guard collects the coins.');
    let release,requested;
    const request=new Promise(resolve=>{requested=resolve;});
    run._display.onEmptyQueue=()=>new Promise(resolve=>{release=()=>resolve(32);requested('read');});
    const operation=gd_move(guard);
    try {
        assert.equal(await Promise.race([request,operation.then(()=> 'complete')]),'read');
        assert.deepEqual(coords(guard),[26,5]);assert.equal(gold.ocarry,guard);
        assert.equal(guard.mextra.egd.warncnt,1);
    } finally {
        run._display.onEmptyQueue=()=>32;
        if(release)release();await operation;
    }
    checkTransfer(guard,gold);assert.deepEqual(coords(guard),[27,5]);
});
for(const scenario of ['ordinary','guard','quiet','blind','absent'])await test(`canonical mpickgold: ${scenario}`,async()=>{
    const {guard,messages}=await setup();
    const target=scenario==='guard'?guard:await makemon(game.mons[P.PM_KITTEN],26,5,MM_NOMSG|NO_MINVENT|MM_NOGRP);
    if(scenario==='quiet')game.flags.verbose=false;
    if(scenario==='blind')await make_blinded(100,false);
    const gold=scenario==='absent'?null:mkgold(50,...coords(target));
    const before=game._toplines;resetRng();
    assert.equal(typeof mon.mpickgold,'function');
    assert.equal(await mon.mpickgold(target),undefined);
    assert.equal(money_cnt(target.minvent),gold?50:0);assert.deepEqual(getRngLog(),[]);
    if(gold){assert.equal(gold.where,OBJ_MINVENT);assert.equal(gold.ocarry,target);assert.equal(goldAt(...coords(target)),null);}
    if(scenario==='ordinary')assert.match([...messages,game._toplines].join('\n'),/kitten picks up some gold/);
    else assert.equal(game._toplines,before);
});
