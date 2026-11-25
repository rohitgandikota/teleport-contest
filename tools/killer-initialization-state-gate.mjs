// C decl.c903/1117 and read.c2638-3016, through actual runtime owners.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {game,resetGame} from '../js/gstate.js';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {do_genocide,seffects} from '../js/read.js';
import {readobjnam} from '../js/objnam.js';
import {addinv} from '../js/invent.js';
import {polymon} from '../js/polyself.js';
import {delayed_killer,find_delayed_killer,dealloc_killer} from '../js/end.js';
import {make_stoned} from '../js/potion.js';
import {dosave0,gamestate_decode} from '../js/save.js';
import {dorecover} from '../js/restore.js';
import {pline} from '../js/display.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {POLYMORPH,STONED,SLIMED,KILLED_BY,KILLED_BY_AN,G_GENOD} from '../js/const.js';
const empty=()=>({next:null,id:0,format:0,name:''});
const options={seed:99812,datetime:'20000110090000',moves:' ',
 nethackrc:'OPTIONS=name:Killers,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\nOPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'};
async function setup({poly=false,race='human',storage=new InMemoryStorage()}={}){
 const run=await runSegment({...options,storage,nethackrc:options.nethackrc.replace('race:human','race:'+race).replace('align:neutral','align:'+(race==='orc'?'chaotic':'neutral'))});
 run._display.clearInputQueue();run._display.onEmptyQueue=()=>32;game._preNhgetchHook=null;
 if(poly)assert.equal(await polymon(P.PM_HILL_GIANT),1);
 game._toplines='';game._msg_history=[];game._toplin=0;game._pending_message='';game._win_stop=false;game.iflags.last_msg=0;
 return {run,storage};
}
function keys(run,text){for(const c of text)run._display.pushKey(c.charCodeAt(0));}
const messages=()=>[...game._msg_history,game._toplines].join('\n');
test('resetGame creates the complete zeroed kinfo with a fresh owner',()=>{
 const first=resetGame();assert.deepEqual(first.killer,empty());assert.equal(first,game);
 const old=first.killer;delayed_killer(STONED,KILLED_BY,'old stone');const record=old.next;
 const second=resetGame();assert.equal(second,game);assert.notEqual(second,first);
 assert.notEqual(second.killer,old);assert.deepEqual(second.killer,empty());
 assert.equal(old.next,record);assert.equal(second.lastinvnr,51);
});
test('ordinary new-game startup supplies the zeroed owner',async()=>{
 await setup();assert.deepEqual(game.killer,empty());assert.equal(game.u.umortality||0,0);
});
test('a second real new game clears an actual pending petrification cause',async()=>{
 await setup();await make_stoned(100,null,KILLED_BY_AN,'a cockatrice');
 const previous=game.killer;assert.equal(find_delayed_killer(STONED).name,'a cockatrice');
 await setup();assert.notEqual(game.killer,previous);assert.deepEqual(game.killer,empty());
 assert.equal(find_delayed_killer(STONED),null);
});
test('delayed owner preserves head identity, updates existing ID, and unlinks in order',async()=>{
 await setup();const head=game.killer;
 delayed_killer(STONED,KILLED_BY_AN,'a cockatrice');const stone=find_delayed_killer(STONED);
 delayed_killer(SLIMED,KILLED_BY,'green slime');const slime=find_delayed_killer(SLIMED);
 assert.equal(game.killer,head);assert.equal(head.next,slime);assert.equal(slime.next,stone);
 delayed_killer(STONED,KILLED_BY,'second cause');assert.equal(find_delayed_killer(STONED),stone);
 assert.equal(stone.name,'second cause');assert.equal(stone.format,KILLED_BY);assert.equal(head.name,'');
 dealloc_killer(stone);assert.equal(slime.next,null);dealloc_killer(slime);assert.equal(head.next,null);
 dealloc_killer(null);assert.equal(game.killer,head);
});
for(const [how,answer,name,format]of [[1,'human','scroll of genocide',KILLED_BY_AN],[3,null,'genocidal confusion',KILLED_BY],[5,'human','imperious order',KILLED_BY_AN]])
 test(`public do_genocide ${how} retains a live form and source killer`,async()=>{
  const {run}=await setup({poly:true});const head=game.killer,mh=game.u.mh;
  if(answer)keys(run,answer+'\r');await do_genocide(how);
  assert.equal(game.u.uhp,-1);assert.equal(game.u.mh,mh);assert.equal(game.u.umortality||0,0);
  assert.equal(game.killer,head);assert.equal(head.name,'');
  const pending=find_delayed_killer(POLYMORPH);assert.ok(pending);
  assert.equal(pending.name,name);assert.equal(pending.format,format);assert.equal(pending.next,null);
  assert.match(messages(),/feel dead inside/);
 });
