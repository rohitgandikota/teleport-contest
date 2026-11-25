// Constructed states through real producers and exported owners. No native claim.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {setup,clearMessages,messages,seed,mount,x,y}=await import(new URL('tools/status-followup-test-setup.mjs',root));
const G=await mod('gstate'),C=await mod('const'),T=await mod('trap');
const {trapmove}=await mod('hack'),{domove}=await mod('cmd');
const {maketrap}=await mod('mklev'),{mksobj}=await mod('mkobj');
const {addinv}=await mod('invent'),{setuwep}=await mod('wield'),{oname}=await mod('do_name');
const {use_pick_axe2,bury_an_obj}=await mod('dig'),{punish}=await mod('read');
const {set_itimeout}=await mod('potion'),{Flying,Levitation}=await mod('youprop');
const {set_levltyp}=await mod('mkmaze'),{getRngLog}=await mod('rng');
const {ONAMES:O}=await mod('objects_data'),{ART_STING}=await mod('artilist_data');
const {pline,bot}=await mod('display');
const deadline=setTimeout(()=>{console.error('55 second worker bound');process.exit(2);},55000),reports=[];
const state=()=>({x:G.game.u.ux,y:G.game.u.uy,trapped:G.game.u.utrap,type:G.game.u.utraptype,
    hp:G.game.u.uhp,moved:!!G.game.u.umoved,success:G.game.domove_succeeded||0,
    flight:!!Flying(),levitation:!!Levitation(),blocked:{...G.game.u.blocked},
    rng:[...getRngLog()],text:messages()});
async function check(name,fn){const r={name};try{await fn(r);r.pass=true;}
    catch(e){r.pass=false;r.error=e.message.slice(0,600);}reports.push(r);console.log(r.pass?'PASS':'FAIL',name,r.error||'');}
async function start(){const run=await setup();G.game.flags.paranoia_bits=0;
    G.game.u.uhp=G.game.u.uhpmax=1000;G.game.u.umoved=false;
    G.game.u.dx=1;G.game.u.dy=G.game.u.dz=0;return run;}
async function walk(){G.game.context.move=1;G.game.domove_attempting=C.DOMOVE_WALK;await domove();}
async function pit({joined=false,seen=true,count=3}={}){
    await start();const old=maketrap(x,y,C.PIT),target=maketrap(x+1,y,C.PIT);
    if(seen)T.seetrap(target);await T.dotrap(old,C.FORCETRAP);
    if(joined){const pick=mksobj(O.PICK_AXE,false,false);addinv(pick);setuwep(pick);await use_pick_axe2(pick);
        assert.ok(T.conjoined_pits(target,old,true));}
    T.set_utrap(count,C.TT_PIT);clearMessages();seed(2);return {old,target};
}
for(const joined of [false,true])for(const seen of [false,true])
await check(`walk ${joined?'joined':'unjoined'} ${seen?'seen':'unseen'} pit attempts climb`,async r=>{
    await pit({joined,seen});r.before=state();await walk();r.after=state();
    assert.equal(r.after.x,x);assert.equal(r.after.y,y);assert.equal(r.after.trapped,2);
    assert.equal(r.after.hp,r.before.hp);assert.equal(r.after.moved,false);assert.equal(r.after.success,0);
    assert.equal(r.after.rng.length,1);assert.match(r.after.rng[0],/^rn2\(2\)=[01]$/);assert.match(r.after.text,/still in a pit/);
    assert.doesNotMatch(r.after.text,/adjacent pit|debris/);
});
for(const joined of [false,true])await check(`escape remains in ${joined?'joined':'unjoined'} pit then next walk enters`,async r=>{
    await pit({joined,count:1});await walk();r.escape=state();
    assert.equal(r.escape.x,x);assert.equal(r.escape.trapped,0);assert.equal(r.escape.type,C.TT_NONE);
    assert.equal(r.escape.moved,false);assert.match(r.escape.text,/crawl to the edge/);
    clearMessages();seed(2);await walk();r.next=state();
    assert.equal(r.next.x,x+1);assert.equal(r.next.moved,true);assert.equal(r.next.success,C.DOMOVE_WALK);
    assert.match(r.next.text,/fall into a pit/);assert.doesNotMatch(r.next.text,/adjacent pit|debris/);
});
for(const kind of ['seen-pit','unseen-pit','seen-web','none'])
await check('direct destination contract '+kind,async r=>{
    const {target}=await pit({seen:kind!=='unseen-pit'});
    if(kind==='seen-web')target.ttyp=C.WEB; // explicit malformed route contrast, real trap record
    r.result=await trapmove(x+1,y,kind==='none'?null:target);r.after=state();
    assert.equal(r.result,kind==='seen-pit');assert.equal(r.after.x,x);
    assert.equal(r.after.trapped,kind==='seen-pit'?3:2);
    if(kind==='seen-pit')assert.deepEqual(r.after.rng,[]);
    else {assert.equal(r.after.rng.length,1);assert.match(r.after.rng[0],/^rn2\(2\)=[01]$/);}
});
await check('untrapped movement negative',async r=>{await start();clearMessages();seed(2);await walk();r.after=state();
    assert.equal(r.after.x,x+1);assert.equal(r.after.trapped,0);assert.equal(r.after.moved,true);});
