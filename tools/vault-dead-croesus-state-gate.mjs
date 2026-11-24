// C vault.c:513-543. Real death, status, anger and weapon producers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {invault, findgd, vault_summon_gd, vault_occupied} from '../js/vault.js';
import {makemon, mongets} from '../js/makemon.js';
import {mondead, mongone} from '../js/mon.js';
import {MON_WEP} from '../js/monst.js';
import {mon_wield_item, select_hwep} from '../js/weapon.js';
import {make_deaf, make_blinded} from '../js/potion.js';
import {Deaf, Blind} from '../js/youprop.js';
import {resetInputState} from '../js/input.js';
import {obj_extract_self} from '../js/invent.js';
import {place_object, curse} from '../js/mkobj.js';
import {make_engr_at, engr_at} from '../js/engrave.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {MM_NOMSG, NO_MINVENT, NEED_HTH_WEAPON, NEED_WEAPON,
    W_WEP, STRAT_WAITMASK, ENGRAVE, PLINE_VERBALIZE} from '../js/const.js';

const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-interrogation-feedback.json', import.meta.url)));
const foundation = recipe.segments[0];

async function exercise({mode = 'hearing', life = 'dead', answer = 'Croesus',
    equipment = 'fresh', bystander = false, elbereth = false} = {}) {
    const run = await runSegment({...foundation, moves: foundation.moves.slice(0, 43),
        storage: new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    let reads = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++reads < 30, 'bounded producer feedback');
        return 32;
    };
    assert.ok(vault_occupied(game.u.urooms));
    assert.equal(findgd(), null);
    const croesus = await makemon(game.mons[P.PM_CROESUS],
        game.u.ux, game.u.uy + 1, MM_NOMSG | NO_MINVENT);
    assert.equal(croesus.mnum, P.PM_CROESUS);
    assert.equal(croesus.cham, -1);
    if (life === 'dead') await mondead(croesus);
    else await mongone(croesus);
    assert.equal(game.mvitals[P.PM_CROESUS].died || 0, life === 'dead' ? 1 : 0);
    const witness = bystander ? await makemon(game.mons[P.PM_ORACLE],
        game.u.ux, game.u.uy + 1, MM_NOMSG | NO_MINVENT) : null;
    if (witness) assert.equal(!!witness.mpeaceful, true);
    await make_deaf(mode === 'hearing' ? 0 : 100, false);
    if (mode === 'deaf-blind') await make_blinded(100, false);
    assert.equal(Deaf(), mode !== 'hearing');
    assert.equal(Blind(), mode === 'deaf-blind');
    const engraving = elbereth
        ? make_engr_at(game.u.ux, game.u.uy, 'Elbereth', null, game.moves, ENGRAVE)
        : null;
    game._toplin = 0;
    game._toplines = '';
    game._pending_message = '';
    game._msg_history = [];

    let prepared = false, letter = 0, chosen, previous, guard, initial;
    const pending = [], messages = [];
    const align = game.u.ualign.record, abuse = game.u.ualign.abuse || 0;
    const before = getRngLog().length;
    reads = 0;
    run._display.onEmptyQueue = async () => {
        assert.ok(++reads < 100, 'bounded dialogue input');
        const text = game._toplines || '';
        messages.push(text);
        if (/supply your name|Hello stranger/.test(text) && !prepared) {
            prepared = true;
            guard = findgd();
            assert.ok(guard);
            initial = {malign: guard.malign, movement: guard.movement,
                location: {...game.level.at(guard.mx, guard.my)}};
            assert.equal(MON_WEP(guard), null, 'makemon does not wield a weapon');
            if (equipment === 'empty') {
                for (const obj of [...guard.minvent]) {
                    obj_extract_self(obj);
                    await place_object(obj, game.u.ux, game.u.uy);
                }
            } else {
                // Give a real inventory object, then use the runtime selector.
                mongets(guard, O.LONG_SWORD);
            }
            chosen = select_hwep(guard);
            if (equipment === 'empty') assert.equal(chosen, null);
            else assert.ok(chosen);
            if (equipment === 'cursed') await curse(chosen);
            if (equipment === 'already') {
                guard.weapon_check = NEED_HTH_WEAPON;
                assert.equal(await mon_wield_item(guard), 1);
                previous = MON_WEP(guard);
            }
        }
        await setImmediate();
        const g = findgd();
        pending.push({text, peaceful: g?.mpeaceful,
            weapon: MON_WEP(g || {})?.o_id ?? null,
            mask: MON_WEP(g || {})?.owornmask || 0,
            align: game.u.ualign.record});
        if (/supply your name|Hello stranger/.test(text))
            return (answer + '\n').charCodeAt(letter++);
        return 32;
    };
    vault_summon_gd();
    assert.equal(await invault(), undefined, 'invault retains its void caller contract');
    messages.push(game._toplines || '', ...(game._msg_history || []));
    assert.equal(game.pline_flags & PLINE_VERBALIZE, 0);
    return {guard: findgd(), created: guard, initial, chosen, previous, witness,
        align, abuse, engraving, pending, text: messages.join('\n'),
        calls: getRngLog().slice(before)};
}

