// Pinned source contracts, not C execution or measured branch coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const bodies = new Map();
const sources = [];
for (const [module, names] of Object.entries({
    shk: ['set_cost', 'get_pricing_units', 'getprice', 'corpsenm_price_adj',
        'contained_cost', 'sellobj', 'sellobj_state', 'globby_bill_fixup',
        'costly_gold', 'money2u'],
    shknam: ['saleable'],
    mkobj: ['weight', 'mksobj_init', 'mksobj', 'shrink_glob', 'obj_absorb'],
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
const owner = js('shk', 'set_cost');
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

check('set_cost starts with weighted units and the shop-buying base price', () => {
    ordered(c('shk.set_cost'), 'getprice(obj, TRUE)',
        'tmp = get_pricing_units(obj) * unit_price', 'if (uarmh');
    ordered(owner, 'get_pricing_units(obj) * getprice(obj, true)', 'if (u.uarmh');
});
check('existing units helper uses current glob weight and rounds up by base weight', () => {
    ordered(c('shk.get_pricing_units'), 'units = obj->quan', 'if (obj->globby)',
        '(obj->owt > 0)', 'weight(obj)', 'if (unit_weight)',
        '(wt + unit_weight - 1L) / unit_weight');
    ordered(js('shk', 'get_pricing_units'), 'obj.quan || 1', 'if (obj.globby)',
        'obj.owt > 0 ? obj.owt : weight(obj)', 'if (unitWeight)',
        'Math.trunc((currentWeight + unitWeight - 1) / unitWeight)');
    assert.match(c('mkobj.weight'), /if \(obj->globby\)[^]*?return \(int\) obj->owt/);
    assert.match(js('invent', 'weight'), /if \(obj.globby\)\s*return obj.owt/);
});
check('clothing and role divisors retain C priority and threshold', () => {
    ordered(c('shk.set_cost'), 'DUNCE_CAP', 'divisor *= 3L', 'Role_if(PM_TOURIST)',
        'u.ulevel < (MAXULEV / 2)', 'uarmu && !uarm && !uarmc', 'divisor *= 2L');
    ordered(owner, 'DUNCE_CAP', 'divisor *= 3', 'tourist && u.ulevel < MAXULEV / 2',
        'u.uarmu && !u.uarm && !u.uarmc', 'divisor *= 2');
});
check('unknown gem replacement remains quantity-based and keeper-specific', () => {
    assert.match(c('shk.set_cost'), /\(6 - shkp->m_id % 3\)/);
    assert.match(c('shk.set_cost'), /\(tmp \+ 3\) \* obj->quan/);
    ordered(owner, '!obj.dknown || !ocl.oc_name_known', 'OCLASSES.GEM_CLASS',
        'MATERIALS.GEMSTONE', 'MATERIALS.GLASS', '6 - (shkp.m_id || 0) % 3',
        '(amount + 3) * (obj.quan || 1)', 'divisor = 1');
});
check('unrecognized non-gems retain the existing three-fourths adjustment', () => {
    assert.match(c('shk.set_cost'), /tmp > 1L && !\(shkp->m_id % 4\)/);
    ordered(owner, 'amount > 1 && !((shkp.m_id || 0) % 4)',
        'multiplier *= 3', 'divisor *= 4');
});
check('integer rounding and nonzero minimum occur after all multipliers', () => {
    ordered(c('shk.set_cost'), 'if (tmp >= 1L)', 'tmp *= multiplier',
        'tmp *= 10L', 'tmp /= divisor', 'tmp += 5L', 'tmp /= 10L', 'tmp < 1L');
    ordered(owner, 'if (amount >= 1)', 'amount *= multiplier',
        'Math.trunc((Math.trunc(amount * 10 / divisor) + 5) / 10)', 'Math.max(1, amount)');
    assert.doesNotMatch(owner, /mpeaceful|surcharge|ANGRY/);
});
check('direct and both existing container sale paths reach the same private owner', () => {
    assert.match(c('shk.sellobj'), /ltmp = set_cost\(obj, shkp\)/);
    assert.match(c('shk.contained_cost'), /price \+= set_cost\(otmp, shkp\)/);
    assert.match(js('shk', 'sellobj'), /set_cost\(obj, shkp\)/);
    assert.match(js('shk', 'contained_cost'), /price \+= set_cost\(otmp, shkp\)/);
    assert.match(js('shk', 'contained_sale_summary'), /cost \+= set_cost\(contained, shkp\)/);
});
check('credit reduction and cash cap stay in the sale consumer', () => {
    ordered(c('shk.sellobj'), 'ltmp = set_cost', 'offer = ltmp + cltmp',
        '((offer * 9L) / 10L)', 'short_funds = (offer > shkmoney)');
    ordered(js('shk', 'sellobj'), 'set_cost(obj, shkp)', 'containerOffer + contents.cost',
        'Math.trunc(offer * 9 / 10)', 'shortFunds = offer > shkmoney');
});
check('globby billing preserves C second pricing-units multiplication', () => {
    ordered(c('shk.globby_bill_fixup'), 'per_unit_cost = set_cost(obj_absorbed, shkp)',
        'amount = get_pricing_units(obj_absorbed) * per_unit_cost',
        'bp_absorber->price += per_unit_cost * get_pricing_units(obj_absorbed)');
    ordered(js('shk', 'globby_bill_fixup'), 'per_unit_cost = set_cost(obj_absorbed, shkp)',
        'amount = get_pricing_units(obj_absorbed) * per_unit_cost',
        'bp_absorber.price += per_unit_cost * get_pricing_units(obj_absorbed)');
});
check('absorption prices the unmodified input weights before adding them', () => {
    ordered(c('mkobj.obj_absorb'), 'globby_bill_fixup(otmp1, otmp2)', 'otmp1->owt += o2wt');
    ordered(js('mkobj', 'obj_absorb'), 'await globby_bill_fixup(otmp1, otmp2)', 'otmp1.owt += o2wt');
});
check('the pricing owner stays private, synchronous and free of RNG or metadata writes', () => {
    assert.ok(owner.startsWith('function set_cost('));
    assert.doesNotMatch(owner, /\b(?:await|async|Promise|rn2|rnd|rn1|export|omid|oextra)\b/);
    assert.doesNotMatch(owner, /obj\.\w+\s*=(?!=)/);
    assert.doesNotMatch(read('js/shk.js'), /export[^\n]*\bset_cost\b/);
});

console.log(JSON.stringify({ evidence: 'source-only; no C execution',
    passed: passed.length, total: passed.length + failures.length, checks: passed,
    failures, sources }, null, 4));
process.exitCode = failures.length ? 1 : 0;