for(const mounted of [false,true])for(const count of [1,3])
await check(`bear diagonal ${mounted?'mounted':'hero'} ${count}`,async r=>{
    await start();if(mounted)await mount();G.game.u.dx=G.game.u.dy=1;
    T.set_utrap(count,C.TT_BEARTRAP);clearMessages();seed(2);r.result=await trapmove(x+1,y+1,null);r.after=state();
    assert.equal(r.result,false);assert.equal(r.after.trapped,count-1);assert.deepEqual(r.after.rng,[]);
    assert.match(r.after.text,mounted?/Your pony is caught in a bear trap/:/You are caught in a bear trap/);
    if(count===1)assert.match(r.after.text,mounted?/Your pony finally lurches free/:/You finally wriggle free/);
});
await check('bear orthogonal consumes only escape roll',async r=>{
    await start();T.set_utrap(3,C.TT_BEARTRAP);clearMessages();seed(2);
    await trapmove(x+1,y,null);r.after=state();assert.equal(r.after.rng.length,1);
    assert.match(r.after.rng[0],/^rn2\(5\)=/);assert.equal(r.after.trapped,3-(r.after.rng[0]==='rn2(5)=0'?1:0));
});
for(const mounted of [false,true])for(const count of [1,3])
await check(`web ${mounted?'mounted':'hero'} ${count}`,async r=>{
    await start();if(mounted)await mount();T.set_utrap(count,C.TT_WEB);clearMessages();seed(2);
    assert.equal(await trapmove(x+1,y,null),false);r.after=state();assert.equal(r.after.trapped,count-1);
    assert.deepEqual(r.after.rng,[]);assert.match(r.after.text,count===1
        ?(mounted?/Your pony breaks out of the web/:/You disentangle yourself/)
        :(mounted?/Your pony is stuck to the web/:/You are stuck to the web/));
});
for(const held of ['sting-wielded','sting-carried','plain-wielded'])await check('web weapon '+held,async r=>{
    await start();const web=maketrap(x,y,C.WEB),weapon=mksobj(O.ELVEN_DAGGER,false,false);addinv(weapon);
    if(held!=='plain-wielded'){oname(weapon,'Sting',0);assert.equal(weapon.oartifact,ART_STING);}
    if(held!=='sting-carried')setuwep(weapon);T.set_utrap(5,C.TT_WEB);clearMessages();seed(2);
    await walk();r.after=state();assert.equal(r.after.x,x);assert.ok(G.game.level.traps.includes(web));
    assert.equal(r.after.trapped,held==='sting-wielded'?0:4);assert.deepEqual(r.after.rng,[]);
    if(held==='sting-wielded'){assert.match(r.after.text,/Sting cuts through the web!/);assert.equal(r.after.type,C.TT_NONE);}
    else assert.doesNotMatch(r.after.text,/Sting cuts/);
});
for(const property of ['HFlying','HLevitation'])for(const direct of [false,true])
await check(`${property} ${direct?'owner leaves reset to caller':'walk resumes after escape'}`,async r=>{
    await start();set_itimeout(property,100);T.set_utrap(1,C.TT_WEB);
    assert.equal(property==='HFlying'?!!Flying():!!Levitation(),false);
    clearMessages();seed(2);if(direct)await trapmove(x+1,y,null);else await walk();r.after=state();
    assert.equal(r.after.x,x);assert.equal(r.after.trapped,0);
    // C pline -> flush_screen -> bot -> near_capacity/weight_cap can unblock
    // levitation before the caller reset. Flight has no such capacity override.
    assert.equal(property==='HFlying'?r.after.flight:r.after.levitation,property==='HLevitation'||!direct);
    assert.equal(r.after.type,direct?C.TT_WEB:C.TT_NONE);
    if(!direct&&property==='HFlying')assert.match(r.after.text,/You can fly\./);
    if(property==='HLevitation')assert.doesNotMatch(r.after.text,/start to float/);
});
for(const mounted of [false,true])for(const destination of ['lava','land','edge'])
await check(`lava ${mounted?'mounted':'hero'} ${destination}`,async r=>{
    await start();if(mounted)await mount();const startx=G.game.u.ux;
    if(destination==='lava')set_levltyp(startx+1,y,C.LAVAPOOL);
    const count=destination==='edge'?257:258;T.set_utrap(count,C.TT_LAVA);clearMessages();seed(2);
    assert.equal(await trapmove(startx+1,y,null),false);r.after=state();
    assert.equal(r.after.trapped,destination==='lava'?258:destination==='edge'?0:257);
    assert.equal(r.after.x,startx);assert.equal(r.after.moved,true);assert.deepEqual(r.after.rng,[]);
    assert.match(r.after.text,mounted?/Your pony is stuck in the lava/:/You are stuck in the lava/);
    if(destination==='edge')assert.match(r.after.text,mounted?/You lead your pony to the edge/:/You pull yourself to the edge/);
});
for(const mounted of [false,true])for(const count of [1,3])
await check(`floor ${mounted?'mounted':'hero'} ${count}`,async r=>{
    await start();if(mounted)await mount();T.set_utrap(count,C.TT_INFLOOR);clearMessages();seed(2);
    assert.equal(await trapmove(x+1,y,null),false);r.after=state();assert.equal(r.after.trapped,count-1);
    assert.match(r.after.text,count===1?(mounted?/finally lurches free/:/finally wriggle free/)
        :(mounted?/Your pony is stuck in the floor/:/You are stuck in the floor/));
});
for(const mode of ['within','outside','free'])await check('buried ball '+mode,async r=>{
    await start();const ball=mksobj(O.HEAVY_IRON_BALL,false,false);
    await punish(ball);await bury_an_obj(ball,null);assert.ok(G.game.level.buriedobjs.includes(ball));
    T.set_utrap(mode==='free'?1:3,C.TT_BURIEDBALL);clearMessages();seed(2);
    r.result=await trapmove(x+(mode==='within'?1:2),y,null);r.after=state();
    assert.equal(r.result,mode==='within');assert.equal(r.after.trapped,mode==='within'?3:mode==='outside'?2:0);
    assert.match(r.after.text,mode==='within'?/within the chain's reach/:mode==='outside'?/chained to the buried ball/:/wrench the ball free/);
    if(mode==='free'){assert.equal(G.game.u.uball,ball);assert.ok(G.game.u.uchain);assert.ok(!G.game.level.buriedobjs.includes(ball));}
});
await check('quiet struggle suppresses repeat feedback',async r=>{
    await start();G.game.flags.verbose=false;T.set_utrap(3,C.TT_WEB);clearMessages();seed(2);
    await trapmove(x+1,y,null);r.after=state();assert.equal(r.after.trapped,2);assert.equal(r.after.text,'');
});
for(const typ of [C.TT_NONE,99])await check('invalid trap diagnostic '+typ,async r=>{
    await start();T.set_utrap(2,typ);clearMessages();seed(2);await trapmove(x+1,y,null);
    r.log=G.game.impossible_log;assert.ok(r.log?.some(s=>s.includes(typ===0?'trapped in nothing':'stuck in unknown trap')));
});
await check('pending escape feedback precedes caller flight reset',async r=>{
    const run=await start();set_itimeout('HFlying',100);T.set_utrap(1,C.TT_WEB);
    await bot();await pline('A long message keeps this line occupied before the next escape attempt begins.');
    let ready,release,timer,finished=false;const pending=new Promise(resolve=>{ready=resolve;});
    run._display.onEmptyQueue=()=>{r.pending=state();ready();return new Promise(resolve=>{release=resolve;});};
    const work=walk().then(()=>{finished=true;});
    try{await Promise.race([pending,work.then(()=>{throw Error('no pending escape feedback');}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('pending timeout')),2000);})]);
        await setImmediate();assert.equal(finished,false);assert.equal(r.pending.trapped,0);
        assert.equal(r.pending.type,C.TT_WEB);assert.equal(r.pending.flight,false);assert.equal(r.pending.x,x);
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;if(release)release(32);await work;}
    r.after=state();assert.equal(r.after.flight,true);assert.equal(r.after.type,C.TT_NONE);
});
clearTimeout(deadline);assert.equal(reports.length,44);
const report={evidence:'Constructed source controls, actual exported domove/trapmove and real producers; no native or ordinary claim',
    passed:reports.filter(r=>r.pass).length,total:reports.length,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
