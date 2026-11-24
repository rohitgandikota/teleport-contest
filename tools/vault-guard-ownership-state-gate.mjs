// Guard ownership from ordinary invault input and real death/migration producers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {findgd, gd_move, grddead, vault_summon_gd} from '../js/vault.js';
import {mondead, mongone, movemon, dmonsfree} from '../js/mon.js';
import {punish, unpunish, litroom} from '../js/read.js';
import {mksobj, add_to_minv, mkcorpstat} from '../js/mkobj.js';
import {m_dowear} from '../js/worn.js';
import {migrate_to_level} from '../js/dog.js';
import {ledger_no} from '../js/dungeon.js';
import {makemon} from '../js/makemon.js';
import {revive} from '../js/zap.js';
import {resetInputState} from '../js/input.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {MIGR_RANDOM, MON_MIGRATING, MON_DETACH, MM_NOMSG, NO_MINVENT,
    CORPSTAT_NONE, W_AMUL, STONE, CORR, OBJ_FLOOR} from '../js/const.js';
import {dosounds} from '../js/sounds.js';
import {goto_level} from '../js/do.js';
import {dosave0} from '../js/save.js';
import {dorecover} from '../js/restore.js';

const foundation = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-interrogation-feedback.json', import.meta.url))).segments[0];

