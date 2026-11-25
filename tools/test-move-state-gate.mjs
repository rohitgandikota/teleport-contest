// Constructed source controls using actual owners and producers. No native claim.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {setup,seed,clearMessages,messages,form,mount,x,y}=await import(new URL('tools/status-followup-test-setup.mjs',root));
const G=await mod('gstate'),C=await mod('const'),H=await mod('hack'),T=await mod('trap');
const {domove,cmdq_peek}=await mod('cmd'),{dokick}=await mod('dokick');
const {PMNAMES:P}=await mod('monst_data'),{ONAMES:O}=await mod('objects_data');
const {set_levltyp}=await mod('mkmaze'),{maketrap}=await mod('mklev');
const {mksobj,place_object,add_to_minv}=await mod('mkobj'),{addinv}=await mod('invent');
const {makemon}=await mod('makemon'),{newcham}=await mod('mon');
const {set_itimeout}=await mod('potion');
const {initworm,place_worm_tail_randomly,worm_cross}=await mod('worm');
const {setworn}=await mod('worn');
const {can_fog}=await mod('monmove'),{getRngLog}=await mod('rng');
const {pline,bot}=await mod('display');
let g;
const reports=[],deadline=setTimeout(()=>{console.error('55 second worker bound');process.exit(2);},55000);
const snap=()=>({x:g.u.ux,y:g.u.uy,trap:g.u.utrap,type:g.u.utraptype,move:g.context.move,
    opened:!!g.context.door_opened,mask:g.level.at(x+1,y).doormask,moved:!!g.u.umoved,
    rng:[...getRngLog()],text:messages(),effort:g.context.digging?.effort});
async function check(name,fn){const r={name};try{await fn(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,800);}
    reports.push(r);if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({incomplete:true,reports},null,2)+'\n');console.log(r.pass?'PASS':'FAIL',name,r.error||'');}
async function start(){const run=await setup();g=G.game;g.flags.paranoia_bits=0;g.flags.autoopen=true;g.flags.mention_walls=true;
    g.u.uhp=g.u.uhpmax=1000;g.u.umoved=false;g.u.dx=1;g.u.dy=g.u.dz=0;g.context.move=1;
    return run;}
const terrain=(xx,yy,typ,mask=0)=>{assert.equal(set_levltyp(xx,yy,typ),true);g.level.at(xx,yy).doormask=mask;};
const door=(mask=C.D_CLOSED)=>terrain(x+1,y,C.DOOR,mask);
const test=(mode=C.DO_MOVE,dx=1,dy=0)=>H.test_move(g.u.ux,g.u.uy,dx,dy,mode);
async function walk(dx=1,dy=0){g.u.dx=dx;g.u.dy=dy;g.domove_attempting=C.DOMOVE_WALK;g.context.move=1;await domove();}
function boulder(xx,yy){const o=mksobj(O.BOULDER,false,false);place_object(o,xx,yy);return o;}

