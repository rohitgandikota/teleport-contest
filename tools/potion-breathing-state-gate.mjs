// Complete potionbreathe source controls, using public production owners.
// Usage: node tools/potion-breathing-state-gate.mjs [compact-report.json]
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
import {setup,seed,clearMessages,messages,x,y} from './half-damage-intrinsic-setup.mjs';
import {game} from '../js/gstate.js';
import {potionbreathe,potionhit,peffects,make_blinded,make_deaf,make_confused,
    set_itimeout} from '../js/potion.js';
import {polymon} from '../js/polyself.js';
import {losehp} from '../js/hack.js';
import {mksobj,bless,curse} from '../js/mkobj.js';
import {makemon} from '../js/makemon.js';
import {addinv} from '../js/invent.js';
import {readobjnam} from '../js/objnam.js';
import {observe_object,makeknown} from '../js/o_init.js';
import {setworn} from '../js/worn.js';
import {Blindf_on,set_wear} from '../js/do_wear.js';
import {wet_a_towel} from '../js/weapon.js';
import {setuwep} from '../js/wield.js';
import {set_ulycn} from '../js/were.js';
import {adjattrib,ACURR,Fast} from '../js/attrib.js';
import {fall_asleep} from '../js/timeout.js';
import {breakobj} from '../js/dothrow.js';
import {getRngLog} from '../js/rng.js';
import {Blind,Confusion,Deaf,Invis,See_invisible,Free_action,Sleep_resistance,
    Unaware,Half_gas_damage} from '../js/youprop.js';
import {display_nhwindow_message,pline} from '../js/display.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';

const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const tests=[],results=[];
const check=(name,fn)=>tests.push([name,fn]);
let notes={};
async function fresh(role='Wizard') {
    const run=await setup(role);let reads=0;
    run._display.onEmptyQueue=async()=>{
        await setImmediate();assert.ok(++reads<=80,'bounded real input transport');
        return /Call .*:/.test(game._pending_message||game._toplines)?27:32;
    };
    notes={};return run;
}
async function bottle(type,buc='uncursed',known=true,seen=false) {
    const obj=mksobj(type,false,false);
    if(buc==='blessed') bless(obj);
    else if(buc==='cursed') await curse(obj);
    if(known) makeknown(type);
    if(seen) observe_object(obj);
    return obj;
}
async function wear(type,mask) {
    const obj=await addinv(mksobj(type,false,false));
    setworn(obj,mask);await set_wear(obj);return obj;
}
async function towel(wet) {
    const obj=await addinv(mksobj(O.TOWEL,false,false));
    if(wet) await wet_a_towel(obj,3,false);
    await Blindf_on(obj);assert.equal(Half_gas_damage(),wet);return obj;
}
async function apply(obj) {
    clearMessages();seed(7);await potionbreathe(obj);
    assert.notEqual(obj.where,C.OBJ_DELETED,'caller, not vapor, owns disposal');
}
const hp=()=>({normal:game.u.uhp,normalMax:game.u.uhpmax,form:game.u.mh,formMax:game.u.mhmax});
const heals=[[O.POT_HEALING,1],[O.POT_EXTRA_HEALING,2],[O.POT_FULL_HEALING,3]];
for(const [type,amount] of heals) for(const buc of ['blessed','uncursed','cursed']) {
    for(const mode of ['base-hurt','base-full','both-hurt','normal-only','form-only','near-cap','both-full']) {
        check(`healing/${type}/${buc}/${mode}`,async()=>{
            await fresh();
            const poly=!mode.startsWith('base');
            if(['base-hurt','both-hurt','normal-only','near-cap'].includes(mode))
                await losehp(mode==='near-cap'?1:4,'constructed injury',C.KILLED_BY);
            if(poly) await polymon(P.PM_HILL_GIANT);
            if(['both-hurt','form-only','near-cap'].includes(mode))
                await losehp(mode==='near-cap'?1:5,'constructed injury',C.KILLED_BY);
            await make_blinded(9,false);await make_deaf(11,false);
            const before=hp(),exercised=game.u.aexe.a[C.A_CON],obj=await bottle(type,buc);game.disp.botl=false;
            await apply(obj);
            const expected={...before,normal:Math.min(before.normalMax,before.normal+amount),
                form:poly?Math.min(before.formMax,before.form+amount):before.form};
            assert.deepEqual(hp(),expected,'independent HP pools and caps follow every fallthrough arm');
            const cured=type===O.POT_FULL_HEALING||(type===O.POT_EXTRA_HEALING&&buc!=='cursed')
                ||(type===O.POT_HEALING&&buc==='blessed');
            assert.equal(Blind(),!cured);assert.equal(Deaf(),!cured);
            assert.equal(game.u.intrinsic.HBlinded&C.TIMEOUT,cured?0:9);
            assert.equal(game.u.intrinsic.HDeaf&C.TIMEOUT,cured?0:11);
            const exerciseDraw=getRngLog().find(s=>s.startsWith('rn2(19)='));
            assert.equal(!!exerciseDraw,!poly);
            assert.equal(game.u.aexe.a[C.A_CON],exercised+(!poly&&Number(exerciseDraw.split('=')[1])>ACURR(C.A_CON)?1:0));
            assert.equal(!!obj.in_use,false);
            notes={before,after:hp(),cured};
        });
    }
}
check('healing/potionhit-producer-separates-shards-and-vapor',async()=>{
    await fresh();await polymon(P.PM_HILL_GIANT);
    await losehp(10,'constructed injury',C.KILLED_BY);
    const before=hp(),obj=await bottle(O.POT_FULL_HEALING,'blessed');
    seed(7);await potionhit(game.youmonst,obj,C.POTHIT_HERO_THROW);
    const impact=Number(getRngLog().find(s=>s.startsWith('rnd(2)=')).split('=')[1]);
    assert.equal(game.u.mh,Math.min(before.formMax,before.form-impact+3));
    assert.equal(obj.where,C.OBJ_DELETED);notes={before:before.form,impact,after:game.u.mh};
});
for(const wet of [false,true]) check(`towel/healing/${wet}`,async()=>{
    await fresh();await polymon(P.PM_HILL_GIANT);await losehp(7,'constructed injury',C.KILLED_BY);
    await towel(wet);const before=hp(),obj=await bottle(O.POT_FULL_HEALING);
    await apply(obj);assert.equal(game.u.mh,before.form+(wet?0:3));
    assert.equal(Blind(),true,'worn towel remains a blindness source');
    assert.equal(/vapor passes harmlessly/.test(messages()),wet);
});

