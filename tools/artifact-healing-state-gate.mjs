// Constructed source controls using normal imports and real producer functions.
// One runtime at a time; ARTIFACT_HEALING_RUNTIME selects the fixed packet tree.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
const runtime=new URL(process.env.ARTIFACT_HEALING_RUNTIME
    ? '../../'+process.env.ARTIFACT_HEALING_RUNTIME+'/' : '../',import.meta.url);
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const {runSegment} = await import(new URL('js/jsmain.js', runtime));
const {InMemoryStorage} = await import(new URL('js/storage.js', runtime));
const gstate = await import(new URL('js/gstate.js', runtime));
const {doinvoke,get_artifact} = await import(new URL('js/artifact.js', runtime));
const {make_slimed,make_stoned,make_sick,make_blinded} = await import(new URL('js/potion.js', runtime));
const {cprefx} = await import(new URL('js/eat.js', runtime));
const {polymon} = await import(new URL('js/polyself.js', runtime));
const {losehp} = await import(new URL('js/hack.js', runtime));
const {getRngLog} = await import(new URL('js/rng.js', runtime));
const {Blind,Blinded} = await import(new URL('js/youprop.js', runtime));
const {bot,newsym,glyph_at,tty_clear_nhwindow_message,flush_screen} = await import(new URL('js/display.js', runtime));
const {PMNAMES: P} = await import(new URL('js/monst_data.js', runtime));
const C = await import(new URL('js/const.js', runtime));

const rc='OPTIONS=name:healer,role:Healer,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,!debug_mongen\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
const reports=[];
const clear=()=>tty_clear_nhwindow_message(gstate.game._topl_cury||0);
function artifact(){return gstate.game.invent.find(o=>get_artifact(o).inv_prop==='HEALING');}
function state(){const killers=[];for(let k=gstate.game.killer?.next;k;k=k.next)killers.push({id:k.id,format:k.format,name:k.name});
    return {hp:gstate.game.u.uhp,hpmax:gstate.game.u.uhpmax,mh:gstate.game.u.mh,mhmax:gstate.game.u.mhmax,
        form:gstate.game.u.umonnum,poly:C.Upolyd(gstate.game.u),slimed:gstate.game.u.uprops?.SLIMED||0,
        sick:gstate.game.u.uprops?.SICK||0,sicktype:gstate.game.u.usick_type||0,stoned:gstate.game.u.uprops?.STONED||0,
        hblind:gstate.game.u.intrinsic?.HBlinded||0,bblind:gstate.game.u.blocked?.BLINDED||0,
        cream:gstate.game.u.ucreamed||0,blind:Blind(),blinded:Blinded(),killers,
        legacyKiller:gstate.game.delayed_killer?{...gstate.game.delayed_killer}:null,
        ap:gstate.game.youmonst.m_ap_type||0,appearance:gstate.game.youmonst.mappearance||0,
        glyph:{...glyph_at(gstate.game.u.ux,gstate.game.u.uy)},botl:!!gstate.game.disp.botl,
        mortality:gstate.game.u.umortality||0,moves:gstate.game.moves,age:artifact()?.age||0,
        top:gstate.game._toplines||'',screenSHA256:sha(gstate.game.nhDisplay.terminal.serialize())};}
async function setup(options={}){
    const extra=options.permanent?'OPTIONS=blind\n':'';
    const pie=options.cream?'\x17uncursed cream pie\r    \x1b\x1bab    \x1b\x1b':'';
    const run=await runSegment({seed:9770,datetime:'20000112093000',nethackrc:rc+extra,
        moves:' #levelchange\r30\r'+' '.repeat(29)
            +'\x17blessed The Staff of Aesculapius\r    \x1b\x1b'+pie,
        storage:new InMemoryStorage()});
    let count=0;run._display.onEmptyQueue=()=>{assert.ok(++count<100);return 32;};
    assert.ok(artifact());assert.ok(artifact().age<=gstate.game.moves);
    clear();await bot();return run;
}
async function food(){await cprefx(P.PM_GREEN_SLIME);assert.equal(gstate.game.u.uprops.SLIMED,10);
    assert.ok(state().killers.some(k=>k.id===C.SLIMED&&k.name===''));clear();}
