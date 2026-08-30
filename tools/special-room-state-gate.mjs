#!/usr/bin/env node

// State checks for src/hack.c check_special_room(). Terminal messages and RNG
// ordering are covered by special-room-entry.session.json.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import {
    ROOMOFFSET, OROOM, THEMEROOM, COURT, SWAMP, VAULT, BEEHIVE, MORGUE,
    BARRACKS, ZOO, DELPHI, TEMPLE, LEPREHALL, COCKNEST, ANTHOLE,
} from '../js/const.js';

const roomCases = new Map([
    [8000, { type: COURT, flag: 'has_court' }],
    [8004, { type: ANTHOLE }],
    [8007, { type: LEPREHALL }],
    [8008, { type: ZOO, flag: 'has_zoo' }],
    [8014, { type: BARRACKS, flag: 'has_barracks' }],
    [8020, { type: COCKNEST }],
    [8035, { type: BEEHIVE, flag: 'has_beehive' }],
    [8038, { type: SWAMP, flag: 'has_swamp' }],
    [8002, { type: MORGUE, flag: 'has_morgue' }],
    [8010, { type: TEMPLE, flag: 'has_temple', persistent: true }],
    [8041, { type: DELPHI }],
]);

async function readRecipe(name) {
    const path = new URL(`gen-sessions/recipes/${name}.json`, import.meta.url);
    return JSON.parse(await readFile(path, 'utf8'));
}

function currentRoom() {
    const mapRoom = game.level.at(game.u.ux, game.u.uy)?.roomno;
    assert.ok(mapRoom >= ROOMOFFSET, 'hero finishes inside a room');
    const roomno = mapRoom - ROOMOFFSET;
    const room = game.level.rooms?.[roomno]
        || game.level.subrooms?.find(candidate => candidate.roomnoidx === roomno);
    assert.ok(room, `room ${roomno} exists`);
    return { room, roomno };
}

const recipe = await readRecipe('special-room-entry');
for (const segment of recipe.segments) {
    await runSegment({ ...segment, onFrame: () => {} });
    const expected = roomCases.get(segment.seed);
    assert.ok(expected, `seed ${segment.seed} has an expected room type`);
    const { room, roomno } = currentRoom();
    assert.equal(room.rtype, expected.persistent ? expected.type : OROOM,
                 `seed ${segment.seed} room retirement`);
    assert.ok(game.level._mapseen_rooms?.includes(roomno),
              `seed ${segment.seed} room discovery`);
    if (expected.flag) {
        const another = [...(game.level.rooms || []),
                         ...(game.level.subrooms || [])]
            .some(candidate => candidate?.rtype === expected.type);
        assert.equal(!!game.level.flags[expected.flag], another,
                     `seed ${segment.seed} level flag`);
    }
}

const themeRecipe = await readRecipe('special-object-options');
await runSegment({ ...themeRecipe.segments[0], onFrame: () => {} });
{
    const { room, roomno } = currentRoom();
    assert.equal(room.rtype, THEMEROOM, 'themed room remains active');
    assert.ok(!game.level._mapseen_rooms?.includes(roomno),
              'themed room has no entry discovery');
}

const vaultRecipe = await readRecipe('vault-guard');
await runSegment({ ...vaultRecipe.segments[0], onFrame: () => {} });
{
    const vault = game.level.rooms.find(room => room?.rtype === VAULT);
    assert.ok(vault, 'vault remains active after entry');
    const roomno = game.level.rooms.indexOf(vault);
    assert.ok(!game.level._mapseen_rooms?.includes(roomno),
              'vault has no entry discovery');
}

console.log('special room state: PASS');
