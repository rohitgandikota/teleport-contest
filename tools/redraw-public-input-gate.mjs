// Ordinary public input witnesses, separate from native output comparisons.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {COULD_SEE, IN_SIGHT} from '../js/vision.js';
import {STONE} from '../js/const.js';

const sessions=process.argv[2]||fileURLToPath(new URL('../sessions/',import.meta.url));
const names=['seed0030-ten-diverse-deaths','seed0360-wizard-world-tour',
    'seed0367-priest-quest-tour','seed0373-barbarian-quest-tour','seed5006-tourist-stress-disaster'];
for(const name of names)await test(`${name}: real visibility or shutdown producer`,async()=>{
    const raw=JSON.parse(fs.readFileSync(path.join(sessions,`${name}.session.json`)));
    const storage=new InMemoryStorage(), reports=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try {
        for(const [segment,part]of raw.segments.entries()) {
            const report={segment,initial:null,zeroRows:[],disclosure:[],shutdown:[],diagnostics:[]};
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!step)report.initial=g.iflags?.window_inited;
                for(let y=0;y<(g.viz_array?.length||0);y++) {
                    const bits=g.viz_array[y][0], loc=g.level.at(0,y);
                    if((bits&COULD_SEE)&&!(bits&IN_SIGHT)&&loc.typ===STONE
                        &&g._viz_rmin?.[y]===0&&report.zeroRows.length<5)
                        report.zeroRows.push({step,y,bits,hero:[g.u.ux,g.u.uy]});
                }
                if(g.program_state_gameover) {
                    const event={step,hero:[g.u.ux,g.u.uy],vision:g.iflags.vision_inited};
                    if(g.iflags.window_inited===true)report.disclosure.push(event);
                    if(g.iflags.window_inited===false)report.shutdown.push(event);
                }
                if(g.impossible_log?.length)report.diagnostics=[...g.impossible_log];
            }};
            const run=await runSegment({...part,storage});
            assert.equal(run.getScreens().length,part.steps.length,'all ordinary input boundaries remain');
            assert.equal(report.initial,true,'a new game or resumed game starts with windows');
            assert.deepEqual(report.diagnostics,[]);
            assert.deepEqual(game.impossible_log||[],[]);
            reports.push(report);
            if(name==='seed0030-ten-diverse-deaths'&&segment===6) {
                const record=JSON.parse(storage.getItem('record:topten')||'[]');
                assert.ok(record.some(entry=>entry.name==='Elara'),
                    'the first formerly blocked death reaches the real score record');
            }
        }
    } finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    if(name.startsWith('seed03')) {
        assert.ok(reports.some(r=>r.zeroRows.length),'ordinary level vision includes blocked column zero');
    } else {
        assert.ok(reports.some(r=>r.disclosure.length),'gameover still permits disclosure erasure');
        assert.ok(reports.some(r=>r.shutdown.some(e=>e.hero[0]===0&&e.hero[1]===0)),
            'real bones preparation precedes final window shutdown');
        assert.ok(reports.every(r=>r.shutdown.every(e=>e.vision===false)));
    }
});
