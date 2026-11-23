// C save.c:141-145 removes startup date luck before serializing the hero.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { dosave0, gamestate_decode } from '../js/save.js';
import { change_luck } from '../js/attrib.js';
import { FULL_MOON, LUCKMIN, LUCKMAX } from '../js/const.js';
import { getRngLog } from '../js/rng.js';

const dates = {
    ordinary: '20000110090000',
    moon: '20000120090000',
    friday: '20261113090000',
    both: '20140613090000',
};

async function boot(date) {
    const storage = new InMemoryStorage();
    await runSegment({
        seed: 99812,
        datetime: dates[date],
        moves: '    ',
        storage,
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
    });
    assert.equal(game.flags.moonphase === FULL_MOON, date === 'moon' || date === 'both');
    assert.equal(!!game.flags.friday13, date === 'friday' || date === 'both');
    assert.equal(game.u.uluck, date === 'moon' ? 1 : date === 'friday' ? -1 : 0);
    return storage;
}

for (const [name, date, luck, savedLuck] of [
    ['ordinary startup', 'ordinary', 0, 0],
    ['ordinary gameplay bonus', 'ordinary', 7, 7],
    ['full moon startup', 'moon', 1, 0],
    ['Friday startup', 'friday', -1, 0],
    ['full moon at the lower limit', 'moon', LUCKMIN, LUCKMIN],
    ['full moon at the upper limit', 'moon', LUCKMAX, LUCKMAX - 1],
    ['Friday at the lower limit', 'friday', LUCKMIN, LUCKMIN + 1],
    ['Friday at the upper limit', 'friday', LUCKMAX, LUCKMAX],
    ['both adjustments at the lower limit', 'both', LUCKMIN, LUCKMIN + 1],
    ['both adjustments at the upper limit', 'both', LUCKMAX, LUCKMAX],
]) {
    test(name, async () => {
        const storage = await boot(date);
        change_luck(luck - game.u.uluck);
        assert.equal(game.u.uluck, luck);
        const rng = [...getRngLog()];
        assert.equal(await dosave0(), true);
        const saved = gamestate_decode(JSON.parse(storage.getItem('save:wizard')));
        assert.equal(saved.u.uluck, savedLuck);
        assert.equal(game.u.uluck, savedLuck);
        assert.deepEqual(getRngLog(), rng, 'date luck changes consume no RNG');
    });
}

for (const date of ['ordinary', 'moon', 'friday', 'both']) {
    test(`${date}: refused storage preserves luck and prior save`, async () => {
        const storage = await boot(date);
        change_luck(LUCKMIN - game.u.uluck);
        storage.setItem('save:wizard', 'prior saved bytes');
        const write = storage.setItem.bind(storage);
        storage.setItem = (key, value) => {
            if (key.startsWith('save:')) throw new Error('quota exhausted');
            return write(key, value);
        };
        const level = game.level;
        const inventory = game.invent;
        const rng = [...getRngLog()];
        assert.equal(await dosave0(), false);
        assert.equal(game.u.uluck, LUCKMIN);
        assert.equal(storage.getItem('save:wizard'), 'prior saved bytes');
        assert.equal(game.level, level);
        assert.equal(game.invent, inventory);
        assert.deepEqual(getRngLog(), rng);
    });
}

test('missing storage leaves the startup luck intact', async () => {
    await boot('moon');
    game.storage = null;
    const rng = [...getRngLog()];
    assert.equal(await dosave0(), false);
    assert.equal(game.u.uluck, 1);
    assert.deepEqual(getRngLog(), rng);
});
