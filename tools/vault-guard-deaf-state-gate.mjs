// C vault.c:948-1070. Real guard/status/object producers, no stubbed movers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {gd_move, vault_occupied} from '../js/vault.js';
import {make_deaf, make_blinded} from '../js/potion.js';
import {Deaf, Blind} from '../js/youprop.js';
import {resetInputState} from '../js/input.js';
import {initRng, enableRngLog, getRngLog, rn2} from '../js/rng.js';
import {mksobj} from '../js/mkobj.js';
import {addinv, money_cnt} from '../js/invent.js';
import {ONAMES} from '../js/objects_data.js';
import {teleds} from '../js/teleport.js';
import {makemon} from '../js/makemon.js';
import {mhitm_ad_stck} from '../js/uhitm.js';
import {polymon} from '../js/polyself.js';
import {sticks} from '../js/mondata.js';
import {PMNAMES, ATTKS} from '../js/monst_data.js';
import {VAULT, NO_MINVENT, MM_NOMSG, MM_NOGRP, MM_NOCOUNTBIRTH} from '../js/const.js';

const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-guard-deaf-feedback.json', import.meta.url)));
const part = recipe.segments[0];
const seeds = {};
for (let seed = 0; seed < 32 && (seeds.zero === undefined || seeds.nonzero === undefined); seed++) {
    initRng(seed);
    const key = rn2(10) === 0 ? 'zero' : 'nonzero';
    if (seeds[key] === undefined) seeds[key] = seed;
}
assert.notEqual(seeds.zero, undefined);
assert.notEqual(seeds.nonzero, undefined);

