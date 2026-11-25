// C-grounded constructed controls; actual owners/producers, no native claim.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {setup,form,mount,clearMessages,messages,seed}=await import(new URL('tools/status-followup-test-setup.mjs',root));
const G=await mod('gstate'),C=await mod('const'),H=await mod('hack');
const {PMNAMES:P}=await mod('monst_data'),{ONAMES:O}=await mod('objects_data');
const {set_levltyp}=await mod('mkmaze'),{mksobj}=await mod('mkobj');
const {addinv,fully_identify_obj}=await mod('invent'),{setworn}=await mod('worn'),{Boots_on}=await mod('do_wear');
const {set_itimeout}=await mod('potion'),{has_ceiling}=await mod('dungeon'),{grounded}=await mod('trap');
const {getRngLog}=await mod('rng');
const {Flying,Levitation,Stunned}=await mod('youprop');
const {domove}=await mod('cmd'),{pline,bot}=await mod('display');
let g;
async function boots(known,proof=false){
    const obj=addinv(mksobj(O.WATER_WALKING_BOOTS,false,false));obj.oerodeproof=proof?1:0;
    assert.equal(!!g.objects[obj.otyp].oc_name_known,false);
    if(known)fully_identify_obj(obj);
    await setworn(obj,C.W_ARMF);await Boots_on();assert.equal(g.u.uarmf,obj);
    return obj;
}
const originalCases=[
    {name:'bare pool negative',want:true,text:'stepping'},
    {name:'identified walking boots',want:false,prepare:()=>boots(true)},
    {name:'unidentified walking boots negative',want:true,prepare:()=>boots(false)},
    {name:'known fireproof boots and resistance',terrain:C.LAVAPOOL,want:false,prepare:async()=>{await boots(true,true);set_itimeout('HFire_resistance',20);}},
    {name:'fire resistance absent negative',terrain:C.LAVAPOOL,want:true,prepare:()=>boots(true,true)},
    {name:'proof knowledge absent negative',terrain:C.LAVAPOOL,want:true,prepare:async()=>{const b=await boots(true,true);b.rknown=0;set_itimeout('HFire_resistance',20);}},
    {name:'mounted boots excluded negative',want:true,prepare:async()=>{await boots(true);await mount();}},
    {name:'m prefix negative',want:false,tips:1<<H.TIP_SWIM,prepare:()=>{g.context.nopick=true;}},
    {name:'paranoia disabled negative',want:false,prepare:()=>{g.flags.paranoia_bits=0;}},
    {name:'water wall despite paranoia disabled negative',terrain:C.WATER,want:true,prepare:()=>{g.flags.paranoia_bits=0;}},
    {name:'ceiling clinger over pool',want:false,prepare:()=>{form(P.PM_ROCK_PIERCER);assert.equal(grounded(g.youmonst.data),false);}},
    {name:'clinger without ceiling return negative',want:true,prepare:()=>{form(P.PM_ROCK_PIERCER);g.u.uz={...g.astral_level};assert.equal(has_ceiling(g.u.uz),false);assert.equal(grounded(g.youmonst.data),true);}},
    {name:'amorphous locomotion',want:true,text:'oozing',prepare:()=>form(P.PM_ACID_BLOB)},
    {name:'slithy locomotion',want:true,text:'slithering',prepare:()=>form(P.PM_COBRA)},
    {name:'clinger water-wall locomotion',terrain:C.WATER,want:true,text:'crawling',prepare:()=>form(P.PM_ROCK_PIERCER)},
    {name:'levitating water wall negative',terrain:C.WATER,want:true,text:'floating',prepare:()=>set_itimeout('HLevitation',20)},
    {name:'ordinary floor negative',terrain:C.ROOM,want:false},
    {name:'same liquid floor negative',want:false,prepare:()=>set_levltyp(g.u.ux,g.u.uy,C.POOL)},
];
const moreCases=[
    {name:'type knowledge without individual knowledge',want:false,prepare:async()=>{const b=await boots(true);b.known=b.dknown=b.bknown=0;}},
    {name:'unworn known boots negative',want:true,prepare:async()=>{await boots(true);await setworn(null,C.W_ARMF);}},
    {name:'general water walking is not known boots',want:true,prepare:()=>set_itimeout('HWwalking',20)},
    {name:'fireproofing absent negative',terrain:C.LAVAPOOL,want:true,prepare:async()=>{await boots(true);set_itimeout('HFire_resistance',20);}},
    {name:'known lava boots cannot bypass lava wall',terrain:C.LAVAWALL,want:true,prepare:async()=>{await boots(true,true);set_itimeout('HFire_resistance',20);}},
    {name:'unseen pool negative',want:false,seen:0},
    {name:'stunned pool negative',want:false,prepare:()=>set_itimeout('HStun',20)},
    {name:'confused pool negative',want:false,prepare:()=>set_itimeout('HConfusion',20)},
    {name:'underwater pool negative',want:false,prepare:()=>H.set_uinwater(1)},
    {name:'underwater wall negative',terrain:C.WATER,want:false,prepare:()=>H.set_uinwater(1)},
    {name:'flying pool negative',want:false,prepare:()=>set_itimeout('HFlying',20)},
    {name:'levitating pool negative',want:false,prepare:()=>set_itimeout('HLevitation',20)},
    {name:'blocked stunned bat bypasses guard negative',want:false,prepare:()=>{form(P.PM_BAT);(g.u.blocked||={}).FLYING=C.I_SPECIAL;assert.equal(Stunned(),true);assert.equal(Flying(),false);assert.equal(grounded(g.youmonst.data),false);}},
    {name:'blocked nonstunned flyer remains ungrounded',want:false,prepare:()=>{form(P.PM_RAVEN);(g.u.blocked||={}).FLYING=C.I_SPECIAL;assert.equal(Stunned(),false);assert.equal(Flying(),false);assert.equal(Levitation(),false);assert.equal(grounded(g.youmonst.data),false);}},
    {name:'blocked floating form remains ungrounded',want:false,prepare:()=>{form(P.PM_FLOATING_EYE);(g.u.blocked||={}).LEVITATION=C.I_SPECIAL;assert.equal(Levitation(),false);assert.equal(grounded(g.youmonst.data),false);}},
    {name:'bare raised moat bridge negative',terrain:C.DRAWBRIDGE_UP,bridge:C.DB_MOAT,want:true},
    {name:'known boots over raised moat bridge',terrain:C.DRAWBRIDGE_UP,bridge:C.DB_MOAT,want:false,prepare:()=>boots(true)},
    {name:'known lava boots over raised lava bridge',terrain:C.DRAWBRIDGE_UP,bridge:C.DB_LAVA,want:false,prepare:async()=>{await boots(true,true);set_itimeout('HFire_resistance',20);}},
    {name:'lava wall from lava still refuses',terrain:C.LAVAWALL,want:true,prepare:()=>set_levltyp(g.u.ux,g.u.uy,C.LAVAPOOL)},
    {name:'ceiling clinger over lava',terrain:C.LAVAPOOL,want:false,prepare:()=>form(P.PM_ROCK_PIERCER)},
    {name:'Earth ceiling clinger over pool',want:false,prepare:()=>{form(P.PM_ROCK_PIERCER);g.u.uz={...g.earth_level};assert.equal(has_ceiling(g.u.uz),true);}},
];
const reports=[],deadline=setTimeout(()=>{console.error('55 second worker bound');process.exit(2);},55000);
async function check(name,fn){const r={name};try{await fn(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,700);}
    reports.push(r);console.log(r.pass?'PASS':'FAIL',name,r.error||'');}
