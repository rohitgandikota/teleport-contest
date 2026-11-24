// Pinned source contracts. This reads C text; it neither executes C nor measures coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const sources = [], bodies = new Map();
for (const [module, names] of Object.entries({
    muse: ['find_defensive', 'use_defensive', 'precheck', 'mreadmsg', 'mquaffmsg',
        'm_use_healing', 'm_sees_sleepy_soldier', 'm_tele', 'm_next2m', 'reveal_trap',
        'mon_escape', 'rnd_defensive_item', 'mon_consume_unstone', 'mcould_eat_tin'],
    mondata: ['pronoun_gender', 'same_race'],
    do_name: ['x_monnam'],
    pline: ['set_msg_xy', 'pline_mon', 'You_hear'],
    o_init: ['observe_object'],
    objnam: ['singular', 'doname', 'ansimpleoname'],
    makemon: ['m_initinv', 'mongets'],
    steal: ['mpickobj'],
    mthrowu: ['m_useup', 'm_useupall'],
    mon: ['mpickstuff', 'mondied', 'monkilled', 'mongone', 'flash_mon'],
    monmove: ['mon_would_take_item', 'm_search_items'],
})) {
    const file = `nethack-c/recorder/src/${module}.c`, text = read(file);
    for (const name of names) {
        const match = text.match(new RegExp(`^${name}\\([^]*?^}`, 'm'));
        assert.ok(match, `${file}:${name}`);
        bodies.set(`${module}.${name}`, match[0]);
        sources.push({ file, function: name,
            line: text.slice(0, match.index).split('\n').length,
            functionSha256: sha(match[0]), fileSha256: sha(text) });
    }
}
const c = name => bodies.get(name);
const js = (module, name) => read(`js/${module}.js`)
    .match(new RegExp(`^(?:export )?(?:async )?function ${name}\\([^]*?^}`, 'm'))?.[0] || '';
function ordered(text, ...parts) {
    let at = -1;
    for (const part of parts) {
        const next = text.indexOf(part, at + 1);
        assert.ok(next > at, `missing or misordered: ${part}`);
        at = next;
    }
}
const passed = [], failures = [];
function check(name, operation) {
    try {
        operation();
        passed.push(name);
    } catch (error) {
        failures.push({ name, error: error.message.split('\n')[0] });
    }
}
const mread = js('muse', 'mreadmsg'), use = js('muse', 'use_defensive');

