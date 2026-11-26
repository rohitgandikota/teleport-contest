// Constructed ESC acknowledgement, real diagnostic owner and input transport.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setImmediate} from 'node:timers/promises';
const [rootArg,reportArg]=process.argv.slice(2);
assert.ok(rootArg&&reportArg&&process.argv.length===4);
const root=pathToFileURL(resolve(rootArg)+'/');
const {runSegment}=await import(new URL('js/jsmain.js',root));
const state=await import(new URL('js/gstate.js',root));
const {newsym}=await import(new URL('js/display.js',root));
const {InMemoryStorage}=await import(new URL('js/storage.js',root));
const {getRngLog}=await import(new URL('js/rng.js',root));
const recipe=JSON.parse(readFileSync(new URL('../evidence/guard-cleanup-prompt.json',import.meta.url)));
const results=[];
function check(name,fn) {try{fn();results.push({name,pass:true});}
    catch(e){results.push({name,pass:false,error:e.message.slice(0,900)});}}
const timer=setTimeout(()=>{throw new Error('bounded ESC control exceeded 20 seconds');},20000);
let observations;
try {
    await runSegment({...recipe.segments[3],storage:new InMemoryStorage()});
    const g=state.game, d=g.nhDisplay, rng=[...getRngLog()], turn=g.moves;
    const original=d.onEmptyQueue, prompts=[];
    try {
        d.onEmptyQueue=async()=>{
            prompts.push(d.grid[0].map(c=>c.ch).join('').trimEnd());
            await setImmediate();
            return 27;
        };
        await newsym(0,0);
    } finally {d.onEmptyQueue=original;}
    const top=d.grid[0].map(c=>c.ch).join('').trimEnd();
    check('ESC acknowledges exactly the initial diagnostic',()=>{
        assert.deepEqual(prompts,['newsym: attempting screen update for <0,0>--More--']);
    });
    check('current update paints disorder, later footer is buffered under WIN_STOP',()=>{
        assert.equal(top,'Program in disorder!  (Saving and reloading may fix this problem.)');
        assert.equal(g._toplines,'Please report these messages to devteam@nethack.org.');
        assert.equal(g._prevmsg,g._toplines);
        assert.equal(g._pending_message,'');
        assert.equal(g._win_stop,true);
    });
    check('diagnostic completes without another input or turn',()=>{
        assert.equal(g.program_state.in_impossible,0);
        assert.equal(g.pline_flags,0);
        assert.deepEqual(g.impossible_log,['newsym: attempting screen update for <0,0>']);
        assert.equal(g.moves,turn);
        assert.deepEqual(getRngLog(),rng);
    });
    observations={prompts,top,logical:g._toplines,previous:g._prevmsg,
        impossible:g.program_state.in_impossible,stop:g._win_stop,turn};
} finally {clearTimeout(timer);}
const report={classification:'Constructed helper ESC contract, not ordinary or native evidence',
    passed:results.filter(r=>r.pass).length,total:results.length,results,observations};
writeFileSync(reportArg,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass)}));
if(report.passed!==report.total)process.exitCode=1;
