// Constructed controls use real wishes, status/form/region/queue producers.
// No replacement runtime helpers or random values are installed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { getRngLog } from '../js/rng.js';
import { display_nhwindow_message, pline, newsym, glyph_at } from '../js/display.js';
import { dipfountain, dryup } from '../js/fountain.js';
import { hands_obj, money_cnt } from '../js/invent.js';
import { make_blinded, make_glib } from '../js/potion.js';
import { Blind, Glib, Hallucination } from '../js/youprop.js';
import { create_gas_cloud } from '../js/region.js';
import { cmap_names } from '../js/drawing_data.js';
import { cmdq_add_key, cmdq_copy } from '../js/cmd.js';
import { in_town } from '../js/hack.js';
import { PMNAMES } from '../js/monst_data.js';
import { splitobj } from '../js/mkobj.js';
import { cansee } from '../js/vision.js';
import { CQ_CANNED, CQ_REPEAT, CMDQ_KEY, FOUNTAIN, ROOM, COLNO, ROWNO } from '../js/const.js';

const rc='OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
    +'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
const fountain=' \x17fountain\n';
const ruby=' \x17cursed ruby\n\x17fountain\n';
const dog=fountain+'#polyself\ndog\n  ';
const town=' \x16?\n w  \x17fountain\n';
let reads,inputMessages;
function feed(run,text) {
    reads=0;inputMessages=[];run._display.onEmptyQueue=async()=>{
        await setImmediate();inputMessages.push(game._pending_message||game._toplines);assert.ok(reads<text.length,'unexpected physical input');
        return text.charCodeAt(reads++);
    };
}
async function settle(run) {feed(run,' '.repeat(32));await display_nhwindow_message();feed(run,'');}
async function boot(seed=12001,moves=fountain) {
    const run=await runSegment({seed,moves,datetime:'20000112093000',nethackrc:rc,storage:new InMemoryStorage()});
    resetInputState();await settle(run);return run;
}
const here=()=>game.level.at(game.u.ux,game.u.uy);
const keys=q=>(cmdq_copy(q)||[]).filter(e=>e.typ===CMDQ_KEY).map(e=>e.key);
const guards=()=>game.level.monsters.filter(m=>[PMNAMES.PM_WATCHMAN,PMNAMES.PM_WATCH_CAPTAIN].includes(m.mnum)&&m.mhp>0);
async function runDip(run,obj) {feed(run,' '.repeat(32));const i=getRngLog().length;await dipfountain(obj);return getRngLog().slice(i);}
await test('non-fountain short-circuits without a draw, query or terrain change',async()=>{
    await boot(12001,' ');const typ=here().typ,before=[...getRngLog()];
    await dryup(game.u.ux,game.u.uy,true);assert.equal(here().typ,typ);assert.deepEqual(getRngLog(),before);assert.equal(reads,0);
});
await test('unwarned failed chance leaves the fountain and queue untouched',async()=>{
    await boot(12000);const i=getRngLog().length;
    await dryup(game.u.ux,game.u.uy,true);assert.equal(here().typ,FOUNTAIN);
    assert.deepEqual(getRngLog().slice(i),['rn2(3)=1']);assert.equal(reads,0);
});
await test('visible non-hero drying prints, changes terrain and fountain count with one draw',async()=>{
    await boot();const count=Array.from({length:COLNO-1},(_,x)=>Array.from({length:ROWNO},(_,y)=>game.level.at(x+1,y).typ)).flat().filter(t=>t===FOUNTAIN).length,i=getRngLog().length;
    await dryup(game.u.ux,game.u.uy,false);
    assert.equal(game._toplines,'The fountain dries up!');assert.equal(here().typ,ROOM);
    assert.equal(game.level.flags.nfountains,count-1);assert.equal(here().looted,0);assert.equal(here().blessedftn,0);
    assert.equal(reads,0);assert.deepEqual(getRngLog().slice(i),['rn2(3)=0']);
});
await test('real timed blindness suppresses drying feedback without suppressing terrain change',async()=>{
    const run=await boot();await make_blinded(100,false);await settle(run);assert.ok(Blind());assert.ok(!cansee(game.u.ux,game.u.uy));
    const before=game._toplines,i=getRngLog().length;await dryup(game.u.ux,game.u.uy,false);
    assert.equal(here().typ,ROOM);assert.equal(game._toplines,before);assert.deepEqual(getRngLog().slice(i),['rn2(3)=0']);
});
for(const damage of [0,4])await test(`real ${damage?'poison':'steam'} cloud: glyph-specific drying feedback`,async()=>{
    const run=await boot();feed(run,' '.repeat(16));await create_gas_cloud(game.u.ux,game.u.uy,1,damage);
    newsym(game.u.ux,game.u.uy);await settle(run);
    assert.deepEqual(glyph_at(game.u.ux,game.u.uy),{kind:'cmap',cmap:damage?cmap_names.S_poisoncloud:cmap_names.S_cloud});
    const before=game._toplines,i=getRngLog().length;await dryup(game.u.ux,game.u.uy,false);
    assert.equal(here().typ,ROOM);assert.equal(game._toplines,damage?'The fountain dries up!':before);
    assert.deepEqual(getRngLog().slice(i),['rn2(3)=0']);
});
for(const answer of ['n','y'])await test(`physical wizard ${answer} is recorded for repeat before return`,async()=>{
    const run=await boot();feed(run,answer);await dryup(game.u.ux,game.u.uy,true);
    assert.equal(reads,1);assert.equal(keys(CQ_REPEAT).at(-1),answer);
    assert.equal(here().typ,answer==='y'?ROOM:FOUNTAIN);
});
for(const answer of ['n','y'])await test(`queued wizard ${answer} is consumed without physical input`,async()=>{
    await boot();cmdq_add_key(CQ_CANNED,answer);await dryup(game.u.ux,game.u.uy,true);
    assert.equal(reads,0);assert.deepEqual(keys(CQ_CANNED),[]);assert.equal(here().typ,answer==='y'?ROOM:FOUNTAIN);
});
await test('drying waits for a real More before changing terrain',async()=>{
    const run=await boot();await pline('An earlier message remains on the top line while the fountain is still intact.');let release,entered=false,done=false;
    const wait=new Promise(resolve=>release=resolve);run._display.onEmptyQueue=async()=>{entered=true;await wait;return 32;};
    const pending=dryup(game.u.ux,game.u.uy,false).then(()=>done=true);await setImmediate();
    try{assert.ok(entered);assert.equal(done,false);assert.equal(here().typ,FOUNTAIN);}finally{release();}
    await pending;assert.equal(here().typ,ROOM);
});
await test('wizard query remains pending until actual answer is supplied',async()=>{
    const run=await boot();let release,entered=false,done=false;
    const wait=new Promise(resolve=>release=resolve);run._display.onEmptyQueue=async()=>{entered=true;return await wait;};
    const pending=dryup(game.u.ux,game.u.uy,true).then(()=>done=true);await setImmediate();
    try{assert.ok(entered);assert.equal(done,false);assert.equal(here().typ,FOUNTAIN);assert.deepEqual(keys(CQ_REPEAT),[]);}finally{release(110);}
    await pending;assert.equal(here().typ,FOUNTAIN);assert.equal(keys(CQ_REPEAT).at(-1),'n');
});
async function warnedTown() {
    const run=await boot(12000,town);assert.ok(in_town(game.u.ux,game.u.uy));
    assert.ok(guards().length>0&&guards().every(m=>m.mpeaceful));
    for(let n=0;n<12&&!(here().looted&2);n++) {feed(run,' '.repeat(16));await dryup(game.u.ux,game.u.uy,true);}
    assert.ok(here().looted&2);assert.equal(here().typ,FOUNTAIN);await settle(run);return run;
}
await test('real Minetown first warning leaves peaceful watch and fountain intact',async()=>{
    await warnedTown();assert.ok(guards().every(m=>m.mpeaceful));assert.ok(here().looted&2);
});
await test('warned town decline keeps peaceful watch and records n',async()=>{
    const run=await warnedTown();feed(run,'n');const i=getRngLog().length;await dryup(game.u.ux,game.u.uy,true);
    assert.ok(guards().every(m=>m.mpeaceful));assert.equal(here().typ,FOUNTAIN);assert.equal(keys(CQ_REPEAT).at(-1),'n');
    assert.equal(getRngLog().length-i,1);
});
await test('warned town acceptance dries first then angers the real watch',async()=>{
    const run=await warnedTown();feed(run,'y'+' '.repeat(16));const i=getRngLog().length;
    await dryup(game.u.ux,game.u.uy,true);assert.equal(here().typ,ROOM);
    assert.ok(guards().every(m=>!m.mpeaceful));assert.equal(getRngLog().length-i,1);
});
await test('non-hero warned town drying does not anger watch or ask wizard query',async()=>{
    await warnedTown();await dryup(game.u.ux,game.u.uy,false);
    assert.equal(here().typ,ROOM);assert.ok(guards().every(m=>m.mpeaceful));assert.equal(reads,0);
});
await test('real dog form outcome 26 names the foreleg and awaits both message pages',async()=>{
    const run=await boot(12047,dog);assert.equal(game.u.umonnum,PMNAMES.PM_DOG);
    const log=await runDip(run,hands_obj);assert.ok(log.includes('rnd(30)=26'));
    // Read the live message at the real physical More boundary.
    assert.ok(inputMessages.some(s=>s.includes('your foreleg')));
});
await test('human outcome 26 retains arm wording',async()=>{
    const run=await boot(12001,ruby);const log=await runDip(run,game.invent[0]);
    assert.ok(log.includes('rnd(30)=26'));assert.ok(inputMessages.some(s=>s.includes('your arm')));
});
await test('real hallucination uses hliquid during successful uncursing',async()=>{
    const run=await boot(12008,ruby+'#wizintrinsic\n100h\n ');assert.ok(Hallucination());
    const obj=game.invent[0];assert.ok(obj.cursed);const log=await runDip(run,obj);
    assert.ok(log.includes('rnd(30)=19'));assert.equal(obj.cursed,0);assert.equal(game._toplines,'The ink glows for a moment.');
});
await test('sober uncursing retains the water message and object identity',async()=>{
    const run=await boot(12008,ruby);const obj=game.invent[0],id=obj.o_id;
    const log=await runDip(run,obj);assert.ok(log.includes('rnd(30)=19'));assert.equal(obj.cursed,0);
    assert.equal(game.invent[0],obj);assert.equal(obj.o_id,id);assert.equal(game._toplines,'The water glows for a moment.');
});
await test('real blindness uncurses without a visible glow',async()=>{
    const run=await boot(12008,ruby);await make_blinded(100,false);await settle(run);const obj=game.invent[0],before=game._toplines;
    const log=await runDip(run,obj);assert.ok(log.includes('rnd(30)=19'));assert.equal(obj.cursed,0);assert.equal(game._toplines,before);
});
await test('uncursed bare hands outcome 18 reports loss without creating a curse',async()=>{
    const run=await boot(12005);const log=await runDip(run,hands_obj);
    assert.ok(log.includes('rnd(30)=18'));assert.ok(!hands_obj.cursed);assert.ok(game._toplines.includes('A feeling of loss'));
});
await test('real slippery fingers are washed off before the early-return draw',async()=>{
    const run=await boot(12001);make_glib(100);assert.ok(Glib());const log=await runDip(run,hands_obj);
    assert.equal(Glib(),false);assert.ok(log.some(x=>x.startsWith('rn2(2)=')));
});
await test('money_cnt source contract counts the first real split stack, not their sum',async()=>{
    await boot(12012,' \x17100 gold pieces\n');const gold=game.invent[0];assert.equal(gold.quan,100);
    const child=splitobj(gold,99);assert.equal(child.quan,99);assert.equal(money_cnt(game.invent),1);
});
// Last: baseline wrongly curses this process-global hands sentinel. Keep
// the failure without allowing it to contaminate later controls.
await test('bare hands outcome 16 never curses the shared hands object',async()=>{
    const run=await boot(12001);const log=await runDip(run,hands_obj);
    assert.ok(log.includes('rnd(30)=16'));assert.ok(!hands_obj.cursed);
});
