#!/usr/bin/env node
// Source-derived selection and object-lifecycle contracts from
// artifact.c mk_artifact(). Native sacrifice recordings are checked separately.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { mk_artifact } from '../js/artifact.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { ONAMES } from '../js/objects_data.js';
import { artifact_records, ART_MAGICBANE, ART_MJOLLNIR, ART_CLEAVER,
         ART_SNICKERSNEE, ART_DEMONBANE, ART_FIRE_BRAND, ART_ORCRIST,
         ART_GRIMTOOTH } from '../js/artilist_data.js';
import { A_NONE, A_LAWFUL, A_NEUTRAL, A_CHAOTIC,
         OBJ_FREE, OBJ_DELETED, OBJ_INVENT } from '../js/const.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

const segment = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/recorder-meta-keys.json', import.meta.url))).segments[0];

async function setup(role = 'Wizard', race = 'human', align = 'neutral') {
    const replay = await runSegment({ ...segment, moves: ' ',
        nethackrc: segment.nethackrc.replace('role:Wizard', 'role:' + role)
            .replace('race:human', 'race:' + race)
            .replace('align:neutral', 'align:' + align),
        storage: new InMemoryStorage() });
    replay._display.onEmptyQueue = () => 0x1b;
}

function onlyAvailable(...artifacts) {
    game.artiexist = artifact_records.map((_record, i) => ({
        exists: artifacts.includes(i) ? 0 : 1,
    }));
}

for (const [role, align, alignment, artifact] of [
    ['Wizard', 'neutral', A_NEUTRAL, ART_MAGICBANE],
    ['Valkyrie', 'lawful', A_LAWFUL, ART_MJOLLNIR],
    ['Barbarian', 'chaotic', A_CHAOTIC, ART_CLEAVER],
    ['Samurai', 'lawful', A_LAWFUL, ART_SNICKERSNEE],
    ['Priest', 'neutral', A_NEUTRAL, ART_DEMONBANE],
]) {
    test(`${role} receives the role's first gift despite a low sacrifice value`, async () => {
        await setup(role, 'human', align);
        initRng(2);
        const obj = mk_artifact(null, alignment, 0, true);
        assert.ok(obj && !(obj instanceof Promise));
        assert.equal(obj.oartifact, artifact);
        assert.equal(obj.where, OBJ_FREE);
        assert.equal(obj.age, 0);
        assert.ok(game.artiexist[artifact].exists);
        assert.ok(game.artiexist[artifact].rndm);
    });
}

test('a rejected unaligned candidate remains available as a fallback', async () => {
    await setup();
    onlyAvailable(ART_FIRE_BRAND);
    game.u.ugifts = 0;
    initRng(2);
    enableRngLog();
    const obj = mk_artifact(null, A_NEUTRAL, 99, false);
    assert.equal(obj?.oartifact, ART_FIRE_BRAND);
    assert.deepEqual(getRngLog().slice(0, 2), ['rn2(3)=1', 'rn2(1)=0']);
});

test('previous gifts skip the unaligned first-gift draw', async () => {
    await setup();
    onlyAvailable(ART_FIRE_BRAND);
    game.u.ugifts = 1;
    initRng(2);
    enableRngLog();
    const obj = mk_artifact(null, A_NEUTRAL, 99, false);
    assert.equal(obj?.oartifact, ART_FIRE_BRAND);
    assert.match(getRngLog()[0], /^rn2\(4\)=/);
});

test('an orc is not given an elven artifact', async () => {
    await setup('Wizard', 'orc', 'chaotic');
    onlyAvailable(ART_ORCRIST);
    initRng(2);
    enableRngLog();
    assert.equal(mk_artifact(null, A_CHAOTIC, 99, false), null);
    assert.deepEqual(getRngLog(), []);
});

test('a compatible human can receive the same elven artifact', async () => {
    await setup('Wizard', 'human', 'chaotic');
    onlyAvailable(ART_ORCRIST);
    assert.equal(mk_artifact(null, A_CHAOTIC, 99, false)?.oartifact, ART_ORCRIST);
});

test('a role-specific artifact also bypasses the value cap for an existing object', async () => {
    await setup();
    const obj = mksobj(ONAMES.ATHAME, false, false);
    assert.equal(mk_artifact(obj, A_NONE, 0, false), obj);
    assert.equal(obj.oartifact, ART_MAGICBANE);
});

test('converting an existing weapon to Grimtooth applies permanent poison', async () => {
    await setup();
    const obj = mksobj(ONAMES.ORCISH_DAGGER, false, false);
    assert.equal(mk_artifact(obj, A_NONE, 99, false), obj);
    assert.equal(obj.oartifact, ART_GRIMTOOTH);
    assert.equal(obj.opoisoned, 1);
});

for (const available of [true, false]) {
    test(`alignment generation disposes of a supplied object, candidate=${available}`, async () => {
        await setup();
        onlyAvailable(...(available ? [ART_MAGICBANE] : []));
        const original = await addinv(mksobj(ONAMES.DAGGER, false, false));
        const result = mk_artifact(original, A_NEUTRAL, 99, false);
        assert.equal(original.where, OBJ_DELETED);
        assert.ok(!game.invent.includes(original));
        if (available) assert.equal(result?.oartifact, ART_MAGICBANE);
        else assert.equal(result, null);
    });
}

test('no-alignment generation preserves an object when its artifact already exists', async () => {
    await setup();
    onlyAvailable();
    const obj = mksobj(ONAMES.ATHAME, false, false);
    initRng(2);
    enableRngLog();
    assert.equal(mk_artifact(obj, A_NONE, 99, true), obj);
    assert.equal(obj.oartifact || 0, 0);
    assert.deepEqual(getRngLog(), []);
});

test('the recorded sacrifice grants and identifies the picked-up divine gift', async () => {
    const input = JSON.parse(readFileSync(new URL(
        'gen-sessions/recipes/sacrifice-artifact-gift.json', import.meta.url)));
    await runSegment({ ...input.segments[0], storage: new InMemoryStorage() });
    const gift = game.invent.find(obj => obj.oartifact === ART_SNICKERSNEE);
    assert.ok(gift);
    assert.equal(gift.where, OBJ_INVENT);
    assert.equal(game.u.ugifts, 1);
    assert.ok(game.u.ublesscnt > 0);
    assert.ok(gift.oerodeproof);
    assert.equal(!!gift.cursed, false);
    assert.ok(game.artiexist[ART_SNICKERSNEE].gift);
    assert.ok(game.artiexist[ART_SNICKERSNEE].found);
    assert.equal(game.artiexist[ART_SNICKERSNEE].rndm, 0);
});
