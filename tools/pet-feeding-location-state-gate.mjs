// C dog.c:1143 tamedog() and dogmove.c:218 dog_eat(), located feedback.
// Constructed quiet level; actual monster, taming, food and visibility producers.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import {setup,seed,clearMessages,messages,x,y} from './half-damage-intrinsic-setup.mjs';
import {hash} from './half-damage-reader-observe.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {tamedog,dog_eat} from '../js/dog.js';
import {setmangry} from '../js/mon.js';
import {mksobj,place_object} from '../js/mkobj.js';
import {canseemon,pline} from '../js/display.js';
import {mon_set_minvis} from '../js/worn.js';
import {make_hallucinated} from '../js/potion.js';
import {set_msg_xy} from '../js/pline.js';
import {set_levltyp} from '../js/mkmaze.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
const tests=[],results=[];
const check=(name,fn)=>tests.push([name,fn]);
async function fresh(options='OPTIONS=accessiblemsg,whatis_coord:map\n') {
    const run=await setup('Wizard',options);let reads=0;
    run._display.onEmptyQueue=async()=>{await setImmediate();assert.ok(++reads<40,'bounded input');return 32;};
    return run;
}
async function mon(type=P.PM_PONY) {
    const m=await makemon(game.mons[type],x+2,y,C.NO_MINVENT);assert.ok(m);return m;
}
async function pet(type=P.PM_PONY) {
    const m=await mon(type);assert.equal(await tamedog(m,null,false),true);assert.ok(m.mtame&&m.edog);return m;
}
function food(type=O.CARROT) {return mksobj(type,false,false);}
function begin() {clearMessages();seed(7);}
function contains(text) {assert.ok(messages().includes(text),messages());}
for(const accessible of [true,false]) {
    const opts=`OPTIONS=${accessible?'':'!'}accessiblemsg,whatis_coord:map\n`;
    const prefix=accessible?'<33,10>: ':'';
    check(`tamedog/hostile/${accessible}`,async()=>{
        await fresh(opts);const m=await mon();await setmangry(m,false);assert.equal(m.mpeaceful,0);begin();
        assert.equal(await tamedog(m,null,true),true);contains(prefix+'The pony seems more amiable.');
        assert.ok(!messages().includes('quite friendly'));assert.ok(m.mpeaceful&&m.mtame);
    });
    check(`tamedog/friendly/${accessible}`,async()=>{
        await fresh(opts);const m=await mon();assert.ok(m.mpeaceful,'natural peaceful producer');assert.ok(!m.mtame);begin();
        assert.equal(await tamedog(m,null,true),true);contains(prefix+'The pony seems quite friendly.');assert.ok(m.mtame);
    });
    check(`tamedog/catch-and-eat/${accessible}`,async()=>{
        await fresh(opts);const m=await pet(),o=food();begin();
        assert.equal(await tamedog(m,o,true),true);contains(prefix+'The pony catches the carrot.');
        contains(prefix+'Your pony eats a carrot.');assert.equal(o.where,C.OBJ_DELETED);
        assert.ok(messages().indexOf('catches')<messages().indexOf('eats'));
    });
    for(const devour of [false,true]) check(`dog_eat/meal/${accessible}/${devour}`,async()=>{
        await fresh(opts);const m=await pet(),o=food();await place_object(o,m.mx,m.my);begin();
        assert.equal(await dog_eat(m,o,m.mx,m.my,devour),1);
        contains(prefix+`Your pony ${devour?'devours':'eats'} a carrot.`);assert.equal(o.where,C.OBJ_DELETED);
    });
    check(`dog_eat/tunneler/${accessible}`,async()=>{
        await fresh(opts);const m=await pet(P.PM_ROCK_MOLE),o=food(O.DAGGER);await place_object(o,m.mx,m.my);begin();
        assert.equal(await dog_eat(m,o,m.mx,m.my,false),1);contains(prefix+'Your rock mole digs in.');assert.equal(o.where,C.OBJ_DELETED);
    });
}
for(const [mode,prefix] of [['screen','[12,33]: '],['compass','(2e): '],['full','(2east): '],['none','(2east): ']]) {
    check(`tamedog/coordinates-${mode}`,async()=>{await fresh(`OPTIONS=accessiblemsg,whatis_coord:${mode}\n`);const m=await pet(),o=food();begin();await tamedog(m,o,false);contains(prefix+'The pony catches');contains(prefix+'Your pony eats');});
}
check('tamedog/invisible-pet-plain-messages',async()=>{
    await fresh();const m=await pet(),o=food();mon_set_minvis(m,false);assert.equal(canseemon(m),false);begin();
    await tamedog(m,o,true);contains('The carrot stops.');contains('It eats a carrot.');assert.ok(!messages().includes('<33,10>'));assert.equal(o.where,C.OBJ_DELETED);
});
check('tamedog/quiet-magic-preserves-location',async()=>{
    await fresh();const m=await mon();begin();set_msg_xy(35,12);await tamedog(m,null,false);
    assert.equal(messages(),'');assert.deepEqual(game.a11y.msg_loc,{x:35,y:12});assert.ok(m.mtame);
});
check('tamedog/location-overrides-and-consumes',async()=>{
    await fresh();const m=await pet(),o=food();begin();set_msg_xy(35,12);await tamedog(m,o,true);
    contains('<33,10>: The pony catches');contains('<33,10>: Your pony eats');assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
    await pline('A plain followup.');assert.ok(!messages().includes('<35,12>'));assert.ok(!messages().includes('<33,10>: A plain'));
});
check('dog_eat/underwater-suppression-preserves-location',async()=>{
    await fresh();const m=await pet(),o=food();await place_object(o,m.mx,m.my);assert.ok(set_levltyp(m.mx,m.my,C.POOL));begin();set_msg_xy(35,12);
    await dog_eat(m,o,m.mx,m.my,false);assert.equal(messages(),'');assert.deepEqual(game.a11y.msg_loc,{x:35,y:12});assert.equal(o.where,C.OBJ_DELETED);
});
check('dog_eat/rustproof-spit-stays-plain',async()=>{
    await fresh();const m=await pet(P.PM_RUST_MONSTER),o=food(O.DAGGER);o.oerodeproof=1;await place_object(o,m.mx,m.my);begin();
    await dog_eat(m,o,m.mx,m.my,false);contains('<33,10>: Your rust monster eats');contains('The rust monster spits');
    assert.ok(!messages().includes('<33,10>: The rust monster spits'));assert.equal(o.oerodeproof,0);assert.equal(o.where,C.OBJ_FLOOR);assert.equal(m.mstun,1);
});
for(const hostile of [false,true]) check(`tamedog/hallucination/${hostile}`,async()=>{
    await fresh();const m=await mon();if(hostile)await setmangry(m,false);await make_hallucinated(20,false);begin();await tamedog(m,null,true);
    assert.match(messages(),hostile?/<33,10>: .+ seems really chill\./:/<33,10>: .+ seems quite approachable\./);assert.ok(m.mtame);
});
for(const stage of ['catch','eat']) check(`ordering/pending-${stage}`,async()=>{
    const run=await fresh(`OPTIONS=accessiblemsg,whatis_coord:map\nMSGTYPE=stop "${stage==='catch'?'catches':'eats'}"\n`);
    const m=await pet(),o=food();begin();let release,done=false;
    run._display.onEmptyQueue=async()=>messages().includes(stage==='catch'?'catches':'eats')
        ?new Promise(resolve=>{release=resolve;}):32;
    const work=tamedog(m,o,true).then(()=>{done=true;});
    try {
        for(let i=0;i<100&&!release&&!done;i++)await setImmediate();assert.ok(release,'actual pending input');assert.equal(done,false);
        contains('<33,10>: The pony catches');assert.notEqual(o.where,C.OBJ_DELETED);
        if(stage==='catch'){assert.equal(o.where,C.OBJ_FREE);assert.ok(!messages().includes('eats'));}
        else{contains('<33,10>: Your pony eats');assert.equal(o.where,C.OBJ_FLOOR);}
        assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
    } finally {run._display.onEmptyQueue=async()=>32;if(release)release(32);await work;}
    assert.equal(done,true);assert.equal(o.where,C.OBJ_DELETED);
});
const timeout=setTimeout(()=>{console.error('45 second source worker limit');process.exit(2);},45000);
for(const [name,fn] of tests) {
    const r={name};try{await fn();r.pass=true;}catch(e){r.pass=false;r.error=e.message.slice(0,1000);}
    r.callsHash=hash(getRngLog());results.push(r);
}
clearTimeout(timeout);
const report={evidence:'constructed source controls',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failures:results.filter(r=>!r.pass)}));
if(report.passed!==report.total)process.exitCode=1;
