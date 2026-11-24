// Source controls use real wear callbacks, slot updates, discovery and mount producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup,mount,seed,clearMessages,messages} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {accessory_or_armor_on,Boots_off,Cloak_off,Ring_on,Ring_off} from '../js/do_wear.js';
import {float_vs_flight} from '../js/polyself.js';
import {make_blinded,make_hallucinated} from '../js/potion.js';
import {christen_monst} from '../js/do_name.js';
import {addinv} from '../js/invent.js';
import {mksobj} from '../js/mkobj.js';
import {setworn} from '../js/worn.js';
import {unmul} from '../js/hack.js';
import {Stealth,Blind,Hallucination} from '../js/youprop.js';
import {ONAMES} from '../js/objects_data.js';
import {FROMOUTSIDE,W_ARM,W_ARMF,W_ARMC,W_RINGL} from '../js/const.js';
import {getRngLog,rn2,rn2_on_display_rng} from '../js/rng.js';
const gear=[
    {name:'boots',type:ONAMES.ELVEN_BOOTS,mask:W_ARMF,off:Boots_off},
    {name:'cloak',type:ONAMES.ELVEN_CLOAK,mask:W_ARMC,off:Cloak_off},
];
async function prepare({mounted=false,movement='ground',blind=false,hallu=false}={}){
    await setup();
    assert.equal(game.u.intrinsic.HStealth||0,0,'ordinary starting Wizard has no intrinsic stealth');
    if(movement==='flight')game.u.intrinsic.HFlying=FROMOUTSIDE;
    if(movement==='levitation')game.u.intrinsic.HLevitation=FROMOUTSIDE;
    float_vs_flight();
    if(mounted)await mount();
    if(blind)await make_blinded(100,false);
    if(hallu)await make_hallucinated(100,false,0);
    game.initial_don=false;game.context_takeoff={mask:0,cancelled_don:false};
    clearMessages();
}
async function item(type){
    const obj=await addinv(mksobj(type,false,false));
    obj.blessed=0;obj.cursed=0;
    game.objects[type].oc_name_known=0;
    return obj;
}
async function wear(obj){
    await accessory_or_armor_on(obj);
    if(game.afternmv)await unmul('');
}
async function measure(name,operation,discovery=false){
    clearMessages();seed(701);
    const expected=discovery?[`rn2(19)=${rn2(19)}`]:[];
    game.dispCtx=null;const nextDisplay=rn2_on_display_rng(997);
    seed(701);game.dispCtx=null;
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__rng_log_disp');
    let rng;
    try{
        globalThis.__rng_log_disp=true;
        await operation();
        rng=getRngLog().map(call=>call.replace(/\s*@\s.*$/,''));
        console.log('STATE_RECEIPT '+JSON.stringify({name,text:messages(),rng,expected}));
        assert.deepEqual(rng,expected,'only C discovery wisdom exercise consumes core RNG');
        assert.equal(rn2_on_display_rng(997),nextDisplay,'stealth feedback consumes no display RNG');
    }finally{
        if(previous)Object.defineProperty(globalThis,'__rng_log_disp',previous);
        else delete globalThis.__rng_log_disp;
    }
    return messages();
}
const contexts=[
    {name:'on foot'},
    {name:'flying on foot',movement:'flight'},
    {name:'levitating on foot',movement:'levitation'},
    {name:'mounted on ground',mounted:true},
    {name:'mounted flying',mounted:true,movement:'flight'},
    {name:'mounted levitating',mounted:true,movement:'levitation'},
    {name:'blind on foot',blind:true},
    {name:'blind levitating on foot',blind:true,movement:'levitation'},
    {name:'blind mounted flying',blind:true,mounted:true,movement:'flight'},
];
for(const spec of gear)for(const context of contexts)test(`${spec.name}: ${context.name} gain and loss`,async()=>{
    await prepare(context);const obj=await item(spec.type);
    const blocked=!!context.mounted&&(!context.movement||context.movement==='ground');
    const gain=await measure(`${spec.name}/${context.name}/on`,()=>wear(obj),!blocked);
    assert.equal(obj.owornmask,spec.mask);
    assert.equal(game.u.uprops.STEALTH&spec.mask,spec.mask);
    assert.equal(Stealth(),!blocked);assert.equal(!!game.objects[spec.type].oc_name_known,!blocked);
    const gainText=spec.name==='cloak'?'You move very quietly.'
        :context.movement?'You float imperceptibly.':'You walk very quietly.';
    if(blocked)assert.doesNotMatch(gain,/quietly|imperceptibly|noisy/);
    else assert.ok(gain.includes(gainText));
    const loss=await measure(`${spec.name}/${context.name}/off`,()=>spec.off());
    assert.equal(obj.owornmask,0);assert.equal(game.u.uprops.STEALTH||0,0);
    assert.equal(Stealth(),false);assert.ok(game.invent.includes(obj));
    if(blocked)assert.doesNotMatch(loss,/quietly|imperceptibly|noisy/);
    else assert.ok(loss.includes(context.mounted?'You and your pony are noisy.':'You sure are noisy.'));
    if(context.blind)assert.equal(Blind(),true,'blindness does not suppress feedback');
});
for(const spec of gear)for(const guard of ['initial don','cancelled don','intrinsic','other equipment'])
 test(`${spec.name}: ${guard} suppresses feedback and type discovery`,async()=>{
    await prepare();const obj=await item(spec.type);
    if(guard==='intrinsic')game.u.intrinsic.HStealth=FROMOUTSIDE;
    if(guard==='other equipment'){
        const ring=await item(ONAMES.RIN_STEALTH);
        await setworn(ring,W_RINGL);await Ring_on(ring);
    }
    if(guard==='initial don'||guard==='cancelled don')game.initial_don=true;
    const on=await measure(`${spec.name}/${guard}/on`,()=>wear(obj));
    assert.doesNotMatch(on,/quietly|imperceptibly|noisy/);
    assert.equal(game.objects[spec.type].oc_name_known,0);
    if(guard==='initial don')return;
    game.initial_don=false;
    if(guard==='cancelled don')game.context_takeoff.cancelled_don=true;
    const off=await measure(`${spec.name}/${guard}/off`,()=>spec.off());
    assert.doesNotMatch(off,/quietly|imperceptibly|noisy/);
    assert.equal(game.objects[spec.type].oc_name_known,0);
    assert.equal(obj.owornmask,0);
    if(guard==='other equipment')assert.equal(game.u.uprops.STEALTH,W_RINGL);
 });
