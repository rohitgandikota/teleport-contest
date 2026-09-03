#!/usr/bin/env node

// The C falling-trap oracle covers all five trap types. Noticing the effect
// must reach the caller so learnwand identifies the opening wand.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/wand-opening-falling-traps.json', import.meta.url), 'utf8'));
for (const [index, segment] of recipe.segments.entries()) {
    await runSegment({ ...segment });
    assert.ok(game.objects[ONAMES.WAN_OPENING].oc_name_known,
              `segment ${index}: noticed trap identifies the wand`);
}

console.log('trap opening state: PASS');
