#!/usr/bin/env node
// Static pinned-C witnesses, not an executed C oracle or branch coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const hash = text => createHash('sha256').update(text).digest('hex');
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sources = [];
const bodies = new Map();

for (const [file, names] of Object.entries({
    restore: ['getlev', 'dorecover'],
    save: ['savelev', 'savelev_core', 'dosave0'],
    bones: ['savebones', 'getbones'],
    mkroom: ['save_room', 'save_rooms', 'rest_room', 'rest_rooms'],
    mklev: ['alloc_doors', 'add_door', 'clear_level_structures'],
    detect: ['display_trap_map', 'trap_detect', 'use_crystal_ball'],
    do: ['goto_level'],
    sp_lev: ['flip_level']
})) {
    const path = `nethack-c/recorder/src/${file}.c`;
    const text = read(path);
    for (const name of names) {
        const match = text.match(new RegExp(`^${name}\\([^]*?^}`, 'm'));
        assert.ok(match, `${path}: ${name}`);
        bodies.set(`${file}.${name}`, match[0]);
        sources.push({ file: path, function: name,
            line: text.slice(0, match.index).split('\n').length,
            sha256: hash(match[0]), fileSha256: hash(text) });
    }
}

const checks = [];
const failures = [];
function check(name, fn) {
    try {
        fn();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}

function ordered(text, values) {
    let after = 0;
    for (const value of values) {
        const at = text.indexOf(value, after);
        assert.ok(at >= after, `missing/out of order: ${value}`);
        after = at + value.length;
    }
}

const body = name => bodies.get(name);
check('ordinary and ghostly getlev rebuild the last main-room endpoint', () => {
    const text = body('restore.getlev');
    ordered(text, ['ghostly = (nhfp->ftype == NHF_BONESFILE)',
        'Sfi_int(nhfp, &svd.doors_alloc', 'i < svd.doors_alloc',
        'rest_rooms(nhfp)', 'if (svn.nroom)',
        'gd.doorindex = svr.rooms[svn.nroom - 1].fdoor',
        '+ svr.rooms[svn.nroom - 1].doorct', '} else {',
        'gd.doorindex = 0', 'restore_timers']);
});
check('savelev_core writes capacity and coordinates but not doorindex', () => {
    const text = body('save.savelev_core');
    ordered(text, ['Sfo_int(nhfp, &svd.doors_alloc', 'i < svd.doors_alloc',
        'Sfo_nhcoord(nhfp, tmpc', 'save_rooms(nhfp)']);
    assert.doesNotMatch(text, /gd\.doorindex/);
    assert.match(body('save.savelev'), /savelev_core\(nhfp, lev\)/);
});
check('C capacity grows by twenty independently of active count', () => {
    const text = body('mklev.alloc_doors');
    ordered(text, ['gd.doorindex >= svd.doors_alloc',
        'svd.doors_alloc + DOORINC', 'memset', 'svd.doors_alloc = c']);
    assert.match(read('nethack-c/recorder/include/global.h'), /#define DOORINC\s+20\b/);
});
check('add_door shifts registered entries and updates room and subroom offsets', () => {
    ordered(body('mklev.add_door'), ['alloc_doors()', 'if (aroom->doorct)',
        'aroom->fdoor = gd.doorindex', 'aroom->doorct++',
        'tmp = gd.doorindex', 'i < svn.nroom', 'i < gn.nsubroom',
        'gd.doorindex++', 'svd.doors[aroom->fdoor].x = x']);
});
check('room serialization retains a recursive tree and the main-room count', () => {
    ordered(body('mkroom.save_rooms'), ['&svn.nroom', 'save_room(nhfp, &svr.rooms[i])']);
    ordered(body('mkroom.save_room'), ['Sfo_mkroom', 'save_room(nhfp, r->sbrooms[i])']);
    ordered(body('mkroom.rest_rooms'), ['&svn.nroom', 'gn.nsubroom = 0',
        'rest_room(nhfp, &svr.rooms[i])', 'svr.rooms[svn.nroom].hx = -1']);
    assert.match(body('mkroom.rest_room'), /rest_room\(nhfp, &gs\.subrooms\[gn\.nsubroom\]\)/);
});
check('level disposal resets active count and frees capacity separately', () => {
    ordered(body('mklev.clear_level_structures'), ['svn.nroom = 0',
        'gd.doorindex = 0', 'free((genericptr_t) svd.doors)', 'svd.doors_alloc = 0']);
});
check('bones reuse C savelev and getlev rather than a separate door contract', () => {
    assert.match(body('bones.savebones'), /savelev\(nhfp, ledger_no\(&u\.uz\)\)/);
    assert.match(body('bones.getbones'), /getlev\(nhfp, 0, 0\)/);
});
check('level transitions save the departing level and load a returning level', () => {
    ordered(body('do.goto_level'), ['savelev(nhfp, ledger_no(&u.uz))',
        'assign_level(&u.uz, newlevel)', 'getlev(nhfp, svh.hackpid, new_ledger)']);
});
check('full save and restore apply getlev to all materialized levels', () => {
    ordered(body('save.dosave0'), ['savelev(nhfp, ledger_no(&u.uz))',
        'savegamestate(nhfp)', 'getlev(onhfp, svh.hackpid, ltmp)', 'savelev(nhfp, ltmp)']);
    ordered(body('restore.dorecover'), ['getlev(nhfp, 0, (xint8) 0)',
        'restgamestate(nhfp)', 'getlev(nhfp, 0, ltmp)',
        'getlev(nhfp, 0, (xint8) 0)']);
});
check('both trap consumers use the active bound and exclude secret doors', () => {
    for (const name of ['detect.trap_detect', 'detect.display_trap_map']) {
        ordered(body(name), ['door < gd.doorindex', 'typ == SDOOR', 'D_TRAPPED']);
    }
    assert.match(body('detect.use_crystal_ball'), /trap_detect\(\(struct obj \*\) 0\)/);
});
check('C flip_level also uses the active bound, a separate JS audit limit', () => {
    assert.match(body('sp_lev.flip_level'), /i < gd\.doorindex/);
});
check('ordinary JS getlev assigns the existing room-derived expression to its level', () => {
    const text = read('js/restore.js');
    assert.match(text, /level\.doorindex = lastRoom \? lastRoom\.fdoor \+ lastRoom\.doorct : 0;/);
    assert.doesNotMatch(text, /game\.doorindex\s*=/);
});
check('JS bones getlev assigns the same expression to the loaded level', () => {
    const text = read('js/bones.js');
    ordered(text, ['rest_rooms(snap.rooms)', 'const lastroom = lvl.rooms[lvl.nroom - 1]',
        'lvl.doorindex = lastroom ? lastroom.fdoor + lastroom.doorct : 0',
        'lvl.doors = snap.doors || []']);
    assert.doesNotMatch(text, /game\.doorindex\s*=/);
});
check('JS producer and consumers already share the level owner', () => {
    assert.match(read('js/game.js'), /this\.doorindex = 0/);
    assert.match(read('js/mklev.js'), /g\.level\.doorindex\+\+/);
    const loops = read('js/detect.js').match(/door < \(game\.level\.doorindex \| 0\)/g);
    assert.equal(loops.length, 2);
});

console.log(JSON.stringify({ evidence: 'static pinned C and JS source',
    passed: checks.length, total: checks.length + failures.length,
    functions: sources.length, names: checks, failures, sources }, null, 4));
if (failures.length)
    process.exitCode = 1;
