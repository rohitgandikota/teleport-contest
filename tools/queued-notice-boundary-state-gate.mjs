// Constructed quiet map; actual blindness, monster, inventory and timeout owners.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import {setup,clearMessages,x,y} from './half-damage-intrinsic-setup.mjs';
import {hash} from './half-damage-reader-observe.mjs';
import {game} from '../js/gstate.js';
import {make_blinded,make_deaf} from '../js/potion.js';
import {nh_timeout} from '../js/timeout.js';
import {makemon} from '../js/makemon.js';
import {mksobj} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {notice_mon_off,notice_mon_on} from '../js/hack.js';
import {msgtype_parse_add} from '../js/options.js';
import {Blind} from '../js/youprop.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {NO_MINVENT} from '../js/const.js';

const timer=setTimeout(()=>{console.error('55 second boundary source limit');process.exit(2);},55000);
const results=[];
const visible=()=>game.nhDisplay.grid.slice(0,2).map(r=>r.map(c=>c.ch).join('').trimEnd()).join('\n');
async function fresh({notices=true,monster=true}={}){
    const run=await setup('Wizard',`OPTIONS=accessiblemsg,whatis_coord:map,${notices?'':'!'}spot_monsters\n`);
    await make_blinded(1,false);assert.ok(Blind());
    const item=addinv(mksobj(O.DAGGER,false,false));assert.ok(!item.dknown);
    const mon=monster?await makemon(game.mons[P.PM_BLUE_JELLY],x-2,y,NO_MINVENT):null;
    if(mon)assert.ok(!mon.mspotted);
    clearMessages();assert.equal(game.a11y.notices?.length||0,0);
    return {run,item,mon};
}
async function check(name,fn){
    try{await fn();results.push({name,pass:true,rngSHA256:hash(getRngLog())});}
    catch(e){results.push({name,pass:false,error:e.message.slice(0,1000),rngSHA256:hash(getRngLog())});}
}
for(const mode of ['quiet setter','talking setter','timeout'])await check(`sighting finishes before ${mode} returns`,async()=>{
    const {item,mon}=await fresh(),rng=[...getRngLog()];
    if(mode==='timeout')await nh_timeout();else await make_blinded(0,mode==='talking setter');
    assert.equal(!!Blind(),false);assert.equal(game.a11y.notices?.length||0,0);
    assert.ok(mon.mspotted);assert.ok(visible().includes('blue jelly'));
    assert.ok(item.dknown);assert.deepEqual(getRngLog(),rng);
});
for(const timeout of [false,true])await check(`STOP suspends ${timeout?'timeout before next property':'setter before inventory discovery'}`,async()=>{
    const {run,item}=await fresh();
    if(timeout)await make_deaf(1,false);
    assert.equal(msgtype_parse_add('stop "You see"'),true);
    let release,holding=true,done=false,reads=0;
    run._display.onEmptyQueue=async()=>{
        await setImmediate();assert.ok(++reads<32);
        if(holding)return new Promise(resolve=>{release=resolve;});
        return 32;
    };
    const action=(timeout?nh_timeout():make_blinded(0,false)).then(()=>{done=true;});
    try{
        for(let n=0;n<128&&!release&&!done;n++)await setImmediate();
        assert.ok(release,'real sighting STOP must block the owner');
        assert.equal(done,false);assert.match(visible(),/blue jelly.*--More--/s);
        assert.equal(!!Blind(),false);assert.ok(!item.dknown,'discovery follows sighting completion');
        if(timeout)assert.equal(game.u.intrinsic.HDeaf,1,'later property has not decremented');
        const before={rng:[...getRngLog()],known:item.dknown,deaf:game.u.intrinsic.HDeaf,text:visible()};
        await setImmediate();assert.equal(done,false);
        assert.deepEqual({rng:[...getRngLog()],known:item.dknown,deaf:game.u.intrinsic.HDeaf,text:visible()},before);
    }finally{holding=false;if(release)release(32);await action;}
    assert.ok(item.dknown);assert.equal(game.a11y.notices?.length||0,0);
    if(timeout)assert.equal(game.u.intrinsic.HDeaf,0);
});
await check('hidden sighting is consumed before inventory discovery',async()=>{
    const {item,mon}=await fresh();assert.equal(msgtype_parse_add('hide "You see"'),true);
    await make_blinded(0,false);assert.ok(mon.mspotted);assert.ok(item.dknown);
    assert.equal(game.a11y.notices?.length||0,0);assert.ok(!visible().includes('blue jelly'));
});
await check('notices disabled leaves no message or pending work',async()=>{
    const {item}=await fresh({notices:false});await make_blinded(0,false);
    assert.ok(item.dknown);assert.equal(game.a11y.notices?.length||0,0);assert.ok(!visible().includes('blue jelly'));
});
await check('public notice suppression leaves no message or pending work',async()=>{
    const {item}=await fresh();notice_mon_off();
    try{await make_blinded(0,false);}finally{notice_mon_on();}
    assert.ok(item.dknown);assert.equal(game.a11y.notices?.length||0,0);assert.ok(!visible().includes('blue jelly'));
});
await check('empty visible level has no sighting to wait for',async()=>{
    const {item}=await fresh({monster:false});const rng=[...getRngLog()],text=visible();
    await make_blinded(0,false);assert.ok(item.dknown);assert.equal(game.a11y.notices?.length||0,0);
    assert.deepEqual(getRngLog(),rng);assert.equal(visible(),text);
});
await check('extending blindness does not discover the monster or inventory',async()=>{
    const {item,mon}=await fresh();const rng=[...getRngLog()];await make_blinded(7,false);
    assert.ok(Blind());assert.ok(!item.dknown);assert.ok(!mon.mspotted);
    assert.equal(game.a11y.notices?.length||0,0);assert.deepEqual(getRngLog(),rng);
});
clearTimeout(timer);
const report={total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));if(report.passed!==report.total)process.exitCode=1;
