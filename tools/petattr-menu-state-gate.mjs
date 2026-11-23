#!/usr/bin/env node
// Real JS input paths, with C-derived option state expectations.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {boolean_option} from '../js/options.js';
import {InMemoryStorage} from '../js/storage.js';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/petattr-options.json',import.meta.url)));
const expected=[[[4,true]],[[7,true]],[[0,false]],
    [[1,true],[1,false],[1,true]],[[0,false],[7,true],[4,true]],[[4,true]]];

for(const [index,segment] of recipe.segments.entries()) test(segment.name,async()=>{
    const observed=[];let previous;
    globalThis.__step_snapshot={step:'*',cb:(s,step)=>{
        const value=[s.iflags.wc2_petattr,boolean_option('hilite_pet')];
        const key=JSON.stringify(value);
        if(key!==previous){observed.push(value);previous=key;}
    }};
    let g;
    try {g=await runSegment({...segment,storage:new InMemoryStorage()});}
    finally {delete globalThis.__step_snapshot;}
    assert.deepEqual(observed,expected[index]);
    assert.deepEqual(game.rc.errors,[]);
    if(index>=4) {
        assert.ok(g.getScreens().some(s=>s.includes('Select pet highlight attribute')));
        assert.equal(game.opt_need_redraw,false);
    }
});
