#!/usr/bin/env node

import assert from 'node:assert/strict';
import { game, resetGame } from '../js/gstate.js';
import { useupall } from '../js/invent.js';
import { objects, OCLASSES, ONAMES } from '../js/objects_data.js';
import { OBJ_CONTAINED, OBJ_INVENT, OBJ_ONBILL } from '../js/obj.js';
import { OBJ_DELETED } from '../js/const.js';
import { TIMER_OBJECT } from '../js/timeout.js';

let nextId = 1000;

function resetFixture() {
    resetGame();
    Object.assign(game, {
        objects,
        u: { uhave: {}, uprops: {}, ushops: '', twoweap: false },
        flags: {},
        iflags: {},
        disp: {},
        context: {
            victual: {},
            spbook: {},
            tin: {},
            objsplit: { parent_oid: 0, child_oid: 0 },
        },
        program_state: { in_moveloop: false },
        invent: [],
        billobjs: [],
        timer_base: [],
        light_sources: [],
        level: { monsters: [] },
    });
}

function object(otyp, oclass, fields = {}) {
    return {
        otyp,
        oclass,
        o_id: nextId++,
        quan: 1,
        where: OBJ_INVENT,
        owornmask: 0,
        oartifact: 0,
        timed: 0,
        lamplit: 0,
        cobj: [],
        ...fields,
    };
}

function consume(obj) {
    game.invent = [obj];
    useupall(obj);
}

function testGeneralDeletion() {
    resetFixture();
    const food = object(ONAMES.FOOD_RATION, OCLASSES.FOOD_CLASS, {
        timed: 1,
        lamplit: 1,
    });
    game.context.victual = { piece: food, o_id: food.o_id, eating: 1 };
    game.context.tin = { tin: food, o_id: food.o_id };
    game.context.objsplit = { parent_oid: food.o_id, child_oid: 0 };
    game.timer_base = [{ kind: TIMER_OBJECT, func_index: 1, arg: food }];
    game.light_sources = [{ type: 1, id: food.o_id }];
    game.thrownobj = food;
    game.kickedobj = food;

    consume(food);

    assert.equal(food.where, OBJ_DELETED);
    assert.equal(food.timed, 0);
    assert.equal(food.lamplit, 0);
    assert.deepEqual(game.timer_base, []);
    assert.deepEqual(game.light_sources, []);
    assert.deepEqual(game.context.victual, {});
    assert.equal(game.context.tin.tin, null);
    assert.equal(game.context.tin.o_id, 0);
    assert.deepEqual(game.context.objsplit, { parent_oid: 0, child_oid: 0 });
    assert.equal(game.thrownobj, null);
    assert.equal(game.kickedobj, null);
}

function testSpellbookContext() {
    resetFixture();
    const book = object(ONAMES.SPE_MAGIC_MISSILE, OCLASSES.SPBOOK_CLASS);
    game.context.spbook = { book, o_id: book.o_id, delay: -4 };

    consume(book);

    assert.equal(book.where, OBJ_DELETED);
    assert.equal(game.context.spbook.book, null);
    assert.equal(game.context.spbook.o_id, 0);
}

function testLeashRelease() {
    resetFixture();
    const pet = { m_id: 42, mleashed: 1 };
    const leash = object(ONAMES.LEASH, OCLASSES.TOOL_CLASS, { leashmon: 42 });
    game.level.monsters = [pet];

    consume(leash);

    assert.equal(leash.leashmon, 0);
    assert.equal(pet.mleashed, 0);
    assert.equal(leash.where, OBJ_DELETED);
}

function testContainerCleanup() {
    resetFixture();
    const parent = object(ONAMES.LARGE_BOX, OCLASSES.TOOL_CLASS);
    const child = object(ONAMES.FOOD_RATION, OCLASSES.FOOD_CLASS, {
        where: OBJ_CONTAINED,
        ocontainer: parent,
        timed: 1,
    });
    parent.cobj = [child];
    game.xlock = {
        usedtime: 3,
        chance: 20,
        picktyp: ONAMES.LOCK_PICK,
        magic_key: true,
        door: {},
        box: parent,
    };
    game.timer_base = [{ kind: TIMER_OBJECT, func_index: 1, arg: child }];

    consume(parent);

    assert.deepEqual(parent.cobj, []);
    assert.equal(parent.where, OBJ_DELETED);
    assert.equal(child.where, OBJ_DELETED);
    assert.equal(child.ocontainer, null);
    assert.deepEqual(game.timer_base, []);
    assert.deepEqual(game.xlock, {
        usedtime: 0,
        chance: 0,
        picktyp: 0,
        magic_key: false,
        door: null,
        box: null,
    });
}

function testUsedUpBillEntry() {
    resetFixture();
    const potion = object(ONAMES.POT_WATER, OCLASSES.POTION_CLASS, {
        unpaid: 1,
    });
    const entry = {
        bo_id: potion.o_id,
        bquan: 1,
        useup: false,
        price: 5,
    };
    game.level.monsters = [{ isshk: 1, eshk: { bill_p: [entry], billct: 1 } }];

    consume(potion);

    assert.equal(entry.useup, true);
    assert.equal(entry.obj, potion);
    assert.equal(potion.unpaid, 0);
    assert.equal(potion.where, OBJ_ONBILL);
    assert.deepEqual(game.billobjs, [potion]);
}

const tests = [
    testGeneralDeletion,
    testSpellbookContext,
    testLeashRelease,
    testContainerCleanup,
    testUsedUpBillEntry,
];

for (const test of tests)
    test();

console.log(`object lifecycle gate: ${tests.length}/${tests.length} passed`);