async function start(){const run=await setup();g=G.game;g.flags.paranoia_bits=C.PARANOID_SWIM;
    g.flags.tips=false;g.context.tips=0;g.context.move=1;return run;}
function target(typ=C.POOL){const x=g.u.ux+1,y=g.u.uy;set_levltyp(x,y,typ);g.level.at(x,y).seenv=255;return {x,y};}
for(const c of [...originalCases,...moreCases])await check(c.name,async r=>{
    await start();if(c.prepare)await c.prepare();
    const {x,y}=target(c.terrain??C.POOL),loc=g.level.at(x,y);
    if(c.seen!==undefined)loc.seenv=c.seen;if(c.bridge!==undefined)loc.drawbridgemask=c.bridge;
    clearMessages();seed(2);r.result=await H.swim_move_danger(x,y);r.text=messages();r.tips=g.context.tips;
    assert.equal(r.result,c.want);if(c.text)assert.ok(r.text.includes(c.text),r.text);
    if(c.tips!==undefined)assert.equal(r.tips,c.tips);assert.deepEqual(getRngLog(),[]);
});
for(const [pm,verb] of [[null,'step'],[P.PM_COBRA,'slither'],[P.PM_ACID_BLOB,'ooze'],
    [P.PM_BROWN_MOLD,'wiggle'],[P.PM_ROCK_PIERCER,'crawl'],[P.PM_FLOATING_EYE,'float'],[P.PM_BAT,'fly']])await check('locomotion capitalization '+verb,async r=>{
    await start();if(pm!==null)form(pm);clearMessages();seed(2);
    r.lower=H.u_locomotion('step');r.upper=H.u_locomotion('Step');assert.equal(r.lower,verb);
    assert.equal(r.upper,verb[0].toUpperCase()+verb.slice(1));assert.deepEqual(getRngLog(),[]);
});
await check('effective levitation precedes flight and form',async r=>{
    await start();form(P.PM_COBRA);set_itimeout('HFlying',20);set_itimeout('HLevitation',20);
    r.result=H.u_locomotion('Step');assert.equal(r.result,'Float');
});
async function walk(){g.u.dx=1;g.u.dy=g.u.dz=0;g.domove_attempting=C.DOMOVE_WALK;g.context.move=1;await domove();}
for(const known of [false,true])await check('actual caller and pool effects, boots known '+known,async r=>{
    await start();const b=await boots(known),{x,y}=target();g.u.uhp=g.u.uhpmax=1000;g.multi=7;g.context.run=0;
    clearMessages();seed(2);await walk();r.after={x:g.u.ux,y:g.u.uy,hp:g.u.uhp,move:g.context.move,multi:g.multi,water:!!g.u.uinwater,text:messages()};
    assert.equal(r.after.x,known?x:x-1);assert.equal(r.after.y,y);assert.equal(r.after.hp,1000);
    assert.equal(r.after.move,known?1:0);assert.equal(r.after.water,false);assert.equal(g.u.uarmf,b);
    if(known)assert.doesNotMatch(r.after.text,/avoid/);else {assert.match(r.after.text,/avoid stepping/);assert.equal(r.after.multi,0);}
});
await check('tip emitted once across repeated refusals',async r=>{
    await start();g.flags.tips=true;const {x,y}=target();clearMessages();seed(2);
    assert.equal(await H.swim_move_danger(x,y),true);assert.equal(await H.swim_move_danger(x,y),true);
    r.text=messages();assert.equal((r.text.match(/Tip:/g)||[]).length,1);assert.equal(g.context.tips,1<<H.TIP_SWIM);
});
for(const tips of [false,true])await check('pending refusal and tip precede caller stop '+tips,async r=>{
    const run=await start();form(P.PM_COBRA);target();g.flags.tips=tips;g.multi=7;g.context.run=0;
    await bot();await pline('A long message keeps this line occupied before the next movement attempt.');seed(2);
    const sx=g.u.ux,pending=[],signals=[],releases=[];let finished=false,timer;
    run._display.onEmptyQueue=()=>{const i=pending.length;
        pending.push({x:g.u.ux,multi:g.multi,move:g.context.move,tips:g.context.tips});
        signals[i]?.();return new Promise(resolve=>{releases[i]=resolve;});};
    const work=walk().then(()=>{finished=true;});
    try{
        for(let i=0;i<(tips?2:1);i++){
            const arrived=new Promise(resolve=>{if(pending.length>i)resolve();else signals[i]=resolve;});
            await Promise.race([arrived,work.then(()=>{throw Error('missing pending feedback '+i);}),
                new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('feedback timeout '+i)),2000);})]);
            clearTimeout(timer);await setImmediate();assert.equal(finished,false);
            assert.equal(pending[i].x,sx);assert.equal(pending[i].multi,7);assert.equal(pending[i].move,1);
            assert.equal(pending[i].tips,i?1<<H.TIP_SWIM:0);releases[i](32);
        }
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;for(const release of releases)release(32);await work;}
    r.pending=pending;r.text=messages();assert.equal(g.u.ux,sx);assert.equal(g.multi,0);assert.equal(g.context.move,0);
    assert.match(r.text,/avoid slithering/);assert.equal(g.context.tips,tips?1<<H.TIP_SWIM:0);
});
clearTimeout(deadline);assert.equal(reports.length,52);
const report={evidence:'Constructed C-source controls with actual production owners/helpers, no ordinary/native claim',
    passed:reports.filter(r=>r.pass).length,total:reports.length,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