for(const kind of ['none','timed-invisible','form-invisible','timed-see','form-see','ring-invisible','ring-blocked']) {
    check(`invisibility/${kind}`,async()=>{
        await fresh();
        if(kind==='timed-invisible') await peffects(await bottle(O.POT_INVISIBILITY,'uncursed',false));
        if(kind==='form-invisible') await polymon(P.PM_STALKER);
        if(kind==='timed-see') await peffects(await bottle(O.POT_SEE_INVISIBLE));
        if(kind==='form-see') await polymon(P.PM_WOODLAND_ELF);
        if(kind.startsWith('ring')) await wear(O.RIN_INVISIBILITY,C.W_RINGL);
        if(kind==='ring-blocked') await wear(O.MUMMY_WRAPPING,C.W_ARMC);
        const invisible=Invis(),see=See_invisible(),blind=Blind();
        if(kind==='timed-see'||kind==='form-see') assert.ok(see);
        if(['timed-invisible','form-invisible','ring-invisible'].includes(kind)) assert.ok(invisible);
        if(kind==='ring-blocked') assert.equal(invisible,false);
        const intr=structuredClone(game.u.intrinsic),obj=await bottle(O.POT_INVISIBILITY,'uncursed',false,true);
        assert.equal(!!game.objects[obj.otyp].oc_name_known,false);
        await apply(obj);
        assert.deepEqual(game.u.intrinsic,intr,'vapor never grants lasting invisibility');
        const flash=!blind&&!invisible;
        assert.equal(/For an instant/.test(messages()),flash);
        assert.equal(!!game.objects[obj.otyp].oc_name_known,flash);
        if(flash) assert.ok(messages().includes(see?'could see right through yourself':"couldn't see yourself"));
        notes={invisible,see,blind,flash};
    });
}
for(const type of [O.POT_INVISIBILITY,O.POT_BLINDNESS]) {
    for(const source of ['setter-timeout','blindfold','eyeless-form']) check(`blindness/read/${type}/${source}`,async()=>{
        await fresh();
        if(source==='setter-timeout') set_itimeout('HBlinded',9);
        if(source==='blindfold') await Blindf_on(await addinv(mksobj(O.BLINDFOLD,false,false)));
        if(source==='eyeless-form') await polymon(P.PM_FOG_CLOUD);
        assert.ok(Blind());
        const priorTimeout=(game.u.intrinsic.HBlinded||0)&C.TIMEOUT;
        const obj=await bottle(type,'uncursed',false,true);await apply(obj);
        assert.doesNotMatch(messages(),/For an instant|suddenly gets dark|vision clears/);
        assert.equal(!!game.objects[type].oc_name_known,false);
        if(type===O.POT_BLINDNESS) {
            const duration=Number(getRngLog().find(s=>s.startsWith('rnd(5)=')).split('=')[1]);
            assert.equal(game.u.intrinsic.HBlinded&C.TIMEOUT,priorTimeout+duration);
        }
    });
}
check('blindness/artifact-blocker-keeps-C-dark-and-clear-feedback',async()=>{
    await fresh('Monk');
    const eyes=await addinv(await readobjnam('the Eyes of the Overworld',null));
    assert.ok(eyes.oartifact);await Blindf_on(eyes);assert.ok(game.u.blocked.BLINDED);
    const obj=await bottle(O.POT_BLINDNESS,'uncursed',false,true);await apply(obj);
    assert.equal(Blind(),false);assert.ok(game.u.intrinsic.HBlinded&C.TIMEOUT);
    assert.match(messages(),/suddenly gets dark/);assert.match(messages(),/vision clears/);
    assert.equal(!!game.objects[obj.otyp].oc_name_known,true);
});
check('blindness/unaware-suppresses-knowledge-and-feedback',async()=>{
    await fresh();await fall_asleep(-7,false);assert.ok(Unaware());
    const obj=await bottle(O.POT_BLINDNESS,'uncursed',false,true);await apply(obj);
    assert.ok(Blind());assert.equal(!!game.objects[obj.otyp].oc_name_known,false);
    assert.doesNotMatch(messages(),/suddenly gets dark|vision clears/);
});
for(const type of [O.POT_CONFUSION,O.POT_BOOZE]) {
    for(const source of ['none','setter-timeout','make-confused']) check(`confusion/${type}/${source}`,async()=>{
        await fresh();
        if(source==='setter-timeout') set_itimeout('HConfusion',9);
        if(source==='make-confused') await make_confused(9,false);
        const confused=Confusion(),before=(game.u.intrinsic.HConfusion||0)&C.TIMEOUT;
        const obj=await bottle(type);await apply(obj);
        assert.equal(/somewhat dizzy/.test(messages()),!confused);
        const duration=Number(getRngLog().find(s=>s.startsWith('rnd(5)=')).split('=')[1]);
        assert.equal(game.u.intrinsic.HConfusion&C.TIMEOUT,before+duration);
    });
}

