// Ordinary input reach through real gameplay; native parity is checked separately.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {canseemon} from '../js/display.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {MSLOW} from '../js/const.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import registry from './gen-sessions/coverage-requirements.json' with {type:'json'};
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/monster-slow-touch-completion.json',import.meta.url)));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('ordinary tuples, registered categories and explicit positive/negative branches',()=>{
    const fields=['name','seed','datetime','nethackrc','moves'];
    assert.equal(hash(recipe.segments.map(s=>fields.map(k=>[Object.hasOwn(s,k),s[k]]))),
        '15132d20b995d4db8550c986e8f3fab27b6cc9a300a97f2d4d0213593e42216e');
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    const known=new Set(registry.requirements.map(r=>r.id));for(const c of recipe.coverage)assert.ok(known.has(c));
});
for(const [i,part] of recipe.segments.entries())test(part.name,async()=>{
    const rows=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){rows.push({step,turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality||0,
            accessible:g.flags.accessiblemsg,top:g._toplines,vis:g.vis,monsters:g.level.monsters.map(m=>({
                id:m.m_id,species:m.mnum,canonical:m.data===g.mons[m.mnum],xy:[m.mx,m.my],hp:m.mhp,
                tame:m.mtame||0,sleeping:!!m.msleeping,peaceful:!!m.mpeaceful,cancelled:!!m.mcan,
                speed:m.mspeed,permanent:m.permspeed,seen:canseemon(m),attacks:m.data.mattk}))});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    assert.equal(run.getScreens().length,[53,53,49][i]);
    const before=rows.find(r=>r.step===part.moves.lastIndexOf('2s'));
    assert.equal(before.accessible,i!==0);
    const attacker=before.monsters.find(m=>m.species===(i===2?P.PM_LARGE_CAT:P.PM_SKELETON));
    const target=before.monsters.find(m=>m.species===(i===2?P.PM_OGRE:P.PM_OGRE_TYRANT));
    assert.ok(attacker?.canonical&&target?.canonical&&attacker.seen&&target.seen);
    assert.ok(attacker.tame>0);assert.equal(attacker.cancelled,false);assert.equal(attacker.sleeping,false);
    assert.equal(target.peaceful,false);assert.equal(target.sleeping,true);assert.equal(target.speed,0);
    assert.ok(Math.max(Math.abs(attacker.xy[0]-target.xy[0]),Math.abs(attacker.xy[1]-target.xy[1]))===1);
    assert.equal(attacker.attacks.some(a=>a[1]===A.AD_SLOW),i!==2);
    const final=rows.at(-1).monsters.find(m=>m.id===target.id);assert.ok(final);
    assert.ok(final.hp<target.hp);assert.equal(final.speed,i===2?0:MSLOW);
    assert.ok(rows.every(r=>r.hp>0&&r.mortality===0),'no death prompt or revival path');
    if(i!==2)assert.ok(rows.some(r=>r.vis&&r.monsters.some(m=>m.id===target.id&&m.speed===MSLOW)));
    if(i===1){
        const effect=rows.find(r=>r.top==='(southwest): The ogre king seems to be moving slower.');
        const suffix=rows.find(r=>r.top.startsWith('(southwest): The ogre king slows down.'));
        assert.ok(effect&&suffix&&effect.step<suffix.step);
        assert.equal(effect.monsters.find(m=>m.id===target.id).hp,26,'touch damage waits for speed feedback');
        assert.equal(suffix.monsters.find(m=>m.id===target.id).hp,24,'damage follows the completed slow handler');
    }
    const text=run.getScreens().map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('')).join('\n')).join('\n');
    for(const s of recipe.branchAssertions[i].screenIncludes)assert.ok(text.includes(s),s);
    for(const s of recipe.branchAssertions[i].screenExcludes)assert.ok(!text.includes(s),s);
    for (const cell of recipe.branchAssertions[i].screenCells || []) {
        const grid = decodeScreen(run.getScreens()[cell.step]);
        assert.equal(renderCell(grid[cell.y][cell.x]), cell.equals, `step ${cell.step} cell (${cell.x},${cell.y})`);
    }
});
