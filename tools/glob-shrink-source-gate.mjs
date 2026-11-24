// Pinned source contracts, not C execution or native branch coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const bodies = new Map();
const sources = [];
for (const [module, names] of Object.entries({
    mkobj: ['item_on_ice', 'start_glob_timeout', 'shrink_glob', 'shrinking_glob_gone',
        'mksobj_init', 'mksobj', 'obj_absorb', 'obj_meld', 'obj_extract_self',
        'extract_nobj', 'container_weight', 'dealloc_obj', 'check_glob', 'insane_object'],
    timeout: ['run_timers', 'start_timer', 'stop_timer', 'write_timer', 'obj_is_local',
        'timer_is_local', 'save_timers', 'restore_timers', 'relink_timers'],
    pickup: ['removed_from_icebox', 'in_container', 'out_container'],
    invent: ['useupall', 'freeinv', 'freeinv_core'],
    shk: ['obfree', 'add_one_tobill', 'add_to_billobjs'],
    steal: ['remove_worn_item'],
    allmain: ['stop_occupation'],
    weapon: ['setmnotwielded'],
    mon: ['maybe_unhide_at', 'hideunder'],
    eat: ['eating_glob'],
    objnam: ['xname_flags', 'yname', 'Yname2'],
})) {
    const file = `nethack-c/recorder/src/${module}.c`;
    const source = read(file);
    for (const name of names) {
        const match = source.match(new RegExp(`^${name}\\([^]*?^}`, 'm'));
        assert.ok(match, `${file}:${name}`);
        bodies.set(`${module}.${name}`, match[0]);
        sources.push({ file, function: name,
            line: source.slice(0, match.index).split('\n').length,
            functionSha256: sha(match[0]), fileSha256: sha(source) });
    }
}
const c = name => bodies.get(name);
const js = (file, name) => read(`js/${file}.js`)
    .match(new RegExp(`^(?:export )?(?:async )?function ${name}\\([^]*?^}`, 'm'))?.[0] || '';
