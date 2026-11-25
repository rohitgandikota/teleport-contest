// C travel contracts through public owners and real state producers.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {game as g} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {findtravelpath,is_valid_travelpt,crawl_destination,end_running,classify_terrain,
    TRAVP_TRAVEL as TRAVEL,TRAVP_VALID as VALID,TRAVP_GUESS as GUESS} from '../js/hack.js';
import {set_levltyp} from '../js/mkmaze.js';
import {vision_reset,vision_recalc,couldsee} from '../js/vision.js';
import {set_itimeout,make_blinded} from '../js/potion.js';
import {Blind} from '../js/youprop.js';
import {can_ooze} from '../js/monmove.js';
import {mksobj} from '../js/mkobj.js';
import {addinv_nomerge} from '../js/invent.js';
import {maketrap} from '../js/mklev.js';
import {seetrap} from '../js/trap.js';
import {show_glyph_cell,glyph_at,pline} from '../js/display.js';
import {cmap_names} from '../js/drawing_data.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {getRngLog} from '../js/rng.js';
import {setup,form,x,y,seed,clearMessages,messages} from './status-followup-test-setup.mjs';
import {hash} from './half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const results=[],bound=setTimeout(()=>{console.error('55 second source bound');process.exit(2);},55000);
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,700);}results.push(r);}
function terrain(xx,yy,typ=C.ROOM,mask=0){assert.ok(set_levltyp(xx,yy,typ));Object.assign(g.level.at(xx,yy),{seenv:255,lit:1,waslit:1,doormask:mask,roomno:0});}
function vision(){vision_reset();vision_recalc();}
async function start(){const run=await setup();
    for(let xx=x-5;xx<=x+5;xx++)for(let yy=y-5;yy<=y+5;yy++)terrain(xx,yy,C.STONE);
    for(let xx=x-4;xx<=x+4;xx++)for(let yy=y-4;yy<=y+4;yy++)terrain(xx,yy);
    g.context.run=8;g.context.travel=g.context.travel1=0;g.context.mv=1;g.multi=80;
    g.travelmap=null;g.flags.travel_debug=false;g.flags.runmode=C.RUN_TPORT;
    g.iflags.travelcc={x:x+2,y:y+2};g.u.tx=x+2;g.u.ty=y+2;g.u.dx=g.u.dy=0;
    vision();clearMessages();seed();return run;
}
function target(dx,dy){g.u.tx=x+dx;g.u.ty=y+dy;g.iflags.travelcc={x:g.u.tx,y:g.u.ty};}
function snapshot(){return {d:[g.u.dx,g.u.dy],run:g.context.run,multi:g.multi,travel:g.context.travel,
    travel1:g.context.travel1,mv:g.context.mv,map:g.travelmap?[...g.travelmap]:null,
    cc:g.iflags.travelcc,time:!!g.disp.time_botl,botl:!!g.disp.botl,text:messages(),rng:[...getRngLog()]};}

for(const mode of [TRAVEL,VALID,GUESS])for(const grid of [true,false])await check(`${grid?'grid bug':'human'} flood mode ${mode}`,async r=>{
    await start();if(grid)form(P.PM_GRID_BUG);vision();seed();
    r.found=await findtravelpath(mode);r.after=snapshot();assert.equal(r.found,true);
    assert.equal(Math.abs(g.u.dx)+Math.abs(g.u.dy),grid?1:2);assert.equal(getRngLog().length,0);
    assert.equal(g.travelmap.has(`${x},${y}`),true);
});

for(const grid of [true,false])await check(`${grid?'grid bug':'human'} isolated diagonal VALID`,async r=>{
    await start();for(let xx=x-4;xx<=x+4;xx++)for(let yy=y-4;yy<=y+4;yy++)terrain(xx,yy,C.STONE);
    terrain(x,y);terrain(x+1,y+1);target(1,1);if(grid)form(P.PM_GRID_BUG);vision();seed();
    r.found=await findtravelpath(VALID);r.after=snapshot();assert.equal(r.found,!grid);
});

for(const kind of ['ooze','ooze-dagger','ooze-bulky','human','xorn'])await check(`closed-door delay ${kind}`,async r=>{
    await start();target(2,0);terrain(x+1,y,C.DOOR,C.D_CLOSED);
    if(kind.startsWith('ooze'))form(P.PM_GRAY_OOZE);if(kind==='xorn')form(P.PM_XORN);
    if(kind==='ooze-bulky'||kind==='ooze-dagger')await addinv_nomerge(mksobj(kind==='ooze-bulky'?O.LONG_SWORD:O.DAGGER,false,false));
    vision();clearMessages();seed();r.canOoze=can_ooze(g.youmonst);r.found=await findtravelpath(TRAVEL);r.after=snapshot();
    assert.equal(r.found,true);assert.equal(g.u.dx,1);
    assert.equal(g.u.dy===0,['ooze','ooze-dagger','xorn'].includes(kind));assert.equal(getRngLog().length,0);
});

