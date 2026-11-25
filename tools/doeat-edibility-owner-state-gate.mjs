// Private export only. Items, forms, detection and status helpers are real.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, seed, clearMessages, messages, x, y } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import * as eating from '../js/eat.js';
import { mksobj, set_corpsenm, place_object } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { polymon } from '../js/polyself.js';
import { set_itimeout } from '../js/potion.js';
import { set_levltyp } from '../js/mkmaze.js';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { resetInputState } from '../js/input.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { ICE } from '../js/const.js';

async function fixture(spec = {}) {
    let run = await setup();
    if (spec.monk) {
        run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
            storage: new InMemoryStorage(), nethackrc: 'OPTIONS=name:Desired,role:Monk,race:human,gender:male,align:neutral,playmode:debug\n'
                + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n' });
        game._preNhgetchHook = null;
        resetInputState();
    }
    if (spec.form)
        await polymon(PMNAMES[spec.form]);
    Object.assign(game.u.uconduct, { unvegan: 1, unvegetarian: 1 }, spec.conduct);
    for (const key of spec.intrinsics || [])
        set_itimeout(key, 30);
    const obj = mksobj(ONAMES[spec.type || 'CORPSE'], false, false);
    if (spec.species || obj.otyp === ONAMES.CORPSE)
        set_corpsenm(obj, PMNAMES[spec.species || 'PM_GIANT_RAT']);
    Object.assign(obj, { age: game.moves - (spec.age || 0), quan: spec.count || 1,
        cursed: +!!spec.cursed, blessed: +!!spec.blessed, orotten: +!!spec.rotten,
        oerodeproof: +!!spec.proof });
    if (spec.ice) {
        assert.equal(set_levltyp(x, y, ICE), true);
        await place_object(obj, x, y);
        assert.equal(obj.on_ice, 1);
        game.moves += 80;
    } else {
        await addinv(obj);
    }
    game.u.uedibility = 1;
    clearMessages();
    run._display.clearInputQueue();
    game.command_queue = [];
    run._display.onEmptyQueue = () => { throw Error('unexpected extra input'); };
    run._display.pushKey((spec.answer || 'n').charCodeAt(0));
    seed();
    return { obj, run };
}

