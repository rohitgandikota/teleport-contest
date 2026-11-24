// Real gd_move returns from a guard produced by ordinary invault input.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {gd_move} from '../js/vault.js';
import {resetInputState} from '../js/input.js';

const recipe=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-guard-origin.json',import.meta.url)));
async function setup(boundary) {
    const part=recipe.segments[0];
    const run=await runSegment({...part,moves:part.moves.slice(0,boundary),storage:new InMemoryStorage()});
    game._preNhgetchHook=null;
    resetInputState();
    let reads=0;
    run._display.onEmptyQueue=()=>{assert.ok(++reads<=4);return 32;};
    const guard=game.level.monsters.find(m=>m.isgd);
    assert.ok(guard);
    assert.deepEqual([guard.mx,guard.my],[25,5]);
    return guard;
}
await test('warning six returns zero and preserves the guard coordinates',async()=>{
    const guard=await setup(126);
    assert.equal(guard.mextra.egd.warncnt,6);
    assert.equal(await gd_move(guard),0);
    assert.equal(guard.mextra.egd.warncnt,7);
    assert.deepEqual([guard.mx,guard.my],[25,5]);
    assert.equal(guard.mpeaceful,1);
});
await test('warning seven calls real mnexto and returns fallback after relocating',async()=>{
    const guard=await setup(128);
    assert.equal(guard.mextra.egd.warncnt,7);
    assert.equal(await gd_move(guard),-1);
    assert.notDeepEqual([guard.mx,guard.my],[25,5]);
    assert.equal(guard.mpeaceful,0);
    assert.deepEqual([...game.level.monAt].filter(([,v])=>v===guard).map(([k])=>k),
        [`${guard.mx},${guard.my}`]);
    assert.equal(game.level.monAt.has('25,5'),false);
});
