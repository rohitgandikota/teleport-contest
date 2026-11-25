// Constructed C-source contracts, actual producers and owners, no native claim.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {setup,form,mount,clearMessages,messages,seed}=await import(new URL('tools/status-followup-test-setup.mjs',root));
const G=await mod('gstate'),C=await mod('const'),H=await mod('hack'),T=await mod('trap');
const {ONAMES:O}=await mod('objects_data'),{PMNAMES:P}=await mod('monst_data');
const {mksobj,place_object}=await mod('mkobj'),{maketrap}=await mod('mklev');
const {addinv,sobj_at}=await mod('invent'),{set_levltyp}=await mod('mkmaze');
const {set_itimeout}=await mod('potion'),{Blind}=await mod('youprop');
const {map_object,bot,pline}=await mod('display'),{getRngLog,rn2}=await mod('rng');
const {depth,get_level}=await mod('dungeon'),{random_teleport_level}=await mod('teleport');
const {domove}=await mod('cmd'),{makemon}=await mod('makemon');
let g;
const reports=[],deadline=setTimeout(()=>{console.error('55 second worker bound');process.exit(2);},55000);
async function check(name,fn){const r={name};try{await fn(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,700);}
    reports.push(r);console.log(r.pass?'PASS':'FAIL',name,r.error||'');}
