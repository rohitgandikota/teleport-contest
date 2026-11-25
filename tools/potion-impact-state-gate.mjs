// Constructed C potionhit controls with real objects, damage, bills and callers.
// Usage: node tools/potion-impact-state-gate.mjs [compact-report.json]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {setup,seed,clearMessages,messages,x,y} from './half-damage-intrinsic-setup.mjs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {potionhit} from '../js/potion.js';
import {makemon,mongets} from '../js/makemon.js';
import {resist} from '../js/zap.js';
import {m_dowear} from '../js/worn.js';
import {sleep_monst} from '../js/mhitm.js';
import {ohitmon} from '../js/mthrowu.js';
import {mksobj,bless,curse,place_object,splitobj,dobjsfree} from '../js/mkobj.js';
import {readobjnam} from '../js/objnam.js';
import {freeinv} from '../js/invent.js';
import {pickup_object} from '../js/pickup.js';
import {onbill,costly_spot,sellobj,hot_pursuit,shkgone} from '../js/shk.js';
import {makeknown} from '../js/o_init.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {display_nhwindow_message,pline} from '../js/display.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O,OCLASSES as OC} from '../js/objects_data.js';
import * as C from '../js/const.js';

const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const recipe=JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/shop-food-price-rounding.json',import.meta.url)));
const entry={...recipe.segments[0],moves:recipe.segments[0].moves.split('\x17')[0]};
const tests=[],results=[];
const check=(name,fn)=>tests.push([name,fn]);
const credit=()=>({kills:game.u.uconduct?.killer||0,xp:game.u.uexp||0});
function removed(obj) {
    assert.equal(obj.where,C.OBJ_DELETED);
    assert.equal((game.objs_deleted||[]).filter(o=>o===obj).length,1);
    assert.ok(!(game.billobjs||[]).includes(obj));
}
async function target(type=P.PM_NEWT) {
    const m=await makemon(game.mons[type],x+3,y,C.NO_MM_FLAGS);
    assert.ok(m);return m;
}
async function bottle(type,buc='uncursed') {
    const obj=mksobj(type,false,false);
    makeknown(type); // Normal discovery producer avoids an unrelated naming prompt.
    if(buc==='blessed') bless(obj);
    if(buc==='cursed') await curse(obj);
    return obj;
}
for(const how of [C.POTHIT_HERO_BASH,C.POTHIT_HERO_THROW,C.POTHIT_MONST_THROW,C.POTHIT_OTHER_THROW]) {
    for(const buc of ['blessed','uncursed','cursed']) check(`acid/lethal/${how}/${buc}`,async()=>{
        await setup();const m=await target();
        // Real nonlethal damage establishes exactly one HP, without replacing RNG.
        if(m.mhp>1) await resist(m,OC.WAND_CLASS,m.mhp-1,false);
        assert.equal(m.mhp,1);
        const obj=await bottle(O.POT_ACID,buc),before=credit(),died=game.mvitals[m.mnum].died;
        clearMessages();seed(7);await potionhit(m,obj,how);
        assert.ok(m.mhp<=0);assert.equal(game.mvitals[P.PM_NEWT].died,died+1);
        const yours=how<=C.POTHIT_HERO_THROW;
        assert.equal(credit().kills-before.kills,Number(yours));
        assert.equal(credit().xp>before.xp,yours);
        assert.match(messages(),yours?/You kill the newt!/:/newt is killed!/);
        removed(obj);
    });
    for(const buc of ['blessed','uncursed','cursed']) check(`acid/survivor/${how}/${buc}`,async()=>{
        await setup();const m=await target(P.PM_HILL_GIANT);
        m.mpeaceful=1; // Constructed anger condition; target and damage are real.
        await sleep_monst(m,0,-1);assert.ok(m.msleeping);
        const hp=m.mhp,before=credit(),obj=await bottle(O.POT_ACID,buc);
        seed(7);await potionhit(m,obj,how);
        assert.ok(m.mhp>0&&m.mhp<hp);
        assert.equal(!!m.mpeaceful,how>C.POTHIT_HERO_THROW);
        assert.equal(m.msleeping,0);assert.deepEqual(credit(),before);removed(obj);
    });
    check(`acid/resistant/${how}`,async()=>{
        await setup();const m=await target(P.PM_ACID_BLOB);
        const hp=m.mhp,before=credit(),obj=await bottle(O.POT_ACID,'cursed');
        seed(7);await potionhit(m,obj,how);
        const chip=Number(getRngLog().find(s=>s.startsWith('rn2(5)=')).split('=')[1]);
        assert.equal(m.mhp,hp-Number(chip!==0&&hp>1));
        assert.deepEqual(credit(),before);assert.doesNotMatch(messages(),/in pain/);removed(obj);
    });
    check(`acid/lifesaving/${how}`,async()=>{
        await setup();const m=await target(P.PM_GOBLIN);
        mongets(m,O.AMULET_OF_LIFE_SAVING);await m_dowear(m,true);
        await resist(m,OC.WAND_CLASS,m.mhp-1,false);assert.equal(m.mhp,1);
        const obj=await bottle(O.POT_ACID,'cursed'),before=credit();
        seed(7);await potionhit(m,obj,how);
        assert.ok(m.mhp>0);assert.equal(game.mvitals[P.PM_GOBLIN].died,0);
        assert.ok(!m.minvent.some(o=>o.otyp===O.AMULET_OF_LIFE_SAVING));
        assert.equal(credit().xp,before.xp);
        // C killed() counts conduct before life-saving; monkilled() does not.
        assert.equal(credit().kills-before.kills,Number(how<=C.POTHIT_HERO_THROW));removed(obj);
    });
}
for(const [type,buc] of [[P.PM_HUMAN_WEREWOLF,'blessed'],[P.PM_IRON_GOLEM,'uncursed']]) {
    check(`water/preserves-C-hero-credit/${type}`,async()=>{
        await setup();const m=await target(type);
        // MR can halve damage; repeat bounded real nonlethal damage until one HP.
        for(let n=0;m.mhp>1&&n<12;n++) await resist(m,OC.WAND_CLASS,m.mhp-1,false);
        assert.equal(m.mhp,1);const before=credit(),obj=await bottle(O.POT_WATER,buc);
        await potionhit(m,obj,C.POTHIT_OTHER_THROW);
        assert.ok(m.mhp<=0);assert.equal(credit().kills,before.kills+1);removed(obj);
    });
}
check('acid/real-ohitmon-other-throw',async()=>{
    await setup();const m=await target();
    if(m.mhp>1) await resist(m,OC.WAND_CLASS,m.mhp-1,false);
    const obj=await bottle(O.POT_ACID,'cursed'),before=credit();
    game.bhitpos={x:m.mx,y:m.my}; // Real missile caller's coordinate input.
    seed(1);assert.equal(await ohitmon(m,obj,0,false),1);
    assert.ok(m.mhp<=0);assert.deepEqual(credit(),before);removed(obj);
});

