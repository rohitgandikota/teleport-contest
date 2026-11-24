// Pinned C contracts. These checks do not claim native branch coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const sources = [];
const bodies = new Map();
for (const [module, names] of Object.entries({
    muse: ['find_misc', 'use_misc', 'precheck', 'mquaffmsg', 'muse_newcham_mon'],
    dungeon: ['Can_rise_up', 'ceiling', 'depth', 'get_level'],
    do: ['trycall'],
    do_name: ['docall'],
    makemon: ['grow_up'],
    mon: ['newcham'],
    dog: ['mon_leave', 'migrate_to_level'],
    mthrowu: ['m_useup', 'm_useupall'],
    pline: ['pline_mon'],
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
const js = (module, name) => read(`js/${module}.js`)
    .match(new RegExp(`^(?:export )?(?:async )?function ${name}\\([^]*?^}`, 'm'))?.[0] || '';
const arm = (text, name, next) => text.split(`case ${name}:`)[1]?.split(`case ${next}:`)[0] || '';
function ordered(text, ...parts) {
    let at = -1;
    for (const part of parts) {
        const next = text.indexOf(part, at + 1);
        assert.ok(next > at, `missing or misordered: ${part}`);
        at = next;
    }
}
const checks = [];
const failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message.split('\n')[0] });
    }
}
const use = js('muse', 'use_misc');
const gain = arm(use, 'MUSE_POT_GAIN_LEVEL', 'MUSE_WAN_SPEED_MONSTER');
const poly = arm(use, 'MUSE_POT_POLYMORPH', 'MUSE_POLY_TRAP');
const cGain = arm(c('muse.use_misc'), 'MUSE_POT_GAIN_LEVEL', 'MUSE_WAN_MAKE_INVISIBLE');
const cPoly = arm(c('muse.use_misc'), 'MUSE_POT_POLYMORPH', 'MUSE_POLY_TRAP');