for(const type of [O.POT_RESTORE_ABILITY,O.POT_GAIN_ABILITY]) {
    check(`ability/${type}/no-deficit`,async()=>{
        await fresh();const before=[...game.u.acurr.a],obj=await bottle(type,'blessed');
        assert.deepEqual(before,[...game.u.amax.a]);await apply(obj);
        assert.deepEqual([...game.u.acurr.a],before);
        assert.equal(getRngLog().filter(s=>s.startsWith('rn2(6)=')).length,1);
    });
    for(const buc of ['blessed','uncursed','cursed']) check(`ability/${type}/${buc}`,async()=>{
        await fresh();for(const i of [C.A_STR,C.A_INT,C.A_CON]) await adjattrib(i,-2,-1);
        const before=[...game.u.acurr.a],max=[...game.u.amax.a],obj=await bottle(type,buc);
        await apply(obj);const expected=[...before];
        if(buc!=='cursed') {
            const start=Number(getRngLog().find(s=>s.startsWith('rn2(6)=')).split('=')[1]);
            for(let k=0;k<6;k++) {const i=(start+k)%6;
                if(expected[i]<max[i]) {expected[i]++;if(buc!=='blessed') break;}}
        }
        assert.deepEqual([...game.u.acurr.a],expected);assert.deepEqual([...game.u.amax.a],max);
        if(buc==='cursed') assert.match(messages(),/smells terrible/);
    });
}
for(const [form,pattern] of [[P.PM_VAMPIRE,/eyes sting/],[P.PM_FOG_CLOUD,null]]) {
    check(`ability/cursed-anatomy/${form}`,async()=>{
        await fresh();await polymon(form);const before=[...game.u.acurr.a];
        const obj=await bottle(O.POT_RESTORE_ABILITY,'cursed');await apply(obj);
        assert.deepEqual([...game.u.acurr.a],before);
        if(pattern) assert.match(messages(),pattern);else assert.equal(messages().trim(),'');
        assert.deepEqual(getRngLog(),[]);
    });
}
for(const role of ['Wizard','Healer']) for(const poly of [false,true]) for(const health of [1,5,6]) {
    check(`sickness/${role}/${poly}/${health}`,async()=>{
        await fresh(role);if(poly) await polymon(P.PM_HILL_GIANT);
        const pool=poly?'mh':'uhp';await losehp(game.u[pool]-health,'constructed injury',C.KILLED_BY);
        const before=hp(),obj=await bottle(O.POT_SICKNESS);await apply(obj);
        assert.equal(game.u[pool],role==='Healer'?health:Math.max(1,health-5));
        assert.equal(game.u[poly?'uhp':'mh'],poly?before.normal:before.form);
        assert.equal(game.u.umortality||0,0);
    });
}
for(const type of [O.POT_PARALYSIS,O.POT_SLEEPING]) {
    check(`immobility/${type}/intrinsic-free-action-is-not-extrinsic`,async()=>{
        await fresh();set_itimeout('HFree_action',9);
        assert.equal(game.u.uprops?.FREE_ACTION||0,0);
        await apply(await bottle(type));
        assert.ok(game.multi<0,'C Free_action reads only the extrinsic property');
        assert.equal(game.u.intrinsic.HFree_action,9);
        assert.equal(getRngLog().filter(s=>s.startsWith('rnd(5)=')).length,1);
    });
    for(const protection of ['none','free-action','sleep-resistance','wet-towel']) check(`immobility/${type}/${protection}`,async()=>{
        await fresh();
        if(protection==='free-action') await wear(O.RIN_FREE_ACTION,C.W_RINGL);
        if(protection==='sleep-resistance') await polymon(P.PM_WOODLAND_ELF);
        if(protection==='wet-towel') await towel(true);
        assert.equal(Free_action(),protection==='free-action');
        if(protection==='sleep-resistance') assert.ok(Sleep_resistance());
        const blocked=protection==='wet-towel'||Free_action()||(type===O.POT_SLEEPING&&Sleep_resistance());
        const obj=await bottle(type,'uncursed',false,true);await apply(obj);
        assert.equal(game.multi<0,!blocked);
        assert.equal(getRngLog().some(s=>s.startsWith('rnd(5)=')),!blocked);
        assert.equal(!!game.objects[type].oc_name_known,protection!=='wet-towel');
        if(!blocked) {
            assert.equal(game.multi_reason,type===O.POT_SLEEPING?'sleeping off a magical draught':'frozen by a potion');
            assert.equal(game.nomovemsg,'You can move again.');
        }
        if(type===O.POT_SLEEPING&&protection==='sleep-resistance') assert.match(messages(),/yawn/);
    });
}
for(const initial of [0,9,C.TIMEOUT-1]) check(`speed/timeout/${initial}`,async()=>{
    await fresh();
    if(initial) await peffects(await bottle(O.POT_SPEED));
    set_itimeout('HFast',initial);
    const before=game.u.intrinsic.HFast||0,wasFast=Fast(),obj=await bottle(O.POT_SPEED);
    await apply(obj);
    const duration=Number(getRngLog().find(s=>s.startsWith('rnd(5)=')).split('=')[1]);
    assert.equal(game.u.intrinsic.HFast&C.TIMEOUT,Math.min(C.TIMEOUT,initial+duration));
    assert.equal(game.u.intrinsic.HFast&~C.TIMEOUT,before&~C.TIMEOUT);
    assert.equal(/knees seem more flexible/.test(messages()),!wasFast);
});
for(const invisible of [false,true]) check(`sleep/monster-learns-visible-resistance/${invisible}`,async()=>{
    await fresh();await wear(O.RIN_FREE_ACTION,C.W_RINGL);
    const mon=await makemon(game.mons[P.PM_NEWT],x+2,y,C.NO_MM_FLAGS);assert.ok(mon);
    if(invisible) await peffects(await bottle(O.POT_INVISIBILITY));
    assert.equal(Invis(),invisible);assert.equal((mon.seen_resistance||0)&C.M_SEEN_SLEEP,0);
    await apply(await bottle(O.POT_SLEEPING));
    assert.equal(!!((mon.seen_resistance||0)&C.M_SEEN_SLEEP),!invisible);
});