const shrink = js('mkobj', 'shrink_glob');
const gone = js('mkobj', 'shrinking_glob_gone');
const passed = [];
const failures = [];
function check(name, operation) {
    try {
        operation();
        passed.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}
function ordered(source, ...parts) {
    let at = -1;
    for (const part of parts) {
        const next = source.indexOf(part, at + 1);
        assert.ok(next > at, `missing or misordered: ${part}`);
        at = next;
    }
}

check('callback dispatch passes the original deadline after removing its timer', () => {
    assert.match(c('timeout.run_timers'), /curr->timeout/);
    ordered(js('timeout', 'run_timers'), 'game.timer_base.shift()', 'curr.arg.timed',
        'await shrink_glob(curr.arg, curr.timeout)');
});
check('catch-up uses C ceiling division and computes interval before the ice divisor', () => {
    ordered(c('mkobj.shrink_glob'), 'expire_time < svm.moves',
        '(svm.moves - expire_time + 24L) / 25L', '25L - (delta % 25L)', '(delta + 2L) / 3L');
    ordered(shrink, 'expire_time < game.moves',
        'Math.trunc((game.moves - expire_time + 24) / 25)', '25 - (delta % 25)',
        'Math.trunc((delta + 2) / 3)');
});
check('catch-up precedes eating and has no normal naming, nutrition or feedback work', () => {
    ordered(c('mkobj.shrink_glob'), 'expire_time < svm.moves', 'eating_glob(obj)', 'Yname2(obj)');
    ordered(shrink, 'expire_time < game.moves', 'game.occupation === eatfood', 'Yname2(obj)');
    const catchup = shrink.slice(shrink.indexOf('if (expire_time'), shrink.indexOf('// src/eat.c'));
    assert.doesNotMatch(catchup, /oeaten|Yname2|pline|newsym|rn2|encumber_msg|update_inventory/);
    assert.match(catchup, /container_weight\(contnr\)/);
    assert.match(catchup, /start_glob_timeout\(obj, moddelta\)/);
});
check('normal skip conditions retain the literal ice phase and exact meal identity', () => {
    assert.match(c('mkobj.shrink_glob'), /svm\.moves % 3L\) == 1L/);
    assert.match(c('eat.eating_glob'), /go\.occupation == eatfood && glob == svc\.context\.victual\.piece/);
    assert.match(shrink, /game\.moves % 3 === 1/);
    assert.match(shrink, /game\.occupation === eatfood && game\.context\.victual\.piece === obj/);
});
check('temporary partly-eaten naming surrounds Yname2 before weight changes', () => {
    ordered(shrink, 'partly_eaten_hack = true', 'Yname2(obj)',
        'partly_eaten_hack = false', 'obj.owt--', 'obj.oeaten > 1');
    const name = js('objnam', 'xname_flags');
    ordered(name, 'case FOOD_CLASS', 'ONAMES.SLIME_MOLD',
        'game.iflags?.partly_eaten_hack && obj.oeaten', 'buf += \'partly eaten \'', 'if (obj.globby)');
});
check('contained shrink computes old outer weight before recursively updating and reporting', () => {
    ordered(shrink, 'old_top_owt = topcontnr.owt', 'container_weight(contnr)',
        'near_capacity() !== game.oldcap', 'lighter.');
    assert.match(c('mkobj.shrink_glob'), /near_capacity\(\) != go\.oldcap/);
});
check('floor visibility is captured before disposal and distant The becomes A', () => {
    ordered(shrink, 'const seeit', 'get_obj_location(obj, cc, 0)',
        'await shrinking_glob_gone(obj)', 'newsym(cc.x, cc.y)', "globnambuf.startsWith('The ')",
        "globnambuf = 'A ' + globnambuf.slice(4)", 'fades away.');
    assert.match(shrink, /if \(seeit\) \{\s*newsym\(cc\.x, cc\.y\)/);
    assert.match(c('mkobj.shrink_glob'), /if \(seeit\) \{\s*newsym\(ox, oy\)/);
    assert.match(c('mkobj.shrink_glob'), /ox != u\.ux \|\| oy != u\.uy/);
});
check('inventory destruction finishes slot removal and occupation before useupall', () => {
    ordered(gone, 'owhere === OBJ_INVENT', 'if (obj.owornmask)',
        'await remove_worn_item(obj, false)', 'await stop_occupation()', 'await useupall(obj)');
    ordered(c('mkobj.shrinking_glob_gone'), 'remove_worn_item(obj, FALSE)', 'stop_occupation()', 'useupall(obj)');
});
check('migration flags and defensive monster weapon references clear before extraction', () => {
    ordered(gone, 'owhere === OBJ_MIGRATING', 'obj.owornmask = 0',
        'owhere === OBJ_MINVENT', 'MON_WEP(obj.ocarry)',
        'await setmnotwielded(obj.ocarry, obj)', 'obj_extract_self(obj)');
});
check('floor concealment cleanup is between extraction and canonical obfree', () => {
    ordered(gone, 'obj_extract_self(obj)', 'owhere === OBJ_FLOOR',
        'maybe_unhide_at(obj.ox, obj.oy)', 'await obfree(obj, null)');
    ordered(c('mkobj.shrinking_glob_gone'), 'obj_extract_self(obj)',
        'maybe_unhide_at(obj->ox, obj->oy)', 'obfree(obj, (struct obj *) 0)');
});
check('contained extraction repairs every ancestor through the existing helper', () => {
    assert.match(c('mkobj.obj_extract_self'), /container_weight\(obj->ocontainer\)/);
    assert.match(js('invent', 'obj_extract_self'), /container_weight\(c\)/);
    assert.match(js('mkobj', 'container_weight'), /container_weight\(object\.ocontainer\)/);
});
check('timer producers and thaw use the same restart contract', () => {
    assert.match(c('mkobj.mksobj_init'), /start_glob_timeout\(otmp, 0L\)/);
    assert.match(c('pickup.removed_from_icebox'), /start_glob_timeout\(obj, 0L\)/);
    assert.match(c('mkobj.obj_absorb'), /start_glob_timeout\(otmp1, tm1\)/);
    assert.match(js('mkobj', 'start_glob_timeout'), /25 \+ rn2\(5\) - 2/);
});
check('timer persistence retains original deadlines and relinks object IDs', () => {
    assert.match(c('timeout.restore_timers'), /if \(ghostly\)/);
    assert.match(c('timeout.relink_timers'), /find_oid/);
    assert.match(js('timeout', 'relink_timers'), /find_oid/);
    assert.match(js('restore', 'getlev'), /relink_timers\(false\)/);
    assert.match(js('save', 'savelev'), /save_timers\(RANGE_LEVEL, release\)/);
});
check('private disposal remains private and no local RNG/disposal substitute is added', () => {
    assert.ok(gone.startsWith('async function shrinking_glob_gone('));
    assert.doesNotMatch(gone, /export|rn2|splice|OBJ_DELETED|timer_base|light_sources/);
    assert.doesNotMatch(shrink, /\brn2\(/);
});

console.log(JSON.stringify({ evidence: 'source-only; no C execution',
    passed: passed.length, total: passed.length + failures.length, checks: passed,
    failures, sources }, null, 4));
process.exitCode = failures.length ? 1 : 0;
