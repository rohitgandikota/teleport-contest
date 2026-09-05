#!/usr/bin/env node

// C hack.h:1021 EXACT_NAME includes SUPPRESS_SADDLE. Check its effect on a
// real saddled steed left by an existing C gameplay fixture, not just its bits.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { x_monnam } from '../js/do_name.js';
import { ARTICLE_A, EXACT_NAME, SUPPRESS_SADDLE, W_SADDLE } from '../js/const.js';
import { PMNAMES } from '../js/monst_data.js';

const recipe = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/mounted-jousting.json', import.meta.url), 'utf8'));
await runSegment({ ...recipe.segments[0], storage: new InMemoryStorage() });
const steed = game.u.usteed;
assert.equal(steed?.mnum, PMNAMES.PM_PONY);
assert.ok(steed.misc_worn_check & W_SADDLE);
assert.equal(x_monnam(steed, ARTICLE_A, 'hurtling', EXACT_NAME & ~SUPPRESS_SADDLE, false),
             'a hurtling saddled pony', 'the fixture exercises saddle naming');
assert.equal(x_monnam(steed, ARTICLE_A, 'hurtling', EXACT_NAME, false),
             'a hurtling pony', 'the exact name omits the saddle adjective');
console.log('constant consumer state: PASS (C saddle-suppression control)');
