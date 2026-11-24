// Source contracts, not C execution or measured native coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const bodies = new Map();
const sources = [];
for (const [module, names] of Object.entries({
    shk: ['add_one_tobill', 'add_to_billobjs', 'bill_box_content', 'billable',
        'addtobill', 'get_pricing_units', 'obfree', 'sub_one_frombill',
        'subfrombill', 'doinvbill', 'globby_bill_fixup', 'set_cost'],
    mkobj: ['init_oextra', 'newoextra', 'newomid', 'free_omid', 'copy_oextra',
        'bill_dummy_object', 'obj_attach_mid', 'mksobj', 'mksobj_init',
        'shrink_glob', 'shrinking_glob_gone'],
    pickup: ['pick_obj'],
    save: ['saveobj'],
    restore: ['restobj'],
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
const owner = js('shk', 'add_one_tobill');
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

check('C captures the current glob weight after pricing and before marking unpaid', () => {
    ordered(c('shk.add_one_tobill'), 'if (obj->globby)',
        'bp->price *= get_pricing_units(obj)', 'newomid(obj)',
        'OMID(obj) = obj->owt', 'eshkp->billct++', 'obj->unpaid = 1');
    ordered(owner, 'if (obj.globby)', 'price *= get_pricing_units(obj)',
        'obj.oextra ||= {}', 'obj.oextra.omid = obj.owt', 'obj.unpaid = 1');
});
check('the metadata assignment is restricted to the globby branch', () => {
    assert.match(owner, /if \(obj\.globby\) \{\s*price \*= get_pricing_units\(obj\);[^]*?obj\.oextra\.omid = obj\.owt;\s*}/);
    assert.equal((owner.match(/obj\.oextra\.omid\s*=/g) || []).length, 1);
    assert.doesNotMatch(owner, /obj\.owt\s*=|obj\.quan\s*=/);
});
check('lazy metadata allocation follows the existing object association convention', () => {
    ordered(c('mkobj.newomid'), 'if (!otmp->oextra)', 'otmp->oextra = newoextra()', 'OMID(otmp) = 0');
    assert.match(c('mkobj.newoextra'), /init_oextra\(oextra\)/);
    assert.match(c('mkobj.init_oextra'), /\*oex = zerooextra/);
    assert.match(js('mkobj', 'obj_attach_mid'), /\(obj\.oextra \|\|= \{\}\)\.omid = mid/);
    assert.match(owner, /obj\.oextra \|\|= \{\};\s*obj\.oextra\.omid = obj\.owt/);
});
check('ordinary already-billed and partly-eaten guards precede the private owner', () => {
    ordered(c('shk.billable'), 'onbill(obj, shkp, FALSE)', 'obj->oeaten', 'return FALSE');
    const acquire = js('shk', 'addtobill');
    ordered(acquire, 'obj.unpaid', 'obj.oeaten', 'return;', 'add_one_tobill(');
});
check('the capacity guard precedes metadata allocation', () => {
    ordered(c('shk.add_one_tobill'), 'eshkp->billct == BILLSZ', 'if (unbilled)', 'newomid(obj)');
    ordered(owner, 'eshk.bill_p.length >= 200', 'return false', 'obj.oextra ||= {}');
});
check('rebilling uses the then-current weight and bill removal leaves metadata intact', () => {
    assert.match(owner, /obj\.oextra\.omid = obj\.owt/);
    assert.doesNotMatch(js('shk', 'sub_one_frombill'), /obj\.oextra\s*=|free_omid\(obj\)|OMID\(obj\)/);
    assert.doesNotMatch(c('shk.sub_one_frombill'), /obj->oextra\s*=|free_omid\(obj\)|OMID\(obj\)/);
});
check('dummy copies discard their old association before canonical billing', () => {
    ordered(c('mkobj.bill_dummy_object'), 'copy_oextra(dummy, otmp)',
        'free_omid(dummy)', 'addtobill(dummy, FALSE, TRUE, TRUE)');
    ordered(js('mkobj', 'bill_dummy_object'), 'copy_oextra(dummy, otmp)',
        'free_omid(dummy)', 'await addtobill(dummy, false, true, true)');
});
check('recursive container billing and floor pickup use the same billing owner', () => {
    assert.match(c('shk.bill_box_content'), /add_one_tobill\(otmp, dummy, shkp\)/);
    assert.match(js('shk', 'bill_box_content'), /add_one_tobill\(contained, dummy, shkp\)/);
    ordered(c('pickup.pick_obj'), 'obj_extract_self(otmp)', 'addtobill(otmp', 'addinv(otmp)');
    ordered(js('pickup', 'pick_obj'), 'obj_extract_self(otmp)', 'await addtobill(otmp', 'await addinv(otmp)');
});
check('expiry restores saved weight only at zero and retains the bill charge', () => {
    ordered(c('shk.obfree'), 'if (!merge)', 'bp->useup = TRUE',
        'obj->globby && !obj->owt && has_omid(obj)', 'obj->owt = OMID(obj)', 'add_to_billobjs(obj)');
    const retain = js('shk', 'obfree_bill');
    ordered(retain, 'if (!merge)', 'bp.useup = true',
        'obj.globby && !obj.owt && has_omid(obj)', 'obj.owt = OMID(obj)', 'add_to_billobjs(obj)');
    assert.doesNotMatch(retain, /bp\.price\s*=/);
});
check('real timer disposal reaches canonical inventory or floor billing cleanup', () => {
    const gone = js('mkobj', 'shrinking_glob_gone');
    assert.match(gone, /await useupall\(obj\)/);
    assert.match(gone, /await obfree\(obj, null\)/);
    assert.match(js('shk', 'add_to_billobjs'), /obj_stop_timers\(obj\)/);
});
check('C save and restore transport the existing object metadata scalar', () => {
    assert.match(c('save.saveobj'), /OMID\(otmp\)/);
    assert.match(c('restore.restobj'), /OMID\(otmp\)/);
    assert.match(read('nethack-c/recorder/include/obj.h'), /unsigned omid/);
    assert.match(read('js/const.js'), /obj\?\.oextra\?\.omid/);
});
check('the private owner remains synchronous with no RNG, exports or new helper', () => {
    assert.ok(owner.startsWith('function add_one_tobill('));
    assert.doesNotMatch(owner, /\b(?:await|async|Promise|rn2|rnd|rn1|export)\b/);
    assert.doesNotMatch(read('js/shk.js'), /export[^\n]*add_one_tobill/);
});

console.log(JSON.stringify({ evidence: 'source-only; no C execution',
    passed: passed.length, total: passed.length + failures.length, checks: passed,
    failures, sources }, null, 4));
process.exitCode = failures.length ? 1 : 0;