test('cancelled genocide leaves HP and the existing head unchanged',async()=>{
 const {run}=await setup({poly:true});const head=game.killer,hp=game.u.uhp;keys(run,'none\r');
 await do_genocide(1);assert.equal(game.killer,head);assert.equal(game.u.uhp,hp);
 assert.equal(find_delayed_killer(POLYMORPH),null);assert.equal(game.u.umortality||0,0);
});
test('other species genocide leaves hero killer state unchanged',async()=>{
 const {run}=await setup({poly:true});const head=game.killer,hp=game.u.uhp;keys(run,'goblin\r');
 await do_genocide(1);assert.ok(game.mvitals[P.PM_GOBLIN].mvflags&G_GENOD);
 assert.equal(game.killer,head);assert.equal(game.u.uhp,hp);assert.equal(find_delayed_killer(POLYMORPH),null);
});
test('immediate self-genocide completes actual wizard death recovery',async()=>{
 const {run}=await setup();const head=game.killer;keys(run,'human\r');await do_genocide(1);
 assert.equal(game.u.umortality,1);assert.ok(game.u.uhp>0);assert.equal(game.killer,head);
 assert.equal(head.name,'');assert.equal(head.format,KILLED_BY_AN);
 assert.match(messages(),/OK, so you don't die/);
});
test('blessed scroll reaches the private class owner through seffects',async()=>{
 const {run}=await setup({poly:true,race:'orc'});const scroll=await readobjnam('blessed scroll of genocide',null);await addinv(scroll);
 const head=game.killer;keys(run,'  o\r');await seffects(scroll);
 assert.equal(game.u.uhp,-1);assert.ok(game.u.mh>0);assert.equal(game.u.umortality||0,0);
 assert.equal(game.killer,head);assert.equal(head.name,'scroll of genocide');assert.equal(head.format,KILLED_BY_AN);
 assert.equal(find_delayed_killer(POLYMORPH),null,'C class branch does not add a delayed record');
 assert.ok(game.mvitals[P.PM_ORC].mvflags&G_GENOD);
});
test('genocide feedback is awaited before HP and killer mutation',async()=>{
 const {run}=await setup({poly:true});const hp=game.u.uhp,head=game.killer;
 await pline('An existing message occupies enough of the line to require acknowledgement.');
 let reached,release;const waiting=new Promise(resolve=>{reached=resolve;});
 run._display.onEmptyQueue=()=>{reached();return new Promise(resolve=>{release=resolve;});};
 const operation=do_genocide(3);const pending=await Promise.race([waiting.then(()=>true),operation.then(()=>false)]);
 const during={hp:game.u.uhp,head:structuredClone(game.killer),mortality:game.u.umortality||0};
 run._display.onEmptyQueue=()=>32;release?.(32);await operation;
 assert.equal(pending,true);assert.deepEqual(during,{hp,head:empty(),mortality:0});
 assert.equal(game.killer,head);assert.equal(game.u.uhp,-1);assert.ok(find_delayed_killer(POLYMORPH));
});
test('real save and recovery preserve an empty killer owner',async()=>{
 await setup();assert.equal(await dosave0(),true);assert.equal(await dorecover(),true);
 assert.deepEqual(game.killer,empty());assert.equal(game.u.umortality||0,0);
});
test('new-process startup restores the saved chain instead of keeping a new empty owner',async()=>{
 const {storage}=await setup({poly:true});await make_stoned(100,null,KILLED_BY_AN,'a cockatrice');
 await do_genocide(3);const expected=structuredClone(game.killer),previous=game.killer;
 assert.equal(await dosave0(),true);
 const encoded=gamestate_decode(JSON.parse(storage.getItem('save:wizard')));
 assert.deepEqual(encoded.killer,expected);
 await runSegment({...options,storage,moves:'    \x1b\x1b'});
 assert.notEqual(game.killer,previous);assert.deepEqual(game.killer,expected);
 assert.equal(game.u.uhp,-1);assert.ok(game.u.mh>0);
 assert.equal(find_delayed_killer(POLYMORPH).next.id,STONED);
});
