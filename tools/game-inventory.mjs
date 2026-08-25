#!/usr/bin/env node
// Verify and print the exhaustive static game inventory generated from C.
// This is a data-coverage gate. Gameplay sessions cover interactions, while
// this script makes sure every numbered definition remains present.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { mons, NUMMONS } from '../js/monst_data.js';
import {
    objects, obj_descr, NUM_OBJECTS, OCLASSES,
} from '../js/objects_data.js';
import { artifact_names } from '../js/artilist_data.js';
import { roles, races, genders, aligns } from '../js/role_data.js';
import { dungeon } from '../js/dungeon_data.js';
import { defsyms, monexplain, oc_explain } from '../js/drawing_data.js';
import { extcmdlist } from '../js/extcmd_data.js';
import { themerooms, themeroom_fills } from '../js/themerms_data.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function source(path) {
    return readFileSync(join(ROOT, path), 'utf8');
}

function enumValue(text, name) {
    const match = new RegExp(`\\b${name}\\s*=\\s*(-?\\d+)`).exec(text);
    if (!match) throw new Error(`could not find ${name}`);
    return Number(match[1]);
}

function check(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
}

const propHeader = source('nethack-c/upstream/include/prop.h');
const trapHeader = source('nethack-c/upstream/include/trap.h');
const terrainHeader = source('nethack-c/upstream/include/rm.h');
const roomHeader = source('nethack-c/upstream/include/mkroom.h');

const objectClassCounts = {};
for (const [name, value] of Object.entries(OCLASSES)) {
    if (!name.endsWith('_CLASS') || value < 1 || value > 17) continue;
    objectClassCounts[name] = objects.slice(0, -1)
        .filter((object) => object.oc_class === value).length;
}

const branches = dungeon.flatMap((entry) => entry.branches || []);
const namedLevels = dungeon.flatMap((entry) => entry.levels || []);
const spellbooks = objects.slice(0, -1)
    .map((object, index) => ({ object, description: obj_descr[index] }))
    .filter(({ object }) => object.oc_class === OCLASSES.SPBOOK_CLASS);
const nonSpellBooks = new Set([
    'generic spellbook', 'blank paper', 'novel', 'Book of the Dead',
]);
const castableSpells = spellbooks
    .map(({ description }) => description.oc_name)
    .filter((name) => !nonSpellBooks.has(name));

const inventory = {
    roles: {
        count: roles.length,
        names: roles.map((role) => role.name.m),
    },
    races: {
        count: races.length,
        names: races.map((race) => race.noun),
    },
    grammarGenders: {
        count: genders.length,
        names: genders.map((gender) => gender.adj),
    },
    alignments: {
        count: aligns.length,
        names: aligns.map((alignment) => alignment.adj),
    },
    monsters: {
        count: NUMMONS,
        tableEntriesIncludingTerminator: mons.length,
        displayClasses: monexplain.filter(Boolean).length,
    },
    objects: {
        count: NUM_OBJECTS,
        tableEntriesIncludingTerminator: objects.length,
        classes: oc_explain.filter(Boolean).length,
        byClass: objectClassCounts,
    },
    artifacts: {
        count: artifact_names.length - 1,
        names: artifact_names.slice(1),
    },
    spells: {
        castable: castableSpells.length,
        spellbookClassEntries: spellbooks.length,
        names: castableSpells,
    },
    properties: enumValue(propHeader, 'LIFESAVED'),
    trapsAndTrapKnowledgeTypes: enumValue(trapHeader, 'TRAPNUM') - 1,
    terrainTypes: enumValue(terrainHeader, 'MAX_TYPE'),
    roomAndShopTypes: enumValue(roomHeader, 'CANDLESHOP') + 1,
    mapAndEffectGlyphs: defsyms.length,
    dungeons: dungeon.length,
    branches: branches.length,
    namedLevelTemplates: namedLevels.length,
    themedRooms: themerooms.length,
    themedRoomFills: themeroom_fills.length,
    commands: extcmdlist.length,
};

check(inventory.roles.count, 13, 'roles');
check(inventory.races.count, 5, 'races');
check(inventory.grammarGenders.count, 4, 'grammar genders');
check(inventory.alignments.count, 4, 'alignments including unaligned');
check(inventory.monsters.count, 383, 'monsters');
check(inventory.monsters.tableEntriesIncludingTerminator, 384,
    'monster table entries');
check(inventory.monsters.displayClasses, 60, 'monster display classes');
check(inventory.objects.count, 481, 'objects');
check(inventory.objects.tableEntriesIncludingTerminator, 482,
    'object table entries');
check(Object.values(objectClassCounts).reduce((sum, count) => sum + count, 0),
    481, 'object class total');
check(inventory.artifacts.count, 34, 'artifacts');
check(inventory.spells.castable, 41, 'castable spells');
check(inventory.spells.spellbookClassEntries, 45, 'spellbook class entries');
check(inventory.properties, 68, 'properties');
check(inventory.trapsAndTrapKnowledgeTypes, 25, 'trap types');
check(inventory.terrainTypes, 37, 'terrain types');
check(inventory.roomAndShopTypes, 26, 'room types');
check(inventory.mapAndEffectGlyphs, 105, 'map and effect glyphs');
check(inventory.dungeons, 9, 'dungeons');
check(inventory.branches, 7, 'branches');
check(inventory.namedLevelTemplates, 37, 'named level templates');
check(inventory.themedRooms, 31, 'themed rooms');
check(inventory.themedRoomFills, 15, 'themed room fills');
check(inventory.commands, 170, 'commands');

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(inventory, null, 2));
} else {
    const rows = [
        ['roles', inventory.roles.count],
        ['races', inventory.races.count],
        ['monsters', inventory.monsters.count],
        ['monster display classes', inventory.monsters.displayClasses],
        ['objects', inventory.objects.count],
        ['artifacts', inventory.artifacts.count],
        ['castable spells', inventory.spells.castable],
        ['properties', inventory.properties],
        ['trap types', inventory.trapsAndTrapKnowledgeTypes],
        ['terrain types', inventory.terrainTypes],
        ['room and shop types', inventory.roomAndShopTypes],
        ['map and effect glyphs', inventory.mapAndEffectGlyphs],
        ['dungeons', inventory.dungeons],
        ['branches', inventory.branches],
        ['named level templates', inventory.namedLevelTemplates],
        ['themed rooms', inventory.themedRooms],
        ['themed room fills', inventory.themedRoomFills],
        ['commands', inventory.commands],
    ];
    for (const [label, value] of rows) {
        console.log(`${label.padEnd(28)} ${String(value).padStart(4)}`);
    }
    console.log('static inventory: PASS');
}