for(const mode of [C.DO_MOVE,C.TEST_MOVE,C.TEST_TRAV,C.TEST_TRAP])await check('closed door mode '+mode,async r=>{
    await start();door();seed(1);r.allowed=await test(mode);r.after=snap();
    assert.equal(r.allowed,mode===C.TEST_TRAV);assert.equal(r.after.x,x);
    assert.equal(r.after.mask,mode===C.DO_MOVE?C.D_ISOPEN:C.D_CLOSED);
    assert.equal(r.after.opened,mode===C.DO_MOVE);
    if(mode===C.DO_MOVE){assert.equal(!!r.after.move,false);assert.match(r.after.text,/door opens/);assert.ok(r.after.rng.length>0);}
    else {assert.deepEqual(r.after.rng,[]);assert.equal(r.after.text,'');}
});
await check('resisting door does not claim opening or movement',async r=>{
    await start();door();seed(2);r.allowed=await test();r.after=snap();assert.equal(r.allowed,false);
    assert.equal(r.after.mask,C.D_CLOSED);assert.equal(r.after.opened,false);assert.equal(!!r.after.move,false);
    assert.match(r.after.text,/door resists/);assert.ok(r.after.rng.includes('rnl(20)=13'));
});
await check('walk opens then next step enters',async r=>{
    await start();door();seed(1);await walk();r.open=snap();assert.equal(r.open.x,x);assert.equal(r.open.opened,true);
    assert.equal(r.open.mask,C.D_ISOPEN);clearMessages();seed(2);await walk();r.enter=snap();assert.equal(r.enter.x,x+1);
});
for(const trap of [C.TT_PIT,C.TT_WEB,C.TT_BEARTRAP])await check('trapped walk precedes closed door '+trap,async r=>{
    await start();door();const record=maketrap(x,y,trap===C.TT_PIT?C.PIT:trap===C.TT_WEB?C.WEB:C.BEAR_TRAP);
    await T.dotrap(record,C.FORCETRAP);T.set_utrap(3,trap);clearMessages();seed(2);await walk();r.after=snap();
    assert.equal(r.after.x,x);assert.equal(r.after.mask,C.D_CLOSED);assert.equal(r.after.opened,false);
    assert.doesNotMatch(r.after.text,/reach over|door opens|door resists/);
    assert.match(r.after.text,trap===C.TT_PIT?/still in a pit/:trap===C.TT_WEB?/stuck to the web/:/caught in a bear trap/);
    assert.equal(r.after.trap,trap===C.TT_BEARTRAP?3:2);
});
await check('pit escape keeps door closed until next input',async r=>{
    await start();door();await T.dotrap(maketrap(x,y,C.PIT),C.FORCETRAP);T.set_utrap(1,C.TT_PIT);
    clearMessages();seed(2);await walk();r.escape=snap();assert.equal(r.escape.type,C.TT_NONE);
    assert.equal(r.escape.mask,C.D_CLOSED);assert.equal(r.escape.x,x);
    clearMessages();seed(1);await walk();r.open=snap();assert.equal(r.open.mask,C.D_ISOPEN);assert.equal(r.open.x,x);
});
for(const enabled of [false,true])await check('autoopen flag '+enabled,async r=>{
    await start();door();g.flags.autoopen=enabled;seed(1);assert.equal(await test(),false);r.after=snap();
    assert.equal(r.after.mask,enabled?C.D_ISOPEN:C.D_CLOSED);assert.match(r.after.text,enabled?/door opens/:/That door is closed/);
});
await check('queued kick preserves the caller command queue',async r=>{
    const run=await start();door(C.D_LOCKED);g.flags.autounlock=C.AUTOUNLOCK_KICK;
    let reads=0;run._display.onEmptyQueue=async()=>{await setImmediate();assert.ok(++reads<=10);return run._display.grid.slice(0,4).flat().map(c=>c.ch).join('').includes('--More--')?32:121;};seed(2);await walk();r.after=snap();const q=cmdq_peek(C.CQ_CANNED);
    assert.equal(r.after.opened,true);assert.equal(r.after.mask,C.D_LOCKED);assert.equal(q?.typ,C.CMDQ_EXTCMD);assert.equal(q.fn,dokick);
});
for(const mounted of [false,true])await check('impaired closed door bump '+mounted,async r=>{
    await start();if(mounted)await mount();const xx=g.u.ux;terrain(xx+1,y,C.DOOR,C.D_CLOSED);
    set_itimeout('HStun',20);clearMessages();seed(2);assert.equal(await test(),false);r.after=snap();
    assert.equal(r.after.opened,true);assert.equal(r.after.move,1);
    assert.match(r.after.text,mounted?/lead your pony through that closed door/:/bump into a door/);
});
await check('rock mole chews closed door through ordinary caller',async r=>{
    await start();door();form(P.PM_ROCK_MOLE);g.u.mh=g.u.mhmax=100;seed(2);r.steps=[];
    for(let i=0;i<3;i++){clearMessages();await walk();r.steps.push(snap());}
    assert.deepEqual(r.steps.map(s=>s.x),[x,x,x+1]);assert.equal(r.steps[2].mask,C.D_BROKEN);
    assert.match(r.steps[0].text,/start chewing/);assert.match(r.steps[2].text,/chew through/);
    assert.equal(g.u.uconduct.food,1);
});
for(const pm of [P.PM_GHOST,P.PM_FOG_CLOUD,P.PM_KITTEN])await check('closed door form '+pm,async r=>{
    await start();door();form(pm);g.u.mh=g.u.mhmax=100;seed(2);r.allowed=await test();r.after=snap();
    assert.equal(r.allowed,pm!==P.PM_KITTEN);assert.equal(r.after.mask,C.D_CLOSED);
    assert.equal(r.after.opened,false);
});
for(const opened of [C.D_ISOPEN,C.D_NODOOR,C.D_BROKEN])for(const exit of [false,true])await check(`door diagonal ${opened} exit ${exit}`,async r=>{
    await start();terrain(exit?x:x+1,exit?y:y+1,C.DOOR,opened);seed(2);
    r.allowed=await test(C.DO_MOVE,1,1);r.after=snap();assert.equal(r.allowed,opened!==C.D_ISOPEN);
    if(!r.allowed)assert.match(r.after.text,exit?/diagonally out/:/diagonally into/);assert.deepEqual(r.after.rng,[]);
});
for(const mode of [C.DO_MOVE,C.TEST_MOVE,C.TEST_TRAV,C.TEST_TRAP])await check('solid obstacle mode '+mode,async r=>{
    await start();terrain(x+1,y,C.STONE);seed(2);assert.equal(await test(mode),false);r.after=snap();assert.deepEqual(r.after.rng,[]);
    assert.equal(r.after.text.includes('solid stone'),mode===C.DO_MOVE);
});
await check('blind property maps obstruction without cached blindness',async r=>{
    await start();terrain(x+1,y,C.STONE);set_itimeout('HBlinded',20);g.u.ublind=0;
    g.level.at(x+1,y).seenv=0;seed(2);await test();r.after=snap();assert.ok(g.level.at(x+1,y).seenv);
});
for(const rules of [false,true])for(const branch of [false,true])await check(`active Sokoban rules ${rules} branch ${branch}`,async r=>{
    await start();g.sokoban_dnum=branch?g.u.uz.dnum:g.u.uz.dnum+99;g.level.flags.sokoban_rules=rules;
    boulder(x+1,y);seed(2);assert.equal(H.bad_rock(g.youmonst.data,x+1,y),rules);
    assert.equal(H.cant_squeeze_thru(g.youmonst),rules?3:0);
    r.travel=await test(C.TEST_TRAV);assert.equal(r.travel,!rules);r.after=snap();assert.deepEqual(r.after.rng,[]);
});
for(const phasing of [false,true])await check('Sokoban diagonal boulders phase '+phasing,async r=>{
    await start();g.level.flags.sokoban_rules=true;boulder(x+1,y);boulder(x,y+1);
    if(phasing)form(P.PM_GHOST);seed(2);r.allowed=await test(C.DO_MOVE,1,1);assert.equal(r.allowed,phasing);r.after=snap();
});
for(const oversized of [false,true])await check('diagonal load limit '+oversized,async r=>{
    await start();terrain(x+1,y,C.STONE);terrain(x,y+1,C.STONE);
    if(oversized)addinv(mksobj(O.BOULDER,false,false));seed(2);r.reason=H.cant_squeeze_thru(g.youmonst);
    assert.equal(r.reason,oversized?2:0);r.allowed=await test(C.TEST_MOVE,1,1);assert.equal(r.allowed,!oversized);
});
for(const genocided of [false,true])await check('vampire fog squeeze exception '+genocided,async r=>{
    await start();const v=await makemon(g.mons[P.PM_VAMPIRE],x+2,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(v);assert.ok(newcham(v,g.mons[P.PM_STONE_GIANT],0));
    if(genocided)g.mvitals[P.PM_FOG_CLOUD].mvflags|=C.G_GENOD;
    r.fog=!!can_fog(v);assert.equal(r.fog,!genocided);r.reason=H.cant_squeeze_thru(v);assert.equal(r.reason,genocided?1:0);
});
for(const protection of ['intrinsic','ring','bulky-inventory','none'])await check('fog helper canonical constraint '+protection,async r=>{
    await start();const v=await makemon(g.mons[P.PM_VAMPIRE],x+2,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG);
    assert.ok(v);assert.ok(newcham(v,g.mons[P.PM_STONE_GIANT],0));assert.equal(can_fog(v),true);
    if(protection==='intrinsic')set_itimeout('HProtection_from_shape_changers',20);
    else if(protection==='ring'){const ring=mksobj(O.RIN_PROTECTION_FROM_SHAPE_CHAN,false,false);addinv(ring);setworn(ring,C.W_RINGL);}
    else if(protection==='bulky-inventory')add_to_minv(v,mksobj(O.LARGE_BOX,false,false));
    seed(2);r.fog=can_fog(v);r.reason=H.cant_squeeze_thru(v);
    assert.equal(r.fog,protection==='none');assert.equal(r.reason,protection==='none'?0:1);assert.deepEqual(getRngLog(),[]);
});
for(const mode of [C.TEST_TRAV,C.TEST_TRAP])for(const seen of [false,true])await check(`travel pit ${mode} seen ${seen}`,async r=>{
    await start();const t=maketrap(x+1,y,C.PIT);if(seen)T.seetrap(t);g.context.run=8;seed(2);
    r.allowed=await test(mode);assert.equal(r.allowed,mode===C.TEST_TRAP?seen:!seen);r.after=snap();assert.deepEqual(r.after.rng,[]);
});
for(const mode of [C.TEST_TRAV,C.TEST_TRAP])for(const levitating of [false,true])await check(`travel water ${mode} levitation ${levitating}`,async r=>{
    await start();terrain(x+1,y,C.POOL);g.context.run=8;if(levitating)set_itimeout('HLevitation',20);seed(2);
    r.allowed=await test(mode);assert.equal(r.allowed,mode===C.TEST_TRAP?!levitating:levitating);r.after=snap();assert.deepEqual(r.after.rng,[]);
});
await check('generated long worm blocks diagonal through consecutive segments',async r=>{
    await start();seed(2);const worm=await makemon(g.mons[P.PM_LONG_WORM],x+2,y,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG|C.MM_NOTAIL);
    assert.ok(worm?.wormno);initworm(worm,8);place_worm_tail_randomly(worm,worm.mx,worm.my);
    let route;for(let a=g.worms.wtails[worm.wormno];a?.nseg;a=a.nseg){const b=a.nseg;
        if(Math.max(Math.abs(a.wx-x),Math.abs(b.wx-x),Math.abs(a.wy-y),Math.abs(b.wy-y))<=4&&Math.abs(a.wx-b.wx)===1&&Math.abs(a.wy-b.wy)===1&&!g.level.monAt.has(`${a.wx},${b.wy}`)&&!g.level.monAt.has(`${b.wx},${a.wy}`)){
            route={sx:a.wx,sy:b.wy,tx:b.wx,ty:a.wy};break;}}
    assert.ok(route,'actual generated tail has an open diagonal crossing');r.route=route;
    Object.assign(g.u,{ux:route.sx,uy:route.sy});assert.ok(worm_cross(route.sx,route.sy,route.tx,route.ty));
    clearMessages();seed(2);await walk(route.tx-route.sx,route.ty-route.sy);r.after=snap();
    assert.equal(r.after.x,route.sx);assert.equal(r.after.y,route.sy);assert.match(r.after.text,/worm is in your way/);
});
await check('pending autoopen feedback precedes door and caller state updates',async r=>{
    const run=await start();door();await bot();await pline('A long message keeps this line occupied before the next door attempt begins.');seed(1);
    let ready,release,timer,finished=false;const pending=new Promise(resolve=>{ready=resolve;});
    run._display.onEmptyQueue=()=>{r.pending=snap();ready();return new Promise(resolve=>{release=resolve;});};
    const work=walk().then(()=>{finished=true;});
    try{await Promise.race([pending,work.then(()=>{throw Error('no pending door feedback');}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('pending timeout')),2000);})]);
        await setImmediate();assert.equal(finished,false);assert.equal(r.pending.mask,C.D_CLOSED);
        assert.equal(r.pending.opened,false);assert.equal(r.pending.x,x);
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;if(release)release(32);await work;}
    r.after=snap();assert.equal(r.after.mask,C.D_ISOPEN);assert.equal(r.after.opened,true);assert.equal(r.after.x,x);
});
clearTimeout(deadline);
const report={evidence:'Constructed source controls with actual owners and real producers; no native or ordinary claim',
    passed:reports.filter(r=>r.pass).length,total:reports.length,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