for(const mode of [TRAVEL,VALID])for(const same of [false,true])await check(`adjacent end_running mode ${mode} same ${same}`,async r=>{
    await start();target(same?0:1,0);g.context.travel=g.context.travel1=1;g.flags.time=g.flags.terrainstatus=true;
    classify_terrain();g.disp.time_botl=g.disp.botl=false;
    r.found=await findtravelpath(mode);r.after=snapshot();assert.equal(r.found,true);
    assert.equal(g.context.run,0);assert.equal(g.multi,0);assert.equal(g.travelmap,null);
    assert.equal(g.disp.time_botl,true);assert.equal(g.disp.botl,true);
    assert.equal(g.context.travel,mode===TRAVEL?0:1);assert.equal(g.context.travel1,mode===TRAVEL?0:1);
    assert.equal(g.context.mv,mode===TRAVEL?0:1);
});

for(const count of [-3,0,7])for(const andTravel of [false,true])await check(`shared end_running count ${count} travel ${andTravel}`,async r=>{
    await start();await findtravelpath(TRAVEL);assert.ok(g.travelmap);g.context.travel=g.context.travel1=1;
    g.multi=count;g.flags.time=g.flags.terrainstatus=true;g.disp.time_botl=g.disp.botl=false;
    end_running(andTravel);r.after=snapshot();assert.equal(g.multi,Math.min(0,count));assert.equal(g.travelmap,null);
    assert.equal(g.context.travel,andTravel?0:1);assert.equal(g.disp.time_botl,true);assert.equal(g.disp.botl,true);
});

for(const source of ['timeout-set','timeout-clear','setter-blind','sighted'])await check(`canonical sight ${source}`,async r=>{
    await start();target(3,0);
    if(source==='timeout-clear'||source==='setter-blind')await make_blinded(10,false);
    if(source==='timeout-set')set_itimeout('HBlinded',10);
    if(source==='timeout-clear')set_itimeout('HBlinded',0);
    vision();assert.ok(couldsee(x+1,y));
    for(let xx=x-4;xx<=x+4;xx++)for(let yy=y-4;yy<=y+4;yy++)g.level.at(xx,yy).seenv=0;
    // Valid mode expands from the hero; the endpoint is not an unseen seed.
    r.blind=Blind();r.cached=!!g.u.ublind;r.found=await findtravelpath(VALID);r.after=snapshot();assert.equal(r.found,!r.blind);
});

for(const mode of [TRAVEL,VALID,GUESS])await check(`same square without travel1 mode ${mode}`,async r=>{
    await start();target(0,0);g.u.dx=1;g.u.dy=-1;r.found=await findtravelpath(mode);r.after=snapshot();
    assert.equal(r.found,false);assert.deepEqual(r.after.d,[0,0]);assert.equal(g.multi,0);assert.equal(g.travelmap,null);
});

await check('visited route stops once and frees selection',async r=>{
    await start();target(3,0);assert.equal(await findtravelpath(TRAVEL),true);const next=`${x+g.u.dx},${y+g.u.dy}`;
    // The first real search marks the hero square. Move the real prior mark
    // into the next-step position by returning from a previous travel step.
    const old=[g.u.ux,g.u.uy];g.u.ux=x+g.u.dx;g.u.uy=y+g.u.dy;await findtravelpath(VALID);[g.u.ux,g.u.uy]=old;
    assert.ok(g.travelmap.has(next));clearMessages();r.found=await findtravelpath(TRAVEL);r.after=snapshot();
    assert.equal(r.found,true);assert.match(messages(),/stop, unsure which way to go/);assert.equal(g.multi,0);assert.equal(g.travelmap,null);assert.equal(g.context.run,8);
});

for(const blocked of [false,true])await check(`GUESS toward unseen target blocked ${blocked}`,async r=>{
    await start();target(7,0);if(blocked)for(let yy=y-5;yy<=y+5;yy++)terrain(x+1,yy,C.STONE);vision();seed();
    r.found=await findtravelpath(GUESS);r.after=snapshot();assert.equal(r.found,!blocked);
    if(!blocked)assert.equal(g.u.dx,1);
});

for(const type of [C.WEB,C.VIBRATING_SQUARE])await check(`travel trap policy ${type}`,async r=>{
    await start();target(2,0);const trap=maketrap(x+1,y,type);seetrap(trap);clearMessages();seed();
    r.found=await findtravelpath(TRAVEL);r.after=snapshot();assert.ok(r.found);assert.equal(g.u.dy===0,type===C.VIBRATING_SQUARE);
});

