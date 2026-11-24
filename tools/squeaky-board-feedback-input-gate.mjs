// Real keyboard inputs, independently recorded by C, expose both located messages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {Deaf} from '../js/youprop.js';
import {SQKY_BOARD} from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {recordingIntegrityErrors,branchAssertionErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};

const file=process.argv[2]||new URL('gen-sessions/generated/squeaky-board-feedback.session.json',import.meta.url);
const recipeFile=process.argv[3]||new URL('gen-sessions/recipes/squeaky-board-feedback.json',import.meta.url);
const bytes=fs.readFileSync(file),raw=JSON.parse(bytes),recipe=JSON.parse(fs.readFileSync(recipeFile));
test('raw integrity, registered coverage and native branch witnesses',()=>{
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
        '091912305c7db589f0c5ff328b7949e7cfe32f49c65602619903f0712a199526');
    assert.equal(raw.source,'c');assert.equal(raw.version,5);
    assert.equal(raw.segments.length,4);assert.equal(recipe.segments.length,4);
    const registered=new Set(tags.requirements.map(t=>t.id));
    for(const tag of recipe.coverage)assert.ok(registered.has(tag),tag);
    assert.deepEqual(recordingIntegrityErrors(raw),[]);
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    assert.deepEqual(branchAssertionErrors(recipe,raw),[]);
    for(const [i,part] of raw.segments.entries()) {
        for(const field of ['name','seed','datetime','nethackrc','moves']) {
            assert.equal(Object.hasOwn(part,field),Object.hasOwn(recipe.segments[i],field));
            assert.deepEqual(part[field],recipe.segments[i][field]);
        }
        assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
    }
});
const grid=screen=>decodeScreen(screen).map(row=>
    row.map(cell=>[renderCell(cell),cell.color,cell.attr]));
function calls(entries) {
    return entries.map(entry=>{
        const value=String(entry).replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
        assert.match(value,/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/,
            'every RNG entry is recognized and retained');
        return value;
    });
}
for(const [i,part] of raw.segments.entries())test(`${part.name}: a real monster steps onto the board`,async()=>{
    const run=await runSegment({...part,storage:new InMemoryStorage()});
    assert.deepEqual(run.getScreens().map(grid),part.steps.map(step=>grid(step.screen)));
    assert.deepEqual(run.getCursors(),part.steps.map(step=>step.cursor));
    assert.deepEqual(calls(run.getRngLog()),part.steps.flatMap(step=>calls(step.rng||[])));
    assert.deepEqual(run.getRngSlices().map(calls),part.steps.map(step=>calls(step.rng||[])));
    assert.deepEqual(run.getAnimationFramesByStep(),part.steps.map(step=>step.animation_frames||[]));
    const deaf=i>=2,located=i%2===0;
    assert.equal(Deaf(),deaf);assert.equal(game.u.uhp,36);assert.equal(game.u.umortality||0,0);
    const mon=game.level.monsters.find(m=>m.mnum===P.PM_KOBOLD);
    assert.ok(mon);assert.deepEqual([mon.mx,mon.my],[39,5]);
    const trap=game.level.traps.find(t=>t.tx===mon.mx&&t.ty===mon.my&&t.ttyp===SQKY_BOARD);
    assert.ok(trap);assert.equal(trap.tnote,6);assert.equal(!!trap.tseen,!deaf);
    const text=run.getScreens().map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('')).join('\n')).join('\n');
    const line=deaf ? 'The kobold stops momentarily and appears to cringe.'
        : 'A board beneath the kobold squeaks an F sharp loudly.';
    assert.ok(text.includes(line));
    assert.equal(text.includes(`(${deaf?'south':'north'}): ${line}`),located);
    assert.equal(run.getScreens().length,99);
    assert.equal(run.getRngLog().length,deaf?2337:2348);
    assert.equal(run.getAnimationFramesByStep().flat().length,0);
});
