// Constructed states, actual owners and real form/mount/status producers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {setup,clearMessages,messages,seed,form,mount,x,y}=await import(new URL('tools/status-followup-test-setup.mjs',root));
const G=await mod('gstate'),C=await mod('const'),H=await mod('hack'),T=await mod('trap');
const {domove}=await mod('cmd'),{stucksteed}=await mod('steed'),{PMNAMES:P}=await mod('monst_data');
const {set_itimeout,paralyze_monst}=await mod('potion'),{sleep_monst}=await mod('mhitm');
const {maketrap}=await mod('mklev'),{set_levltyp}=await mod('mkmaze'),{makemon}=await mod('makemon');
const {mksobj,place_object}=await mod('mkobj'),{ONAMES:O}=await mod('objects_data');
const {dog_eat}=await mod('dog'),{pline,bot,map_invisible,glyph_is_invisible_at}=await mod('display');
const {getRngLog}=await mod('rng');
let g;
const reports=[],deadline=setTimeout(()=>{console.error('55 second worker bound');process.exit(2);},55000);
const snap=()=>({x:g.u.ux,y:g.u.uy,move:g.context.move,moved:!!g.u.umoved,success:g.domove_succeeded||0,
    trap:g.u.utrap||0,type:g.u.utraptype,multi:g.multi,run:g.context.run,form:g.u.umonnum,
    steed:g.u.usteed?{x:g.u.usteed.mx,y:g.u.usteed.my,sleep:g.u.usteed.msleeping||0,
        mobile:g.u.usteed.mcanmove,frozen:g.u.usteed.mfrozen||0,eating:g.u.usteed.meating||0}:null,
    rng:[...getRngLog()],text:messages()});
async function check(name,fn){const r={name};try{await fn(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,700);}
    reports.push(r);console.log(r.pass?'PASS':'FAIL',name,r.error||'');}
async function start(){const run=await setup();g=G.game;g.flags.paranoia_bits=0;g.context.move=1;
    g.u.uhp=g.u.uhpmax=1000;g.u.umoved=false;g.u.dx=1;g.u.dy=g.u.dz=0;return run;}