function clearMessages() {
    game._toplin = 0;
    game._toplines = '';
    game._pending_message = '';
    game._msg_history = [];
}
async function setup(kind, deaf = false, blind = false) {
    const moves = kind === 'corridor' ? part.moves.slice(0, 90) + 'd$l\x1b\x1b'
        : kind === 'exit' ? part.moves.slice(0, 90) + 'd$\x1b'
        : part.moves.slice(0, kind === 'warn3' ? 159 : 167);
    const run = await runSegment({...part, moves, storage: new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    let reads = 0;
    run._display.onEmptyQueue = () => {assert.ok(++reads <= 24, 'bounded message input'); return 32;};
    const guard = game.level.monsters.find(m => m.isgd);
    assert.ok(guard);
    assert.equal(guard.mpeaceful, 1);
    assert.equal(guard.mextra.egd.fcend, kind === 'corridor' ? 2 : 1);
    if (kind.startsWith('warn')) assert.equal(guard.mextra.egd.warncnt, kind === 'warn3' ? 3 : 7);
    await make_deaf(deaf ? 100 : 0, false);
    if (blind) await make_blinded(100, false);
    assert.equal(Deaf(), deaf);
    assert.equal(Blind(), blind);
    clearMessages();
    return guard;
}
function resetCalls(seed = seeds.zero) {
    clearMessages();
    initRng(seed);
    enableRngLog();
}

for (const deaf of [false, true]) {
    await test(`warning three: ${deaf ? 'deaf' : 'hearing'} speech and drop counter`, async () => {
        const g = await setup('warn3', deaf), e = g.mextra.egd;
        const drop = e.dropgoldcnt, at = [g.mx, g.my];
        resetCalls();
        assert.equal(await gd_move(g), 0);
        assert.equal(e.warncnt, 4);
        assert.equal(e.dropgoldcnt, drop + (deaf ? 0 : 1));
        assert.deepEqual([g.mx, g.my], at);
        assert.equal(g.mpeaceful, 1);
        assert.equal(game._toplines, deaf ? '' : '"I repeat, drop that gold and follow me!"');
        assert.deepEqual(getRngLog(), []);
    });
    await test(`warning seven: ${deaf ? 'deaf' : 'hearing'} keeps hostile relocation and fallback`, async () => {
        const g = await setup('warn7', deaf), at = [g.mx, g.my];
        resetCalls();
        assert.equal(await gd_move(g), -1);
        assert.equal(g.mpeaceful, 0);
        assert.notDeepEqual([g.mx, g.my], at);
        assert.equal(game.level.monAt.get(`${g.mx},${g.my}`), g);
        assert.equal(game._toplines, deaf ? '' : '"You\'ve been warned, knave!"');
        assert.ok(getRngLog().length > 0, 'real mnexto relocation');
    });
    await test(`begone: ${deaf ? 'deaf' : 'hearing'} keeps cleanup`, async () => {
        const g = await setup('exit', deaf);
        assert.equal(money_cnt(game.invent), 0);
        const room = game.level.rooms.find(r => r.rtype !== VAULT && r.lx > 0);
        await teleds(room.lx, room.ly, 0);
        assert.equal(vault_occupied(game.u.urooms), 0);
        assert.equal(g.mextra.egd.fcend, 1);
        clearMessages();
        const result = await gd_move(g);
        assert.ok(result === 1 || result === -2);
        assert.equal(g.mextra.egd.gddone, 1);
        assert.equal([game._toplines, ...game._msg_history].join('\n').includes('Well, begone.'), !deaf);
    });
}
await test('clearing the real deaf timeout restores warning-three speech and counter', async () => {
    const g = await setup('warn3', true);
    await make_deaf(0, false);
    assert.equal(Deaf(), false);
    clearMessages();
    const drop = g.mextra.egd.dropgoldcnt;
    assert.equal(await gd_move(g), 0);
    assert.equal(g.mextra.egd.dropgoldcnt, drop + 1);
    assert.match(game._toplines, /I repeat/);
});
for (const mode of ['hearing', 'deaf', 'deaf-blind']) {
    await test(`gold demands: ${mode} keeps warning six then hostility`, async () => {
        const deaf = mode !== 'hearing', blind = mode === 'deaf-blind';
        const g = await setup('corridor', deaf, blind);
        assert.equal(g.female, 1, 'real guard producer selects a female guard');
        addinv(mksobj(ONAMES.GOLD_PIECE, false, false));
        assert.ok(money_cnt(game.invent) > 0);
        resetCalls();
        assert.equal(await gd_move(g), 0);
        assert.equal(g.mextra.egd.warncnt, 6);
        assert.equal(g.mpeaceful, 1);
        assert.equal(game._toplines, blind ? '' : deaf
            ? 'The guard holds out her palm demandingly!' : '"Drop all your gold, scoundrel!"');
        clearMessages();
        assert.equal(await gd_move(g), -1);
        assert.equal(g.mpeaceful, 0);
        assert.equal(game._toplines, blind ? '' : deaf
            ? 'The guard rubs her hands with enraged delight!' : '"So be it, rogue!"');
        assert.deepEqual(getRngLog(), []);
    });
}
for (const mode of ['hearing', 'deaf', 'nonzero', 'held', 'holding']) {
    await test(`move-along: ${mode} preserves its draw before feedback guards`, async () => {
        const g = await setup('corridor', mode === 'deaf');
        assert.equal(money_cnt(game.invent), 0);
        if (mode === 'held' || mode === 'holding') {
            const type = mode === 'held' ? PMNAMES.PM_LARGE_MIMIC : PMNAMES.PM_KOBOLD;
            const mon = await makemon(game.mons[type], 23, 5,
                NO_MINVENT | MM_NOMSG | MM_NOGRP | MM_NOCOUNTBIRTH);
            assert.ok(mon);
            if (mode === 'holding') assert.ok(await polymon(PMNAMES.PM_LARGE_MIMIC));
            const attacker = mode === 'held' ? mon : game.youmonst;
            const defender = mode === 'held' ? game.youmonst : mon;
            const attack = attacker.data.mattk.find(a => a[1] === ATTKS.AD_STCK);
            assert.ok(attack);
            for (let n = 0; n < 8 && !game.u.ustuck; n++)
                await mhitm_ad_stck(attacker, attack, defender, {damage: 0, indx: 0});
            assert.equal(game.u.ustuck, mon);
            assert.equal(sticks(game.youmonst.data), mode === 'holding');
        }
        resetCalls(mode === 'nonzero' ? seeds.nonzero : seeds.zero);
        assert.equal(await gd_move(g), 0);
        const expectedSpeech = mode === 'hearing' || mode === 'holding';
        assert.equal(game._toplines, expectedSpeech ? '"Move along!"' : '');
        assert.equal(g.mpeaceful, 1);
        assert.equal(getRngLog().length, 1);
        assert.match(getRngLog()[0], mode === 'nonzero' ? /^rn2\(10\)=[1-9]/ : /^rn2\(10\)=0/);
    });
}
console.log(JSON.stringify({stateRngSeeds: seeds, ordinaryInputSeedsScanned: [7303]}));