const cases = [
    ['taint precedes every other hazard', { species: 'PM_COCKATRICE', age: 60 }, /could be tainted!/],
    ['stone hazard', { species: 'PM_COCKATRICE' }, /something very dangerous!/],
    ['taint with real green dragon defense', { age: 60, form: 'PM_GREEN_DRAGON' }, /could be tainted\./],
    ['stone precedes protected taint', { species: 'PM_COCKATRICE', age: 60, form: 'PM_GREEN_DRAGON' }, /something very dangerous!/],
    ['rotten age boundary', { age: 40 }, /could be rotten!/],
    ['explicit rotten flag', { type: 'CARROT', rotten: true }, /could be rotten!/],
    ['poisonous corpse', { species: 'PM_KOBOLD' }, /might be poisonous!/],
    ['poisoned apple', { type: 'APPLE', cursed: true }, /might have been poisoned\./],
    ['Monk conduct before acid', { monk: true, species: 'PM_GIANT_RAT', conduct: { unvegetarian: 0 } }, /smells unhealthy\./],
    ['acidic corpse', { species: 'PM_ACID_BLOB' }, /rather acidic\./],
    ['rustproof rejection warning', { type: 'DAGGER', form: 'PM_RUST_MONSTER', proof: true }, /disgusting to you right now\./],
    ['vegan conduct', { type: 'TALLOW_CANDLE', conduct: { unvegan: 0, unvegetarian: 0 } }, /foul and unfamiliar/],
    ['vegetarian conduct', { type: 'LEATHER_GLOVES', conduct: { unvegan: 1, unvegetarian: 0 } }, /smells unfamiliar/],
    ['green slime glob', { type: 'GLOB_OF_GREEN_SLIME' }, /something very dangerous!/],
    ['petrifying egg', { type: 'EGG', species: 'PM_COCKATRICE' }, /something very dangerous!/],
    ['petrifying tin', { type: 'TIN', species: 'PM_COCKATRICE' }, /something very dangerous!/],
    ['cursed age adjustment', { age: 40, cursed: true }, /could be tainted!/],
    ['blessed age adjustment', { age: 70, blessed: true }, /could be rotten!/],
    ['actual ice placement halves effective age without mutation', { ice: true }, /could be rotten!/],
    ['plural grammar and one-item question', { age: 60, count: 3 }, /corpses smell like they could be tainted!  Eat one anyway/],
];
for (const [name, spec, pattern] of cases) {
    test(name, async () => {
        assert.equal(typeof eating.edibility_prompts, 'function');
        const { obj } = await fixture(spec);
        const before = { age: obj.age, ice: obj.on_ice, where: obj.where, count: obj.quan };
        assert.equal(await eating.edibility_prompts(obj), 1);
        assert.match(messages(), pattern);
        assert.equal(game.u.uedibility, 1, 'lifetime belongs to doeat');
        assert.deepEqual({ age: obj.age, ice: obj.on_ice, where: obj.where, count: obj.quan }, before);
        assert.deepEqual(getRngLog(), [], 'worst-case warning does not randomize rot');
    });
}
for (const [name, spec] of [
    ['ordinary food', { type: 'CARROT' }],
    ['future-dated corpse truncation', { age: -1 }],
    ['poison resistance', { species: 'PM_KOBOLD', intrinsics: ['HPoison_resistance'] }],
    ['sleep resistance', { type: 'APPLE', cursed: true, intrinsics: ['HSleep_resistance'] }],
    ['stone resistance', { species: 'PM_COCKATRICE', intrinsics: ['HStone_resistance'] }],
    ['golem petrification conversion', { species: 'PM_COCKATRICE', form: 'PM_FLESH_GOLEM' }],
    ['slimeproof form', { type: 'GLOB_OF_GREEN_SLIME', form: 'PM_GREEN_SLIME' }],
    ['unchanging blocks slime', { type: 'GLOB_OF_GREEN_SLIME', intrinsics: ['HUnchanging'] }],
    ['lizard never taints', { species: 'PM_LIZARD', age: 150 }],
    ['lichen never taints', { species: 'PM_LICHEN', age: 150 }],
    ['acid blob never taints', { species: 'PM_ACID_BLOB', age: 150, intrinsics: ['HAcid_resistance'] }],
    ...['PM_DEATH', 'PM_PESTILENCE', 'PM_FAMINE'].map(species => [species + ' never taints', { species, age: 150 }]),
]) {
    test(`safe boundary: ${name}`, async () => {
        assert.equal(typeof eating.edibility_prompts, 'function');
        const { obj, run } = await fixture(spec);
        const queued = run._display.inputQueueLength;
        assert.equal(await eating.edibility_prompts(obj), 0);
        assert.equal(run._display.inputQueueLength, queued);
        assert.equal(game.u.uedibility, 1);
        assert.equal(messages().trim(), '');
        assert.deepEqual(getRngLog(), []);
    });
}
test('yes returns the distinct accepted-warning result without consuming the sense itself', async () => {
    assert.equal(typeof eating.edibility_prompts, 'function');
    const { obj } = await fixture({ type: 'APPLE', cursed: true, answer: 'y' });
    assert.equal(await eating.edibility_prompts(obj), 2);
    assert.equal(game.u.uedibility, 1);
    assert.deepEqual(getRngLog(), []);
});
for (const species of ['PM_DEATH', 'PM_PESTILENCE', 'PM_FAMINE']) {
    test(`shared nonrotting predicate includes ${species}`, async () => {
        await setup();
        assert.equal(eating.nonrotting_corpse(PMNAMES[species]), true);
    });
}
