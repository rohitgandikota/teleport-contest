// Ordinary-input reach and source-derived C exit/cleanup contracts.
// The unpatched JS is expected to fail three secret-exit assertions.
// Usage after copying to tools/: node tools/vault-exit-input-gate.mjs input.json [report.json]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Passes_walls} from '../js/youprop.js';
import {vault_occupied} from '../js/vault.js';
import {engr_at} from '../js/engrave.js';
import {SDOOR, DOOR, D_NODOOR} from '../js/const.js';
const input = JSON.parse(fs.readFileSync(process.argv[2]));
assert.equal(input.source,'c'); assert.equal(input.version,5);
assert.equal(input.segments.length,2);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const outputs = run => ({screens:hash(run.getScreens()),cursors:hash(run.getCursors()),
    fullRng:hash(run.getRngLog()),slices:hash(run.getRngSlices()),
    animations:hash(run.getAnimationFramesByStep())});
const results = [];
for (const [index,part] of input.segments.entries()) {
    if (part.steps.length) {
        assert.equal(part.steps.length,part.moves.length+1);
        assert.equal(part.steps[0].key,null);
        assert.deepEqual(part.steps.slice(1).map(s=>s.key),Array.from(part.moves));
    }
    const prior = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states = [];
    let run;
    try {
        globalThis.__step_snapshot = {step:'*',cb(g,step) {
            const guard = g.level.monsters.find(m=>m.isgd);
            const loc = g.level.at(27,4);
            states.push({step,hero:[g.u.ux,g.u.uy],inVault:!!vault_occupied(g.u.urooms),
                phasing:Passes_walls(),target:{typ:loc.typ,mask:loc.doormask,
                    flags:loc.flags,engraving:engr_at(27,4)?.engr_txt || null},
                guard:guard && {id:guard.m_id,xy:[guard.mx,guard.my],peaceful:guard.mpeaceful,
                    egd:structuredClone(guard.mextra.egd)}});
        }};
        run = await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    const hashes = outputs(run);
    const unobserved = await runSegment({...part,storage:new InMemoryStorage()});
    const entry = states.find(s=>s.guard?.egd.fcend===1);
    const exitIndex = states.findIndex(s=>s.guard?.egd.gddone);
    const before = states[exitIndex-1], exit = states[exitIndex], final = states.at(-1);
    await test(`${part.name}: real preparation precedes the guard`,()=>{
        assert.ok(states.some(s=>!s.guard && s.phasing && s.target.engraving
            && s.target.typ===(index===0?SDOOR:DOOR)));
        assert.ok(entry); assert.deepEqual(entry.hero,[23,5]);
        assert.deepEqual(entry.guard.xy,[25,5]); assert.equal(entry.phasing,false);
    });
    await test(`${part.name}: the real outside-vault cardinal exit is selected`,()=>{
        assert.ok(before && exit);
        assert.deepEqual(before.guard.xy,[27,5]);
        assert.deepEqual(exit.hero,[26,5]); assert.equal(exit.inVault,false);
        assert.equal(exit.phasing,false); assert.equal(exit.guard.peaceful,1);
        assert.equal(exit.guard.id,entry.guard.id);
        assert.deepEqual(exit.guard.xy,[0,0]);
        assert.equal(exit.target.typ,DOOR); assert.equal(exit.target.mask,D_NODOOR);
        assert.equal(before.target.typ,index===0?SDOOR:DOOR);
    });
    await test(`${part.name}: C deletes engraving only on the converted exit`,()=>{
        assert.ok(before.target.engraving);
        assert.equal(exit.target.engraving,index===0?null:before.target.engraving);
    });
    await test(`${part.name}: C records a converted exit before parking`,()=>{
        assert.equal(exit.guard.egd.fcend,before.guard.egd.fcend+(index===0?1:0));
        if (index===0) assert.deepEqual(exit.guard.egd.fakecorr.at(-1),
            {fx:27,fy:4,ftyp:SDOOR,flags:0,doormask:0});
        else assert.deepEqual(exit.guard.egd.fakecorr,before.guard.egd.fakecorr);
    });
    await test(`${part.name}: real cleanup restores only the converted exit`,()=>{
        assert.deepEqual(final.hero,[23,5]); assert.equal(final.guard,undefined);
        assert.equal(final.phasing,false);
        assert.equal(final.target.typ,index===0?SDOOR:DOOR);
        if (index===0) assert.equal(final.target.engraving,null);
        else assert.ok(final.target.engraving);
    });
    await test(`${part.name}: all input boundaries complete`,()=>{
        for (const list of [run.getScreens(),run.getCursors(),run.getRngSlices(),run.getAnimationFramesByStep()])
            assert.equal(list.length,part.moves.length+1);
        assert.equal(run._display.inputQueueLength,0);
    });
    await test(`${part.name}: passive observer preserves five arrays and restores its hook`,()=>{
        assert.deepEqual(hashes,outputs(unobserved));
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    });
    results.push({name:part.name,boundaries:run.getScreens().length,calls:run.getRngLog().length,
        frames:run.getAnimationFramesByStep().flat().length,entry,before,exit,final,hashes,
        observerPreservesOutputs:true,states});
}
if (process.argv[3]) fs.writeFileSync(process.argv[3],JSON.stringify({kind:'JS ordinary-input source controls, no native parity claim',results},null,2)+'\n');
