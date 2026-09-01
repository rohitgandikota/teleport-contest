#!/usr/bin/env node

// State checks for the remaining src/mhitu.c:summonmu() were branches.
// The C recordings pin the rare attack-time rolls and unseen feedback.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { PMNAMES } from '../js/monst_data.js';

async function loadJson(relativePath) {
    return JSON.parse(await readFile(new URL(relativePath, import.meta.url),
                                     'utf8'));
}

function cSteps(session) {
    return session.segments.flatMap(segment => segment.steps || []);
}

function hasRng(session, annotation) {
    return cSteps(session).some(step =>
        (step.rng || []).includes(annotation));
}

function hasScreenText(session, text) {
    return cSteps(session).some(step =>
        (step.screen || '').includes(text));
}

async function runRecipe(name, watchedSteps) {
    const recipe = await loadJson('gen-sessions/recipes/' + name + '.json');
    const trace = new Map();
    globalThis.__step_snapshot = {
        step: '*',
        cb: (state, step) => {
            if (!watchedSteps.has(step))
                return;
            trace.set(step, {
                blind: !!state.u.ublind,
                monsters: (state.level.monsters || [])
                    .filter(mon => (mon.mhp | 0) > 0)
                    .map(mon => ({
                        mnum: mon.mnum,
                        invisible: !!mon.minvis,
                        peaceful: !!mon.mpeaceful,
                    })),
            });
        },
    };
    try {
        await runSegment({ ...recipe.segments[0], onFrame: () => {} });
    } finally {
        delete globalThis.__step_snapshot;
    }
    return {
        trace,
        unported: [...(game.unported || [])],
    };
}

const beastC = await loadJson(
    'gen-sessions/generated/were-attack-beast-human.session.json');
assert.ok(hasRng(beastC, 'rn2(30)=0 @ summonmu(mhitu.c:982)'),
          'the C trace changes beast to human inside summonmu');
assert.ok(hasScreenText(beastC, 'changes into a human'),
          'the C frame exposes the attack-time human form');

const beast = await runRecipe('were-attack-beast-human',
                              new Set([64, 69, 71]));
assert.ok(beast.trace.get(64)?.monsters.some(mon =>
    mon.mnum === PMNAMES.PM_WEREWOLF && !mon.peaceful),
          'the attack-time form fixture creates a hostile beast werewolf');
assert.ok(beast.trace.get(69)?.monsters.some(mon =>
    mon.mnum === PMNAMES.PM_WEREWOLF),
          'the werewolf remains in beast form before the rare roll');
assert.ok(beast.trace.get(71)?.monsters.some(mon =>
    mon.mnum === PMNAMES.PM_HUMAN_WEREWOLF),
          'the rare summonmu roll leaves the attacker in human form');

const visibleC = await loadJson(
    'gen-sessions/generated/were-unseen-visible-helper.session.json');
assert.ok(hasRng(visibleC, 'rn2(10)=0 @ summonmu(mhitu.c:989)'),
          'the invisible-summoner C trace takes the helper branch');
assert.ok(hasScreenText(visibleC, 'Something growls!'),
          'the unseen C summoner is reported by sound');
assert.ok(hasScreenText(visibleC, 'Wolves appear!'),
          'the visible C helpers receive plural arrival feedback');

const visible = await runRecipe('were-unseen-visible-helper',
                                new Set([74, 88]));
const visibleStart = visible.trace.get(74)?.monsters || [];
assert.ok(visibleStart.some(mon =>
    mon.mnum === PMNAMES.PM_WEREWOLF && mon.invisible),
          'the helper fixture starts with an invisible werewolf');
const visibleEnd = visible.trace.get(88)?.monsters || [];
assert.equal(visibleEnd.filter(mon =>
    mon.mnum === PMNAMES.PM_WOLF).length, 4,
             'the C-recorded summon creates four ordinary wolves');
assert.equal(visibleEnd.filter(mon =>
    mon.mnum === PMNAMES.PM_WARG).length, 1,
             'the C-recorded summon also creates one warg');
assert.ok(visibleEnd.filter(mon =>
    mon.mnum === PMNAMES.PM_WOLF || mon.mnum === PMNAMES.PM_WARG)
    .every(mon => !mon.invisible),
          'all summoned helpers are visible while their summoner is not');

const hemmedC = await loadJson(
    'gen-sessions/generated/were-unseen-hemmed-in.session.json');
assert.ok(hasRng(hemmedC, 'rn2(10)=0 @ summonmu(mhitu.c:989)'),
          'the blinded C trace takes the helper branch');
assert.ok(hasScreenText(hemmedC, 'Something growls!'),
          'the blinded hero hears the unseen summoner');
assert.ok(hasScreenText(hemmedC, 'You feel hemmed in.'),
          'the C trace reports that every helper is unseen');

const hemmed = await runRecipe('were-unseen-hemmed-in',
                               new Set([81, 114]));
assert.equal(hemmed.trace.get(81)?.blind, true,
             'the hero is blind before the werewolf starts attacking');
const hemmedEnd = hemmed.trace.get(114);
assert.equal(hemmedEnd?.blind, true,
             'blindness remains active through the summon');
assert.equal((hemmedEnd?.monsters || []).filter(mon =>
    mon.mnum === PMNAMES.PM_WOLF || mon.mnum === PMNAMES.PM_WARG).length,
             3,
             'three helpers surround the blinded hero');

for (const result of [beast, visible, hemmed]) {
    assert.ok(!result.unported.some(path => path.startsWith('were:')),
              'the were attack fixtures leave no were implementation marker');
}

console.log('were attack form and unseen summon feedback state: PASS');