async function invoke(r,{cancel=false}={}){
    clear();await bot();r.before=state();const root=gstate.game.killer,start=getRngLog().length;
    const display=gstate.game.nhDisplay,old=display.onEmptyQueue;let n=0;const waits=[];
    display.onEmptyQueue=()=>{waits.push(state());assert.ok(++n<40);
        return n===1?(cancel?27:artifact().invlet.charCodeAt(0)):32;};
    try{r.result=await doinvoke();}finally{display.onEmptyQueue=old;}
    r.after=state();r.waits=waits;r.rng=getRngLog().slice(start);assert.equal(gstate.game.killer,root);
    assert.ok(r.waits.every(s=>s.hp===r.before.hp&&s.mh===r.before.mh
        &&s.slimed===r.before.slimed&&s.sick===r.before.sick),'feedback/input precedes cures');
    assert.equal(r.result,cancel?C.ECMD_CANCEL:C.ECMD_TIME);
}
async function check(name,fn){await test(name,{timeout:15000},async()=>{const r={name};try{await fn(r);r.pass=true;}
    catch(error){r.pass=false;r.error=error.message;throw error;}finally{reports.push(r);}});}

for(const poly of [false,true])for(const deficit of [0,1,8,9])
await check(`real health producer, polymorphed ${poly}, deficit ${deficit}`,async r=>{
    await setup();if(poly){await losehp(7,'a source health control',C.KILLED_BY);await polymon(P.PM_MINOTAUR);}
    if(deficit)await losehp(deficit,'a source health control',C.KILLED_BY);
    await invoke(r);const b=r.before,a=r.after;
    assert.equal(b.poly,poly);assert.ok(a.age>a.moves);
    const heal=Math.trunc(((poly?b.mhmax:b.hpmax)+1-(poly?b.mh:b.hp))/2);
    if(poly){assert.equal(a.mh,b.mh+heal);assert.equal(a.hp,b.hp);}
    else assert.equal(a.hp,b.hp+heal);
    assert.equal(a.hpmax,b.hpmax);assert.equal(a.mhmax,b.mhmax);
    if(heal)assert.ok(a.top.includes('You feel better.  You feel better.'));
    else assert.ok(a.top.includes('a surge of power, but nothing seems to happen.'));
});

for(const stone of [false,true])await check('real food slime cure, unrelated stone '+stone,async r=>{
    await setup();await food();if(stone)await make_stoned(100,null,C.KILLED_BY_AN,'cockatrice');
    await invoke(r);assert.equal(r.after.slimed,0);assert.equal(r.after.stoned,stone?100:0);
    assert.deepEqual(r.after.killers,stone?[{id:C.STONED,format:C.KILLED_BY_AN,name:'cockatrice'}]:[]);
    assert.ok(r.after.botl);assert.ok(r.after.top.includes('You feel better.  You feel better.'));
});

await check('HP then sickness, slime and blindness cure with unrelated stone retained',async r=>{
    await setup();await losehp(9,'a source health control',C.KILLED_BY);
    await make_sick(100,'a source sickness control',false,C.SICK_ALL);
    await food();await make_stoned(100,null,C.KILLED_BY_AN,'cockatrice');await make_blinded(30,false);
    await invoke(r);assert.equal(r.after.hp,r.before.hp+5);
    assert.deepEqual([r.after.sick,r.after.sicktype,r.after.slimed,r.after.hblind],[0,0,0,0]);
    assert.equal(r.after.legacyKiller,null);assert.equal(r.after.blind,false);
    assert.deepEqual(r.after.killers,[{id:C.STONED,format:C.KILLED_BY_AN,name:'cockatrice'}]);
});

for(const permanent of [false,true])await check('temporary blindness cure, permanent source '+permanent,async r=>{
    await setup({permanent});await make_blinded(30,false);await invoke(r);
    assert.equal(r.after.hblind,permanent?C.FROMOUTSIDE:0);assert.equal(r.after.blind,permanent);
    assert.ok(r.after.top.includes(permanent?'You feel better.  You feel slightly better.':'You feel better.  You feel better.'));
});
await check('permanent blindness alone retains C first-message and no-effect branch',async r=>{
    await setup({permanent:true});await invoke(r);
    assert.equal(r.after.hblind,C.FROMOUTSIDE);assert.equal(r.after.blind,true);
    assert.ok(r.waits.some(s=>s.top==='You feel better.'));
    assert.ok(r.after.top.includes('a surge of power, but nothing seems to happen.'));
});
for(const timed of [false,true])await check('real cream producer retains goop, extra timeout '+timed,async r=>{
    await setup({cream:true});assert.ok(gstate.game.u.ucreamed>0);
    if(timed)await make_blinded(gstate.game.u.ucreamed+30,false);
    await invoke(r);assert.equal(r.after.cream,r.before.cream);
    assert.equal(r.after.hblind&C.TIMEOUT,r.before.cream);assert.equal(r.after.blind,true);
    assert.ok(r.after.top.includes(timed?'You feel better.':'a surge of power, but nothing seems to happen.'));
});