check('water/gremlin-real-clone',async()=>{
    await fresh();await polymon(P.PM_GREMLIN);const before=hp(),obj=await bottle(O.POT_WATER);
    await apply(obj);const clone=game.level.monsters.find(m=>m.mcloned&&m.mnum===P.PM_GREMLIN);
    assert.ok(clone?.mtame);assert.equal(game.u.mh+clone.mhp,before.form);
    assert.equal(game.u.mhmax+clone.mhpmax,before.formMax);
});
check('water/gremlin-one-HP-does-not-clone',async()=>{
    await fresh();await polymon(P.PM_GREMLIN);await losehp(game.u.mh-1,'constructed injury',C.KILLED_BY);
    const before=hp();await apply(await bottle(O.POT_WATER));
    assert.deepEqual(hp(),before);assert.equal(game.level.monsters.length,0);
});
for(const kind of ['no-infection','holy-base','holy-other-form','unholy-already-were']) {
    check(`water/no-change/${kind}`,async()=>{
        await fresh();
        if(kind!=='no-infection') set_ulycn(P.PM_WEREWOLF);
        if(kind==='holy-other-form') await polymon(P.PM_HILL_GIANT);
        if(kind==='unholy-already-were') await polymon(P.PM_WEREWOLF);
        const before=hp(),form=game.u.umonnum,infection=game.u.ulycn;
        await apply(await bottle(O.POT_WATER,kind.startsWith('holy')?'blessed':'cursed'));
        assert.deepEqual(hp(),before);assert.equal(game.u.umonnum,form);assert.equal(game.u.ulycn,infection);
    });
}
for(const inUse of [false,true]) check(`water/wielded-unholy-in-use/${inUse}`,async()=>{
    await fresh();set_ulycn(P.PM_WEREWOLF);
    const obj=await addinv(await bottle(O.POT_WATER,'cursed'));setuwep(obj);
    obj.in_use=inUse; // Explicit caller-state input; the helper must preserve it.
    await apply(obj);assert.equal(game.u.umonnum,P.PM_WEREWOLF);
    assert.equal(game.u.ulycn,P.PM_WEREWOLF);
    assert.ok(game.invent.includes(obj),'transformation must not drop the in-use potion');
    assert.equal(obj.where,C.OBJ_INVENT);assert.equal(!!obj.in_use,inUse);
});
check('water/holy-reversion-keeps-infection',async()=>{
    await fresh();set_ulycn(P.PM_WEREWOLF);await polymon(P.PM_WEREWOLF);
    await apply(await bottle(O.POT_WATER,'blessed'));
    assert.equal(game.u.umonnum,game.u.umonster);assert.equal(game.u.ulycn,P.PM_WEREWOLF);
});
check('water/unchanging-blocks-unholy-transformation',async()=>{
    await fresh();set_ulycn(P.PM_WEREWOLF);await wear(O.AMULET_OF_UNCHANGING,C.W_AMUL);
    await apply(await bottle(O.POT_WATER,'cursed'));
    assert.equal(game.u.umonnum,game.u.umonster);assert.equal(game.u.ulycn,P.PM_WEREWOLF);
});
check('water/breakobj-caller-owns-consumption',async()=>{
    await fresh();const obj=await bottle(O.POT_WATER);seed(7);
    await breakobj(obj,x,y,true,false);assert.equal(obj.where,C.OBJ_DELETED);
});
for(const type of [O.POT_GAIN_LEVEL,O.POT_GAIN_ENERGY,O.POT_LEVITATION,O.POT_FRUIT_JUICE,
    O.POT_MONSTER_DETECTION,O.POT_OBJECT_DETECTION,O.POT_OIL]) {
    check(`default/no-effect/${type}`,async()=>{
        await fresh();const before=hp(),intr=structuredClone(game.u.intrinsic),obj=await bottle(type);
        await apply(obj);assert.deepEqual(hp(),before);assert.deepEqual(game.u.intrinsic,intr);
        assert.deepEqual(getRngLog(),[]);assert.equal(!!obj.in_use,false);
    });
}
check('hallucination/vision-does-not-set-timeout',async()=>{
    await fresh();const obj=await bottle(O.POT_HALLUCINATION);await apply(obj);
    assert.match(messages(),/momentary vision/);assert.equal(game.u.intrinsic.HHallucination||0,0);
});
for(const type of [O.POT_ACID,O.POT_POLYMORPH]) check(`exercise-only/${type}`,async()=>{
    await fresh();const before=hp(),form=game.u.umonnum,exercised=game.u.aexe.a[C.A_CON],obj=await bottle(type);
    await apply(obj);assert.deepEqual(hp(),before);assert.equal(game.u.umonnum,form);
    const abuse=Number(getRngLog().find(s=>s.startsWith('rn2(2)=')).split('=')[1]);
    assert.equal(game.u.aexe.a[C.A_CON],exercised-abuse);
});
check('knowledge/unobserved-flash-does-not-identify',async()=>{
    await fresh();const obj=await bottle(O.POT_INVISIBILITY,'uncursed',false,false);
    assert.equal(!!obj.dknown,false);await apply(obj);
    assert.match(messages(),/For an instant/);assert.equal(!!game.objects[obj.otyp].oc_name_known,false);
});
for(const inUse of [false,true]) check(`naming/suspends-after-flag-restoration/${inUse}`,async()=>{
    const run=await fresh(),obj=await bottle(O.POT_FRUIT_JUICE,'uncursed',false,true);
    obj.in_use=inUse; // Constructed caller-state branch.
    let enter,release,done=false;const entered=new Promise(r=>enter=r);
    run._display.onEmptyQueue=()=>new Promise(r=>{release=r;enter();});
    const operation=potionbreathe(obj).then(()=>{done=true;});
    try {
        await Promise.race([entered,operation]);assert.equal(done,false);
        assert.equal(!!obj.in_use,inUse);assert.notEqual(obj.where,C.OBJ_DELETED);
        const calls=[...getRngLog()];await setImmediate();assert.deepEqual(getRngLog(),calls);
    } finally {run._display.onEmptyQueue=()=>27;if(release) release(27);await operation;}
    assert.equal(!!game.objects[obj.otyp].oc_name_known,false);
});
check('healing/HP-before-sight-and-hearing-feedback',async()=>{
    const run=await fresh();await polymon(P.PM_HILL_GIANT);await losehp(8,'constructed injury',C.KILLED_BY);
    await make_blinded(7,false);await make_deaf(9,false);
    const obj=await bottle(O.POT_FULL_HEALING,'blessed'),before=hp();
    await display_nhwindow_message();
    await pline('An earlier message fills most of the line before the healing vapor.');
    let release,enter,done=false;const entered=new Promise(r=>enter=r);
    run._display.onEmptyQueue=()=>new Promise(r=>{release=r;enter();});
    const operation=potionbreathe(obj).then(()=>{done=true;});
    try {
        await Promise.race([entered,operation]);assert.equal(done,false);
        assert.equal(game.u.mh,before.form+3);assert.equal(!!obj.in_use,true);
        assert.ok(Blind());assert.ok(Deaf());
    } finally {run._display.onEmptyQueue=()=>32;if(release) release(32);await operation;}
    assert.equal(Blind(),false);assert.equal(Deaf(),false);assert.equal(!!obj.in_use,false);
});

const deadline=setTimeout(()=>{console.error('55 second source worker limit');process.exit(2);},55000);
for(const [name,fn] of tests) {
    try {await fn();results.push({name,pass:true,notes,calls:getRngLog().length,rngSHA256:hash(getRngLog())});}
    catch(error) {results.push({name,pass:false,error:error.message.slice(0,450),
        location:error.stack?.split('\n').find(line=>line.includes('potion-breathing-state-gate.mjs:'))});}
}
clearTimeout(deadline);
const report={kind:'constructed source controls with real producers; ordinary/native reach is separate',
    passed:results.filter(r=>r.pass).length,total:results.length,results};
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass).slice(0,5)}));
if(report.passed!==report.total) process.exitCode=1;
