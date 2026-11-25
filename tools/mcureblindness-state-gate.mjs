// C muse.c:2872 mcureblindness and its immediate public caller contracts.
// Constructed quiet level; blindness is produced by actual potionhit unless labelled.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import {setup,seed,clearMessages,messages,x,y} from './half-damage-intrinsic-setup.mjs';
import {hash} from './half-damage-reader-observe.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {mcureblindness,m_consume_obj} from '../js/mon.js';
import {potionhit,make_hallucinated,make_blinded} from '../js/potion.js';
import {mksobj,bless,curse} from '../js/mkobj.js';
import {makeknown} from '../js/o_init.js';
import {mon_set_minvis} from '../js/worn.js';
import {canseemon} from '../js/display.js';
import {mpickobj} from '../js/steal.js';
import {find_defensive,use_defensive} from '../js/muse.js';
import {bhitm} from '../js/zap.js';
import {engulfer_digests_food} from '../js/do.js';
import {christen_monst} from '../js/do_name.js';
import {set_msg_xy} from '../js/pline.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
const tests=[],results=[]; let notes={};
const check=(name,fn)=>tests.push([name,fn]);
async function fresh(options='OPTIONS=accessiblemsg,whatis_coord:map\n') {
    const run=await setup('Wizard',options); let reads=0;
    run._display.onEmptyQueue=async()=>{await setImmediate();assert.ok(++reads<100,'bounded input');return /Call .*:/.test(game._pending_message||game._toplines)?27:32;};
    notes={};return run;
}
async function mon(type=P.PM_HILL_GIANT) {
    const m=await makemon(game.mons[type],x+2,y,C.NO_MINVENT);assert.ok(m);return m;
}
async function obj(type,buc='uncursed') {
    const o=mksobj(type,false,false);makeknown(type);
    if(buc==='blessed') bless(o); else if(buc==='cursed') await curse(o);
    return o;
}
async function blind(m) {
    await potionhit(m,await obj(O.POT_BLINDNESS),C.POTHIT_HERO_THROW);
    assert.equal(m.mcansee,0);assert.ok(m.mblinded>0);assert.ok(m.mhp>0);
}
function begin() {clearMessages();seed(7);}
function cured(m,verbose=true,prefix='<33,10>: ') {
    assert.equal(m.mcansee,1);assert.equal(m.mblinded,0);
    if(verbose) assert.ok(messages().includes(prefix+'The hill giant can see again.'),messages());
    else assert.ok(!messages().includes('can see again'),messages());
}
for(const [mode,prefix] of [['map','<33,10>: '],['screen','[12,33]: '],['compass','(2e): '],['full','(2east): '],['none','(2east): ']]) {
    check(`owner/location-${mode}`,async()=>{
        await fresh(`OPTIONS=accessiblemsg,whatis_coord:${mode}\n`);const m=await mon();await blind(m);begin();
        await mcureblindness(m,true);cured(m,true,prefix);assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});assert.deepEqual(getRngLog(),[]);
    });
}
check('owner/plain-negative',async()=>{await fresh('OPTIONS=!accessiblemsg\n');const m=await mon();await blind(m);begin();await mcureblindness(m,true);cured(m,true,'');assert.deepEqual(getRngLog(),[]);});
check('owner/quiet-preserves-pending-location',async()=>{await fresh();const m=await mon();await blind(m);begin();set_msg_xy(35,12);await mcureblindness(m,false);cured(m,false);assert.deepEqual(game.a11y.msg_loc,{x:35,y:12});assert.deepEqual(getRngLog(),[]);});
check('owner/sighted-stale-counter-constructed',async()=>{await fresh();const m=await mon();m.mblinded=47;begin();set_msg_xy(35,12);await mcureblindness(m,true);assert.equal(m.mcansee,true);assert.equal(m.mblinded,47);assert.equal(messages(),'');assert.deepEqual(game.a11y.msg_loc,{x:35,y:12});assert.deepEqual(getRngLog(),[]);});
check('owner/eyeless-constructed-state',async()=>{await fresh();const m=await mon(P.PM_GELATINOUS_CUBE);m.mcansee=0;m.mblinded=127;begin();set_msg_xy(35,12);await mcureblindness(m,true);cured(m,false);assert.deepEqual(game.a11y.msg_loc,{x:35,y:12});assert.deepEqual(getRngLog(),[]);});
check('owner/infinite-blindness-constructed-state',async()=>{await fresh();const m=await mon();m.mcansee=0;m.mblinded=0;begin();await mcureblindness(m,true);cured(m);});
check('owner/location-overrides-and-consumes',async()=>{await fresh();const m=await mon();await blind(m);begin();set_msg_xy(35,12);await mcureblindness(m,true);cured(m);await pline('A plain followup.');assert.ok(!messages().includes('<35,12>'));assert.ok(!messages().includes('<33,10>: A plain'));});
check('owner/named-monster',async()=>{await fresh();const m=await mon();await blind(m);christen_monst(m,'Iris');begin();await mcureblindness(m,true);assert.ok(messages().includes('<33,10>: Iris can see again.'),messages());});
check('owner/hallucinated-name-real-setter',async()=>{await fresh();const m=await mon();await blind(m);await make_hallucinated(20,false);begin();await mcureblindness(m,true);assert.match(messages(),/<33,10>: .+ can see again\./);assert.ok(!messages().includes('The hill giant'));assert.deepEqual(getRngLog(),[],'hallucinated naming uses the display stream');notes={namingRng:hash(getRngLog())};});
check('owner/suppressed-feedback-consumes-location',async()=>{await fresh('OPTIONS=accessiblemsg,whatis_coord:map\nMSGTYPE=hide "can see again"\n');const m=await mon();await blind(m);begin();await mcureblindness(m,true);cured(m,false);assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});});
for(const kind of ['direct','quaff']) check(`ordering/pending-${kind}`,async()=>{
    const run=await fresh('OPTIONS=accessiblemsg,whatis_coord:map\nMSGTYPE=stop "can see again"\n');
    const m=await mon();await blind(m);let o;
    if(kind==='quaff') {o=await obj(O.POT_EXTRA_HEALING);await mpickobj(m,o);assert.equal(find_defensive(m,true),true);}
    begin();let release,reads=0,done=false;
    run._display.onEmptyQueue=async()=>{++reads;if(messages().includes('can see again')) return new Promise(resolve=>{release=resolve;});return 32;};
    const work=(kind==='direct'?mcureblindness(m,true):use_defensive(m)).then(()=>{done=true;});
    try {
        for(let i=0;i<100&&!release&&!done;i++) await setImmediate();
        assert.ok(release,'actual pending input');assert.equal(done,false);cured(m);
        if(o) {assert.ok(m.minvent.includes(o));assert.ok(!messages().includes('looks much better'));}
    } finally {if(release) release(32);await work;}
    assert.equal(done,true);if(o) assert.ok(!m.minvent.includes(o));
});
for(const type of [O.POT_HEALING,O.POT_EXTRA_HEALING,O.POT_FULL_HEALING,O.POT_RESTORE_ABILITY,O.POT_GAIN_ABILITY]) for(const buc of ['blessed','uncursed','cursed']) {
    check(`potionhit/${type}/${buc}`,async()=>{
        await fresh();const m=await mon();await blind(m);const before=m.mblinded,o=await obj(type,buc);begin();await potionhit(m,o,C.POTHIT_HERO_THROW);
        const yes=type===O.POT_FULL_HEALING||type===O.POT_EXTRA_HEALING&&buc!=='cursed'||type===O.POT_HEALING&&buc==='blessed';
        if(yes) {cured(m);assert.ok(messages().indexOf('sound and hale')<messages().indexOf('can see again'));}
        else {assert.equal(m.mcansee,0);assert.equal(m.mblinded,before);assert.ok(!messages().includes('can see again'));}
        assert.equal(o.where,C.OBJ_DELETED);notes={cures:yes};
    });
}
for(const type of [O.POT_HEALING,O.POT_EXTRA_HEALING,O.POT_FULL_HEALING]) for(const buc of ['blessed','uncursed','cursed']) {
    check(`use_defensive/${type}/${buc}`,async()=>{
        await fresh();const m=await mon();await blind(m);const before=m.mblinded,o=await obj(type,buc);await mpickobj(m,o);
        assert.equal(find_defensive(m,true),true);assert.equal(game.m.defensive,o);begin();assert.equal(await use_defensive(m),2);
        const yes=type!==O.POT_HEALING||buc!=='cursed';
        if(yes) {cured(m);assert.ok(messages().indexOf('can see again')<messages().indexOf('looks'));}
        else {assert.equal(m.mcansee,0);assert.equal(m.mblinded,before);assert.ok(!messages().includes('can see again'));}
        assert.ok(!m.minvent.includes(o));notes={cures:yes};
    });
}
check('use_defensive/held-unicorn-horn',async()=>{await fresh();const m=await mon();await blind(m);const o=await obj(O.UNICORN_HORN);await mpickobj(m,o);assert.equal(find_defensive(m,true),true);assert.equal(game.m.defensive,o);begin();assert.equal(await use_defensive(m),2);cured(m);assert.ok(m.minvent.includes(o));assert.ok(messages().indexOf('uses a unicorn horn')<messages().indexOf('can see again'));});
check('use_defensive/natural-horn',async()=>{await fresh();const m=await mon(P.PM_GRAY_UNICORN);await blind(m);assert.equal(find_defensive(m,true),true);assert.equal(game.m.defensive,null);begin();await use_defensive(m);assert.equal(m.mcansee,1);assert.equal(m.mblinded,0);assert.ok(messages().includes('<33,10>: The gray unicorn can see again.'),messages());assert.ok(messages().indexOf('horn glows')<messages().indexOf('can see again'));});
for(const type of [O.CARROT,O.CORPSE,O.FOOD_RATION]) check(`m_consume_obj/${type}`,async()=>{
    await fresh();const m=await mon();await blind(m);const before=m.mblinded,o=await obj(type);if(type===O.CORPSE)o.corpsenm=P.PM_NURSE;
    begin();await m_consume_obj(m,o);if(type===O.FOOD_RATION){assert.equal(m.mcansee,0);assert.equal(m.mblinded,before);assert.ok(!messages().includes('can see again'));}else cured(m);
    assert.equal(o.where,C.OBJ_DELETED);
});
for(const type of [O.SPE_HEALING,O.SPE_EXTRA_HEALING]) for(const skilled of [false,true]) check(`bhitm/${type}/${skilled}`,async()=>{
    await fresh();const m=await mon();await blind(m);const before=m.mblinded,o=await obj(type,skilled?'blessed':'uncursed');
    game.bhitpos={x:m.mx,y:m.my};begin();await bhitm(m,o);
    if(skilled||type===O.SPE_EXTRA_HEALING){cured(m);assert.ok(messages().indexOf('can see again')<messages().indexOf('looks'));}
    else{assert.equal(m.mcansee,0);assert.equal(m.mblinded,before);assert.ok(!messages().includes('can see again'));}
});
check('engulfer/nurse-corpse-constructed-swallow',async()=>{await fresh();const m=await mon(P.PM_PURPLE_WORM);await blind(m);game.u.ustuck=m;game.u.uswallow=true;const o=await obj(O.CORPSE);o.corpsenm=P.PM_NURSE;begin();assert.equal(await engulfer_digests_food(o),true);cured(m,false);assert.match(messages(),/instantly digested/);assert.equal(o.where,C.OBJ_DELETED);});
check('owner/unseen-verbose-does-not-add-visibility-test',async()=>{await fresh();const m=await mon();await blind(m);mon_set_minvis(m,false);assert.equal(canseemon(m),false);begin();await mcureblindness(m,true);assert.equal(m.mcansee,1);assert.equal(m.mblinded,0);assert.ok(messages().includes('<33,10>: It can see again.'),messages());});
check('owner/hero-alias-constructed-helper-contract',async()=>{await fresh();const m=game.youmonst;m.mcansee=0;m.mblinded=7;begin();set_msg_xy(35,12);await mcureblindness(m,true);assert.equal(m.mcansee,1);assert.equal(m.mblinded,0);assert.equal(messages(),'You can see again.');assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});});
check('potionhit/unseen-full-healing',async()=>{await fresh();const m=await mon();await blind(m);mon_set_minvis(m,false);assert.equal(canseemon(m),false);begin();await potionhit(m,await obj(O.POT_FULL_HEALING),C.POTHIT_HERO_THROW);cured(m,false);});
check('m_consume_obj/hero-blind-carrot',async()=>{await fresh();const m=await mon();await blind(m);await make_blinded(20,false);assert.equal(canseemon(m),false);begin();await m_consume_obj(m,await obj(O.CARROT));cured(m,false);});
for(const type of [O.POT_HEALING,O.POT_EXTRA_HEALING,O.POT_FULL_HEALING]) check(`pestilence/potionhit/${type}`,async()=>{
    await fresh();const m=await mon(P.PM_PESTILENCE);await blind(m);const timer=m.mblinded,hp=m.mhp;begin();await potionhit(m,await obj(type,'blessed'),C.POTHIT_HERO_THROW);assert.equal(m.mcansee,0);assert.equal(m.mblinded,timer);assert.ok(m.mhp<hp);assert.ok(!messages().includes('can see again'));
});
check('pestilence/defensive-sickness-substitute',async()=>{await fresh();const m=await mon(P.PM_PESTILENCE);await blind(m);await potionhit(m,await obj(O.POT_FULL_HEALING),C.POTHIT_HERO_THROW);const timer=m.mblinded,hp=m.mhp,o=await obj(O.POT_SICKNESS,'blessed');await mpickobj(m,o);assert.equal(find_defensive(m,true),true);assert.equal(game.m.defensive,o);begin();await use_defensive(m);assert.equal(m.mcansee,0);assert.equal(m.mblinded,timer);assert.ok(m.mhp>hp);assert.ok(!m.minvent.includes(o));assert.ok(!messages().includes('can see again'));});
check('pestilence/healing-spell-exclusion',async()=>{await fresh();const m=await mon(P.PM_PESTILENCE);await blind(m);const timer=m.mblinded,hp=m.mhp;game.bhitpos={x:m.mx,y:m.my};begin();await bhitm(m,await obj(O.SPE_EXTRA_HEALING,'blessed'));assert.equal(m.mcansee,0);assert.equal(m.mblinded,timer);assert.ok(m.mhp<hp);assert.ok(!messages().includes('can see again'));});
const deadline=setTimeout(()=>{console.error('55 second source worker limit');process.exit(2);},55000);
for(const [name,fn] of tests) {
    try {await fn();results.push({name,pass:true,rngSHA256:hash(getRngLog()),notes});}
    catch(error){results.push({name,pass:false,error:String(error.message).slice(0,1100),rngSHA256:hash(getRngLog())});}
}
clearTimeout(deadline);
const report={kind:'constructed states through public production owners',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,firstFailure:results.find(r=>!r.pass)||null}));
if(report.passed!==report.total)process.exitCode=1;
