// Constructed direct helper contracts after ordinary startup. No private exports.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setImmediate} from 'node:timers/promises';

const [rootArg, reportArg] = process.argv.slice(2);
assert.ok(rootArg && reportArg && process.argv.length === 4, 'runtime root and compact report required');
const root = pathToFileURL(resolve(rootArg) + '/');
const {runSegment} = await import(new URL('js/jsmain.js', root));
const {InMemoryStorage} = await import(new URL('js/storage.js', root));
// Use the module namespace below for its live game binding across runSegment reset.
const state = await import(new URL('js/gstate.js', root));
const {newsym} = await import(new URL('js/display.js', root));
const {impossible} = await import(new URL('js/pline.js', root));
const {getRngLog} = await import(new URL('js/rng.js', root));
const recipe = JSON.parse(readFileSync(new URL('../evidence/guard-cleanup-prompt.json', import.meta.url)));
const results = [];
async function check(name, fn) {
    try { await fn(); results.push({name,pass:true}); }
    catch (e) { results.push({name,pass:false,error:e.message.slice(0,900)}); }
}
const timer = setTimeout(() => { throw new Error('bounded source controls exceeded 30 seconds'); },30000);
try {
    await runSegment({...recipe.segments[3], storage:new InMemoryStorage()});
    const g=state.game, display=g.nhDisplay;
    const rngBefore=[...getRngLog()], movesBefore=g.moves;
    await check('valid coordinate: synchronous return and no diagnostic', () => {
        assert.equal(newsym(g.u.ux,g.u.uy),undefined);
        assert.deepEqual(g.impossible_log || [],[]);
    });
    for (const key of ['in_mklev','saving','restoring','done_hup']) {
        await check(`${key}: suppression precedes invalid-coordinate handling`, () => {
            const owner=key==='in_mklev' ? g : g.program_state;
            const previous=Object.getOwnPropertyDescriptor(owner,key);
            try {
                owner[key]=true;
                assert.equal(newsym(0,0),undefined);
                assert.equal(newsym(-1,0),undefined);
                assert.deepEqual(g.impossible_log || [],[]);
            } finally {
                if (previous) Object.defineProperty(owner,key,previous); else delete owner[key];
            }
        });
    }
    for (const [x,y] of [[-1,0],[80,0],[1,-1],[1,21]]) {
        await check(`fatal bounds ${x},${y}: synchronous error, no impossible`, () => {
            assert.throws(()=>newsym(x,y),{message:`newsym: attempting screen update for <${x},${y}>`});
            assert.deepEqual(g.impossible_log || [],[]);
        });
    }
    const waits=[];
    let release, reached;
    const pending = new Promise(resolve => { reached=resolve; });
    const oldOnEmpty=display.onEmptyQueue;
    display.onEmptyQueue=async()=>{
        waits.push({turn:g.moves, impossible:g.program_state.in_impossible,
            top:display.grid[0].map(c=>c.ch).join('').trimEnd()});
        if (waits.length===1) {
            reached();
            return new Promise(resolve=>{release=()=>resolve(32);});
        }
        await setImmediate();
        return 32;
    };
    let settled=false;
    const diagnostic=newsym(0,0);
    const tracked=diagnostic.then(()=>{settled=true;});
    try {
        await pending;
        await check('column zero: returns a pending diagnostic promise', async()=>{
            assert.ok(diagnostic instanceof Promise);
            await setImmediate();
            assert.equal(settled,false);
            assert.equal(g.program_state.in_impossible,1);
            assert.equal(g.moves,movesBefore);
            assert.deepEqual(g.impossible_log,['newsym: attempting screen update for <0,0>']);
            assert.ok(waits[0].top.startsWith('newsym: attempting screen update for <0,0>'));
        });
        await check('recursive impossible: rejects without replacing original diagnostic', async()=>{
            await assert.rejects(impossible('recursive source control'),{message:'impossible called impossible'});
            assert.equal(g.program_state.in_impossible,1);
            assert.equal(g.impossible_log.length,1);
        });
    } finally {
        release();
        await tracked;
        display.onEmptyQueue=oldOnEmpty;
    }
    await check('awaited diagnostic: full sequence and cleanup before return',()=>{
        assert.equal(settled,true);
        assert.equal(waits.length,2);
        assert.ok(waits[1].top.startsWith('Program in disorder!'));
        assert.ok(g._pending_message.startsWith('Please report these messages'));
        assert.equal(g.program_state.in_impossible,0);
        assert.equal(g.pline_flags,0);
    });
    const prevSanity=Object.getOwnPropertyDescriptor(g.program_state,'in_sanity_check');
    display.onEmptyQueue=async()=>{await setImmediate();return 32;};
    try {
        g.program_state.in_sanity_check=1;
        await check('sanity-check diagnostic: skips footer and clears recursion flag',async()=>{
            await impossible('sanity branch source control');
            assert.equal(g.program_state.in_impossible,0);
            assert.equal(g.pline_flags,0);
            assert.equal(g._pending_message,'sanity branch source control');
            assert.equal(g.impossible_log.at(-1),'sanity branch source control');
        });
    } finally {
        display.onEmptyQueue=oldOnEmpty;
        if(prevSanity) Object.defineProperty(g.program_state,'in_sanity_check',prevSanity);
        else delete g.program_state.in_sanity_check;
    }
    await check('direct helper controls do not advance turn or consume core RNG',()=>{
        assert.equal(g.moves,movesBefore);
        assert.deepEqual(getRngLog(),rngBefore);
    });
} finally {clearTimeout(timer);}
const report={classification:'Constructed public-helper source contracts, not ordinary or native evidence',
    passed:results.filter(r=>r.pass).length,total:results.length,results};
writeFileSync(reportArg,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,total:report.total,failures:results.filter(r=>!r.pass)}));
if(report.passed!==report.total)process.exitCode=1;
