// Ordinary input witnesses recorded by the pinned C executable.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {ONAMES as O} from '../js/objects_data.js';
import {W_ARMF, ANTI_MAGIC} from '../js/const.js';

const file = process.argv[2] || new URL(
    'gen-sessions/generated/anti-magic-iron-shoes.session.json', import.meta.url);
const bytes = fs.readFileSync(file);
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    'b56fb686cb3b273a06f46c62cdd68d81f5866593e8e9df13c2752ce521e57746');
const raw = JSON.parse(bytes);
assert.equal(raw.version, 5);
assert.equal(raw.source, 'c');
assert.equal(raw.segments.length, 5);
const expected = [
    [O.IRON_SHOES, 0, true, true, true],
    [O.KICKING_BOOTS, 1, true, true, false],
    [O.IRON_SHOES, 0, true, false, true],
    [O.LOW_BOOTS, 2, true, false, true],
    [O.IRON_SHOES, 2, false, false, true],
];
for (const [index, part] of raw.segments.entries()) {
    test(`${part.name}: ordinary wear, trap and sit inputs reach the C branch`, async () => {
        assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
        const run = await runSegment({...part, storage:new InMemoryStorage()});
        assert.equal(run.getScreens().length, part.steps.length);
        const [type, enchantment, worn, aura, drain] = expected[index];
        const boots = game.invent.find(obj => obj.otyp === type);
        assert.ok(boots);
        assert.equal(boots.spe, enchantment);
        assert.equal(!!(boots.owornmask & W_ARMF), worn);
        assert.equal(game.u.uarmf || null, worn ? boots : null);
        assert.ok(game.level.traps.some(trap => trap.tx === game.u.ux
            && trap.ty === game.u.uy && trap.ttyp === ANTI_MAGIC && trap.tseen));
        const text = run.getScreens().map(screen => decodeScreen(screen).map(row =>
            row.map(renderCell).join('')).join('\n')).join('\n');
        assert.equal(text.includes('A lethargic aura surrounds'), aura);
        assert.equal(text.includes('magical energy drain away'), drain);
        if (aura && drain)
            assert.ok(text.indexOf('A lethargic aura surrounds') < text.indexOf('magical energy drain away'));
    });
}
