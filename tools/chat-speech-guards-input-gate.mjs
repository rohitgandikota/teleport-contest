// Source-derived speech checks using the six original keyboard inputs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const root=new URL('../',import.meta.url);
const evidence=new URL('gen-sessions/evidence/chat-speech-guards/',import.meta.url);
const target=process.argv[2] || null;
assert.ok(process.argv.length<=3 && (!target || !target.startsWith('-')), 'one optional report path, no selectors');
assert.ok(!target || !fs.existsSync(target), 'report path must be new');
const sha=b=>createHash('sha256').update(b).digest('hex');
function pinned(url,digest) {
    const bytes=fs.readFileSync(url);
    assert.equal(sha(bytes),digest,'exact tracked evidence');
    return JSON.parse(bytes);
}
const recipe=pinned(new URL('proposal-original.json',evidence),'fb5056ab061f2df448353076da844a2a1d5aa01315576e816ea21608c39afedb');
const initial=pinned(new URL('probe-original.json',evidence),'0dacf5bc767bb3161f9eb1b5a4c756642c265517fdea3c6c4db1c35e9694fb8d');
const lock=pinned(new URL('input-lock.json',evidence),'83dc622f7295bd9074664252eae0335b438c7a9219f3855df5cde935b498f25c');
const recording=pinned(new URL('recording.json',evidence),'f6464eebd7c0f5594a26a06c4fcf1f0a49f486399c5dca1199e444cac90d0762');
const primary=pinned(new URL('gen-sessions/recipes/chat-speech-guards.json',import.meta.url),'afb8fd2ed61a293321d79d283b129738d637d4d8b43a60980a8dda8f963ec48c');
const native=pinned(new URL('gen-sessions/generated/chat-speech-guards.session.json',import.meta.url),'ce89945391669f758be0f5c44d602051601984d77dbc4f7b046a698a7d2d2f78');
assert.equal(recording.exit,0);
assert.equal(recording.rawSha256,'ce89945391669f758be0f5c44d602051601984d77dbc4f7b046a698a7d2d2f78');
assert.equal(recording.binarySha256,'ba4dbc1c823f8d4b0cfb6fd594d00ff0ff5754daaaa2036bee15baeffdf85aa7');
assert.equal(recording.recorderSha256,'b129caee2ca3941b30c36f5c26644bd37ff610344332eb511c474b8709b70648');
assert.equal(recording.cPin,'16ff59115315917b93185d026aeefea06db9b0f4');
assert.equal(recording.primaryRecipeSHA256,lock.primaryRecipeSHA256);
assert.equal(recording.inputSHA256,lock.minimalInputSHA256);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.equal(native.segments.length,6);
const tuple=s=>['name','seed','datetime','nethackrc','moves'].map(f=>({field:f,present:Object.hasOwn(s,f),value:s[f]}));
assert.deepEqual(native.segments.map(tuple),recipe.segments.map(tuple));
assert.deepEqual(primary.segments.map(tuple),recipe.segments.map(tuple));
for(const [i,part] of native.segments.entries())
    assert.deepEqual(part.steps.map(s=>s.key),[null,...recipe.segments[i].moves]);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(primary,native),[]);
const {runSegment}=await import('../js/jsmain.js');
const {InMemoryStorage}=await import('../js/storage.js');
const {PMNAMES}=await import('../js/monst_data.js');
const {decodeScreen,renderCell}=await import('../frozen/screen-decode.mjs');
const {outputs,hashes,deferred}=await import('./half-damage-reader-observe.mjs');
const results = [];
for (const part of recipe.segments) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            if (!g.u || !g.level) return;
            states.push({step, turn: g.moves, form: g.u.umonnum, sound: g.youmonst?.data?.msound, strangled: g.u.intrinsic?.HStrangled || 0, swallowed: !!g.u.uswallow, underwater: !!g.u.uinwater, x:g.u.ux, y:g.u.uy});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output = outputs(run), streamHashes = hashes(output);
    assert.equal(output.screens.length, part.moves.length + 1);
    assert.deepEqual(output.slices.flat(), output.calls);
    assert.deepEqual(hashes(outputs(await runSegment({...part, storage: new InMemoryStorage()}))), streamHashes);
    assert.deepEqual(hashes(await deferred(part)), streamHashes);
    const text = output.screens.map(s => decodeScreen(s)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    const index = recipe.segments.indexOf(part);
    const expected = recipe.predictedMessages[index];
    const final = states.at(-1), failures = [];
    const check = fn => { try { fn(); } catch (error) { failures.push(error.message); } };
    check(() => assert.ok(text.at(-1).includes(expected), expected));
    if (index === 0) {
        check(() => assert.equal(final.form, PMNAMES.PM_FOG_CLOUD));
        check(() => assert.equal(final.sound, 0));
    } else if (index === 1) {
        check(() => assert.ok(final.strangled > 0));
        check(() => assert.notEqual(final.sound, 0));
    } else if (index === 2) {
        check(() => assert.equal(final.swallowed, true));
        check(() => assert.equal(final.strangled, 0));
        check(() => assert.notEqual(final.sound, 0));
    } else if (index === 3) {
        check(() => assert.equal(final.underwater, true));
        check(() => assert.equal(final.swallowed, false));
        check(() => assert.equal(final.strangled, 0));
        check(() => assert.notEqual(final.sound, 0));
    }
    const before = initial.find(r => r.name === part.name);
    check(() => assert.deepEqual(final, before.states.at(-1)));
    if (part.name.endsWith('-negative'))
        check(() => assert.deepEqual(streamHashes, before.hashes));
    const result = {name: part.name, passed: failures.length === 0,
        failures, hashes: streamHashes, final};
    results.push(result);
    console.log(JSON.stringify({name: result.name, passed: result.passed, failures}));
}
if(target) fs.writeFileSync(target,JSON.stringify(results,null,2)+'\n',{flag:'wx'});
if(results.some(r=>!r.passed)) process.exitCode=1;
