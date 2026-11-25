// C hack.c:2879-2884. Constructed fixtures use public owners and real producers.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {game as g} from '../js/gstate.js';
import * as C from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {domove,rhack} from '../js/cmd.js';
import {exercise_steed} from '../js/steed.js';
import {use_skill,skill_init,can_advance,enhance_weapon_skill} from '../js/weapon.js';
import {Skill_Mon} from '../js/skills_data.js';
import {makemon} from '../js/makemon.js';
import {tamedog} from '../js/dog.js';
import {sleep_monst} from '../js/mhitm.js';
import {set_levltyp} from '../js/mkmaze.js';
import {vision_reset,vision_recalc} from '../js/vision.js';
import {pline,newsym,is_safemon} from '../js/display.js';
import {m_at} from '../js/mon.js';
import {getRngLog} from '../js/rng.js';
import {setup,mount,x,y,seed,clearMessages,messages} from './status-followup-test-setup.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const results=[],hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const bound=setTimeout(()=>{console.error('55 second source bound');process.exit(2);},55000);
const flags=C.NO_MINVENT|C.MM_NOGRP|C.MM_NOWAIT|C.MM_NOMSG|C.MM_ANGRY;
function state(mon){return {xy:[g.u.ux,g.u.uy],ride:g.u.urideturns||0,skill:{...g.u.weapon_skills[C.P_RIDING]},eligible:can_advance(C.P_RIDING,false),
    steed:g.u.usteed&&{xy:[g.u.usteed.mx,g.u.usteed.my],hp:g.u.usteed.mhp},mon:mon&&{xy:[mon.mx,mon.my],hp:mon.mhp},
    move:g.context.move,run:g.context.run,hp:g.u.uhp,text:messages(),rng:[...getRngLog()]};}
async function fresh(mounted=true){const runtime=await setup();g.flags.safe_dog=true;g.flags.runmode=C.RUN_TPORT;
    Object.assign(g.context,{run:0,move:1,travel:0,travel1:0,mv:0,nopick:0,forcefight:0});g.multi=0;
    if(mounted)await mount();assert.equal(g.u.urideturns||0,0);assert.equal(g.u.weapon_skills[C.P_RIDING].advance,0);
    clearMessages();seed();return runtime;}
async function prime(count=99){for(let i=0;i<count;i++)await exercise_steed();assert.equal(g.u.urideturns,count%100);}
async function step(dx=1,dy=0){g.u.dx=dx;g.u.dy=dy;g.context.move=1;await domove();}
async function pet(pm=P.PM_LITTLE_DOG,dx=1,dy=0){const mon=await makemon(g.mons[pm],g.u.ux+dx,g.u.uy+dy,flags);
    assert.ok(mon&&await tamedog(mon,null,false));vision_reset();vision_recalc();newsym(mon.mx,mon.my);assert.ok(is_safemon(mon));return mon;}
async function check(name,body){const r={name};try{await body(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,400);}results.push(r);}