for (const [mode, answer] of [['hearing', 'CrOeSuS'], ['deaf', 'Kroisos'], ['deaf-blind', 'Creosote']]) {
    await test(`${mode}, ${answer}: anger completes before response and wield`, async () => {
        const r = await exercise({mode, answer});
        assert.equal(r.guard.mpeaceful, 0);
        assert.equal(game.u.ualign.record, r.align - 1);
        assert.equal(game.u.ualign.abuse, r.abuse + 1);
        assert.equal(r.guard.mstrategy & STRAT_WAITMASK, 0);
        assert.equal(r.guard.malign, r.initial.malign, 'C does not recalculate malign here');
        assert.equal(MON_WEP(r.guard), r.chosen);
        assert.equal(r.chosen.owornmask & W_WEP, W_WEP);
        assert.equal(r.guard.weapon_check, NEED_WEAPON);
        assert.equal(r.guard.movement, r.initial.movement, 'ignored return does not spend movement');
        assert.equal(r.guard.mextra.egd.fcend || 0, 0);
        assert.deepEqual(game.level.at(r.guard.mx, r.guard.my), r.initial.location);
        assert.equal(r.text.includes('gets angry!'), true);
        assert.equal(r.text.includes('Back from the dead'), mode === 'hearing');
        assert.equal(r.text.includes('mouths something'), mode === 'deaf');
        assert.equal(r.text.includes('wields'), mode !== 'deaf-blind');
        const angry = r.pending.find(s => s.text.includes('gets angry!'));
        if (mode === 'hearing') {
            assert.ok(angry);
            assert.equal(angry.weapon, null);
            assert.equal(angry.align, r.align - 1);
        }
        assert.ok(r.pending.filter(s => /Back from|mouths something/.test(s.text))
            .every(s => s.peaceful === 0 && s.align === r.align - 1));
    });
}
for (const mode of ['hearing', 'deaf', 'deaf-blind']) {
    await test(`${mode}: removing living Croesus does not increment deaths or anger guard`, async () => {
        const r = await exercise({mode, life: 'removed'});
        assert.equal(r.guard, null);
        assert.equal(game.u.ualign.record, r.align);
        assert.equal(game.mvitals[P.PM_CROESUS].died || 0, 0);
        assert.equal(r.text.includes('gets angry!'), false);
        assert.equal(r.text.includes('Back from'), false);
        assert.equal(r.text.includes('wields'), false);
    });
}
await test('real death with an unrecognized name keeps ordinary escort behavior', async () => {
    const r = await exercise({answer: 'Croesus junior'});
    assert.equal(r.guard.mpeaceful, 1);
    assert.equal(game.u.ualign.record, r.align);
    assert.equal(MON_WEP(r.guard), null);
    assert.equal(r.guard.mextra.egd.fcend, 1);
    assert.equal(r.guard.mextra.egd.dropgoldcnt, 1);
    assert.ok(r.text.includes("I don't know you."));
});
await test('already wielded real weapon is preserved without a second wield', async () => {
    const r = await exercise({equipment: 'already'});
    assert.equal(MON_WEP(r.guard), r.previous);
    assert.equal(r.previous.owornmask & W_WEP, W_WEP);
    assert.equal(game.u.ualign.record, r.align - 1);
    assert.equal(r.guard.weapon_check, NEED_WEAPON);
});
await test('empty real inventory completes unsuccessful selection and resets weapon check', async () => {
    const r = await exercise({equipment: 'empty'});
    assert.equal(MON_WEP(r.guard), null);
    assert.equal(r.guard.weapon_check, NEED_WEAPON);
    assert.equal(game.u.ualign.record, r.align - 1);
    assert.equal(r.text.includes('wields'), false);
});
await test('cursed real weapon welds before invault returns', async () => {
    const r = await exercise({equipment: 'cursed'});
    assert.equal(MON_WEP(r.guard), r.chosen);
    assert.equal(r.chosen.owornmask & W_WEP, W_WEP);
    assert.equal(r.chosen.bknown, 1);
    assert.ok(r.text.includes('welds itself'));
});
await test('non-attack anger preserves Elbereth and applies only its ordinary penalty', async () => {
    const r = await exercise({elbereth: true});
    assert.equal(engr_at(game.u.ux, game.u.uy).engr_txt, 'Elbereth');
    assert.equal(game.u.ualign.record, r.align - 1);
    assert.equal(r.text.includes('hypocrite'), false);
});
await test('real peaceful bystander responds before the guard reply', async () => {
    const r = await exercise({bystander: true});
    assert.equal(r.witness.mpeaceful, 0);
    assert.equal(game.u.ualign.record, r.align - 2);
    assert.ok(r.text.includes('Oracle'));
    assert.equal(MON_WEP(r.guard), r.chosen);
});