await check('real cooldown rejects the second invocation before curing new slime',async r=>{
    await setup();await invoke({});await food();await invoke(r);
    assert.equal(r.after.slimed,r.before.slimed);assert.deepEqual(r.after.killers,r.before.killers);
    assert.ok(r.after.age>r.before.age);assert.ok(r.after.top.includes('ignoring you.'));
});
await check('cancelled selection leaves slime and cooldown intact',async r=>{
    await setup();await food();await invoke(r,{cancel:true});
    assert.equal(r.after.age,r.before.age);assert.equal(r.after.slimed,10);
    assert.deepEqual(r.after.killers,r.before.killers);assert.deepEqual(r.rng,[]);
});

for(const flagged of [false,true])await check('constructed slime disguise cure, type flag '+flagged,async r=>{
    await setup();await food();
    // C slime_dialogue creates this disguise at one turn, inside timeout handling.
    // This direct setup is constructed; no ordinary command boundary is claimed.
    gstate.game.youmonst.m_ap_type=C.M_AP_MONSTER|(flagged?C.M_AP_F_DKNOWN:0);
    gstate.game.youmonst.mappearance=P.PM_GREEN_SLIME;
    newsym(gstate.game.u.ux,gstate.game.u.uy);await flush_screen(1);
    await invoke(r);assert.equal(r.before.glyph.glyphnum,P.PM_GREEN_SLIME+C.GLYPH_MON_MALE_OFF);
    assert.deepEqual([r.after.slimed,r.after.ap,r.after.appearance],[0,C.M_AP_NOTHING,0]);
    assert.deepEqual(r.after.killers,[]);
    // make_slimed clears fields without redrawing the buffered map glyph.
    assert.equal(r.after.glyph.glyphnum,r.before.glyph.glyphnum);
    newsym(gstate.game.u.ux,gstate.game.u.uy);await flush_screen(1);r.redrawn=state();
    assert.equal(r.redrawn.glyph.glyphnum,gstate.game.u.umonnum+C.GLYPH_MON_MALE_OFF);
});

for(const kind of ['eyeless','blocked','blindfold'])await check('blindness source retained: '+kind,async r=>{
    await setup();
    if(kind==='eyeless')await polymon(P.PM_EARTH_ELEMENTAL);
    if(kind==='blocked'){
        // Constructed blocker word, not an ordinary Eyes-of-the-Overworld claim.
        (gstate.game.u.blocked ||= {}).BLINDED=C.W_TOOL;
    }
    if(kind==='blindfold'){
        const {mksobj}=await import(new URL('js/mkobj.js',runtime));
        const {addinv}=await import(new URL('js/invent.js',runtime));
        const {ONAMES}=await import(new URL('js/objects_data.js',runtime));
        const {Blindf_on}=await import(new URL('js/do_wear.js',runtime));
        const {setworn}=await import(new URL('js/worn.js',runtime));
        const blindfold=mksobj(ONAMES.BLINDFOLD,true,false);
        addinv(blindfold);setworn(blindfold,C.W_TOOL);await Blindf_on(blindfold);
    }
    await make_blinded(30,false);await invoke(r);
    assert.equal(r.after.hblind&C.TIMEOUT,0);
    assert.equal(r.after.hblind&~C.TIMEOUT,r.before.hblind&~C.TIMEOUT);
    assert.equal(r.after.blind,kind!=='blocked');
    assert.equal(r.after.bblind,r.before.bblind);
    const message='You feel '+(kind==='eyeless'?'slightly ':'')+'better.';
    assert.ok([r.after,...r.waits].some(s=>s.top.includes(message)));
});
await check('constructed active slime with I_SPECIAL retains whole-word cause',async r=>{
    await setup();await food();gstate.game.u.uprops.SLIMED|=C.I_SPECIAL;
    await invoke(r);assert.equal(r.after.slimed,C.I_SPECIAL);
    assert.deepEqual(r.after.killers,r.before.killers);assert.ok(r.after.botl);
});
await check('constructed absent slime leaves a stale cause untouched',async r=>{
    await setup();await food();gstate.game.u.uprops.SLIMED=0;
    await invoke(r);assert.equal(r.after.slimed,0);
    assert.deepEqual(r.after.killers,r.before.killers);
    assert.ok(r.after.top.includes('a surge of power, but nothing seems to happen.'));
});
await check('constructed unrelated appearance survives the slime cure',async r=>{
    await setup();await food();gstate.game.youmonst.m_ap_type=C.M_AP_MONSTER;
    gstate.game.youmonst.mappearance=P.PM_MINOTAUR;
    await invoke(r);assert.equal(r.after.slimed,0);assert.deepEqual(r.after.killers,[]);
    assert.equal(r.after.ap,r.before.ap);assert.equal(r.after.appearance,r.before.appearance);
});

if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({evidence:'Constructed source controls using real producers and normal doinvoke; not native or ordinary-overlap claims',reports},null,2)+'\n');
