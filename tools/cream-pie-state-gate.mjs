// C apply.c:3568. Public doapply, real status/equipment/shop producers.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {game as g} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {doapply,apply_ok} from '../js/apply.js';
import {make_blinded,make_hallucinated,make_deaf,set_itimeout} from '../js/potion.js';
import {Blind} from '../js/youprop.js';
import {Blindf_on} from '../js/do_wear.js';
import {oname} from '../js/do_name.js';
import {mksobj,place_object,dobjsfree} from '../js/mkobj.js';
import {readobjnam} from '../js/objnam.js';
import {addinv_nomerge,GETOBJ_SUGGEST} from '../js/invent.js';
import {setworn} from '../js/worn.js';
import {setuwep} from '../js/wield.js';
import {punish} from '../js/read.js';
import {makemon} from '../js/makemon.js';
import {see_monsters} from '../js/display.js';
import {pickup_object} from '../js/pickup.js';
import {onbill,costly_spot} from '../js/shk.js';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {setup,form,seed,clearMessages,messages,x,y} from './status-followup-test-setup.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const shopBytes=readFileSync(new URL('gen-sessions/recipes/shop-food-price-rounding.json',import.meta.url));
assert.equal(createHash('sha256').update(shopBytes).digest('hex'),'102f1eac7937d17ea4cd3effe18752696c48da980f2774574fc503d275167c9c');
const shopRecipe=JSON.parse(shopBytes).segments[0],results=[];
const bound=setTimeout(()=>{console.error('55 second source bound');process.exit(2);},55000);
function state(){return {blind:Blind(),cached:!!g.u.ublind,cream:g.u.ucreamed||0,timeout:g.u.intrinsic.HBlinded||0,
    weapon:g.u.uwep?.o_id||0,inventory:g.invent.map(o=>[o.o_id,o.quan,o.where,o.owornmask||0]),
    copies:(g.billobjs||[]).map(o=>[o.o_id,o.quan,o.where,o.owornmask||0]),text:messages(),rng:getRngLog()};}
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,500);}
    const s=state();r.after={blind:s.blind,cached:s.cached,cream:s.cream,timeout:s.timeout,text:s.text.slice(0,220),rng:s.rng,hash:hash(s)};results.push(r);}
async function equip(kind){let obj=mksobj(kind==='blindfold'?O.BLINDFOLD:kind==='towel'?O.TOWEL:O.LENSES,false,false);
    if(kind==='eyes')obj=await oname(obj,'The Eyes of the Overworld',0);
    await addinv_nomerge(obj);await Blindf_on(obj);return obj;}
async function pie(quantity=1){const obj=await readobjnam(`${quantity} uncursed cream pie${quantity>1?'s':''}`,null);
    assert.equal(obj.otyp,O.CREAM_PIE);assert.equal(obj.quan,quantity);await addinv_nomerge(obj);return obj;}
function deleted(obj){assert.equal(obj.where,C.OBJ_DELETED);assert.ok(!g.invent.includes(obj));
    assert.equal((g.objs_deleted||[]).filter(o=>o===obj).length,1);}
async function apply(run,obj,inspect){let selected=false,reads=0;
    run._display.onEmptyQueue=async()=>{assert.ok(++reads<25,'bounded input');if(!selected){selected=true;return obj.invlet.charCodeAt(0);}
        const before=state();if(inspect)await inspect();await setImmediate();assert.deepEqual(state(),before,'pending feedback cannot advance owner state');return 32;};
    assert.equal(apply_ok(obj),GETOBJ_SUGGEST);assert.equal(await doapply(),C.ECMD_OK);return reads;}
function increments(){return getRngLog().filter(s=>/^rnd\(25\)=/.test(s)).map(s=>Number(s.split('=')[1]));}

