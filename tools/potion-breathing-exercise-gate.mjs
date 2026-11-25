// C ordering gate for exercise -> encumber_msg, with actual inventory history.
// Usage: node tools/potion-breathing-exercise-gate.mjs [compact-report.json]
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import {setup,seed} from './half-damage-intrinsic-setup.mjs';
import {game} from '../js/gstate.js';
import {potionbreathe} from '../js/potion.js';
import {exercise,encumber_msg,near_capacity} from '../js/attrib.js';
import {mksobj} from '../js/mkobj.js';
import {addinv,obj_extract_self} from '../js/invent.js';
import {makeknown} from '../js/o_init.js';
import {display_nhwindow_message,pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {ONAMES as O} from '../js/objects_data.js';
import {A_CON,A_DEX,OVERLOADED,UNENCUMBERED} from '../js/const.js';

async function priorLoad() {
    const run=await setup();
    assert.ok(game.moves>0);assert.equal(game.u.umonnum,game.u.umonster);
    const heavy=await addinv(mksobj(O.BOULDER,false,false));
    assert.equal(near_capacity(),OVERLOADED);
    await encumber_msg();assert.equal(game.oldcap,OVERLOADED);
    await display_nhwindow_message();
    await obj_extract_self(heavy);
    assert.equal(near_capacity(),UNENCUMBERED);assert.equal(game.oldcap,OVERLOADED);
    await pline('An earlier message fills most of the line before the vapor arrives.');
    seed(7);return run;
}
const results=[];
const deadline=setTimeout(()=>{console.error('55 second exercise worker limit');process.exit(2);},55000);
for(const [name,type] of [['healing',O.POT_HEALING],['extra-healing',O.POT_EXTRA_HEALING],
    ['full-healing',O.POT_FULL_HEALING],['sickness',O.POT_SICKNESS],['acid',O.POT_ACID],
    ['polymorph',O.POT_POLYMORPH],['direct-CON',null],['direct-DEX',null]]) {
    const result={name};let release,operation,run;
    try {
        run=await priorLoad();
        let enter,done=false,reads=0;const entered=new Promise(r=>enter=r);
        run._display.onEmptyQueue=()=>new Promise(r=>{reads++;release=r;enter();});
        const obj=type?mksobj(type,false,false):null;
        if(obj) makeknown(type);
        const returned=obj?potionbreathe(obj):exercise(name==='direct-CON'?A_CON:A_DEX,false);
        operation=Promise.resolve(returned).then(()=>{done=true;});
        if(name==='direct-DEX') {
            await operation;await setImmediate();
            assert.equal(returned,undefined);assert.equal(reads,0);
            assert.equal(game.oldcap,OVERLOADED);
            result.observed={returnsPromise:false,inputReads:reads,oldcap:game.oldcap};
        } else {
            // The broken owner may finish before the asynchronous message
            // reaches nhgetch. Still wait for the real pending input boundary.
            await entered;await setImmediate();
            result.observed={returnsPromise:typeof returned?.then==='function',
                ownerDoneAtPendingInput:done,inUseAtPendingInput:obj?!!obj.in_use:null,
                inputReads:reads,oldcap:game.oldcap,newcap:near_capacity(),calls:getRngLog().length};
            assert.equal(done,false,'C exercise/encumber_msg must finish before owner returns');
            if(obj) assert.equal(!!obj.in_use,true,'C restores in_use after exercise completes');
            assert.equal(game.oldcap,OVERLOADED,'encumbrance feedback still awaits the earlier message');
        }
        result.pass=true;
    } catch(error) {
        result.pass=false;result.error=error.message.slice(0,350);
    } finally {
        if(run) run._display.onEmptyQueue=()=>32;
        if(release) release(32);
        if(operation) await operation;
        if(name!=='direct-DEX'&&run) {
            for(let k=0;k<20&&game.oldcap!==near_capacity();k++) await setImmediate();
            assert.equal(game.oldcap,near_capacity(),'finish all real pending feedback before next control');
        }
    }
    results.push(result);
}
clearTimeout(deadline);
const report={kind:'constructed prior load from real addinv, encumber_msg and obj_extract_self; expected C ordering',
    passed:results.filter(r=>r.pass).length,total:results.length,results};
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,
    failures:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error,observed:r.observed}))}));
if(report.passed!==report.total) process.exitCode=1;
