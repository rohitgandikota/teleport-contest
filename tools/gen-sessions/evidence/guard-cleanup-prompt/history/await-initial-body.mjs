// Original ordinary keyboard tuples. Observers do not change game state.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [rootArg, reportArg] = process.argv.slice(2);
assert.ok(rootArg && reportArg && process.argv.length === 4, 'runtime root and compact report required');
const root = pathToFileURL(resolve(rootArg) + '/');
const {runSegment} = await import(new URL('js/jsmain.js', root));
const {InMemoryStorage} = await import(new URL('js/storage.js', root));
const {outputs, hashes, deferred} = await import(new URL('tools/observe.mjs', root));
const recipe = JSON.parse(readFileSync(new URL('../evidence/guard-cleanup-prompt.json', import.meta.url)));
const lock = JSON.parse(readFileSync(new URL('../evidence/input-lock.json', import.meta.url)));
const original = JSON.parse(readFileSync(new URL('../evidence/probe-01.json', import.meta.url))).results;
const results = [], policy = [], rows = [];
function check(list, name, fn) {
    try { fn(); list.push({name, pass: true}); }
    catch (e) { list.push({name, pass: false, error: e.message.slice(0, 900)}); }
}
function snapshot(g, step) {
    const mon = g.level?.monsters.find(m => m.isgd);
    const egd = mon?.mextra?.egd;
    return {step, turn: g.moves, hero: [g.u.ux,g.u.uy],
        top: g.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd(),
        impossible: g.program_state.in_impossible || 0,
        diagnostics: [...(g.impossible_log || [])],
        guard: mon ? {id: mon.m_id, xy: [mon.mx,mon.my], hp: mon.mhp,
            peaceful: mon.mpeaceful, state: mon.mstate, done: egd.gddone,
            end: egd.fcend, begin: egd.fcbeg} : null};
}
async function runObserved(part, held) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (step >= 180) states.push(snapshot(g, step));
        }};
        run = held ? await deferred(part)
            : outputs(await runSegment({...part, storage: new InMemoryStorage()}));
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    return {output: run, states};
}
const timer = setTimeout(() => { throw new Error('bounded ordinary controls exceeded 55 seconds'); }, 55000);
try {
    for (const [i, part] of recipe.segments.entries()) {
        const queued = await runObserved(part, false);
        const plain = await runSegment({...part, storage: new InMemoryStorage()});
        const held = await runObserved(part, true);
        const qh = hashes(queued.output), dh = hashes(held.output);
        const at = (run, step) => run.states.find(s => s.step === step);
        const positive = i < 3;
        const prefix = Object.fromEntries(Object.entries(queued.output).map(([key,value]) =>
            [key, key === 'calls' ? queued.output.slices.slice(0,188).flat() : value.slice(0,188)]));
        check(results, `${part.name}: actual guard producer`, () => {
            for (const run of [queued, held]) {
                const before = at(run,187);
                assert.deepEqual(before.guard.xy, [27,5]);
                assert.equal(before.guard.done,0);
                assert.equal(before.guard.end,3);
                assert.equal(before.impossible,0);
                if (positive) {
                    const after = at(run,188);
                    assert.equal(after.guard.id,before.guard.id);
                    assert.deepEqual(after.guard.xy,[0,0]);
                    assert.equal(after.guard.hp,47);
                    assert.equal(after.guard.peaceful,1);
                    assert.equal(after.guard.state,0); // MON_FLOOR, not off-map.
                    assert.equal(after.guard.done,1);
                    assert.deepEqual(after.hero,[26,5]);
                } else assert.equal(run.states.at(-1).guard.done,0);
            }
        });
        check(results, `${part.name}: legitimate diagnostic retained and finished`, () => {
            for (const run of [queued, held]) {
                assert.deepEqual(run.states.at(-1).diagnostics, positive
                    ? ['newsym: attempting screen update for <0,0>'] : []);
                assert.equal(run.states.at(-1).impossible,0);
            }
        });
        check(results, `${part.name}: C diagnostic finishes before next turn`, () => {
            for (const run of [queued, held]) {
                const pending = run.states.filter(s => s.impossible);
                assert.equal(pending.length > 0, positive);
                for (const state of pending)
                    assert.equal(state.turn,at(run,187).turn,
                        `boundary ${state.step}: diagnostic still pending after turn advanced`);
            }
        });
        check(results, `${part.name}: all diagnostic lines precede resumed command`, () => {
            for (const run of [queued, held]) {
                const tops = run.states.map(s => s.top);
                const diagnostic = tops.findIndex(s => s.startsWith('newsym: attempting screen update'));
                const disorder = tops.findIndex(s => s.startsWith('Program in disorder!'));
                const report = tops.findIndex(s => s.startsWith('Please report these messages'));
                if (positive) assert.ok(diagnostic >= 0 && disorder > diagnostic && report > disorder);
                else assert.deepEqual([diagnostic,disorder,report],[-1,-1,-1]);
            }
        });
        check(results, `${part.name}: original prefix and negative hashes`, () => {
            assert.deepEqual(hashes(prefix), original[0].prefix187Hashes);
            if (!positive) {
                assert.deepEqual(qh,lock.negativeHashes[part.name]);
                assert.deepEqual(dh,lock.negativeHashes[part.name]);
            }
        });
        check(results, `${part.name}: observer neutrality`, () => {
            assert.deepEqual(qh,hashes(outputs(plain)));
        });
        check(results, `${part.name}: deferred and held EOF equality`, () => {
            assert.deepEqual(dh,qh);
        });
        check(results, `${part.name}: complete keys and five stream integrity`, () => {
            assert.equal(plain._display.inputQueueLength,0);
            for (const run of [queued,held]) {
                for (const key of ['screens','cursors','slices','frames'])
                    assert.equal(run.output[key].length,part.moves.length+1);
                assert.deepEqual(run.output.slices.flat(),run.output.calls);
            }
        });
        // These original expectations remain failures until a separate vault change.
        check(policy, `${part.name}: C cleanup message policy`, () => {
            const top = step => at(queued,step).top;
            if (i === 0 || i === 2) {
                assert.equal(top(188),'Suddenly, the guard disappears.--More--');
                assert.equal(top(189),'newsym: attempting screen update for <0,0>--More--');
            } else if (i === 1)
                assert.equal(top(188),'newsym: attempting screen update for <0,0>--More--');
            else assert.equal(top(187),'');
        });
        rows.push({name:part.name, keys:part.moves.length, boundaries:queued.output.screens.length,
            calls:queued.output.calls.length, hashes:qh, deferredHashes:dh,
            originalQueuedEqual:JSON.stringify(qh)===JSON.stringify(original[i].hashes),
            queued:queued.states.filter(s => s.step >=187 && s.step <=195),
            deferred:held.states.filter(s => s.step >=187 && s.step <=195)});
    }
} finally { clearTimeout(timer); }
const summary = list => ({passed:list.filter(r=>r.pass).length,total:list.length});
const report = {classification:'Ordinary JS keyboard controls, no new C comparison',
    ...summary(results),results,cleanupPolicy:{...summary(policy),results:policy},rows};
writeFileSync(reportArg,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...summary(results),cleanupPolicy:summary(policy),
    failures:results.filter(r=>!r.pass).map(r=>r.name)}));
if (report.passed !== report.total) process.exitCode=1;