async function shop() {
    const run=await runSegment({...entry,storage:new InMemoryStorage()});
    let reads=0;
    run._display.onEmptyQueue=async()=>{await setImmediate();assert.ok(++reads<=40);return 32;};
    game._preNhgetchHook=null;resetInputState();
    const shkp=game.level.monsters.find(m=>m.isshk);
    assert.ok(shkp&&game.u.ushops);assert.ok(costly_spot(game.u.ux,game.u.uy));
    assert.equal(shkp.eshk.billct,0);assert.equal(game.billobjs.length,0);dobjsfree();
    return {run,shkp};
}
async function stock(shkp,quantity=1) {
    const obj=await readobjnam(`${quantity} uncursed potion${quantity>1?'s':''} of fruit juice`,null);
    makeknown(O.POT_FRUIT_JUICE);place_object(obj,game.u.ux,game.u.uy);
    assert.equal(await pickup_object(obj,quantity,false),1);
    assert.ok(obj.unpaid);assert.ok(onbill(obj,shkp,true));return obj;
}
async function deposit(amount) {
    if(!amount) return;
    const gold=await readobjnam(`${amount} gold pieces`,null);
    place_object(gold,game.u.ux,game.u.uy);
    await sellobj(gold,game.u.ux,game.u.uy);
}
for(const mode of ['debit','partial-credit','exact-credit','extra-credit','monster-moving','angry','paid','outside','stack']) {
    check(`billing/${mode}`,async()=>{
        const {shkp}=await shop();
        const stack=await stock(shkp,mode==='stack'?3:1);
        const obj=mode==='stack'?splitobj(stack,1):stack;
        if(mode==='angry') hot_pursuit(shkp);
        const bp=onbill(obj,shkp,true),price=bp.bquan*bp.price;
        const amount=mode==='partial-credit'?price-1:mode==='exact-credit'?price:mode==='extra-credit'?price+1:0;
        await deposit(amount);assert.equal(shkp.eshk.credit,amount);
        if(mode==='paid') {
            // Normal sale returns this exact stock item and removes its bill.
            await sellobj(obj,game.u.ux,game.u.uy);assert.ok(!obj.unpaid);
        }
        if(mode==='outside') game.u.ushops=''; // Constructed guard negative, not ordinary shop travel.
        game.context.mon_moving=mode==='monster-moving'; // C explicitly considers this unpaid state unreachable.
        freeinv(obj);assert.equal(obj.where,C.OBJ_FREE);
        clearMessages();await potionhit(game.youmonst,obj,C.POTHIT_HERO_THROW);
        const eshk=shkp.eshk;
        if(mode==='outside') {
            assert.equal(obj.where,C.OBJ_ONBILL);assert.equal(onbill(obj,shkp,true).useup,true);
            assert.equal(eshk.debit,0);return;
        }
        removed(obj);assert.equal(onbill(obj,shkp,true),null);
        assert.equal(eshk.billct,mode==='stack'?1:0);
        assert.equal(eshk.credit,Math.max(0,amount-price));
        assert.equal(eshk.debit,['monster-moving','angry','paid'].includes(mode)?0:Math.max(0,price-amount));
        assert.equal(eshk.robbed,mode==='angry'?price:0);
        if(mode==='stack') {
            assert.equal(stack.quan,2);assert.ok(stack.unpaid);
            assert.equal(onbill(stack,shkp,true).bquan,2);
        }
        assert.equal(game.billobjs.length,0);
    });
}
check('billing/missing-keeper-defensive-arm',async()=>{
    const {shkp}=await shop(),obj=await stock(shkp);
    const shops=game.u.ushops;shkgone(shkp);
    assert.ok(!obj.unpaid);assert.equal(shkp.eshk.billct,0);
    // C says this stale unpaid/ushops pair should never occur. No fake bill or keeper.
    obj.unpaid=1;game.u.ushops=shops;
    freeinv(obj);await potionhit(game.youmonst,obj,C.POTHIT_HERO_THROW);
    assert.equal(obj.unpaid,0);removed(obj);assert.equal(shkp.eshk.debit,0);
});
check('billing/vapor-and-feedback-complete-before-free',async()=>{
    const {run,shkp}=await shop(),obj=await stock(shkp),price=onbill(obj,shkp,true).price;
    await deposit(price);freeinv(obj);
    await display_nhwindow_message();
    await pline('An earlier long message fills the top line before the bottle breaks and its bill is settled.');
    const pauses=[];let reads=0;
    run._display.onEmptyQueue=async()=>{
        assert.ok(++reads<=40);
        const state={where:obj.where,unpaid:!!obj.unpaid,billed:!!onbill(obj,shkp,true),
            credit:shkp.eshk.credit,text:game._pending_message||game._toplines};
        pauses.push(state);const rng=[...getRngLog()];await setImmediate();
        assert.deepEqual(getRngLog(),rng,'real billing input suspension draws nothing');
        assert.equal(obj.where,state.where,'disposal waits for feedback');return 32;
    };
    await potionhit(game.youmonst,obj,C.POTHIT_HERO_THROW);
    assert.ok(pauses.some(s=>s.billed&&s.unpaid&&s.where===C.OBJ_FREE));
    assert.ok(pauses.some(s=>!s.billed&&!s.unpaid&&s.where===C.OBJ_FREE));
    assert.match(messages(),/price is deducted from your credit/);
    assert.match(messages(),/no credit remaining/);removed(obj);
});

const deadline=setTimeout(()=>{console.error('55 second source worker limit');process.exit(2);},55000);
for(const [name,fn] of tests) {
    try {await fn();results.push({name,pass:true,rngSHA256:hash(getRngLog()),calls:getRngLog().length});}
    catch(error) {results.push({name,pass:false,error:error.message.slice(0,450),
        location:error.stack?.split('\n').slice(1,3).join('\n')});}
}
clearTimeout(deadline);
const report={kind:'constructed source controls; native and ordinary reach are separate',
    passed:results.filter(r=>r.pass).length,total:results.length,results};
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass).slice(0,4)}));
if(report.passed!==report.total) process.exitCode=1;