for (const phrase of ['rises up, through the', 'looks uneasy.',
    'seems more experienced.', 'suddenly mutates!']) {
    check(`visible ${phrase} feedback uses the affected monster location`, () => {
        assert.ok(c('muse.use_misc').split('\n').some(line =>
            line.includes('pline_mon(mtmp,') && line.includes(phrase)));
        assert.ok(use.split('\n').some(line =>
            line.includes('await pline_mon(mtmp,') && line.includes(phrase)));
    });
}
check('rise feedback completes before naming, consumption and migration', () => {
    ordered(cGain, 'mquaffmsg(mtmp, otmp)', 'Can_rise_up(', 'get_level(',
        'pline_mon(mtmp,', 'ceiling(mtmp->mx, mtmp->my)', 'trycall(otmp)',
        'm_useup(mtmp, otmp)', 'migrate_to_level(');
    ordered(gain, 'await mquaffmsg(mtmp, obj)', 'Can_rise_up(', 'get_level(',
        'await pline_mon(mtmp,', 'ceiling(mtmp.mx, mtmp.my)', 'await trycall(obj)',
        'await m_useup(mtmp, obj)', 'migrate_monster(');
});
check('blocked rise feedback completes before naming and consumption', () => {
    ordered(cGain, 'looks uneasy.', 'trycall(otmp)', 'm_useup(mtmp, otmp)', 'return 2');
    ordered(gain, 'looks uneasy.', 'await trycall(obj)', 'await m_useup(mtmp, obj)', 'return 2');
});
check('growth feedback precedes discovery, consumption and survivor selection', () => {
    ordered(cGain, 'seems more experienced.', 'if (oseen)', 'makeknown(POT_GAIN_LEVEL)',
        'm_useup(mtmp, otmp)', 'grow_up(mtmp,', 'return 1', 'return 2');
    ordered(gain, 'seems more experienced.', 'if (vismon)', 'makeknown(ONAMES.POT_GAIN_LEVEL)',
        'await m_useup(mtmp, obj)', 'await grow_up(mtmp, null)', '? 2 : 1');
});
check('polymorph consumes before feedback and awaits transformation before discovery', () => {
    ordered(cPoly, 'mquaffmsg(mtmp, otmp)', 'm_useup(mtmp, otmp)', 'if (vismon)',
        'pline_mon(mtmp,', 'newcham(mtmp, muse_newcham_mon(mtmp), NC_SHOW_MSG)',
        'if (oseen)', 'makeknown(POT_POLYMORPH)', 'return 2');
    ordered(poly, 'await mquaffmsg(mtmp, obj)', 'await m_useup(mtmp, obj)', 'if (vismon)',
        'await pline_mon(mtmp,', 'await newcham(mtmp, await muse_newcham_mon(mtmp), NC_SHOW_MSG)',
        'if (oseen)', 'makeknown(ONAMES.POT_POLYMORPH)', 'return 2');
});
check('visible gain and polymorph discovery is direct, including hallucination', () => {
    for (const text of [gain, poly, cGain, cPoly]) {
        assert.match(text, /makeknown\(/);
        assert.doesNotMatch(text, /learnwand|Hallucination|dknown/);
    }
});
check('selection and precheck precede utility dispatch', () => {
    assert.match(c('muse.find_misc'), /!mtmp->isgd && !mtmp->isshk && !mtmp->ispriest/);
    assert.match(js('muse', 'find_misc'), /!mtmp.isgd && !mtmp.isshk && !mtmp.ispriest/);
    ordered(c('muse.use_misc'), 'precheck(mtmp, otmp)', 'return i;', 'switch (gm.m.has_misc)');
    ordered(use, 'await precheck(mtmp, obj)', 'return i;', 'switch (game.m?.has_misc');
    assert.match(c('muse.precheck'), /POTION_OCCUPANT_CHANCE/);
    assert.match(js('muse', 'precheck'), /POTION_OCCUPANT_CHANCE/);
});
check('real worn dragon armor determines the potion transformation', () => {
    ordered(c('muse.muse_newcham_mon'), 'which_armor(mon, W_ARM)',
        'Is_dragon_scales', 'Dragon_scales_to_pm', 'Is_dragon_mail', 'Dragon_mail_to_pm', 'rndmonst()');
    ordered(js('muse', 'muse_newcham_mon'), 'which_armor(mtmp, W_ARM)',
        'GRAY_DRAGON_SCALES', 'GRAY_DRAGON_SCALE_MAIL', 'rndmonst()');
});
check('consumption retains stack, extraction and canonical disposal ownership', () => {
    ordered(c('mthrowu.m_useup'), 'obj->quan > 1L', 'obj->quan--', 'weight(obj)', 'm_useupall(mon, obj)');
    ordered(js('mthrowu', 'm_useup'), 'obj.quan > 1', 'obj.quan--', 'weight(obj)', 'await m_useupall(mon, obj)');
    ordered(js('mthrowu', 'm_useupall'), 'await extract_from_minvent(mon, obj, true, false)', 'obfree(obj, null)');
});
check('speed dependency and movement completion remain intact', () => {
    ordered(arm(use, 'MUSE_POT_SPEED', 'MUSE_WAN_MAKE_INVISIBLE'),
        'await mquaffmsg(mtmp, obj)', 'await mon_adjust_speed(mtmp, 1, obj)', 'await m_useup(mtmp, obj)');
    assert.match(js('monmove', 'dochug'), /else if \(find_misc\(mtmp\)\)\s*\{\s*if \(await use_misc\(mtmp\) !== 0\)\s*return 1/);
    assert.ok(js('muse', 'mquaffmsg').startsWith('async function mquaffmsg('));
});
check('invisibility effect messages retain their C plain-message contract', () => {
    const cInvis = arm(c('muse.use_misc'), 'MUSE_POT_INVISIBILITY', 'MUSE_WAN_SPEED_MONSTER');
    const invis = arm(use, 'MUSE_POT_INVISIBILITY', 'MUSE_WAN_POLYMORPH');
    assert.match(cInvis, /pline\("Suddenly you cannot see %s\./);
    assert.match(invis, /await pline\(`Suddenly you cannot see/);
    assert.doesNotMatch(invis, /pline_mon/);
});
check('effect-message owners add no RNG or monster-death surrogates', () => {
    assert.doesNotMatch(gain + poly,
        /\b(?:rn2|rnd|rn1|mondead|mondied|monkilled|mongone|xkilled|make_corpse)\(/);
});

console.log(JSON.stringify({ evidence: 'source-only', passed: checks.length,
    total: checks.length + failures.length, checks, failures, sources,
    limits: ['The existing trap.migrate_monster route remains separate from canonical dog.migrate_to_level.',
        'Bullwhip ownership, deliberate polymorph-trap worm movement and invalid-item panics are unchanged.',
        'No native genocide, equipment-death, no-corpse or migration-cleanup coverage is claimed.'] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
