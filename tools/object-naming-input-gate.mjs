// node tools/object-naming-input-gate.mjs <eight-case-session.json>
// node tools/object-naming-input-gate.mjs --extra <four-prompt-case-session.json>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { ONAMES } from '../js/objects_data.js';
import { ART_STING, ART_EYES_OF_THE_OVERWORLD } from '../js/artilist_data.js';
import { QBUFSZ } from '../js/const.js';

const extra = process.argv[2] === '--extra';
const input = normalizeSession(JSON.parse(readFileSync(process.argv[extra ? 3 : 2], 'utf8')));
assert.equal(input.segments.length, extra ? 4 : 8);

for (const [index, segment] of input.segments.entries()) {
    const states = [];
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    globalThis.__step_snapshot = { step: '*', cb(g, step) {
        states[step] = { step, literate: g.u.uconduct.literate,
            discoveries: [...(g.artidisco || [])], topline: g._toplines,
            inventory: (g.invent || []).map(o => ({ id: o.o_id, type: o.otyp,
                name: o.oname ?? null, artifact: o.oartifact || 0, quantity: o.quan,
                known: o.known, called: g.objects[o.otyp].oc_uname || null })) };
    } };
    let run;
    try { run = await runSegment({ ...segment, storage: new InMemoryStorage() }); }
    finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const result = { segment: index, boundaries: run.getScreens().length,
        calls: run.getRngLog().length, pass: false };
    try {
        assert.equal(result.boundaries, (extra ? [61,95,189,60] : [47,49,69,52,47,64,36,55])[index]);
        assert.equal(result.boundaries, segment.moves.length + 1);
        const text = run.getScreens().map(s => decodeScreen(s)
            .map(row => row.map(c => c.ch).join('').trimEnd()).join('\n'));
        const final = states.at(-1), target = final.inventory.at(-1);
        if (!extra) {
            const names = ['Magicbare', 'Sting', 'Stinc', 'St?ng', 'mAgIcBaNe', null,
                'The Light Fantastic', 'The (rb of Fate']; // native inventory/message witnesses
            const types = [ONAMES.ATHAME, ONAMES.ELVEN_DAGGER, ONAMES.ELVEN_DAGGER,
                ONAMES.ELVEN_DAGGER, ONAMES.DAGGER, ONAMES.DAGGER, ONAMES.SPE_NOVEL,
                ONAMES.CRYSTAL_BALL];
            assert.equal(target.type, types[index]);
            assert.equal(target.name, names[index]);
            assert.equal(target.artifact, index === 1 ? ART_STING : 0);
            assert.equal(target.quantity, index === 3 ? 3 : 1);
            assert.equal(final.literate, [1,1,1,1,0,0,0,1][index]);
            if ([0,2,3,7].includes(index)) {
                const step = [40,0,62,45,0,0,0,48][index];
                assert.equal(states[step - 1].inventory.at(-1).artifact, 0);
                assert.ok(text[step].startsWith('While engraving, your hand slips.--More--'));
                assert.ok(text[step + 1].startsWith(`You engrave: "${names[index]}".`));
            }
            if (index === 2) {
                assert.equal(final.inventory.length, 2);
                assert.equal(final.inventory[0].artifact, ART_STING);
                assert.equal(final.inventory[0].name, 'Sting');
                assert.equal(final.inventory[0].quantity, 1);
            }
            if (index === 5)
                assert.ok(states.some(s => s.inventory[0]?.name === 'travel knife'));
            if (index === 6) {
                assert.ok(text[29].startsWith('Your paperback book already has a published name.'));
                assert.ok(!states.some(s => s.topline?.startsWith('What do you want to name this')));
            }
        } else {
            if (index < 2) {
                assert.equal(target.type, ONAMES.LENSES);
                assert.equal(target.artifact, ART_EYES_OF_THE_OVERWORLD);
                assert.equal(target.name, 'The Eyes of the Overworld');
                assert.equal(target.known, 1); // object knowledge alone is insufficient
                assert.equal(final.discoveries.includes(ART_EYES_OF_THE_OVERWORLD), index === 1);
                assert.equal(final.literate, index === 1 ? 1 : 0);
                const prompt = index === 0 ? 45 : 79;
                assert.equal(states[prompt].topline, index === 0
                    ? 'What do you want to name this pair of lenses named the Eyes of the Overworld? '
                    : 'What do you want to name these Eyes of the Overworld? ');
                if (index === 1) {
                    assert.ok(states.some(s => s.inventory.some(o => o.type === ONAMES.SCR_IDENTIFY)));
                    assert.ok(text.some(s => s.startsWith('As you read the scroll, it disappears.')));
                    assert.ok(!final.inventory.some(o => o.type === ONAMES.SCR_IDENTIFY));
                    assert.ok(states.slice(0,67).every(s => !s.discoveries.includes(ART_EYES_OF_THE_OVERWORLD)));
                }
            } else if (index === 2) {
                assert.equal(target.type, ONAMES.POT_GAIN_ENERGY);
                assert.equal(target.name, 'N'.repeat(62));
                assert.equal(target.called, 'M'.repeat(62));
                assert.equal(target.artifact, 0);
                assert.equal(final.literate, 0);
                const prompt = states[185].topline.trimEnd();
                assert.equal(prompt, 'What do you want to name this potion called MMMMMMMM... named '
                    + 'N'.repeat(62) + '?');
                assert.ok(prompt.length < QBUFSZ);
                assert.deepEqual(states[185].inventory, final.inventory, 'short prompt and cancel preserve full names');
            } else {
                assert.equal(target.name, 'Sting'); assert.equal(target.artifact, ART_STING);
                assert.equal(final.literate, 0);
                for (const step of [29,38,47]) {
                    assert.equal(states[step].topline, 'What do you want to name this runed dagger named Sting? ');
                    assert.deepEqual(states[step].inventory, final.inventory);
                }
                assert.ok(text[53].startsWith('Sting resists the attempt.'));
                assert.ok(text.slice(0,47).every(s => !s.includes('resists the attempt.')));
            }
        }
        result.pass = true;
    } catch (error) {
        result.error = error.message;
        process.exitCode = 1;
    }
    console.log(JSON.stringify(result));
}
