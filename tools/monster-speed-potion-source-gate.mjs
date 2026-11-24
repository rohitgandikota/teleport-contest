// Pinned source contracts, not native execution or branch coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const sources = [];
const bodies = new Map();
for (const [module, names] of Object.entries({
    muse: ['find_misc', 'use_misc', 'precheck', 'mquaffmsg'],
    worn: ['mon_adjust_speed'],
    zap: ['learnwand'],
    o_init: ['observe_object', 'discover_object'],
    objnam: ['singular'],
    do_name: ['oname', 'rndmonnam'],
    wield: ['setuwep'],
    artifact: ['set_artifact_intrinsic'],
    potion: ['make_hallucinated'],
    mthrowu: ['m_useup', 'm_useupall'],
    attrib: ['exercise'],
    pline: ['pline_mon'],
})) {
    const file = `nethack-c/recorder/src/${module}.c`;
    const text = read(file);
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
const potion = arm(use, 'MUSE_POT_SPEED', 'MUSE_WAN_MAKE_INVISIBLE');
const cPotion = arm(c('muse.use_misc'), 'MUSE_POT_SPEED', 'MUSE_WAN_POLYMORPH');
const speed = js('worn', 'mon_adjust_speed');

check('speed potion uses C shared message, speed and consumption sequence', () => {
    ordered(cPotion, 'mquaffmsg(mtmp, otmp)', 'mon_adjust_speed(mtmp, 1, otmp)',
        'm_useup(mtmp, otmp)', 'return 2');
    ordered(potion, 'await mquaffmsg(mtmp, obj)', 'await mon_adjust_speed(mtmp, 1, obj)',
        'await m_useup(mtmp, obj)', 'return 2');
});
check('speed-potion arm contains no copied message or speed implementation', () => {
    assert.doesNotMatch(potion, /mtmp\.(?:permspeed|mspeed)\s*=|SPEED_BOOTS|learnwand|observe_object|singular|import\(/);
    assert.doesNotMatch(read('js/muse.js'), /\bMSLOW\b/);
});
check('selection requires non-fast speed and excludes guards', () => {
    assert.match(c('muse.find_misc'), /obj->otyp == POT_SPEED && mtmp->mspeed != MFAST && !mtmp->isgd/);
    assert.match(js('muse', 'find_misc'), /obj.otyp === ONAMES.POT_SPEED && mtmp.mspeed !== MFAST\s*&& !mtmp.isgd/);
    assert.ok(js('muse', 'find_misc').startsWith('export function'));
});
check('precheck can finish the action before speed-potion dispatch', () => {
    ordered(c('muse.use_misc'), 'precheck(mtmp, otmp)', 'return i;', 'switch (gm.m.has_misc)');
    ordered(use, 'await precheck(mtmp, obj)', 'return i;', 'switch (game.m?.has_misc');
    assert.match(c('muse.precheck'), /POTION_OCCUPANT_CHANCE/);
    assert.match(js('muse', 'precheck'), /POTION_OCCUPANT_CHANCE/);
});
check('canonical increase advances intrinsic speed by one stage', () => {
    ordered(c('worn.mon_adjust_speed'), 'case 1:', 'mon->permspeed == MSLOW',
        'mon->permspeed = 0', 'mon->permspeed = MFAST');
    ordered(speed, 'case 1:', 'mon.permspeed === MSLOW',
        'mon.permspeed = 0', 'mon.permspeed = MFAST');
});
check('effective speed follows the worn FAST property', () => {
    assert.match(c('worn.mon_adjust_speed'), /otmp->owornmask && objects\[otmp->otyp\].oc_oprop == FAST/);
    assert.match(speed, /o.owornmask\s*&& game.objects\[o.otyp\].oc_oprop === FAST/);
    ordered(speed, 'if (otmp)', 'mon.mspeed = MFAST', 'mon.mspeed = mon.permspeed');
});
check('canonical feedback retains creation, immobility and visibility guards', () => {
    ordered(c('worn.mon_adjust_speed'), 'give_msg = !gi.in_mklev', 'case 2:',
        'give_msg = FALSE', 'give_msg &&', 'mon->data->mmove', 'mon->mfrozen || mon->msleeping', 'canseemon(mon)');
    ordered(speed, 'give_msg = !game.in_mklev', 'case 2:', 'give_msg = false',
        'give_msg &&', 'mon.data.mmove', 'mon.mfrozen || mon.msleeping', 'canseemon(mon)');
});
check('effect location is printed before learning and conditional completion is awaited', () => {
    ordered(c('worn.mon_adjust_speed'), 'pline_mon(mon, "%s is suddenly moving %sfaster."', 'learnwand(obj)');
    ordered(speed, 'message = pline_mon(mon,', 'const finish =', 'learnwand(obj)', 'message.then(finish)');
    assert.match(potion, /await mon_adjust_speed\(mtmp, 1, obj\)/);
});
check('new discovery credits wisdom after the effect message', () => {
    ordered(c('zap.learnwand'), 'observe_object(obj)', 'if (obj->dknown)', 'makeknown(obj->otyp)');
    ordered(c('o_init.discover_object'), 'objects[oindx].oc_name_known = 1', 'if (credit_hero)', 'exercise(A_WIS, TRUE)');
    assert.match(c('attrib.exercise'), /rn2\(19\) > ACURR\(i\)/);
    assert.match(js('attrib', 'exercise'), /rn2\(19\) > ACURR\(i\)/);
});
check('hallucination names use display RNG and real artifact resistance controls observation', () => {
    assert.match(c('do_name.rndmonnam'), /rn2_on_display_rng/);
    assert.match(js('do_name', 'rndmonnam_with_code'), /rn2_on_display_rng/);
    assert.match(c('o_init.observe_object'), /!Hallucination/);
    assert.match(c('artifact.set_artifact_intrinsic'), /SPFX_HALRES[^]*make_hallucinated/);
    assert.match(js('artifact', 'set_artifact_intrinsic'), /SPFX_HALRES[^]*make_hallucinated/);
});
check('consumption updates a stack or completes extraction and canonical disposal', () => {
    ordered(c('mthrowu.m_useup'), 'obj->quan > 1L', 'obj->quan--', 'weight(obj)', 'm_useupall(mon, obj)');
    ordered(js('mthrowu', 'm_useup'), 'obj.quan > 1', 'obj.quan--', 'weight(obj)', 'await m_useupall(mon, obj)');
    ordered(js('mthrowu', 'm_useupall'), 'await extract_from_minvent(mon, obj, true, false)', 'obfree(obj, null)');
});
check('all nine active potion callers now use private mquaffmsg', () => {
    assert.equal((read('nethack-c/recorder/src/muse.c').match(/^ {4,}mquaffmsg\(/gm) || []).length, 9);
    assert.equal((read('js/muse.js').match(/await mquaffmsg\(/g) || []).length, 9);
    assert.ok(js('muse', 'mquaffmsg').startsWith('async function mquaffmsg('));
});
check('movement waits for the utility action before continuing its turn', () => {
    assert.match(js('monmove', 'dochug'), /else if \(find_misc\(mtmp\)\)\s*\{\s*if \(await use_misc\(mtmp\) !== 0\)\s*return 1/);
});
check('speed arm adds neither RNG decisions nor monster-death ownership', () => {
    assert.doesNotMatch(potion, /\b(?:rn2|rnd|rn1|d|mondead|mondied|monkilled|mongone|xkilled|make_corpse)\(/);
    ordered(arm(use, 'MUSE_WAN_SPEED_MONSTER', 'MUSE_POT_SPEED'),
        'await mzapwand(mtmp, obj, true)', 'await mon_adjust_speed(mtmp, 1, obj)', 'return 2');
});

console.log(JSON.stringify({ evidence: 'source-only', passed: checks.length,
    total: checks.length + failures.length, checks, failures, sources,
    limits: ['Other use_misc effect-location and branch-owner gaps remain separate.',
        'Invalid selected-item panic behavior is a pre-existing separate gap.'] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
