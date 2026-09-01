#!/usr/bin/env node

// State checks for src/cmd.c's direct chronicle binding, src/zap.c makewish()
// livelog transitions, and src/uhitm.c first_weapon_hit(). The paired C trace
// pins every terminal boundary and RNG draw for the visible scenarios.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { first_weapon_hit } from '../js/uhitm.js';
import { mksobj } from '../js/mkobj.js';
import { ART_EXCALIBUR, ART_LONGBOW_OF_DIANA,
         artifact_names } from '../js/artilist_data.js';
import { ONAMES } from '../js/objects_data.js';

const recipe = JSON.parse(await readFile(new URL(
    'gen-sessions/recipes/weapon-conduct-chronicle.json',
    import.meta.url), 'utf8'));
const cTrace = JSON.parse(await readFile(new URL(
    'gen-sessions/generated/weapon-conduct-chronicle.session.json',
    import.meta.url), 'utf8'));

function cRng(index) {
    return cTrace.segments[index].steps.flatMap(step => step.rng || []);
}

function cText(index) {
    return cTrace.segments[index].steps.map(step => step.screen || '')
        .join('\n').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
        .replace(/\s+/g, ' ');
}

function formerMarkers() {
    return [...(game.unported || [])].filter(path =>
        path.includes('hmon_hitmon:first_weapon_hit'));
}

async function replay(index) {
    const nhGame = await runSegment({
        ...recipe.segments[index],
        onFrame: () => {},
    });
    nhGame._display.onEmptyQueue = () => 0x1b;
    return {
        nhGame,
        rng: nhGame.getRngLog().length,
        gamelog: (game.gamelog || []).map(event => ({ ...event })),
        wishes: game.u.uconduct?.wishes || 0,
        wisharti: game.u.uconduct?.wisharti || 0,
        unported: formerMarkers(),
    };
}

const runs = [];
for (let index = 0; index < recipe.segments.length; ++index) {
    const run = await replay(index);
    assert.equal(run.rng, cRng(index).length,
                 `segment ${index} matches the C RNG total`);
    assert.deepEqual(run.unported, [],
                     `segment ${index} leaves no former first-hit marker`);
    assert.ok(cText(index).includes('Logged events:'),
              `segment ${index} opens the C chronicle with direct v`);
    runs.push(run);
}

assert.deepEqual(runs[0].gamelog.map(event => event.text), [
    'wizard the neutral male human Barbarian entered the dungeon',
    'made his first wish - "cursed +20 dagger named Secret", got "a dagger named Secret"',
    'hit with a wielded weapon (cursed dagger) for the first time',
    'killed for the first time',
], 'the first wish, sanitized weapon hit, and kill use C chronicle order');
assert.deepEqual(runs[0].gamelog.map(event => event.turn), [1, 1, 2, 2],
                 'same-turn first-hit logging precedes the kill event');
assert.equal(runs[0].gamelog[2].text.includes('Secret'), false,
             'the weapon milestone excludes the player-supplied object name');
assert.equal(runs[0].wishes, 1, 'the successful wish increments conduct');
assert.equal(runs[0].wisharti, 0,
             'an ordinary dagger does not increment artifact wishes');

const femaleWishEvents = runs[1].gamelog.map(event => event.text);
assert.equal(femaleWishEvents.length, 4,
             'entry plus three successful wishes produce four events');
assert.match(femaleWishEvents[1],
             /^made her first wish - "blessed apple", got "/,
             'the first wish uses the female possessive and granted object');
assert.match(femaleWishEvents[2],
             /^made her first artifact wish - "blessed Excalibur", got "/,
             'the first later artifact wish gets its own milestone');
assert.match(femaleWishEvents[3],
             /^wished for "uncursed pear", got "/,
             'a later ordinary wish uses the repeat event form');
assert.equal(runs[1].wishes, 3, 'all three successful wishes count');
assert.equal(runs[1].wisharti, 1, 'only Excalibur counts as an artifact wish');

assert.deepEqual(runs[2].gamelog.map(event => event.text), [
    'wizard the neutral male human Wizard entered the dungeon',
    'declined to make a wish',
], 'an explicit wish for nothing is chronicled');
assert.equal(runs[2].wishes, 0,
             'declining preserves wishless conduct');
assert.equal(runs[2].wisharti, 0,
             'declining preserves artifact-wish conduct');

const movesBeforeChronicle = game.moves;
await rhack('v');
assert.equal(game.context.move, 0,
             'the direct chronicle command consumes no game time');
assert.equal(game.moves, movesBeforeChronicle,
             'opening and dismissing the chronicle leaves the turn unchanged');

function loggedWeaponName(obj) {
    game.gamelog = [];
    first_weapon_hit(obj);
    assert.equal(game.gamelog.length, 1,
                 'first_weapon_hit appends exactly one event');
    return game.gamelog[0].text;
}

let weapon = mksobj(ONAMES.DAGGER, false, false);
weapon.oname = 'Secret';
weapon.dknown = 1;
weapon.cursed = 1;
weapon.bknown = 1;
assert.equal(loggedWeaponName(weapon),
             'hit with a wielded weapon (cursed dagger) for the first time',
             'known cursed state is retained while a custom name is removed');

weapon.bknown = 0;
assert.equal(loggedWeaponName(weapon),
             'hit with a wielded weapon (dagger) for the first time',
             'unknown curse state is not leaked into the chronicle');

weapon.cursed = 0;
weapon.bknown = 1;
weapon.blessed = 1;
weapon.quan = 3;
assert.equal(loggedWeaponName(weapon),
             'hit with a wielded weapon (daggers) for the first time',
             'blessed state is omitted and a wielded stack remains plural');

weapon = mksobj(ONAMES.LONG_SWORD, false, false);
weapon.oartifact = ART_EXCALIBUR;
weapon.oname = artifact_names[ART_EXCALIBUR];
weapon.dknown = weapon.known = weapon.bknown = weapon.rknown = 1;
const savedOverrideId = game.iflags.override_ID;
game.iflags.override_ID = true;
assert.equal(loggedWeaponName(weapon),
             'hit with a wielded weapon (Excalibur) for the first time',
             'a fully identified artifact uses only its proper name');
game.iflags.override_ID = savedOverrideId;

weapon = mksobj(ONAMES.BOW, false, false);
weapon.oartifact = ART_LONGBOW_OF_DIANA;
weapon.oname = artifact_names[ART_LONGBOW_OF_DIANA];
weapon.dknown = 1;
weapon.known = 0;
assert.equal(loggedWeaponName(weapon),
             'hit with a wielded weapon (bow named the Longbow of Diana) for the first time',
             'a seen but incompletely known artifact includes its bare name');

weapon.dknown = 0;
assert.equal(loggedWeaponName(weapon).includes(' named '), false,
             'an unseen artifact does not leak its artifact name');

console.log('weapon conduct chronicle state: PASS');
