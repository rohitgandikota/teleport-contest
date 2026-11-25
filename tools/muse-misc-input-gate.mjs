// Ordinary keys only. The observer reads fields and restores its prior descriptor.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {observe,unobserved,hash} from './muse-misc-observe.mjs';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {W_WEP,OBJ_INVENT} from '../js/const.js';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/monster-miscellaneous-use.json',import.meta.url)));
const supplied=process.argv[2] ? JSON.parse(readFileSync(process.argv[2])) : recipe;
if(process.argv[2]) {assert.equal(supplied.source,'c');assert.equal(supplied.version,5);}
const tuple=p=>['name','seed','datetime','nethackrc','moves'].map(k=>({field:k,present:Object.hasOwn(p,k),value:p[k]}));
assert.equal(supplied.segments.length,recipe.segments.length);
for(const [i,p] of supplied.segments.entries()) {
    assert.equal(hash(tuple(p)),hash(tuple(recipe.segments[i])),`case ${i}: five fields and their presence`);
    if(p.steps?.length)assert.deepEqual(p.steps.map(s=>s.key),[null,...p.moves]);
}
const located = text => /<\d+,\d+>: /.test(text);
for(const [i,part] of supplied.segments.entries()) test(`ordinary ${i}: ${part.name}; observer preserves all five outputs`,async()=>{
    const seen=await observe(part,true);
    assert.deepEqual(seen.output,await unobserved(part));
    const text=seen.lines.map(l=>l.text).join('\n');
    const states=seen.states;
    const mons=states.flatMap(s=>s.monsters);
    if(i<=2) {
        assert.ok(mons.some(m=>m.type===P.PM_ORC && m.inventory.some(o=>o.type===O.BULLWHIP&&(o.worn&W_WEP))));
        assert.match(text,/orc flicks a bullwhip/);assert.match(text,/bullwhip wraps around/);
        assert.match(text,/orc yanks/);
        assert.ok(states.some(s=>s.selected===8));
        if(i===0)assert.match(text,/<\d+,\d+>: The orc flicks a bullwhip/);
        if(i===1)assert.ok(part.nethackrc.includes('MSGTYPE=hide "wraps around"'));
        if(i===2) {
            assert.match(text,/Sunsword stops shining\.--More--/);
            assert.ok(states.some(s=>s.inventory.some(o=>o.artifact&&o.inUse===1&&o.lit===0
                &&o.where===OBJ_INVENT&&(o.worn&W_WEP)&&s.weapon===o.id)),
                'ordinary Sunsword disarm waits with in_use, slot and worn mask intact');
        }
    } else if(i===3||i===4) {
        const line=seen.lines.find(l=>/deliberately jumps onto a polymorph trap/.test(l.text));assert.ok(line);
        assert.equal(located(line.text),i===3);
        const before=mons.find(m=>m.type===P.PM_GOBLIN);assert.ok(before);
        assert.ok(mons.some(m=>m.id===before.id&&m.type!==P.PM_GOBLIN));
        assert.ok(states.some(s=>s.selected===4));
    } else if(i===5||i===6) {
        const line=seen.lines.find(l=>/goblin removes .* from a bag/.test(l.text));assert.ok(line);
        assert.equal(located(line.text),i===5);
        assert.ok(states.some(s=>s.selected===10));
        assert.ok(mons.some(m=>m.type===P.PM_GOBLIN&&m.inventory.some(o=>o.type===O.SACK)));
        assert.ok(mons.some(m=>m.type===P.PM_GOBLIN&&m.inventory.some(o=>[O.DIAMOND,O.RUBY,O.EMERALD,O.SAPPHIRE].includes(o.type))));
    } else {
        assert.match(text,/stone giant drinks a murky potion!/);
        assert.match(text,/stone giant rises up, through the ceiling!/);
        const holder=mons.find(m=>m.type===P.PM_STONE_GIANT&&m.inventory.some(o=>o.type===O.POT_GAIN_LEVEL&&o.cursed));assert.ok(holder);
        const migrated=states.flatMap(s=>s.migrating).find(m=>m.id===holder.id);assert.ok(migrated,'naming completed before actual migration');
        assert.equal(migrated.trap,0);assert.equal(migrated.x,0);assert.equal(migrated.y,0);
        assert.deepEqual(migrated.to,[0,1]);assert.ok(!migrated.inventory.some(o=>o.type===O.POT_GAIN_LEVEL));
        if(i===7) {
            assert.match(text,/stone giant is caught in a bear trap!/);
            assert.ok(mons.some(m=>m.id===holder.id&&m.trap===1));
        } else {
            assert.doesNotMatch(text,/stone giant is caught/);
            assert.ok(!mons.some(m=>m.id===holder.id&&m.trap));
        }
    }
});
