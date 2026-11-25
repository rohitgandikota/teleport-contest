// Reuse the original nine C inputs. No state changes in the observer.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {observe, unobserved, hashes, hash} from './muse-misc-observe.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {W_WEP} from '../js/const.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/monster-miscellaneous-use.json', import.meta.url)));
const bytes = readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/monster-miscellaneous-use.session.json', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '0aef44bd299815a5383f6d67d02202b1eb78fd3688e05e9ca2f029fedf853f1b');
const raw = JSON.parse(bytes);
assert.equal(raw.source, 'c'); assert.equal(raw.version, 5);
assert.equal(raw.segments.length, 9);
const tuple = p => ['name', 'seed', 'datetime', 'nethackrc', 'moves']
    .map(field => ({field, present:Object.hasOwn(p,field), value:p[field]}));
function top(screen) {
    return decodeScreen(screen).slice(0,3)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n');
}
for (const [i, part] of raw.segments.entries()) {
    assert.equal(hash(tuple(part)), hash(tuple(recipe.segments[i])));
    assert.deepEqual(part.steps.map(s => s.key), [null, ...part.moves]);
    test(`ordinary C case ${i}: ${part.name}; all-five observer neutrality`, async () => {
        const seen = await observe(part, true), plain = await unobserved(part);
        assert.deepEqual(seen.output, plain);
        assert.deepEqual(seen.hashes, hashes(plain));
        const cText = part.steps.map(s => top(s.screen)).join('\n');
        const jText = seen.lines.map(l => l.text).join('\n');
        const monsters = seen.states.flatMap(s => s.monsters);
        if (i === 0) {
            const witness = /<40,6>: The orc wields a bullwhip!--More--/;
            assert.match(cText, witness); assert.match(jText, witness);
            assert.match(cText, /<40,6>: The orc lashes his bullwhip\./);
            assert.match(jText, /<40,6>: The orc lashes his bullwhip\./);
            assert.ok(monsters.some(m => m.type === P.PM_ORC
                && m.inventory.some(o => o.type === O.BULLWHIP && (o.worn & W_WEP))));
            const boundary = seen.lines.find(l => witness.test(l.text));
            assert.ok(boundary); assert.doesNotMatch(boundary.text, /lashes/);
        } else if (i === 3) {
            const witness = /<39,5>: The owlbear hits!  <39,5>: The owlbear hits again!/;
            assert.match(cText, witness); assert.match(jText, witness);
            const goblin = monsters.find(m => m.type === P.PM_GOBLIN);
            assert.ok(goblin && monsters.some(m => m.id === goblin.id && m.type === P.PM_OWLBEAR));
        } else if (i === 5) {
            assert.match(cText, /<40,6>: The goblin hits!/);
            assert.match(jText, /<40,6>: The goblin hits!/);
            assert.ok(monsters.some(m => m.type === P.PM_GOBLIN
                && m.inventory.some(o => o.type === O.SACK)));
        } else {
            // These controls exercise the original owner without accessible prefixes.
            assert.ok(seen.states.every(s => !s.accessible));
            assert.ok(!/<\d+,\d+>: /.test(jText));
            const witness = i <= 2 ? /The orc lashes his/ : i === 4 ? /The owlbear hits!/
                : i === 6 ? /The goblin hits!/ : /The stone giant rises up, through the ceiling!/;
            assert.match(cText, witness); assert.match(jText, witness);
        }
    });
}
