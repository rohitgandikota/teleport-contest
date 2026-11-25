// Constructed source controls. Objects, worn slots, status, terrain, queues,
// prompts and pending input all use real runtime producers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { getRngLog } from '../js/rng.js';
import { display_nhwindow_message, pline } from '../js/display.js';
import { mksobj, curse, set_bknown } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { setworn } from '../js/worn.js';
import * as wear from '../js/do_wear.js';
import { yname, xname, readobjnam } from '../js/objnam.js';
import { dodip, dip_into, drink_ok, make_glib } from '../js/potion.js';
import { can_reach_floor } from '../js/pickup.js';
import { Glib, Levitation } from '../js/youprop.js';
import { cmdq_add_key, cmdq_add_userinput, cmdq_copy, do_reqmenu } from '../js/cmd.js';
import { ONAMES } from '../js/objects_data.js';
import { CQ_CANNED, CQ_REPEAT, CMDQ_KEY, ECMD_OK, ECMD_CANCEL, ECMD_TIME,
    W_ARM, W_ARMC, W_ARMU, W_ARMG, W_RINGL, W_RINGR,
    GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_NONINVENT } from '../js/const.js';

const rc = 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
    + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n';
let reads;
function feed(run, text) {
    reads = 0;
    run._display.onEmptyQueue = async () => {
        await setImmediate();
        assert.ok(reads < text.length, 'unexpected physical read');
        return text.charCodeAt(reads++);
    };
}
async function settle(run) {
    feed(run, ' '.repeat(16));
    await display_nhwindow_message();
    feed(run, '');
}
async function boot() {
    const run = await runSegment({seed:9770,datetime:'20000112093000',moves:' ',nethackrc:rc,
        storage:new InMemoryStorage()});
    resetInputState(); await settle(run); return run;
}
async function item(type, mask = 0) {
    const obj = await addinv(mksobj(type, false, false));
    if (mask) await setworn(obj, mask);
    return obj;
}
async function terrain(run, type) {
    feed(run, ' '.repeat(16)); await readobjnam(type); await settle(run);
}
const queue = q => cmdq_copy(q) || [];
const key = k => ({typ:CMDQ_KEY,key:k});
const silent = obj => wear.inaccessible_equipment(obj, null, false);
async function noRng(action) {
    const before = [...getRngLog()];
    const value = await action(); assert.deepEqual(getRngLog(), before); return value;
}
async function covered(kind) {
    let inner, outer;
    if (kind === 'suit') {
        inner = await item(ONAMES.LEATHER_ARMOR, W_ARM);
        outer = await item(ONAMES.ROBE, W_ARMC);
    } else if (kind === 'shirt') {
        inner = await item(ONAMES.HAWAIIAN_SHIRT, W_ARMU);
        outer = await item(ONAMES.LEATHER_ARMOR, W_ARM);
    } else {
        inner = await item(ONAMES.RIN_SEARCHING, kind === 'right ring' ? W_RINGR : W_RINGL);
        outer = await item(ONAMES.LEATHER_GLOVES, W_ARMG);
    }
    return {inner, outer};
}
await test('null and unworn items remain synchronous, accessible and RNG-neutral', async () => {
    await boot(); const obj=await item(ONAMES.DAGGER);
    assert.equal(await noRng(() => silent(null)), false);
    assert.equal(silent(obj), false); assert.equal(reads, 0);
});
for (const [label, type, mask] of [
    ['uncovered suit',ONAMES.LEATHER_ARMOR,W_ARM],
    ['uncovered shirt',ONAMES.HAWAIIAN_SHIRT,W_ARMU],
    ['uncovered ring',ONAMES.RIN_SEARCHING,W_RINGL],
    ['outer gloves',ONAMES.LEATHER_GLOVES,W_ARMG],
]) await test(`${label} is not inaccessible`, async () => {
    await boot(); const obj=await item(type,mask);
    assert.equal(silent(obj), false); assert.equal(reads,0);
});
for (const kind of ['suit','shirt','left ring','right ring']) {
    await test(`${kind}: silent filtering is a boolean, feedback uses canonical ownership names`, async () => {
        const run=await boot(); const {inner,outer}=await covered(kind); await settle(run);
        const before=[...getRngLog()];
        assert.equal(silent(inner),true); assert.equal(reads,0);
        const pending=wear.inaccessible_equipment(inner,'dip',false);
        assert.ok(pending instanceof Promise); assert.equal(await pending,true);
        assert.equal(game._toplines,`You need to take off ${yname(outer)} to dip ${yname(inner)}.`);
        assert.deepEqual(getRngLog(),before); assert.equal(reads,0);
    });
    await test(`${kind}: known-curse mode distinguishes ordinary, unknown cursed and known cursed covers`, async () => {
        const run=await boot(); const {inner,outer}=await covered(kind); await settle(run);
        assert.equal(wear.inaccessible_equipment(inner,null,true),false);
        await curse(outer); set_bknown(outer,0);
        assert.equal(wear.inaccessible_equipment(inner,null,true),false);
        set_bknown(outer,1);
        assert.equal(wear.inaccessible_equipment(inner,null,true),true);
        assert.equal(wear.inaccessible_equipment(inner,null,false),true);
    });
}
await test('shirt names both real coverings once when both share the same ownership prefix', async () => {
    const run=await boot(); const {inner,outer:suit}=await covered('shirt');
    const cloak=await item(ONAMES.ROBE,W_ARMC); await settle(run);
    assert.equal(await wear.inaccessible_equipment(inner,'dip',false),true);
    assert.equal(game._toplines,`You need to take off ${yname(cloak)} and ${xname(suit)} to dip ${yname(inner)}.`);
});
await test('known-curse mode still names both coverings when only one blocks', async () => {
    const run=await boot(); const {inner,outer:suit}=await covered('shirt');
    const cloak=await item(ONAMES.ROBE,W_ARMC); await curse(suit); set_bknown(suit,1); await settle(run);
    assert.equal(await wear.inaccessible_equipment(inner,'dip',true),true);
    assert.equal(game._toplines,`You need to take off ${yname(cloak)} and ${xname(suit)} to dip ${yname(inner)}.`);
});
await test('covered feedback waits for a real More before the owner returns', async () => {
    const run=await boot(); const {inner}=await covered('suit'); await settle(run);
    await pline('Earlier message'); let release, entered=false, finished=false;
    const wait=new Promise(resolve=>release=resolve);
    run._display.onEmptyQueue=async()=>{entered=true;await wait;return 32;};
    const before=[...getRngLog()];
    const pending=wear.inaccessible_equipment(inner,'dip',false).then(value=>{finished=true;return value;});
    await setImmediate();
    try { assert.equal(entered,true); assert.equal(finished,false); }
    finally {release();}
    assert.equal(await pending,true);assert.deepEqual(getRngLog(),before);
});
for (const kind of ['suit','shirt','left ring']) await test(`dodip rejects a physically selected covered ${kind} before a floor query`, async () => {
    const run=await boot(); const {inner,outer}=await covered(kind); await terrain(run,'fountain');
    const previous=inner.pickup_prev;
    feed(run,inner.invlet); const result=await noRng(()=>dodip());
    assert.equal(result,ECMD_OK);assert.equal(reads,1);
    assert.equal(game._toplines,`You need to take off ${yname(outer)} to dip ${yname(inner)}.`);
    assert.equal(inner.pickup_prev,previous);assert.ok(inner.owornmask);
});
await test('dip_into shares covered-equipment feedback after consuming the actual queued potion', async () => {
    const run=await boot();const potion=await item(ONAMES.POT_WATER);const {inner,outer}=await covered('suit');
    await settle(run);cmdq_add_key(CQ_CANNED,potion.invlet);feed(run,inner.invlet);
    assert.equal(await noRng(()=>dip_into()),ECMD_OK);assert.equal(reads,1);
    assert.equal(game._toplines,`You need to take off ${yname(outer)} to dip ${yname(inner)}.`);
    assert.ok(game.invent.includes(potion));assert.deepEqual(queue(CQ_CANNED),[]);
});
for (const feature of ['fountain','sink','pool']) {
    await test(`${feature}: queued decline is consumed without a physical query and reports nothing else`, async () => {
        const run=await boot();const obj=await item(ONAMES.DAGGER);await terrain(run,feature);
        cmdq_add_key(CQ_CANNED,obj.invlet);cmdq_add_key(CQ_CANNED,'n');
        assert.equal(await noRng(()=>dodip()),ECMD_CANCEL);assert.equal(reads,0);
        assert.equal(game._toplines,"You don't have anything else to dip a dagger into.");
        assert.equal(drink_ok(null),GETOBJ_EXCLUDE_NONINVENT);assert.deepEqual(queue(CQ_CANNED),[]);
    });
    await test(`${feature}: physical decline records the answer after the selected object`, async () => {
        const run=await boot();const obj=await item(ONAMES.DAGGER);await terrain(run,feature);feed(run,obj.invlet+'n');
        assert.equal(await noRng(()=>dodip()),ECMD_CANCEL);assert.equal(reads,2);
        assert.deepEqual(queue(CQ_REPEAT),[key(obj.invlet),key('n')]);
        assert.equal(game._toplines,"You don't have anything else to dip a dagger into.");
    });
}
await test('real menu-prefix producer skips the feature and leaves a queued potion cancel for getobj', async () => {
    const run=await boot();const obj=await item(ONAMES.DAGGER);await terrain(run,'fountain');
    await do_reqmenu();cmdq_add_key(CQ_CANNED,obj.invlet);cmdq_add_key(CQ_CANNED,'\x1b');
    assert.equal(await noRng(()=>dodip()),ECMD_CANCEL);assert.equal(reads,0);
    assert.equal(drink_ok(null),GETOBJ_EXCLUDE);assert.deepEqual(queue(CQ_CANNED),[]);
    assert.ok(!game._toplines.startsWith('Dip '));
});
await test('real worn levitation prevents the floor query without a floating-above turn', async () => {
    const run=await boot();const obj=await item(ONAMES.DAGGER);await terrain(run,'fountain');
    const ring=await item(ONAMES.RIN_LEVITATION,W_RINGL);feed(run,' '.repeat(16));await wear.Ring_on(ring);await settle(run);
    assert.ok(Levitation());assert.equal(can_reach_floor(false),false);
    cmdq_add_key(CQ_CANNED,obj.invlet);
    assert.equal(await noRng(()=>dodip()),ECMD_CANCEL);assert.equal(reads,0);
    assert.equal(game._toplines,"You don't have anything to dip a dagger into.");assert.equal(drink_ok(null),GETOBJ_EXCLUDE);
});
await test('first selection Escape cancels before floor or potion use', async () => {
    const run=await boot();await terrain(run,'fountain');feed(run,'\x1b');
    assert.equal(await noRng(()=>dodip()),ECMD_CANCEL);assert.equal(reads,1);assert.equal(game._toplines,'Never mind.');
});
await test('pool hands use the real glib producer and wash_hands, without changing inventory', async () => {
    const run=await boot();await terrain(run,'pool');make_glib(20);assert.ok(Glib());
    cmdq_add_key(CQ_CANNED,'-');cmdq_add_key(CQ_CANNED,'y');feed(run,' '.repeat(16));
    assert.equal(await noRng(()=>dodip()),ECMD_TIME);assert.equal(Glib(),false);
    assert.equal(game._toplines,'Your fingers are no longer slippery.');assert.equal((game.invent || []).length,0);
});
await test('no-floor fallback uses the actual potion and preserves the source return contract', async () => {
    const run=await boot();const obj=await item(ONAMES.DAGGER);const potion=await item(ONAMES.POT_WATER);await settle(run);
    cmdq_add_key(CQ_CANNED,obj.invlet);cmdq_add_key(CQ_CANNED,potion.invlet);feed(run,' '.repeat(16));
    assert.equal(await dodip(),ECMD_TIME);assert.deepEqual(queue(CQ_CANNED),[]);
    assert.equal(drink_ok(null),GETOBJ_EXCLUDE);assert.ok(game.invent.includes(obj));
});

await test('queued covered equipment is rejected by getobj without running the feedback arm', async () => {
    const run=await boot();const {inner}=await covered('suit');await terrain(run,'fountain');
    cmdq_add_key(CQ_CANNED,inner.invlet);cmdq_add_key(CQ_CANNED,'y');
    assert.equal(await noRng(()=>dodip()),ECMD_CANCEL);assert.equal(reads,0);
    assert.deepEqual(queue(CQ_CANNED),[]);assert.ok(!game._toplines.includes('need to take off'));
});
await test('covered physical selection returns before resetting the previous declined-feature state', async () => {
    const run=await boot();const dagger=await item(ONAMES.DAGGER);await terrain(run,'fountain');
    cmdq_add_key(CQ_CANNED,dagger.invlet);cmdq_add_key(CQ_CANNED,'n');
    assert.equal(await dodip(),ECMD_CANCEL);assert.equal(drink_ok(null),GETOBJ_EXCLUDE_NONINVENT);
    const {inner}=await covered('suit');await settle(run);feed(run,inner.invlet);
    assert.equal(await noRng(()=>dodip()),ECMD_OK);assert.equal(drink_ok(null),GETOBJ_EXCLUDE_NONINVENT);
});
