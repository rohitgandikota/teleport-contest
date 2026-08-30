#!/usr/bin/env node

import assert from 'node:assert/strict';
import { resetGame, game } from '../js/gstate.js';
import { make_engr_at, engr_at } from '../js/engrave.js';
import { lspo_engraving } from '../js/sp_lev.js';
import { onscary } from '../js/monmove.js';
import { ROOM, ENGRAVE } from '../js/const.js';
import { mons, PMNAMES } from '../js/monst_data.js';
import { ONAMES } from '../js/objects_data.js';

const X = 20;
const Y = 10;

function resetFixture() {
    resetGame();
    Object.assign(game, {
        in_mklev: true,
        moves: 10,
        mons,
        xstart: 0,
        ystart: 0,
        xsize: 80,
        ysize: 21,
        hell_dnum: 99,
        astral_level: { dnum: 98, dlevel: 1 },
        u: {
            ux: 1,
            uy: 1,
            uprops: {},
            uz: { dnum: 0, dlevel: 1 },
        },
        level: {
            lev_engr: [],
            objects: [],
            at: () => ({ typ: ROOM }),
        },
    });
}

function hostileGoblin() {
    return {
        mnum: PMNAMES.PM_GOBLIN,
        mhp: 5,
        iswiz: false,
        isshk: false,
        ispriest: false,
        isgd: false,
        mcansee: true,
        mpeaceful: false,
        mux: game.u.ux,
        muy: game.u.uy,
    };
}

function floorObject() {
    return { otyp: ONAMES.FOOD_RATION, ox: X, oy: Y };
}

function testAutomaticGuard() {
    resetFixture();
    make_engr_at(X, Y, 'Elbereth', null, 0, ENGRAVE);
    const ep = engr_at(X, Y);
    const monster = hostileGoblin();

    assert.equal(ep.guardobjects, 1);
    assert.equal(Boolean(onscary(X, Y, monster)), false);

    game.level.objects.push(floorObject());
    assert.equal(Boolean(onscary(X, Y, monster)), true);
}

function testLuaDefaultClearsGuard() {
    resetFixture();
    lspo_engraving({ x: X, y: Y, text: 'Elbereth' });
    const ep = engr_at(X, Y);
    game.level.objects.push(floorObject());

    assert.equal(ep.guardobjects, 0);
    assert.equal(Boolean(onscary(X, Y, hostileGoblin())), false);
}

function testLuaCanRequestGuard() {
    resetFixture();
    lspo_engraving({
        x: X,
        y: Y,
        text: 'Elbereth',
        guardobjects: true,
    });
    const ep = engr_at(X, Y);
    game.level.objects.push(floorObject());

    assert.equal(ep.guardobjects, 1);
    assert.equal(Boolean(onscary(X, Y, hostileGoblin())), true);
}

const tests = [
    testAutomaticGuard,
    testLuaDefaultClearsGuard,
    testLuaCanRequestGuard,
];

for (const test of tests)
    test();

console.log(`engraving guard gate: ${tests.length}/${tests.length} passed`);