async function start(walk = true, corridorSteps = 2) {
    const run = await runSegment({...foundation,
        moves: foundation.moves + (walk ? `d$${'l'.repeat(corridorSteps)}\x1b\x1b` : ''), storage:new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    const messages = [];
    let reads = 0;
    run._display.onEmptyQueue = async () => {
        assert.ok(++reads < 50, 'bounded real feedback reads');
        messages.push(game._toplines);
        await setImmediate();
        return 32;
    };
    const guard = game.level.monsters.find(m => m.isgd);
    assert.ok(guard && guard.mextra.egd.fcend === (walk ? corridorSteps + 1 : 1));
    assert.equal(guard.mextra.egd.fcbeg, 0);
    assert.equal(game.mvitals[P.PM_GUARD].died || 0, 0);
    return {guard, run, messages};
}
const deaths = () => game.mvitals[P.PM_GUARD].died || 0;
const grid = mon => [...game.level.monAt].filter(([,value])=>value===mon).map(([key])=>key);
async function blockedDeath(disappear = false, corridorSteps = 2) {
    const state = await start(true,corridorSteps);
    await punish(null);
    assert.deepEqual([game.u.uball.ox,game.u.uball.oy,game.u.uball.where], [23+corridorSteps,5,OBJ_FLOOR]);
    if (disappear) await mongone(state.guard);
    else await mondead(state.guard);
    return state;
}

await test('unblocked guard death clears its real corridor before counting the death', async () => {
    const {guard} = await start();
    const corridor = structuredClone(guard.mextra.egd.fakecorr);
    await mondead(guard);
    assert.equal(guard.isgd, 0);
    assert.equal(guard.mextra.egd.fcbeg, corridor.length);
    for (const fc of corridor) assert.equal(game.level.at(fc.fx,fc.fy).typ, fc.ftyp);
    assert.equal(deaths(), 1);
    assert.equal(findgd(), null);
    assert.deepEqual(grid(guard), []);
});
for (const disappear of [false,true]) {
    await test(`${disappear ? 'disappearance' : 'death'} blocked by the real punishment ball retains its owner`, async () => {
        const {guard} = await blockedDeath(disappear);
        assert.equal(deaths(), 0);
        assert.equal(guard.isgd, 1);
        assert.equal(guard.mhp, 0);
        assert.equal(guard.mstate & MON_DETACH, 0);
        assert.ok(game.level.monsters.includes(guard));
        assert.deepEqual(grid(guard), ['0,0']);
        assert.equal(guard.mextra.egd.fcbeg, 0);
        assert.equal(game.level.at(26,5).typ, CORR);
        dmonsfree();
        assert.ok(game.level.monsters.includes(guard));
    });
}
await test('findgd revives the same unfinished parked owner and prevents another summons', async () => {
    const {guard} = await blockedDeath();
    assert.equal(findgd(), guard);
    assert.equal(guard.mhp, guard.mhpmax);
    const timer = game.u.uinvault;
    vault_summon_gd();
    assert.equal(game.u.uinvault, timer);
    assert.equal(deaths(), 0);
    assert.equal(game.level.monsters.filter(m=>m.isgd).length, 1);
});
await test('parked dead cleanup runs once per turn, retains done guards, then disposes without death credit', async () => {
    const {guard} = await blockedDeath();
    await movemon();
    assert.equal(guard.mextra.egd.gddone, 1);
    assert.equal(guard.mlstmv, game.moves);
    assert.equal(findgd(), guard);
    assert.equal(guard.mhp, 0, 'done parked guards are not revived by lookup');
    unpunish();
    await movemon();
    assert.equal(guard.isgd, 1, 'no second cleanup during the same turn');
    // Advance only the clock for the next monster sweep, as allmain does.
    game.moves++;
    await movemon();
    assert.equal(guard.isgd, 0);
    assert.equal(deaths(), 0);
    assert.ok(!game.level.monsters.includes(guard));
    assert.deepEqual(grid(guard), []);
    assert.equal(game.level.at(26,5).typ, STONE);
});
await test('life saving precedes guard cleanup, inventory release and death history', async () => {
    const {guard} = await start();
    const amulet = mksobj(O.AMULET_OF_LIFE_SAVING, false, false);
    add_to_minv(guard, amulet);
    await m_dowear(guard, true);
    assert.ok(amulet.owornmask & W_AMUL);
    const position = [guard.mx,guard.my];
    await mondead(guard);
    assert.equal(guard.mhp, guard.mhpmax);
    assert.equal(guard.isgd, 1);
    assert.equal(guard.mextra.egd.fcbeg, 0);
    assert.deepEqual([guard.mx,guard.my], position);
    assert.ok(!guard.minvent.includes(amulet));
    assert.equal(deaths(), 0);
});
await test('blocked guard releases inventory at the old map square before parking', async () => {
    const {guard} = await start();
    const old = [guard.mx,guard.my];
    const gold = mksobj(O.GOLD_PIECE, false, false);
    const rock = mksobj(O.ROCK, false, false);
    add_to_minv(guard, gold); add_to_minv(guard, rock);
    await punish(null);
    await mondead(guard);
    assert.equal(deaths(), 0);
    assert.equal(guard.minvent.length, 0);
    assert.ok(!game.level.objects.includes(gold));
    assert.ok(game.level.objects.includes(rock));
    assert.deepEqual([rock.ox,rock.oy], old);
    assert.equal(game.level.objects.some(o=>o.ox===0&&o.oy===0), false);
});
await test('findgd reclaims a migrating owner by home level, preserving identity and list order', async () => {
    const {guard} = await start(false);
    const old = [...game.level.monsters].filter(m=>m!==guard);
    await migrate_to_level(guard, ledger_no({dnum:0,dlevel:3}), MIGR_RANDOM, null);
    assert.ok(guard.mstate & MON_MIGRATING);
    assert.ok(game.migrating_mons.includes(guard));
    const hp = guard.mhp;
    assert.equal(findgd(), guard);
    assert.deepEqual(game.level.monsters, [guard,...old]);
    assert.ok(!game.migrating_mons.includes(guard));
    assert.deepEqual(grid(guard), ['0,0']);
    assert.deepEqual(guard.mtrack, []);
    assert.deepEqual([guard.mux,guard.muy], [game.u.ux,game.u.uy]);
    assert.equal(guard.mstate, 0);
    assert.equal(guard.mhp, hp);
});
await test('ordinary guard species without EGD is not a vault owner', async () => {
    const {guard} = await start(false);
    await mongone(guard);
    const ordinary = await makemon(game.mons[P.PM_GUARD], game.u.ux+1,game.u.uy, MM_NOMSG|NO_MINVENT);
    assert.ok(ordinary && !ordinary.isgd);
    assert.equal(findgd(), null);
    await mondead(ordinary);
    assert.equal(deaths(), 1);
});
await test('a guard corpse revives as a human zombie without vault ownership', async () => {
    await start(false);
    const corpse = mkcorpstat(O.CORPSE, null,game.mons[P.PM_GUARD],game.u.ux,game.u.uy,CORPSTAT_NONE);
    const revived = await revive(corpse,false);
    assert.equal(revived.mnum, P.PM_HUMAN_ZOMBIE);
    assert.ok(!revived.isgd && !revived.mextra?.egd);
    assert.equal(deaths(), 0);
});

await test('a guard arriving on a foreign level neither owns it nor cleans its terrain', async () => {
    const {guard} = await start(false);
    await migrate_to_level(guard, ledger_no({dnum:0,dlevel:3}), MIGR_RANDOM, null);
    await goto_level({dnum:0,dlevel:3}, false, false, 0);
    assert.ok(game.level.monsters.includes(guard));
    assert.equal(guard.isgd,1);
    assert.deepEqual(guard.mextra.egd.gdlevel,{dnum:0,dlevel:2});
    assert.equal(findgd(),null);
    const before=JSON.stringify({egd:guard.mextra.egd,xy:[guard.mx,guard.my],
        terrain:guard.mextra.egd.fakecorr.map(fc=>game.level.at(fc.fx,fc.fy))});
    assert.equal(await gd_move(guard),-1);
    assert.equal(JSON.stringify({egd:guard.mextra.egd,xy:[guard.mx,guard.my],
        terrain:guard.mextra.egd.fakecorr.map(fc=>game.level.at(fc.fx,fc.fy))}),before);
    assert.equal(await grddead(guard),true);
    assert.equal(guard.isgd,0);
    assert.equal(guard.mextra.egd.fcbeg,0,'foreign-level cleanup does not touch the saved corridor');
});

await test('full save and restore retain the parked dead owner and its corridor', async () => {
    const {guard} = await blockedDeath();
    await movemon();
    const id=guard.m_id, corridor=structuredClone(guard.mextra.egd);
    assert.equal(await dosave0(),true);
    assert.equal(await dorecover(),true);
    const restored=game.level.monsters.find(m=>m.m_id===id);
    assert.ok(restored&&restored!==guard);
    assert.equal(restored.isgd,1);
    assert.equal(restored.mhp,0);
    assert.deepEqual(restored.mextra.egd,corridor);
    assert.equal(findgd(),restored);
    assert.equal(restored.mhp,0);
    assert.deepEqual(grid(restored),['0,0']);
    assert.equal(deaths(),0);
});

await test('ambient patrol feedback consults the parked owner before drawing its message', async () => {
    const {guard} = await blockedDeath(false,3);
    await movemon();
    assert.equal(guard.mextra.egd.gddone,1);
    assert.equal(game.u.urooms,'');
    initRng(84); enableRngLog();
    await dosounds();
    const calls=getRngLog();
    assert.equal(calls.length,2);
    assert.match(calls[0],/^rn2\(400\)=/);
    assert.equal(calls[1],'rn2(200)=0');
    assert.equal(guard.mhp,0);
});
await test('ambient patrol feedback resumes after the real owner is retired', async () => {
    const {guard} = await blockedDeath(false,3);
    await movemon();
    unpunish();
    await gd_move(guard);
    assert.equal(findgd(),null);
    initRng(84); enableRngLog();
    await dosounds();
    const calls=getRngLog();
    assert.equal(calls.length,3);
    assert.equal(calls[1],'rn2(200)=0');
    assert.match(calls[2],/^rn2\(2\)=/);
});
await test('restoring corridor stone removes light made by the real light producer', async () => {
    const {guard} = await start();
    await litroom(true,null);
    assert.equal(!!game.level.at(26,5).lit,true);
    await mondead(guard);
    for(const x of [26,27]) {
        const loc=game.level.at(x,5);
        assert.equal(loc.typ,STONE);
        assert.equal(loc.lit,0);
        assert.equal(loc.waslit,0);
        // Parking redraws the old guard square after restoring 26,5;
        // 27,5 is restored only on the second clear_fcorr pass.
        assert.equal(loc.seenv,x===26?128:0);
    }
});