for(const mode of ['sighted','blind','eyes','blindfold','towel','saturated'])for(const quantity of [1,3])
await check(`${mode}/quantity-${quantity}`,async()=>{
    const run=await setup();if(mode==='blind')await make_blinded(9,false);
    if(['eyes','blindfold','towel'].includes(mode))await equip(mode);
    if(mode==='saturated')set_itimeout('HBlinded',C.TIMEOUT);
    const obj=await pie(quantity),old=g.u.intrinsic.HBlinded||0,wasblind=Blind();clearMessages();seed();
    await apply(run,obj);const inc=increments(),blocked=['blindfold','towel'].includes(mode);
    assert.equal(inc.length,blocked?0:1);assert.equal(g.u.ucreamed||0,blocked?0:inc[0]);
    assert.equal(g.u.intrinsic.HBlinded||0,blocked?old:Math.min(C.TIMEOUT,(old&C.TIMEOUT)+inc[0]));
    assert.equal(!!g.u.ublind,Blind());assert.equal(Blind(),mode!=='eyes');
    if(blocked)assert.doesNotMatch(messages(),/sticky goop/);
    else assert.match(messages(),wasblind||mode==='eyes'?/There's sticky goop/:/can't see through all the sticky goop/);
    assert.equal(messages().includes('one of the cream pies'),quantity>1);
    if(quantity===1)deleted(obj);else{assert.ok(g.invent.includes(obj));assert.equal(obj.quan,quantity-1);
        assert.equal(g.invent.filter(o=>o.otyp===O.CREAM_PIE).length,1);}
    assert.equal(getRngLog().filter(s=>/^rn2\(100\)=/.test(s)).length,1);
});
for(const eyes of [false,true])await check(`already creamed/eyes-${eyes}`,async()=>{
    const run=await setup();if(eyes)await equip('eyes');const obj=await pie(2);clearMessages();await apply(run,obj);
    const old=g.u.ucreamed;clearMessages();seed();await apply(run,obj);
    assert.equal(g.u.ucreamed,old+increments()[0]);assert.match(messages(),/There's more sticky goop/);
    assert.equal(Blind(),!eyes);assert.equal(!!g.u.ublind,Blind());deleted(obj);
});
for(const blocked of [false,true])await check(`hallucinated/blocked-${blocked}`,async()=>{
    const run=await setup();if(blocked)await equip('blindfold');await make_hallucinated(30,false,0);
    const obj=await pie();clearMessages();seed();await apply(run,obj);
    assert.match(messages(),/give yourself a facial/);assert.doesNotMatch(messages(),/immerse/);
    assert.equal(increments().length,blocked?0:1);deleted(obj);
});
for(const formId of [P.PM_GRAY_OOZE,P.PM_AIR_ELEMENTAL])await check(`nohands caller/${formId}`,async()=>{
    const run=await setup(),obj=await pie();form(formId);clearMessages();seed();
    run._display.onEmptyQueue=()=>32;assert.equal(await doapply(),C.ECMD_OK);
    assert.match(messages(),/aren't able to use or apply tools/);assert.ok(g.invent.includes(obj));assert.equal(g.u.ucreamed||0,0);assert.deepEqual(getRngLog(),[]);
});
await check('cancel selection keeps pie',async()=>{
    const run=await setup(),obj=await pie();clearMessages();seed();run._display.onEmptyQueue=()=>27;
    assert.equal(await doapply(),C.ECMD_CANCEL);assert.ok(g.invent.includes(obj));assert.deepEqual(getRngLog(),[]);
});
for(const slot of [C.W_WEP,C.W_SWAPWEP,C.W_QUIVER])for(const quantity of [1,3])await check(`equipment/${slot}/quantity-${quantity}`,async()=>{
    const run=await setup(),obj=await pie(quantity);await setworn(obj,slot);assert.ok(obj.owornmask&slot);
    clearMessages();seed();await apply(run,obj);
    if(quantity===1){deleted(obj);assert.equal(obj.owornmask,0);assert.ok(![g.u.uwep,g.u.uswapwep,g.u.uquiver].includes(obj));}
    else{assert.equal(obj.quan,quantity-1);assert.ok(obj.owornmask&slot);assert.ok([g.u.uwep,g.u.uswapwep,g.u.uquiver].includes(obj));}
});
await check('punished blindness preserves top-chain felt state',async()=>{
    const run=await setup();await punish(mksobj(O.SCR_PUNISHMENT,false,false));assert.ok(g.u.uball&&g.u.uchain);
    const obj=await pie();clearMessages();seed();await apply(run,obj);
    assert.equal(g.u.bc_felt,C.BC_CHAIN); // C feel_location: only the top chain is felt here.
    assert.equal(g.level.objectAt(g.u.ux,g.u.uy),g.u.uchain);assert.ok(g.level.objects.includes(g.u.uball));assert.ok(g.level.objects.includes(g.u.uchain));deleted(obj);
});

async function shop(){const run=await runSegment({...shopRecipe,moves:shopRecipe.moves.split('\x17')[0],storage:new InMemoryStorage()});
    let reads=0;run._display.onEmptyQueue=()=>{assert.ok(++reads<30);return 32;};g._preNhgetchHook=null;resetInputState();
    const keeper=g.level.monsters.find(m=>m.isshk);assert.ok(keeper&&g.u.ushops&&costly_spot(g.u.ux,g.u.uy));
    assert.equal(keeper.eshk.billct,0);dobjsfree();return {run,keeper};}
async function stock(keeper,quantity){const obj=await readobjnam(`${quantity} uncursed cream pie${quantity>1?'s':''}`,null);
    place_object(obj,g.u.ux,g.u.uy);assert.equal(await pickup_object(obj,quantity,false),1);
    assert.ok(obj.unpaid&&onbill(obj,keeper,true));return obj;}
for(const mode of ['single','stack','wield','wield-stack','eyes','blindfold','deaf'])await check(`billing/${mode}`,async r=>{
    const {run,keeper}=await shop(),quantity=mode.includes('stack')?3:1,obj=await stock(keeper,quantity);
    if(mode.startsWith('wield'))await setuwep(obj);
    if(mode==='eyes'||mode==='blindfold')await equip(mode);
    if(mode==='deaf')await make_deaf(20,false);
    const price=onbill(obj,keeper,true).price,pauses=[];clearMessages();seed();
    await apply(run,obj,async()=>{
        if(mode==='wield'&&g.u.uwep!==obj){const consumed=obj;
            assert.ok(consumed);assert.equal(consumed.where,C.OBJ_INVENT);assert.ok(consumed.unpaid);assert.equal(consumed.owornmask,0);
            assert.equal(g.billobjs.length,0);pauses.push('billing-before-copy-and-extraction');}
    });
    const copies=g.billobjs.filter(o=>o.otyp===O.CREAM_PIE);assert.equal(copies.length,1);
    const copy=copies[0],bp=onbill(copy,keeper,true);assert.ok(bp.useup);assert.equal(bp.price,price);assert.equal(bp.bquan,1);
    assert.equal(copy.quan,1);assert.equal(copy.where,C.OBJ_ONBILL);assert.equal(copy.owornmask|0,0);assert.notEqual(copy.o_id,obj.o_id);
    const consumed=(g.objs_deleted||[]).filter(o=>o.otyp===O.CREAM_PIE);assert.equal(consumed.length,1);
    assert.notEqual(copy.o_id,consumed[0].o_id);deleted(consumed[0]);
    assert.equal(getRngLog().filter(s=>/^rnd\(2\)=/.test(s)).length,quantity===1?1:2);
    if(quantity===1){deleted(obj);assert.equal(onbill(obj,keeper,true),null);assert.equal(keeper.eshk.billct,1);}
    else{assert.equal(obj.quan,2);assert.equal(onbill(obj,keeper,true).bquan,2);assert.equal(keeper.eshk.billct,2);
        if(mode==='wield-stack')assert.equal(g.u.uwep,obj);}
    assert.match(messages(),/You splatter that cream pie, you pay for it!/); // C costly_alteration does not test Deaf.
    if(mode==='wield')assert.ok(pauses.length>0,'pending billing after unwield, before copy/extraction');
    r.pauses=pauses;
});
for(const orc of [false,true])await check(`blindness setter/Sting warning-${orc}`,async r=>{
    const run=await setup(),sting=await oname(mksobj(O.ELVEN_DAGGER,false,false),'Sting',0);
    await addinv_nomerge(sting);await setuwep(sting);
    if(orc)assert.ok(await makemon(g.mons[P.PM_ORC],x+2,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG));
    await see_monsters();assert.equal(g.warn_obj_cnt||0,Number(orc));assert.ok(g.u.uprops.WARN_OF_MON&C.W_WEP);
    const obj=await pie();clearMessages();seed();let pauses=0;
    await apply(run,obj,async()=>{
        if((g._pending_message||g._toplines).includes('Sting is quivering.')){
            assert.equal(Blind(),true);assert.equal(obj.where,C.OBJ_INVENT);assert.ok(g.invent.includes(obj));pauses++;
        }
    });
    const text=messages();assert.equal(text.includes('Sting is quivering.'),orc);
    if(orc){assert.ok(pauses>0);assert.ok(text.indexOf('Sting is quivering.')<text.indexOf("can't see through"));}
    assert.equal(g.u.uwep,sting);deleted(obj);r.setterFeedbackPauses=pauses;
});
clearTimeout(bound);
const report={total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>r.name),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