async function walk(dx=1,dy=0){g.u.dx=dx;g.u.dy=dy;g.domove_attempting=C.DOMOVE_WALK;g.context.move=1;await domove();}
function shape(pm){form(pm);g.u.mh=g.u.mhmax=100;}
async function riding(kind){await mount();const m=g.u.usteed;
    if(kind==='asleep')assert.equal(await sleep_monst(m,0,-1),1);
    if(kind==='paralyzed')paralyze_monst(m,12);
    if(kind==='feeding'){const obj=mksobj(O.CARROT,false,false);place_object(obj,m.mx,m.my);
        assert.equal(await dog_eat(m,obj,m.mx,m.my,false),1);assert.ok(m.meating>0);}
    clearMessages();seed(2);return m;
}
for(const pm of [P.PM_BROWN_MOLD,P.PM_BLUE_JELLY,P.PM_LICHEN])for(const lev of [false,true])await check(`root owner form ${pm} levitation ${lev}`,async r=>{
    await start();shape(pm);if(lev)set_itimeout('HLevitation',20);g.multi=7;g.context.run=1;clearMessages();seed(2);
    const immobile=!g.youmonst.data.mmove;r.result=await H.u_rooted();r.after=snap();
    assert.equal(r.result,immobile);assert.equal(r.after.multi,immobile?0:7);assert.equal(r.after.run,immobile?0:1);
    assert.equal(r.after.move,1);assert.deepEqual(r.after.rng,[]);
    if(immobile)assert.match(r.after.text,lev?/rooted in place/:/rooted to the ground/);else assert.equal(r.after.text,'');
});
for(const env of ['air','water','flying'])await check('root owner environment '+env,async r=>{
    await start();shape(P.PM_BROWN_MOLD);
    if(env==='flying')set_itimeout('HFlying',20);else g[env+'_level']={...g.u.uz};
    clearMessages();seed(2);assert.equal(await H.u_rooted(),true);r.after=snap();
    assert.match(r.after.text,env==='flying'?/rooted to the ground/:/rooted in place/);assert.deepEqual(r.after.rng,[]);
});
for(const feeding of [false,true])await check('stuck owner without steed '+feeding,async r=>{
    await start();r.result=await stucksteed(feeding);assert.equal(r.result,false);assert.equal(messages(),'');assert.deepEqual(getRngLog(),[]);
});
for(const kind of ['awake','asleep','paralyzed','feeding'])for(const feeding of [false,true])await check(`stuck owner ${kind} checkfeeding ${feeding}`,async r=>{
    await start();await riding(kind);g.multi=7;g.context.run=1;r.before=snap();r.result=await stucksteed(feeding);r.after=snap();
    const blocked=kind==='asleep'||kind==='paralyzed'||kind==='feeding'&&feeding;
    assert.equal(r.result,blocked);assert.equal(r.after.multi,7);assert.equal(r.after.run,1);assert.equal(r.after.move,1);
    assert.deepEqual(r.after.steed,r.before.steed);assert.deepEqual(r.after.rng,[]);
    if(blocked)assert.match(r.after.text,kind==='feeding'?/Your pony is still eating/:/Your pony won't move!/);else assert.equal(r.after.text,'');
});
for(const terrain of ['floor','wall','closed-door','seen-pit','current-pit','current-web'])await check('root walk before '+terrain,async r=>{
    const run=await start();shape(P.PM_BLUE_JELLY);
    if(terrain==='wall')set_levltyp(x+1,y,C.STONE);
    if(terrain==='closed-door'){set_levltyp(x+1,y,C.DOOR);g.level.at(x+1,y).doormask=C.D_CLOSED;}
    if(terrain==='seen-pit'){T.seetrap(maketrap(x+1,y,C.PIT));g.flags.paranoia_bits=C.PARANOID_TRAP;
        run._display.onEmptyQueue=()=>{throw Error('hazard prompt reached before rooted guard');};}
    if(terrain==='current-pit'||terrain==='current-web'){
        maketrap(x,y,terrain==='current-pit'?C.PIT:C.WEB);T.set_utrap(3,terrain==='current-pit'?C.TT_PIT:C.TT_WEB);
    }
    clearMessages();seed(2);await walk();r.after=snap();assert.equal(r.after.x,x);assert.equal(r.after.y,y);
    assert.equal(r.after.move,1);assert.equal(r.after.moved,false);assert.equal(r.after.success,0);
    assert.match(r.after.text,/rooted to the ground/);assert.doesNotMatch(r.after.text,/still in a pit|stuck to the web|door|stone/);
    assert.equal(r.after.trap,terrain.startsWith('current-')?3:0);assert.deepEqual(r.after.rng,[]);
});
for(const kind of ['asleep','paralyzed'])for(const target of ['floor','door','web'])await check(`steed walk ${kind} before ${target}`,async r=>{
    await start();const m=await riding(kind),sx=g.u.ux;
    if(target==='door'){set_levltyp(sx+1,y,C.DOOR);g.level.at(sx+1,y).doormask=C.D_CLOSED;}
    if(target==='web'){maketrap(sx,y,C.WEB);T.set_utrap(3,C.TT_WEB);}
    g.multi=7;g.context.run=1;clearMessages();seed(2);r.before=snap();await walk();r.after=snap();
    assert.equal(r.after.x,sx);assert.equal(r.after.y,y);assert.equal(r.after.move,1);assert.equal(r.after.multi,0);
    assert.equal(r.after.run,0);assert.equal(r.after.moved,false);assert.deepEqual(r.after.steed,r.before.steed);
    assert.equal(r.after.trap,target==='web'?3:0);assert.match(r.after.text,/Your pony won't move!/);assert.deepEqual(r.after.rng,[]);
});
for(const kind of ['awake','feeding'])await check('mobile steed ordinary walk '+kind,async r=>{
    await start();await riding(kind);const sx=g.u.ux;await walk();r.after=snap();assert.equal(r.after.x,sx+1);
    assert.equal(r.after.steed.x,sx+1);assert.equal(r.after.moved,true);assert.doesNotMatch(r.after.text,/won't move|still eating/);
});
await check('frozen counter alone is not helpless',async r=>{
    await start();const m=await riding('paralyzed');m.mcanmove=1; // one-field constructed causal contrast to helpless macro
    assert.equal(await stucksteed(false),false);const sx=g.u.ux;await walk();r.after=snap();assert.equal(r.after.x,sx+1);
    assert.equal(r.after.steed.frozen,12);
});
await check('zero direction does not ask steed to move',async r=>{
    await start();await riding('asleep');const sx=g.u.ux;await walk(0,0);r.after=snap();assert.equal(r.after.x,sx);
    assert.doesNotMatch(r.after.text,/won't move/);assert.equal(r.after.steed.sleep,1);
});
for(const kind of ['rooted','steed'])await check('attack precedes guard '+kind,async r=>{
    await start();if(kind==='rooted')shape(P.PM_BLUE_JELLY);else await riding('asleep');
    const sx=g.u.ux,mon=await makemon(g.mons[P.PM_GRID_BUG],sx+1,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(mon);g.context.forcefight=true;clearMessages();seed(2);await walk();r.after=snap();
    assert.equal(r.after.x,sx);assert.doesNotMatch(r.after.text,/rooted|won't move/);assert.ok(r.after.rng.length||r.after.text.length);
});
await check('rooted form can be involuntarily displaced',async r=>{
    await start();shape(P.PM_BLUE_JELLY);const m=await makemon(g.mons[P.PM_DISPLACER_BEAST],x+1,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(m);m.mux=x;m.muy=y;clearMessages();seed(4);await walk();r.after=snap();
    assert.equal(r.after.x,x+1);assert.equal(m.mx,x);assert.match(r.after.text,/swaps places with you/);
    assert.doesNotMatch(r.after.text,/rooted/);
});
await check('invisible marker cleanup precedes rooted refusal',async r=>{
    await start();shape(P.PM_BLUE_JELLY);g.context.nopick=true;map_invisible(x+1,y);
    assert.ok(glyph_is_invisible_at(x+1,y));clearMessages();seed(2);await walk();r.after=snap();
    assert.equal(r.after.x,x);assert.equal(glyph_is_invisible_at(x+1,y),false);assert.match(r.after.text,/rooted/);
});
for(const kind of ['rooted','steed'])await check('pending feedback precedes nomul '+kind,async r=>{
    const run=await start();if(kind==='rooted')shape(P.PM_BLUE_JELLY);else await riding('asleep');
    await bot();await pline('A long message keeps this line occupied before the next movement attempt.');
    g.multi=7;g.context.run=1;seed(2);const sx=g.u.ux;let signal,release,timer,finished=false;
    const pending=new Promise(resolve=>{signal=resolve;});
    run._display.onEmptyQueue=()=>{r.pending=snap();signal();return new Promise(resolve=>{release=resolve;});};
    const work=walk().then(()=>{finished=true;});
    try{await Promise.race([pending,work.then(()=>{throw Error('guard did not wait for feedback');}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('feedback timeout')),2000);})]);
        await setImmediate();assert.equal(finished,false);assert.equal(r.pending.x,sx);
        assert.equal(r.pending.multi,7);assert.equal(r.pending.run,1);assert.equal(r.pending.move,1);
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;if(release)release(32);await work;}
    r.after=snap();assert.equal(r.after.x,sx);assert.equal(r.after.multi,0);assert.equal(r.after.run,0);assert.equal(r.after.move,1);
});
clearTimeout(deadline);assert.equal(reports.length,41);
const report={evidence:'Constructed source controls with actual exported owners and real form/mount/status producers; no native claim',
    passed:reports.filter(r=>r.pass).length,total:reports.length,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
