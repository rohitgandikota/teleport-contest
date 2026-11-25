// Ordinary keyboard producers and read-only five-collection observation.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {body_part} from '../js/polyself.js';
import {HANDED,NON_PM,RIGHT_HANDED} from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/background-polymorph-enlightenment.json',import.meta.url)));
const outputs=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const witnesses=[21,50,28,28,2];
const forms=[P.PM_OGRE,P.PM_VAMPIRE_BAT,P.PM_OGRE,P.PM_VAMPIRE_BAT,P.PM_WIZARD];
for(const [index,part]of recipe.segments.entries())test(`ordinary background: ${part.name}`,async()=>{
    const rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){rows.push({step,form:g.u.umonnum,natural:g.u.umonster,
            mnum:g.youmonst.mnum,cham:g.youmonst.cham,savedCham:g.u.mcham,
            canonical:g.youmonst.data===g.mons[g.u.umonnum],handed:body_part(HANDED),hand:g.u.uhandedness,
            female:!!g.flags.female,mfemale:!!g.u.mfemale,level:g.u.ulevel,xp:g.u.uexp,moves:g.moves});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    const observed=outputs(run),unobserved=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    for(const key of Object.keys(observed))assert.deepEqual(observed[key],unobserved[key],key+' observer neutrality');
    assert.equal(observed.screens.length,part.moves.length+1);
    assert.equal(run._display.inputQueueLength,0,'all ordinary keys consumed');
    assert.equal(rows.length,part.moves.length+1);
    assert.ok(rows.every(r=>r.canonical&&r.mnum===r.form));
    const step=witnesses[index],row=rows[step];
    assert.equal(row.step,step);assert.equal(row.form,forms[index]);
    assert.equal(row.natural,P.PM_WIZARD);assert.equal(row.hand,RIGHT_HANDED);
    assert.equal(row.cham,index===1?P.PM_VAMPIRE:NON_PM);
    assert.equal(row.savedCham,row.cham);assert.equal(row.moves,1);
    assert.equal(row.female,false);assert.equal(row.mfemale,false);
    assert.equal(row.handed,index===1||index===3?'clawed':'handed');
    assert.equal(row.level,1);assert.equal(row.xp,0);
    if(index===1){
        assert.ok(part.moves.includes('#polyself\rvampire\r'));
        assert.ok(rows.some(r=>r.form===P.PM_VAMPIRE&&r.cham===P.PM_VAMPIRE));
    }
    if(index===2){
        assert.ok(part.moves.endsWith('#quit\ryn'));
    }else assert.equal(part.moves[step-1],'\x18','real attributes command');
    const screen=decodeScreen(observed.screens[step]).map(r=>r.map(renderCell).join('')).join('\n');
    assert.match(screen,/Background:/);
    for(const phrase of recipe.branchAssertions[index].screenIncludes)assert.ok(screen.includes(phrase),phrase);
    if(index===2){assert.match(screen,/--More--/);assert.doesNotMatch(screen,/currently in .* form/);}
    if(index===3)assert.doesNotMatch(screen,/a male vampire in vampire bat/);
    if(index===4)assert.doesNotMatch(screen,/form\.|normally .*handed/);
    assert.equal(observed.frames.flat().length,0);
});