check('visible reading uses the monster location', () => {
    assert.match(c('muse.mreadmsg'), /pline_mon\(mtmp, "%s reads %s!"/);
    assert.match(mread, /await pline_mon\(mtmp, `\$\{Monnam\(mtmp\)\} reads/);
    ordered(js('pline', 'pline_mon'), 'set_msg_xy(mtmp.mx, mtmp.my)', 'await pline(line)');
});
check('unseen confused reading uses mhe and visible reading keeps the name', () => {
    assert.match(c('muse.mreadmsg'), /vismon \? mon_nam\(mtmp\) : mhe\(mtmp\)/);
    assert.match(mread, /vismon \? mon_nam\(mtmp\) : mhe\(mtmp\)/);
});
check('pronoun RNG precedes sight and species checks under active hallucination', () => {
    ordered(c('mondata.pronoun_gender'), 'hallu_rand && Hallucination', 'return rn2(4)', '!canspotmon');
    ordered(js('mondata', 'pronoun_gender'), 'hallu_rand && Hallucination()', 'return rn2(4)', '!canspotmon');
    assert.match(read('js/mondata.js'), /genders_tbl\[pronoun_gender\(mtmp, PRONOUN_HALLU\)\]\.he/);
    assert.doesNotMatch(mread, /\b(?:rn2|rnd|rn1)\(/);
});
check('unseen deaf reading exits before observing or naming the scroll', () => {
    ordered(c('muse.mreadmsg'), '!vismon && Deaf', 'return;', 'observe_object(otmp)', 'singular(otmp');
    ordered(mread, '!vismon && Deaf()', 'return false;', 'observe_object(obj)', 'singular(obj');
});
check('observation and singular naming precede all message suspension', () => {
    ordered(mread, 'observe_object(obj)', 'singular(obj, vismon ? doname : ansimpleoname)',
        'if (vismon)', 'await pline_mon');
    ordered(c('objnam.singular'), 'savequan = otmp->quan', 'otmp->quan = 1L', '(*func)(otmp)', 'otmp->quan = savequan');
    ordered(c('o_init.observe_object'), '!Hallucination', 'obj->dknown = 1', 'discover_object');
});
check('unseen recognition excludes hallucination and unseen unique same-race monsters', () => {
    ordered(c('muse.mreadmsg'), 'same_race', 'G_UNIQ', '|| mtmp->isshk', '!Hallucination',
        'mtmp->meverseen || (similar && !uniqmon)', 'SUPPRESS_IT : AUGMENT_IT');
    ordered(mread, 'same_race', 'G_UNIQ', '|| !!mtmp.isshk', '!Hallucination()',
        'mtmp.meverseen || (similar && !unique)', 'SUPPRESS_IT : AUGMENT_IT');
});
check('label incantation remains conditional on confusion', () => {
    assert.match(c('muse.mreadmsg'), /mtmp->mconf \? "attempting to incant" : "incant"/);
    assert.match(mread, /mtmp.mconf \? 'attempting to incant' : 'incant'/);
});
check('heard reading and sensed flash finish before confused feedback', () => {
    ordered(c('muse.mreadmsg'), 'You_hear(', 'flash_mon(mtmp)', 'if (mtmp->mconf)');
    ordered(mread, 'await You_hear(', 'await flash_mon(mtmp)', 'if (mtmp.mconf)');
    assert.match(mread, /dist2\(mtmp.mx, mtmp.my, game.u.ux, game.u.uy\) <= 100/);
    assert.match(mread, /map_invisible\(mtmp.mx, mtmp.my\)/);
});
check('teleport scroll is detached before reading and freed after teleport and naming', () => {
    ordered(c('muse.use_defensive'), 'case MUSE_SCR_TELEPORTATION:', 'splitobj(otmp, 1L)',
        'extract_from_minvent', 'mreadmsg(mtmp, otmp)', 'random_teleport_level()', 'trycall(otmp)', 'obfree(otmp');
    ordered(use, 'case MUSE_SCR_TELEPORTATION:', 'splitobj(otmp, 1)',
        'await extract_from_minvent', 'await mreadmsg(mtmp, otmp)', 'random_teleport_level()',
        'await trycall(otmp)', 'obfree(otmp');
});
check('create-monster scroll retains its owner until after reading and creation', () => {
    ordered(c('muse.use_defensive'), 'case MUSE_SCR_CREATE_MONSTER:', 'rn2(73)',
        'mreadmsg(mtmp, otmp)', 'while (cnt--)', 'makemon(pm', 'm_useup(mtmp, otmp)');
    ordered(use, 'case MUSE_SCR_CREATE_MONSTER:', 'rn2(73)',
        'await mreadmsg(mtmp, otmp)', 'while (cnt--)', 'await makemon(pm', 'await m_useup(mtmp, otmp)');
});
check('offensive earth scroll is consumed before potentially fatal falling objects', () => {
    ordered(js('muse', 'use_offensive'), 'case MUSE_SCR_EARTH:', 'await mreadmsg(mtmp, otmp)',
        'await m_useup(mtmp, otmp)', 'await drop_boulder_on_monster');
});
check('sliming fire-scroll caller awaits reading before its own consumption', () => {
    ordered(js('muse', 'muse_unslime'), 'otyp === ONAMES.SCR_FIRE', 'await mreadmsg(mon, obj)',
        'if (mon.mconf)', 'await m_useup(mon, obj)');
});
check('selection is synchronous and both movement callers await use', () => {
    assert.ok(js('muse', 'find_defensive').startsWith('export function'));
    assert.match(js('monmove', 'dochug'), /find_defensive\(mtmp, false\)[^]*await use_defensive\(mtmp\) !== 0/);
    assert.match(js('monmove', 'm_move'), /find_defensive\(mtmp, true\) && await use_defensive\(mtmp\)/);
});
check('precheck and escape preserve their distinct death and disappearance routes', () => {
    assert.match(c('muse.precheck'), /monkilled\(mon, "", AD_RBRE\)/);
    assert.match(js('muse', 'precheck'), /await monkilled\(mon, '', ATTKS.AD_RBRE\)/);
    assert.match(c('muse.mon_escape'), /mongone\(mtmp\)/);
    assert.match(js('muse', 'mon_escape'), /await mongone\(mtmp\)/);
    assert.doesNotMatch(mread, /mondead|mondied|monkilled|mongone|xkilled|make_corpse/);
});
check('mreadmsg stays private and its result is unused by every active caller', () => {
    assert.ok(mread.startsWith('async function mreadmsg('));
    const text = read('js/muse.js');
    assert.equal((text.match(/await mreadmsg\(/g) || []).length, 4);
    assert.doesNotMatch(text, /(?:if|return|=)\s*\(?await mreadmsg\(/);
});

console.log(JSON.stringify({ label: 'source-only', passed: passed.length,
    total: passed.length + failures.length, checks: passed, failures, sources }, null, 2));
process.exitCode = failures.length ? 1 : 0;