async function start(dx=1,dy=0){const run=await setup();g=G.game;g.u.dx=dx;g.u.dy=dy;g.level.flags.sokoban_rules=0;return run;}
function pos(n=1){return {x:g.u.ux+n*g.u.dx,y:g.u.uy+n*g.u.dy};}
function rock(x=pos().x,y=pos().y){const o=mksobj(O.BOULDER,false,false);place_object(o,x,y);return o;}
function heavy(){addinv(mksobj(O.BOULDER,false,false));}
function soko(branch,rules){if(branch)g.u.uz={dnum:g.sokoban_dnum,dlevel:1};g.level.flags.sokoban_rules=rules?1:0;}
async function trap(typ,x=pos(2).x,y=pos(2).y){const t=await maketrap(x,y,typ);assert.ok(t);return t;}
function mark(o){map_object(o,true);}
async function push(r){clearMessages();r.result=await H.moverock();r.text=messages();r.rng=[...getRngLog()];return r.result;}
for(const branch of [false,true])for(const rules of [false,true])await check(`diagonal branch ${branch} rules ${rules}`,async r=>{
    await start(1,1);soko(branch,rules);heavy();const o=rock();seed(2);await push(r);
    assert.equal(r.result,rules?-1:0);assert.equal(o.ox,pos(rules?1:2).x);assert.equal(o.next_boulder,0);
    assert.equal(r.text.includes("won't roll diagonally"),rules);
});
for(const branch of [false,true])for(const rules of [false,true])await check(`giant fallback branch ${branch} rules ${rules}`,async r=>{
    await start();soko(branch,rules);form(P.PM_HILL_GIANT);const o=rock();set_levltyp(pos(2).x,pos(2).y,C.STONE);
    const luck=g.u.uluck,cheat=g.u.uconduct?.sokocheat||0;seed(2);await push(r);
    assert.equal(r.result,0);assert.equal(o.ox,pos().x);assert.equal(r.text.includes('and could pick it up'),!rules);
    assert.equal(g.u.uluck,luck-(rules?1:0));assert.equal(g.u.uconduct.sokocheat,cheat+(rules?1:0));
});
for(const rules of [false,true])await check('giant autopickup feedback rules '+rules,async r=>{
    await start();soko(true,rules);form(P.PM_HILL_GIANT);g.flags.autopickup=true;g.flags.pickup_types='';
    rock();set_levltyp(pos(2).x,pos(2).y,C.STONE);seed(2);await push(r);
    assert.equal(r.result,0);assert.equal(r.text.includes('easily pick it up'),!rules);
});
for(const [name,typ] of [['last pit',C.PIT],['last hole',C.HOLE],['spiked pit',C.SPIKED_PIT],['nonfloor',C.ARROW_TRAP]])await check('deltrap completion '+name,async r=>{
    await start();soko(true,true);const t=await trap(typ);seed(2);T.deltrap(t);
    r.rules=g.level.flags.sokoban_rules;assert.equal(g.level.traps.includes(t),false);
    assert.equal(!!r.rules,typ!==C.PIT&&typ!==C.HOLE);assert.deepEqual(getRngLog(),[]);
});
for(const [name,typ,made,building,want] of [
    ['remaining natural pit',C.PIT,false,false,true],['remaining natural hole',C.HOLE,false,false,true],
    ['remaining hero pit',C.PIT,true,false,false],['remaining spikes',C.SPIKED_PIT,false,false,false],
    ['generation guard',C.PIT,true,true,true],
])await check('completion '+name,async r=>{
    await start();soko(true,true);const t=await trap(C.PIT),other=await trap(typ,g.u.ux,g.u.uy+2);other.madeby_u=made?1:0;
    g.in_mklev=building;T.deltrap(t);r.rules=g.level.flags.sokoban_rules;assert.equal(!!r.rules,want);
});
await check('deltrap clears reciprocal and dangling conjoined bits',async r=>{
    await start();const a=await trap(C.PIT,32,10),b=await trap(C.SPIKED_PIT,33,10),other=await trap(C.PIT,33,11);
    a.conjoined=(1<<C.DIR_E)|(1<<C.DIR_N);b.conjoined=(1<<C.DIR_W)|(1<<C.DIR_S);other.conjoined=1<<C.DIR_N;
    T.deltrap(a);r.bits=[a.conjoined,b.conjoined,other.conjoined];assert.deepEqual(r.bits,[0,1<<C.DIR_S,1<<C.DIR_N]);
});
await check('nonpit deltrap does not clear neighboring pit bits',async r=>{
    await start();const a=await trap(C.ARROW_TRAP,32,10),b=await trap(C.PIT,33,10);b.conjoined=1<<C.DIR_W;
    T.deltrap(a);assert.equal(b.conjoined,1<<C.DIR_W);
});
for(const typ of [C.PIT,C.HOLE,C.SPIKED_PIT,C.TRAPDOOR])await check('push fills trap type '+typ,async r=>{
    await start();soko(true,true);const t=await trap(typ),o=rock();const loc=g.level.at(pos(2).x,pos(2).y);
    loc.wall_info|=C.W_NONDIGGABLE;seed(2);await push(r);
    assert.equal(r.result,0);assert.equal(g.level.traps.includes(t),false);assert.equal(g.level.objects.includes(o),false);
    assert.equal(!!g.level.flags.sokoban_rules,typ!==C.PIT&&typ!==C.HOLE);
    if([C.HOLE,C.TRAPDOOR].includes(typ)){assert.equal(loc.wall_info&C.W_NONDIGGABLE,0);assert.equal(loc.candig,1);}
});
await check('actual caller fills last pit then permits diagonal push',async r=>{
    await start();soko(true,true);await trap(C.PIT);rock();g.context.move=1;g.domove_attempting=C.DOMOVE_WALK;
    clearMessages();seed(2);await domove();assert.equal(g.u.ux,32);assert.equal(g.level.flags.sokoban_rules,0);
    g.u.dx=1;g.u.dy=1;const o=rock();await domove();r.text=messages();assert.equal(g.u.ux,33);assert.equal(g.u.uy,11);assert.equal(o.ox,34);
});
for(const travel of [false,true])await check('level teleport '+(travel?'migration':'same level'),async r=>{
    await start();const t=await trap(C.LEVEL_TELEP),o=rock();let chosen;
    for(let s=1;s<=30;s++){seed(s);const n=random_teleport_level();if((n!==depth(g.u.uz))===travel){chosen={s,n};break;}}
    assert.ok(chosen);const dest={};get_level(dest,chosen.n);r.chosen=chosen;r.destination=dest;seed(chosen.s);await push(r);
    assert.equal(r.result,0);assert.equal(o.next_boulder,0);
    if(travel){assert.equal(o.where,C.OBJ_MIGRATING);assert.equal(o.ox,dest.dnum);assert.equal(o.oy,dest.dlevel);assert.equal(o.owornmask,C.MIGR_RANDOM);assert.equal(t.tseen,1);assert.match(r.text,/suddenly it disappears/);}
    else{assert.equal(o.where,C.OBJ_FLOOR);assert.equal(o.ox,pos(2).x);assert.doesNotMatch(r.text,/disappears/);}
});
for(const globalHead of [false,true])await check('pending push global chain head '+globalHead,async r=>{
    const run=await start();const other=mksobj(O.ROCK,false,false);let o;
    if(globalHead){place_object(other,30,10);o=rock();}else{o=rock();place_object(other,30,10);}
    await bot();await pline('A long message keeps the line occupied before the boulder push.');seed(2);
    let release,signal,timer,finished=false;const arrived=new Promise(resolve=>{signal=resolve;});
    run._display.onEmptyQueue=()=>{r.pending={head:g.level.objects[0].o_id,rock:o.o_id,x:o.ox,tag:o.next_boulder};signal();return new Promise(resolve=>{release=resolve;});};
    const work=H.moverock().then(v=>{finished=true;r.result=v;});
    try{await Promise.race([arrived,work.then(()=>{throw Error('missing pending feedback');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('pending timeout')),2000);})]);
        await setImmediate();r.finished=finished;
    }finally{clearTimeout(timer);run._display.onEmptyQueue=()=>32;release?.(32);await work;}
    assert.equal(r.finished,false);assert.equal(r.pending.head,r.pending.rock);assert.equal(r.pending.x,32);assert.equal(o.ox,33);assert.equal(o.next_boulder,0);
});
await check('blind blocked helper uses property and tactile seenv',async r=>{
    await start();heavy();const o=rock();set_itimeout('HBlinded',20);assert.equal(Blind(),true);assert.equal(!!g.u.ublind,false);
    mark(o);g.level.at(32,10).seenv=0;set_levltyp(33,10,C.STONE);seed(2);await push(r);
    assert.equal(r.result,-1);r.seen=g.level.at(32,10).seenv;assert.ok(r.seen);assert.equal(o.next_boulder,0);
});
await check('blind unknown boulder discovers before pushing',async r=>{
    await start();const o=rock();set_itimeout('HBlinded',20);g.multi=9;seed(2);await push(r);
    assert.equal(r.result,-1);assert.match(r.text,/That feels like a boulder/);assert.equal(o.ox,32);assert.equal(g.multi,0);assert.equal(o.next_boulder,0);
});
await check('blind known boulder pushes normally',async r=>{
    await start();const o=rock();set_itimeout('HBlinded',20);mark(o);seed(2);await push(r);
    assert.equal(r.result,0);assert.equal(o.ox,33);assert.match(r.text,/With great effort/);
});
await check('stack second obstruction cleans all remaining names',async r=>{
    await start();heavy();const bottom=rock(),top=rock();seed(2);await push(r);
    assert.equal(r.result,-1);assert.equal(top.ox,33);assert.equal(bottom.ox,32);assert.equal(bottom.next_boulder,0);assert.equal(top.next_boulder,0);assert.match(r.text,/next boulder/);
});
await check('stack hole consumes only first and clears next names',async r=>{
    await start();await trap(C.HOLE);const bottom=rock(),top=rock();bottom.next_boulder=1;seed(2);await push(r);
    assert.equal(r.result,-1);assert.equal(g.level.objects.includes(top),false);assert.equal(bottom.ox,32);assert.equal(bottom.next_boulder,0);
});
for(const [name,prepare,want,text] of [
    ['levitating',()=>set_itimeout('HLevitation',20),-1,/leverage/],
    ['very small',()=>form(P.PM_GRID_BUG),0,/too small/],
    ['giant m-prefix',()=>{form(P.PM_HILL_GIANT);g.context.nopick=true;},0,/step over/],
    ['human m-prefix',()=>{g.context.nopick=true;},0,/squeeze yourself/],
    ['loaded m-prefix',()=>{heavy();g.context.nopick=true;},-1,/boulder in your way/],
])await check(name,async r=>{await start();const o=rock();await prepare();seed(2);await push(r);assert.equal(r.result,want);assert.match(r.text,text);assert.equal(o.ox,32);assert.equal(o.next_boulder,0);});
for(const typ of [C.IRONBARS,C.STONE,C.DOOR])await check('blocked destination type '+typ,async r=>{
    await start();heavy();rock();set_levltyp(33,10,typ);if(typ===C.DOOR)g.level.at(33,10).doormask=C.D_CLOSED;
    seed(2);await push(r);assert.equal(r.result,-1);assert.match(r.text,/in vain/);
});
await check('visible blocking monster',async r=>{
    await start();heavy();rock();const m=await makemon(g.mons[P.PM_NEWT],33,10,C.NO_MINVENT|C.MM_NOGRP|C.MM_NOMSG);
    assert.ok(m);seed(2);await push(r);assert.equal(r.result,-1);assert.match(r.text,/other side/);
});
await check('mounted push feedback',async r=>{
    await start();await mount();const o=rock(),destination=pos(2);seed(2);await push(r);assert.equal(r.result,0);assert.equal(o.ox,destination.x);assert.equal(o.oy,destination.y);assert.match(r.text,/pony moves the boulder/);
});
for(const trigger of [false,true])await check('landmine trigger '+trigger,async r=>{
    await start();const t=await trap(C.LANDMINE),o=rock();let chosen;
    for(let s=1;s<=40;s++){seed(s);if(!!rn2(10)===trigger){chosen=s;break;}}assert.ok(chosen);r.seed=chosen;seed(chosen);await push(r);
    assert.equal(r.result,0);assert.equal(r.text.includes('land mine'),trigger);if(!trigger){assert.equal(g.level.traps.includes(t),true);assert.equal(o.ox,33);}
});
await check('fixed local teleport trap consumes movement and marks trap',async r=>{
    await start();const t=await trap(C.TELEP_TRAP),o=rock();t.teledest={x:34,y:12};seed(2);await push(r);
    assert.equal(r.result,0);assert.equal(o.next_boulder,0);assert.equal(t.tseen,1);assert.match(r.text,/suddenly it disappears/);
    assert.equal(sobj_at(O.BOULDER,32,10),null);assert.equal(o.where,C.OBJ_FLOOR);
});
await check('empty pile negative',async r=>{await start();seed(2);await push(r);assert.equal(r.result,0);assert.deepEqual(r.rng,[]);assert.equal(r.text,'');});
await check('air level lacks leverage without levitation',async r=>{
    await start();g.u.uz={...g.air_level};const o=rock();seed(2);await push(r);assert.equal(r.result,-1);assert.equal(o.ox,32);assert.match(r.text,/leverage/);
});
await check('unaffected arrow trap permits push and remains',async r=>{
    await start();const t=await trap(C.ARROW_TRAP),o=rock();seed(2);await push(r);assert.equal(r.result,0);assert.equal(o.ox,33);assert.ok(g.level.traps.includes(t));
});
for(const fill of [false,true])await check('plain pool fills '+fill,async r=>{
    await start();set_levltyp(33,10,C.POOL);const o=rock();let chosen;
    for(let s=1;s<=40;s++){seed(s);if(!!rn2(10)===fill){chosen=s;break;}}assert.ok(chosen);r.seed=chosen;seed(chosen);await push(r);
    assert.equal(r.result,0);assert.ok(!g.level.objects.includes(o));assert.equal(g.level.at(33,10).typ,fill?C.ROOM:C.POOL);
    assert.equal(r.text.includes('Now you can cross it!'),fill);assert.equal(r.text.includes('It sinks without a trace!'),!fill);
});
await check('rolling trap launches actual boulder and is felt',async r=>{
    await start();const t=await trap(C.ROLLING_BOULDER_TRAP),o=rock();r.launch={...t.launch};r.launch2={...t.launch2};seed(2);await push(r);
    assert.equal(r.result,0);assert.equal(t.tseen,1);assert.equal(sobj_at(O.BOULDER,32,10),null);assert.match(r.text,/suddenly rolls away from you/);
    assert.equal(o.next_boulder,0);
});
for(const known of [false,true])await check('m-prefix caller knowledge uses a move '+!known,async r=>{
    await start();addinv(mksobj(O.PLATE_MAIL,false,false));const o=rock();assert.equal(H.could_move_onto_boulder(32,10),false);
    if(known)mark(o);g.context.nopick=true;g.context.move=1;g.context.door_opened=false;g.domove_attempting=C.DOMOVE_WALK;
    clearMessages();seed(2);await domove();r.text=messages();r.move=g.context.move;r.opened=g.context.door_opened;
    assert.equal(g.u.ux,31);assert.equal(o.ox,32);assert.equal(!!r.move,!known);assert.equal(!!r.opened,!known);assert.equal(o.next_boulder,0);
});
clearTimeout(deadline);
assert.equal(reports.length,56);
const report={evidence:'Constructed source controls with real production helpers; no ordinary or native claim',passed:reports.filter(r=>r.pass).length,total:reports.length,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