await check('VALID wrapper restores destination',async r=>{
    await start();const before=[g.u.tx,g.u.ty];r.found=await is_valid_travelpt(x+1,y);r.after=snapshot();
    assert.ok(r.found);assert.deepEqual([g.u.tx,g.u.ty],before);
    assert.equal(await is_valid_travelpt(x,y),true);assert.deepEqual([g.u.tx,g.u.ty],before);
});
for(const mode of [TRAVEL,GUESS])for(const crawl of [false,true])await check(`debug drawing mode ${mode} crawl ${crawl}`,async r=>{
    const run=await start();g.flags.travel_debug=true;g.flags.runmode=crawl?C.RUN_CRAWL:C.RUN_TPORT;
    target(mode===TRAVEL?2:7,0);const before=run._pendingAnimFrames.length;seed();
    r.found=await findtravelpath(mode);const frames=run._pendingAnimFrames.slice(before);
    r.frames=frames.length;r.hash=hash(frames);r.after=snapshot();assert.ok(r.found);assert.ok(frames.length>0);
    assert.ok(g.tmp_glyph==null);assert.equal(getRngLog().length,0);
    const guessFrames=frames.filter(f=>decodeScreen(f.screen).slice(1,22).flat().some(c=>c.ch==='2'&&c.color===1));
    r.guessFrames=guessFrames.length;
    if(mode===TRAVEL){assert.equal(frames.length,crawl?3:1);assert.equal(guessFrames.length,0);}
    else {assert.equal(guessFrames.length,crawl?5:1);assert.equal(frames.length,crawl?29:9);}
});

for(const mode of [TRAVEL,VALID])await check(`adjacent bulky ooze failed TEST_MOVE mode ${mode}`,async r=>{
    await start();target(1,0);terrain(x+1,y,C.DOOR,C.D_CLOSED);form(P.PM_GRAY_OOZE);
    await addinv_nomerge(mksobj(O.LONG_SWORD,false,false));vision();g.context.travel=g.context.travel1=1;
    assert.equal(can_ooze(g.youmonst),false);assert.equal(await crawl_destination(x+1,y),true);
    r.found=await findtravelpath(mode);r.after=snapshot();assert.ok(r.found);assert.equal(g.multi,0);
    assert.equal(g.context.run,mode===TRAVEL?8:0);assert.equal(g.travelmap,null);
});

for(const mode of [TRAVEL,VALID,GUESS])await check(`unreachable enclosed hero mode ${mode}`,async r=>{
    await start();target(3,0);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(dx||dy)terrain(x+dx,y+dy,C.STONE);
    vision();r.found=await findtravelpath(mode);r.after=snapshot();assert.equal(r.found,false);
    if(mode===GUESS){assert.deepEqual(r.after.d,[0,0]);assert.equal(g.multi,0);}else assert.equal(g.multi,80);
});

for(const blocked of [false,true])await check(`crawl diagonal form wall pass ${blocked}`,async r=>{
    await start();form(P.PM_GRID_BUG);assert.equal(await crawl_destination(x+1,y+1),false);
    form(P.PM_XORN);terrain(x+1,y+1,C.STONE);g.level.at(x+1,y+1).wall_info=blocked?C.W_NONPASSWALL:0;
    r.found=await crawl_destination(x+1,y+1);assert.equal(r.found,!blocked);
});

await check('visited pending message suspends after stop state',async r=>{
    const run=await start();target(3,0);await findtravelpath(TRAVEL);
    g.u.ux=x+g.u.dx;g.u.uy=y+g.u.dy;await findtravelpath(VALID);g.u.ux=x;g.u.uy=y;
    clearMessages();await pline('Prior travel feedback occupies almost the entire available top message line.');
    let release,atInput,done=false;const input=new Promise(resolve=>{atInput=resolve;});
    run._display.onEmptyQueue=()=>new Promise(resolve=>{release=resolve;atInput();});
    const operation=findtravelpath(TRAVEL).then(v=>{done=true;return v;});
    await Promise.race([input,operation]);assert.equal(done,false);assert.ok(release);
    r.pending=snapshot();assert.equal(g.multi,0);assert.equal(g.travelmap,null);assert.equal(g.context.run,8);
    release(32);assert.equal(await operation,true);assert.match(messages(),/stop, unsure which way to go/);
});

for(const stone of [false,true])await check(`VALID remembered glyph stone ${stone}`,async r=>{
    await start();g.level.at(x+1,y).seenv=0;
    show_glyph_cell(x+1,y,' ',8,false,0,stone?{kind:'cmap',cmap:cmap_names.S_stone}:{kind:'unexplored'});
    r.glyph=glyph_at(x+1,y);r.found=await is_valid_travelpt(x+1,y);assert.equal(r.found,!stone);
});

for(const value of [2,5])await check(`adjacent eel goodpos draw seed ${value}`,async r=>{
    await start();form(P.PM_GIANT_EEL);target(1,0);g.context.travel1=1;seed(value);
    r.found=await findtravelpath(TRAVEL);r.after=snapshot();assert.equal(r.found,true);
    assert.equal(getRngLog().length,1);assert.match(getRngLog()[0],/^rn2\(13\)/);
});

for(const first of [false,true])await check(`DEBUG adjacent early return travel1 ${first}`,async r=>{
    const run=await start();target(1,0);g.flags.travel_debug=true;g.context.travel1=first?1:0;
    r.found=await findtravelpath(TRAVEL);assert.ok(r.found);assert.equal(run._pendingAnimFrames.length,0);
});

clearTimeout(bound);const report={classification:'constructed source contracts, not ordinary input reach',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failures:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error}))}));
if(report.passed!==report.total)process.exitCode=1;