for(const first of gear)test(`${first.name} and second armor preserve each other's source`,async()=>{
    await prepare({mounted:true,movement:'flight'});
    const second=gear.find(x=>x!==first);
    const a=await item(first.type);await wear(a);
    const b=await item(second.type);
    const on=await measure('second armor on',()=>wear(b));
    assert.doesNotMatch(on,/quietly|imperceptibly|noisy/);
    assert.equal(game.objects[second.type].oc_name_known,0);
    const off=await measure('first armor off',()=>first.off());
    assert.doesNotMatch(off,/noisy/);
    assert.equal(game.u.uprops.STEALTH,second.mask);assert.equal(Stealth(),true);
    const last=await measure('last armor off',()=>second.off(),true);
    assert.ok(last.includes('You and your pony are noisy.'));
    assert.equal(game.u.uprops.STEALTH||0,0);assert.equal(game.objects[second.type].oc_name_known,1);
});
for(const named of ['personal name','invisible','hallucinating','blind hallucinating'])
 test(`mounted naming: ${named}`,async()=>{
    await prepare({mounted:true,movement:'flight',blind:named==='blind hallucinating',hallu:named.includes('hallucinating')});
    if(named==='personal name')christen_monst(game.u.usteed,'Nimbus');
    if(named==='invisible')game.u.usteed.minvis=1;
    const obj=await item(ONAMES.ELVEN_CLOAK);await wear(obj);
    if(named.includes('hallucinating'))assert.equal(Hallucination(),true);
    const text=await measure(named,()=>Cloak_off());
    const subject=named==='personal name'?'Nimbus':named==='invisible'?'your invisible pony':'your pony';
    assert.ok(text.includes(`You and ${subject} are noisy.`));
    assert.doesNotMatch(text,/saddled/);
 });
for(const dknown of [0,1])test(`ring helper route preserves learnring dknown=${dknown}`,async()=>{
    await prepare({mounted:true,movement:'flight'});const obj=await item(ONAMES.RIN_STEALTH);obj.dknown=dknown;
    await setworn(obj,W_RINGL);
    const on=await measure('ring on',()=>Ring_on(obj),!!dknown);
    assert.ok(on.includes('You move very quietly.'));
    assert.equal(!!game.objects[obj.otyp].oc_name_known,!!dknown);
    const off=await measure('ring off',()=>Ring_off(obj));
    assert.ok(off.includes('You and your pony are noisy.'));
    assert.equal(obj.owornmask,0);assert.equal(game.u.uprops.STEALTH||0,0);
});
test('Cloak_off preserves unrelated takeoff bits before feedback',async()=>{
    await prepare({mounted:true,movement:'flight'});const obj=await item(ONAMES.ELVEN_CLOAK);await wear(obj);
    game.context_takeoff.mask=W_ARMC|W_ARM;
    await Cloak_off();assert.equal(game.context_takeoff.mask,W_ARM);
});
