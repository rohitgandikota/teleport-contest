// Static source contracts, independent of ordinary/native reach claims.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const sources = new Map();
function body(file, name, javascript = false) {
    const path = javascript ? `js/${file}.js` : `nethack-c/recorder/src/${file}.c`;
    const text = fs.readFileSync(new URL(path, root), 'utf8');
    const prefix = javascript ? '(?:export )?(?:async )?function ' : '';
    const match = text.match(new RegExp(`^${prefix}${name}\\([^]*?^}`, 'm'));
    assert.ok(match, `${path}:${name} exists`);
    sources.set(`${path}:${name}`, { path, function: name,
        line: text.slice(0, match.index).split('\n').length,
        fileSha256: sha(text), functionSha256: sha(match[0]) });
    return match[0];
}
const c = (file, name) => body(file, name);
const js = (file, name) => body(file, name, true);
function ordered(text, ...parts) {
    let start = -1;
    for (const part of parts) {
        const index = text.indexOf(part, start + 1);
        assert.ok(index > start, `missing or misordered ${part}`);
        start = index;
    }
}
const checks = [], failures = [];
function check(name, operation) {
    try {
        operation();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message.split('\n')[0] });
    }
}
check('contact and both rejection guards precede nonfood dispatch and food resume', () => {
    ordered(c('eat', 'doeat'), 'retouch_object(&otmp, FALSE)', 'PM_RUST_MONSTER',
        'RIN_SLOW_DIGESTION', 'return doeat_nonfood(otmp)', 'otmp == svc.context.victual.piece');
    ordered(js('eat', 'doeat'), 'await retouch_object(otmp, false)', 'PM_RUST_MONSTER',
        'RIN_SLOW_DIGESTION', 'return await doeat_nonfood(otmp)', 'otmp === game.context.victual?.piece');
});
check('rustproof rejection marks knowledge before split, feedback and stun', () => {
    ordered(c('eat', 'doeat'), 'otmp->rknown = TRUE', '!carried(otmp)',
        'splitobj(otmp, otmp->quan - 1L)', 'otmp = splitobj(otmp, 1L)',
        'was rustproofed!', 'otmp->oerodeproof = 0', 'make_stunned', 'rn2(10)');
    ordered(js('eat', 'doeat'), 'otmp.rknown = 1', '!carried(otmp)',
        'splitobj(otmp, otmp.quan - 1)', 'otmp = splitobj(otmp, 1)',
        'was rustproofed!', 'otmp.oerodeproof = 0', 'await make_stunned', 'rn2(10)');
});
check('spitting preserves welded and cursed-ring exceptions and awaited ownership order', () => {
    ordered(c('eat', 'doeat'), 'welded(otmp)', 'W_RING', 'set_bknown(otmp, 1)',
        'remove_worn_item(otmp, FALSE)', 'freeinv(otmp)', 'dropy(otmp)', 'stackobj(otmp)');
    ordered(js('eat', 'doeat'), 'welded(otmp)', 'W_RING', 'set_bknown(otmp, 1)',
        'await remove_worn_item(otmp, false)', 'await freeinv(otmp)', 'await dropy(otmp)', 'stackobj(otmp)');
});
check('slow digestion awaits rotten feedback and conditional naming without consumption', () => {
    ordered(c('eat', 'doeat'), 'This ring is indigestible!', 'rottenfood(otmp)',
        'otmp->dknown', 'trycall(otmp)', 'return ECMD_TIME;');
    ordered(js('eat', 'doeat'), 'This ring is indigestible!', 'await rottenfood(otmp)',
        'otmp.dknown', 'await trycall(otmp)', 'return ECMD_TIME;');
});
check('glass word discovery uses appearance knowledge and the shared discovery owner', () => {
    ordered(c('eat', 'foodword'), 'FOOD_CLASS', 'GEM_CLASS', 'GLASS', 'otmp->dknown', 'makeknown', 'return foodwords');
    ordered(js('eat', 'foodword'), 'FOOD_CLASS', 'GEM_CLASS', 'GLASS', 'otmp.dknown', 'makeknown', 'return foodwords');
});
check('rotten blindness uses canonical Blind and the blinded timer producer', () => {
    ordered(c('eat', 'rottenfood'), '!rn2(4) && !Blind', 'BlindedTimeout', 'd(2, 10)', 'if (!Blind)', 'vision_clears');
    ordered(js('eat', 'rottenfood'), '!rn2(4) && !Blind()', 'await make_blinded', 'TIMEOUT', 'd(2, 10)',
        'if (!Blind())', 'vision quickly clears');
    assert.doesNotMatch(js('eat', 'rottenfood'), /ublind|\.HBlinded\s*=/);
});
check('rotten fainting tests canonical levitation before the surface and owns its callback', () => {
    ordered(c('eat', 'rottenfood'), 'Levitation || Is_airlevel', 'surface(', 'incr_itimeout(&HDeaf', 'nomul(', 'Hear_again');
    ordered(js('eat', 'rottenfood'), 'Levitation() || Is_airlevel', 'surface(', "incr_itimeout('HDeaf'", 'nomul(', 'Hear_again');
});
check('one-turn victual is unsplit and uses C nutrition choices and cap', () => {
    for (const [text, pieces] of [
        [c('eat', 'doeat_nonfood'), ['reqtime = 1', 'piece = otmp', 'usedtime = 0', 'canchoke', '200000L', '2000', 'weight(otmp)', 'oc_nutrition', 'SCR_MAIL', 'nmod = basenutrit', 'eating = 1']],
        [js('eat', 'doeat_nonfood'), ['reqtime = 1', 'piece = otmp', 'usedtime = 0', 'canchoke', '200000', '2000', 'weight(otmp)', 'oc_nutrition', 'SCR_MAIL', 'nmod = basenutrit', 'eating = 1']],
    ]) {
        ordered(text, ...pieces);
        assert.doesNotMatch(text, /splitobj\(/);
    }
});
check('material conduct excludes wax from meat and preserves log suppression', () => {
    ordered(c('eat', 'doeat_nonfood'), 'u.uconduct.food++', 'LEATHER', 'BONE', 'DRAGON_HIDE', 'WAX',
        'u.uconduct.unvegan++ && !ll_conduct', 'material != WAX', 'violated_vegetarian()');
    ordered(js('eat', 'doeat_nonfood'), 'u.uconduct.food++', 'LEATHER', 'BONE', 'DRAGON_HIDE', 'WAX',
        'u.uconduct.unvegan++ && !ll_conduct', 'material !== MATERIALS.WAX', 'await violated_vegetarian()');
});
check('curse, paper and poison precede the delicious message and final owner', () => {
    ordered(c('eat', 'doeat_nonfood'), 'otmp->cursed', 'rottenfood(otmp)', 'PAPER', 'opoisoned',
        'Poison_resistance', 'rnd(4), rnd(15)', 'obj_is_pname', 'ART_ORB_OF_DETECTION', 'eatspecial()');
    ordered(js('eat', 'doeat_nonfood'), 'otmp.cursed', 'await rottenfood(otmp)', 'MATERIALS.PAPER', 'opoisoned',
        'Poison_resistance()', 'rnd(4), rnd(15)', 'obj_is_pname', 'ART_ORB_OF_DETECTION', 'await eatspecial()');
});
check('eatspecial installs occupation for nutrition then clears the whole victual', () => {
    ordered(c('eat', 'eatspecial'), 'set_occupation(eatfood', 'lesshungry(', 'go.occupation = 0', 'zero_victual', 'COIN_CLASS');
    ordered(js('eat', 'eatspecial'), 'set_occupation(eatfood', 'await lesshungry(', 'game.occupation = null', 'game.context.victual = {}', 'COIN_CLASS');
});
check('whole-stack coins finish disposal before the vault witness', () => {
    ordered(c('eat', 'eatspecial'), 'COIN_CLASS', 'useupall(otmp)', 'useupf(otmp, otmp->quan)', 'vault_gd_watching(GD_EATGOLD)', 'return;');
    ordered(js('eat', 'eatspecial'), 'COIN_CLASS', 'await useupall(otmp)', 'await useupf(otmp, otmp.quan)', 'vault_gd_watching(GD_EATGOLD)', 'return;');
});
check('specific paper messages precede the shuffled description case', () => {
    ordered(c('eat', 'eatspecial'), 'SCR_MAIL', 'SCR_SCARE_MONSTER', 'objdescr_is(otmp, "YUM YUM")', 'Needs salt...');
    ordered(js('eat', 'eatspecial'), 'SCR_MAIL', 'SCR_SCARE_MONSTER', "objdescr_is(otmp, 'YUM YUM')", 'Needs salt...');
});
check('potion increment, accessories and leash use existing complete owners', () => {
    ordered(c('eat', 'eatspecial'), 'otmp->quan++', 'dopotion(otmp)', 'eataccessory(otmp)', 'o_unleash(otmp)', 'TRIDENT', 'FLINT');
    ordered(js('eat', 'eatspecial'), 'otmp.quan++', 'await dopotion(otmp)', 'await eataccessory(otmp)', 'o_unleash(otmp)', 'TRIDENT', 'FLINT');
});
check('single equipment slots clear before ball and chain disposal', () => {
    ordered(c('eat', 'eatspecial'), 'otmp == uwep', 'uwepgone()', 'otmp == uquiver', 'uqwepgone()',
        'otmp == uswapwep', 'uswapwepgone()', 'otmp == uball', 'otmp == uchain', 'else if (carried(otmp))', 'useupf(otmp, 1L)');
    ordered(js('eat', 'eatspecial'), 'otmp === game.u.uwep', 'await uwepgone()', 'otmp === game.u.uquiver', 'uqwepgone()',
        'otmp === game.u.uswapwep', 'uswapwepgone()', 'otmp === game.u.uball', 'otmp === game.u.uchain',
        'else if (carried(otmp))', 'await useupf(otmp, 1)');
});
check('accessory snapshots intrinsic before ring removal and observes before its roll', () => {
    ordered(c('eat', 'eataccessory'), 'oldprop =', 'Ring_gone(otmp)', 'u.uhp <= 0', 'observe_object(otmp)', 'otmp->known = 1', 'RING_CLASS ? 3 : 5');
    ordered(js('eat', 'eataccessory'), 'oldprop =', 'await Ring_gone(otmp)', 'u.uhp <= 0', 'observe_object(otmp)', 'otmp.known = 1', 'RING_CLASS ? 3 : 5');
});
check('canonical intrinsic bitset precedes the complete special visibility dispatch', () => {
    ordered(c('eat', 'eataccessory'), 'intrinsic |= FROMOUTSIDE', 'RIN_SEE_INVISIBLE', 'set_mimic_blocking()', 'see_monsters()',
        'RIN_INVISIBILITY', 'RIN_PROTECTION_FROM_SHAPE_CHAN', 'rescham()', 'RIN_LEVITATION');
    ordered(js('eat', 'eataccessory'), 'intrinsic[prop.key] =', 'FROMOUTSIDE', 'RIN_SEE_INVISIBLE', 'set_mimic_blocking()', 'see_monsters()',
        'RIN_INVISIBILITY', 'RIN_PROTECTION_FROM_SHAPE_CHAN', 'await rescham()', 'RIN_LEVITATION');
});
check('levitation restores its prior word before floating and duration draws', () => {
    ordered(c('eat', 'eataccessory'), 'u.uprops[LEVITATION].intrinsic = oldprop', 'if (!Levitation)', 'float_up()', 'd(10, 20)', 'makeknown(typ)');
    ordered(js('eat', 'eataccessory'), 'intrinsic.HLevitation = oldprop', 'if (!Levitation())', 'await float_up()', 'd(10, 20)', 'makeknown(typ)');
});
check('all C accessory cases are present, and accuracy/damage narrow to signed eight bits', () => {
    const owner = c('eat', 'eataccessory'), port = js('eat', 'eataccessory');
    const cases = [...owner.matchAll(/case (\w+):/g)].map(match => match[1]);
    assert.deepEqual([...port.matchAll(/case ONAMES\.(\w+):/g)].map(match => match[1]), cases);
    assert.equal((owner.match(/\(schar\) bounded_increase/g) || []).length, 2);
    assert.equal((port.match(/<< 24\) >> 24/g) || []).length, 2);
});
check('sleep and no-effect cases retain C RNG and bit-width order', () => {
    ordered(c('eat', 'eataccessory'), 'RIN_FREE_ACTION', 'HSleep_resistance |= FROMOUTSIDE', 'AMULET_OF_CHANGE',
        'AMULET_OF_UNCHANGING', 'AMULET_OF_STRANGULATION', 'AMULET_OF_RESTFUL_SLEEP', 'rnd(100)',
        'HSleepy & TIMEOUT', 'HSleepy & ~TIMEOUT', 'RIN_SUSTAIN_ABILITY', 'AMULET_OF_LIFE_SAVING', 'AMULET_OF_FLYING', 'AMULET_OF_REFLECTION');
    ordered(js('eat', 'eataccessory'), 'RIN_FREE_ACTION', 'intrinsic.HSleep_resistance =', 'AMULET_OF_CHANGE',
        'AMULET_OF_UNCHANGING', 'AMULET_OF_STRANGULATION', 'AMULET_OF_RESTFUL_SLEEP', 'rnd(100)',
        '& TIMEOUT', '& ~TIMEOUT', 'RIN_SUSTAIN_ABILITY', 'AMULET_OF_LIFE_SAVING', 'AMULET_OF_FLYING', 'AMULET_OF_REFLECTION');
});
check('bounded increase removes and restores worn contributions with protection exception', () => {
    ordered(c('eat', 'bounded_increase'), 'old -= uright->spe', 'old -= uleft->spe', 'absold + absinc < 10',
        'absold + absinc < 20', 'rnd(absinc)', 'absold + absinc < 40', 'rn2(absinc)', 'rnd(20 - absold)',
        'old += uright->spe', 'old += uleft->spe', 'return old + inc');
    ordered(js('eat', 'bounded_increase'), 'old -= u.uright.spe', 'old -= u.uleft.spe', 'absold + absinc < 10',
        'absold + absinc < 20', 'rnd(absinc)', 'absold + absinc < 40', 'rn2(absinc)', 'rnd(20 - absold)',
        'old += u.uright.spe', 'old += u.uleft.spe', 'return old + inc');
    assert.equal((js('eat', 'bounded_increase').match(/typ !== ONAMES.RIN_PROTECTION/g) || []).length, 4);
});
check('adjattrib early guards precede attribute mutation and await cap speech', () => {
    ordered(c('attrib', 'adjattrib'), 'Fixed_abil || !incr', 'DUNCE_CAP', 'msgflg == 0', 'cap constricts briefly', 'old_acurr = ACURR');
    ordered(js('attrib', 'adjattrib'), 'Fixed_abil() || !incr', 'DUNCE_CAP', 'msgflg === 0', 'await Your(', 'const old_acurr');
});
check('vault watcher preserves full visibility and accepted activity guards', () => {
    ordered(c('vault', 'vault_gd_watching'), 'findgd()', 'guard->mx', 'guard->mcansee', 'm_canseeu(guard)', 'GD_EATGOLD', 'GD_DESTROYGOLD', 'witness = activity');
    ordered(js('vault', 'vault_gd_watching'), 'findgd()', 'guard.mx', 'guard.mcansee', 'm_canseeu(guard)', 'GD_EATGOLD', 'GD_DESTROYGOLD', 'witness = activity');
});
check('guard witness is consumed after speech and before gold collection', () => {
    ordered(c('vault', 'gd_move'), 'egrd->witness', 'if (!Deaf)', 'verbalize(', 'egrd->witness = 0', 'grd->mpeaceful = 0', 'return -1;', 'umoney');
    ordered(js('vault', 'gd_move'), 'if (egd.witness)', 'if (!Deaf())', 'await verbalize(', 'egd.witness = 0', 'guard.mpeaceful = 0', 'return -1;', 'const umoney');
});
console.log(JSON.stringify({ evidence: 'static source only; not native coverage',
    passed: checks.length, total: checks.length + failures.length, checks, failures,
    sources: [...sources.values()] }, null, 4));
process.exitCode = failures.length ? 1 : 0;