await check('unmounted helper leaves counter and practice unchanged',async r=>{await fresh(false);r.before=state();for(let i=0;i<100;i++)await exercise_steed();r.after=state();assert.deepEqual(r.after,r.before);});
for(const n of [1,99,100,101,200])await check(`helper ${n} real calls`,async r=>{
    await fresh();for(let i=0;i<n;i++)await exercise_steed();r.after=state();assert.equal(r.after.ride,n%100);assert.equal(r.after.skill.advance,Math.floor(n/100));assert.deepEqual(r.after.rng,[]);
});
for(const n of [1,99,100,101,200])await check(`mounted movement ${n} steps`,async r=>{
    await fresh();r.before=state();for(let i=0;i<n;i++)await step(i%2?-1:1);r.after=state();
    assert.deepEqual(r.after.xy,[x+1+n%2,y]);assert.deepEqual(r.after.steed.xy,r.after.xy);
    assert.equal(r.after.ride,n%100);assert.equal(r.after.skill.advance,Math.floor(n/100));assert.equal(r.after.skill.skill,C.P_UNSKILLED);assert.deepEqual(r.after.rng,[]);
});
await check('unmounted 100 movement steps do not train',async r=>{await fresh(false);r.before=state();for(let i=0;i<100;i++)await step(i%2?-1:1);r.after=state();assert.equal(r.after.ride,0);assert.equal(r.after.skill.advance,0);assert.deepEqual(r.after.xy,[x,y]);assert.deepEqual(r.after.rng,[]);});
await check('public rhack movement trains',async r=>{await fresh();await prime();r.before=state();clearMessages();seed();await rhack('l'.charCodeAt(0));r.after=state();assert.deepEqual(r.after.xy,[x+2,y]);assert.equal(r.after.ride,0);assert.equal(r.after.skill.advance,1);assert.deepEqual(r.after.rng,[]);});
await check('restricted canonical Monk table still resets riding counter',async r=>{
    await fresh();skill_init(Skill_Mon);assert.equal(g.u.weapon_skills[C.P_RIDING].skill,C.P_ISRESTRICTED);
    r.classification='constructed public skill_init with canonical Monk table; not a Wizard role transition';
    await prime();r.before=state();await step();r.after=state();assert.equal(r.after.ride,0);assert.equal(r.after.skill.advance,0);assert.deepEqual(r.after.rng,[]);
});
await check('maxed skill still gains practice through movement',async r=>{
    const runtime=await fresh();await use_skill(C.P_RIDING,20);assert.ok(can_advance(C.P_RIDING,false));clearMessages();
    const keys=[...'na\x1b'].map(c=>c.charCodeAt(0));let reads=0;runtime._display.onEmptyQueue=()=>{assert.ok(++reads<12);return keys.shift()??27;};
    await enhance_weapon_skill();assert.equal(g.u.weapon_skills[C.P_RIDING].skill,C.P_BASIC);assert.equal(g.u.weapon_skills[C.P_RIDING].max,C.P_BASIC);
    await prime();clearMessages();seed();r.before=state();await step();r.after=state();assert.equal(r.after.ride,0);assert.equal(r.after.skill.advance,21);assert.equal(r.after.eligible,false);assert.equal(r.after.text,'');assert.deepEqual(r.after.rng,[]);
});
for(const kind of ['wall','sleeping-steed','run-visible-hostile','forcefight-empty','pet-roll-block'])await check(`earlier ${kind} does not train`,async r=>{
    await fresh();await prime();let mon;
    if(kind==='wall')assert.ok(set_levltyp(x+2,y,C.STONE));
    if(kind==='sleeping-steed')assert.equal(await sleep_monst(g.u.usteed,5,-1),1);
    if(kind==='run-visible-hostile'){mon=await makemon(g.mons[P.PM_NEWT],x+2,y,flags);g.context.run=3;vision_reset();vision_recalc();newsym(mon.mx,mon.my);}
    if(kind==='forcefight-empty')g.context.forcefight=1;
    if(kind==='pet-roll-block')mon=await pet();
    clearMessages();seed(kind==='pet-roll-block'?7:2);r.before=state(mon);await step();r.after=state(mon);
    assert.deepEqual(r.after.xy,r.before.xy);assert.deepEqual(r.after.steed.xy,r.before.steed.xy);assert.equal(r.after.ride,99);assert.equal(r.after.skill.advance,0);
    if(kind==='pet-roll-block'){assert.match(r.after.text,/is in the way/);assert.deepEqual(r.after.rng,['rn2(7)=0','rnd(6)=3']);}
    else assert.deepEqual(r.after.rng,[]);
});
for(const kind of ['accepted','diagonal-grid-bug'])await check(`training precedes ${kind} pet displacement`,async r=>{
    await fresh();await prime();const diagonal=kind==='diagonal-grid-bug',mon=await pet(diagonal?P.PM_GRID_BUG:P.PM_LITTLE_DOG,1,+diagonal);
    clearMessages();seed(2);r.before=state(mon);await step(1,+diagonal);r.after=state(mon);
    assert.equal(r.after.ride,0);assert.equal(r.after.skill.advance,1);assert.deepEqual(r.after.rng,['rn2(7)=1']);
    assert.deepEqual(r.after.xy,diagonal?r.before.xy:r.before.mon.xy);assert.deepEqual(r.after.steed.xy,r.after.xy);
    assert.deepEqual(r.after.mon.xy,diagonal?r.before.mon.xy:r.before.xy);assert.equal(m_at(...r.after.mon.xy),mon);
    assert.match(r.after.text,diagonal?/can't move diagonally/:/swap places with/);
});
for(const kind of ['empty','accepted','diagonal-grid-bug'])await check(`pending confidence precedes ${kind} displacement`,async r=>{
    const runtime=await fresh();await use_skill(C.P_RIDING,19);await prime();const diagonal=kind==='diagonal-grid-bug';
    const mon=kind==='empty'?null:await pet(diagonal?P.PM_GRID_BUG:P.PM_LITTLE_DOG,1,+diagonal);
    clearMessages();seed(2);r.before=state(mon);await pline('You carefully settle into the saddle and prepare to continue riding.');
    let release,waiting,reads=0,done=false;const pending=new Promise(resolve=>{waiting=resolve;});
    runtime._display.onEmptyQueue=()=>{assert.ok(++reads<8);if(reads===1)return new Promise(resolve=>{release=resolve;waiting('input');});return 32;};
    const operation=step(1,+diagonal).then(()=>{done=true;return 'complete';});
    const outcome=await Promise.race([pending,operation]);r.pending=state(mon);r.pending.completed=done;
    if(release)release(32);await operation;r.after=state(mon);
    assert.equal(outcome,'input');assert.equal(r.pending.completed,false);assert.equal(r.pending.ride,0);assert.equal(r.pending.skill.advance,20);assert.ok(r.pending.eligible);
    assert.deepEqual(r.pending.xy,[x+2,y+Number(diagonal)]);assert.deepEqual(r.pending.steed.xy,r.pending.xy);
    assert.deepEqual(r.pending.mon,r.before.mon,'target is untouched while confidence feedback waits');
    assert.deepEqual(r.pending.rng,mon?['rn2(7)=1']:[]);assert.deepEqual(r.after.rng,r.pending.rng);
    assert.match(r.after.text,/more confident in your fighting skills/);
    if(mon){assert.ok(r.after.text.indexOf('more confident')<r.after.text.indexOf(diagonal?'stop.':'swap places'),'confidence before displacement feedback');
        assert.deepEqual(r.after.mon.xy,diagonal?r.before.mon.xy:r.before.xy);}
    assert.deepEqual(r.after.xy,diagonal?r.before.xy:[x+2,y]);assert.deepEqual(r.after.steed.xy,r.after.xy);
});
clearTimeout(bound);
const report={classification:'constructed public-owner controls, real producers; no native parity claimed',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>r.name),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
