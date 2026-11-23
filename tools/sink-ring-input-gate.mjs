// Actual-input reach checks complement the native sink-ring recordings.
// Run: node tools/sink-ring-input-gate.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { ONAMES } from '../js/objects_data.js';
import { SINK, OBJ_FLOOR, OBJ_BURIED } from '../js/const.js';
import { Blind, Deaf, Hallucination } from '../js/youprop.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/sink-ring-effects.json', import.meta.url)));
const edgeTypes = {
    'blind-visual': ONAMES.RIN_ADORNMENT,
    'blind-physical': ONAMES.RIN_LEVITATION,
    'hallucinating-aggravate-monster': ONAMES.RIN_AGGRAVATE_MONSTER,
    'hallucinating-gain-strength': ONAMES.RIN_GAIN_STRENGTH,
    'hallucinating-see-invisible': ONAMES.RIN_SEE_INVISIBLE,
    'hallucinating-protection': ONAMES.RIN_PROTECTION,
    'hunger-pile': ONAMES.RIN_HUNGER,
    'buried': ONAMES.RIN_ADORNMENT,
    'backup': ONAMES.RIN_ADORNMENT,
    'deaf-conflict': ONAMES.RIN_CONFLICT,
    'blind-hunger-pile': ONAMES.RIN_HUNGER,
};

for (const part of recipe.segments) {
    const { name } = part;
    const type = edgeTypes[name]
        ?? ONAMES[name.replace(/-negative$/, '').toUpperCase().replaceAll('-', '_')];
    assert.ok(Number.isInteger(type), 'known ring type for ' + name);
    let ring, condition = false, pile = false;
    globalThis.__step_snapshot = { step: '*', cb(g) {
        ring ||= (g.invent || []).find(obj => obj.otyp === type);
        if (!ring || g.level.at(g.u.ux, g.u.uy).typ !== SINK) return;
        condition ||= name.startsWith('blind-') ? Blind()
            : name.startsWith('hallucinating-') ? Hallucination()
            : name.startsWith('deaf-') ? Deaf() : true;
        if (name.endsWith('-negative')) assert.equal(ring.spe, -2);
        if (name.includes('hunger-pile')) {
            const objects = g.level.objectsAt(g.u.ux, g.u.uy);
            pile ||= objects.some(obj => obj.otyp === ONAMES.ROCK && obj.quan === 3)
                && objects.some(obj => obj.otyp === ONAMES.DAGGER);
        }
    }};
    let run;
    try { run = await runSegment({ ...part, storage: new InMemoryStorage() }); }
    finally { delete globalThis.__step_snapshot; }
    assert.ok(ring && condition, name + ' reaches the intended condition at a sink');
    assert.ok(run.getScreens().some(screen => screen.includes('down the drain.')),
        name + ' reaches sink drop');
    if (name.includes('hunger-pile')) assert.ok(pile, name + ' reaches both floor objects');
    if (['backup', 'blind-hunger-pile', 'rin-searching', 'rin-slow-digestion'].includes(name))
        assert.equal(ring.where, OBJ_FLOOR, name + ' returns the ring');
    if (name === 'buried') assert.equal(ring.where, OBJ_BURIED);
    console.log(JSON.stringify({ name, boundaries: run.getScreens().length,
        condition, pile, where: ring.where }));
}
