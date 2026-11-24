// Source contracts only. These checks neither run C nor measure C coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const bodies = new Map(), sources = [];
for (const [module, names] of Object.entries({
    shk: ['setpaid', 'clear_unpaid', 'clear_unpaid_obj', 'clear_no_charge',
        'clear_no_charge_obj', 'onbill', 'dopay', 'pay_billed_items', 'update_bill',
        'dopayobj', 'buy_container', 'bp_to_obj', 'find_oid', 'make_itemized_bill',
        'add_to_billobjs', 'obfree', 'addtobill', 'sub_one_frombill', 'splitbill',
        'money2mon', 'pay', 'check_credit', 'insufficient_funds', 'shk_names_obj',
        'shkgone', 'make_angry_shk', 'rob_shop'],
    mkobj: ['dealloc_obj', 'dealloc_obj_real', 'dobjsfree', 'obj_extract_self',
        'extract_nobj', 'bill_dummy_object', 'nextoid'],
    wizcmds: ['obj_chain'],
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
        failures.push({ name, error: error.message.split("\n")[0] });
    }
}
const setpaid = js('shk', 'setpaid'), update = js('shk', 'update_bill');

check('setpaid drains the bill-object owner after live-object cleanup', () => {
    ordered(c('shk.setpaid'), 'clear_no_charge(shkp, svl.level.buriedobjlist)',
        'while ((obj = gb.billobjs) != 0)', 'obj_extract_self(obj)', 'dealloc_obj(obj)',
        'if (shkp)', 'ESHK(shkp)->billct = 0');
    ordered(setpaid, 'clear_no_charge(shkp, game.level?.buriedobjs)',
        'while (game.billobjs?.length)', 'const obj = game.billobjs[0]',
        'obj_extract_self(obj)', 'dealloc_obj(obj)', 'if (shkp)', 'eshk.billct = 0');
});
check('null shopkeeper still drains the global bill list without dereferencing ESHK', () => {
    assert.match(c('shk.setpaid'), /if \(shkp\) \{\s*ESHK\(shkp\)->billct/);
    assert.match(setpaid, /if \(shkp\) \{\s*const eshk = shkp.eshk/);
    assert.doesNotMatch(setpaid, /if \(!shkp\).*return/);
});
check('setpaid retains synchronous completion and draws no RNG', () => {
    assert.ok(setpaid.startsWith('export function setpaid('));
    assert.doesNotMatch(setpaid, /\b(?:await|async|Promise|rn2|rnd|rn1)\b/);
});
check('paid used-up records are extracted and deallocated before bill compaction', () => {
    ordered(c('shk.update_bill'), 'paiditem->unpaid = 0', 'paiditem->where == OBJ_ONBILL',
        'obj_extract_self(paiditem)', 'dealloc_obj(paiditem)', 'newebillct = eshkp->billct - 1');
    ordered(update, 'paiditem.unpaid = 0', 'paiditem.where === OBJ_ONBILL',
        'obj_extract_self(paiditem)', 'dealloc_obj(paiditem);', 'newebillct = (eshkp.billct | 0) - 1');
    assert.doesNotMatch(update, /\/\*\s*dealloc_obj/);
});
check('partly used payment retains the real item and updates the surviving quantity', () => {
    ordered(c('shk.update_bill'), 'ibill[indx].usedup == PartlyUsedUp',
        'bp->bquan = paiditem->quan', 'ibill[j].usedup = FullyIntact', '} else {', 'dealloc_obj');
    ordered(update, 'ibill[indx].usedup === PartlyUsedUp',
        'bp.bquan = paiditem.quan', 'ibill[j].usedup = FullyIntact', '} else {', 'dealloc_obj');
});
check('payment commits disposal only after dopayobj succeeds', () => {
    ordered(c('shk.pay_billed_items'), 'buy = dopayobj(', 'if (buy == PAY_BUY)', 'update_bill(');
    ordered(js('shk', 'pay_billed_items'), 'buy = await dopayobj(', 'if (buy === PAY_BUY)', 'update_bill(');
    assert.doesNotMatch(c('shk.dopayobj'), /dealloc_obj/);
    assert.doesNotMatch(js('shk', 'dopayobj'), /dealloc_obj/);
});
check('dopayobj restores quantity and price suppression after real payment feedback', () => {
    ordered(c('shk.dopayobj'), 'save_quan = obj->quan', 'obj->quan = quan',
        'iflags.suppress_price++', 'pay(ltmp, shkp)', 'shk_names_obj(',
        'obj->quan = save_quan', 'iflags.suppress_price--', 'return buy');
    ordered(js('shk', 'dopayobj'), 'save_quan = obj.quan', 'obj.quan = quan',
        'game.iflags.suppress_price =', 'await pay(ltmp, shkp)', 'await shk_names_obj(',
        'obj.quan = save_quan', 'game.iflags.suppress_price--', 'return buy');
});
check('container purchases retain the same success-gated update_bill owner', () => {
    ordered(c('shk.buy_container'), 'buy = dopayobj(', 'if (buy != PAY_BUY)', 'continue;', 'update_bill(');
    ordered(js('shk', 'buy_container'), 'buy = await dopayobj(', 'if (buy !== PAY_BUY)', 'continue;', 'update_bill(');
});
check('bill entry stops real timers and clears in_use and bypass before disposal', () => {
    ordered(c('shk.add_to_billobjs'), 'obj->where != OBJ_FREE', 'if (obj->timed)',
        'obj_stop_timers(obj)', 'obj->nobj = gb.billobjs', 'obj->where = OBJ_ONBILL',
        'obj->in_use = 0', 'obj->bypass = 0');
    ordered(js('shk', 'add_to_billobjs'), 'obj.where !== OBJ_FREE', 'if (obj.timed)',
        'obj_stop_timers(obj)', '(game.billobjs ||= []).unshift(obj)',
        'obj.where = OBJ_ONBILL', 'obj.in_use = 0', 'obj.bypass = 0');
});
check('obfree retains unpaid records on the bill instead of deallocating them early', () => {
    ordered(c('shk.obfree'), 'if (!merge)', 'bp->useup = TRUE', 'obj->unpaid = 0',
        'add_to_billobjs(obj)', 'return;', 'dealloc_obj(obj)');
    ordered(js('shk', 'obfree_bill'), 'if (!merge)', 'bp.useup = true',
        'obj.unpaid = 0', 'add_to_billobjs(obj)', 'return true');
    ordered(js('invent', 'obfree'), 'if (obfree_bill(obj, merge))', 'return;', 'dealloc_obj(obj)');
});
check('bill copies and partly consumed returns are distinct real record producers', () => {
    ordered(c('mkobj.bill_dummy_object'), 'dummy->where = OBJ_FREE', 'dummy->o_id = nextoid',
        'dummy->timed = 0', 'copy_oextra', 'addtobill(dummy');
    ordered(js('mkobj', 'bill_dummy_object'), 'where: OBJ_FREE', 'dummy.o_id = nextoid',
        'dummy.timed = 0', 'copy_oextra', 'await addtobill(dummy');
    ordered(c('shk.sub_one_frombill'), 'if (bp->bquan > obj->quan)',
        'otmp->where = OBJ_FREE', 'bp->useup = TRUE', 'add_to_billobjs(otmp)');
    ordered(js('shk', 'sub_one_frombill'), 'if (bp.bquan > obj.quan)',
        'otmp.where = OBJ_FREE', 'bp.useup = true', 'add_to_billobjs(otmp)');
});
check('OBJ_ONBILL extraction unlinks the owner before canonical FREE-only disposal', () => {
    assert.match(c('mkobj.obj_extract_self'), /case OBJ_ONBILL:[^]*?extract_nobj\(obj, &gb.billobjs\)/);
    ordered(c('mkobj.extract_nobj'), 'obj->where = OBJ_FREE', 'obj->nobj = (struct obj *) 0');
    ordered(js('invent', 'obj_extract_self'), 'case OBJ_ONBILL:', 'const objs = game.billobjs',
        'objs.splice(i, 1)', 'obj.where = OBJ_FREE');
    assert.match(js('mkobj', 'dealloc_obj'), /obj.where !== OBJ_FREE && obj.where !== OBJ_LUAFREE/);
});
check('canonical deletion clears resources and split association before staging', () => {
    ordered(c('mkobj.dealloc_obj'), 'obj_stop_timers(obj)', 'obj_sheds_light(obj)',
        'obj == gt.thrownobj', 'obj == gk.kickedobj', 'obj == svc.context.tin.tin',
        'svc.context.objsplit.parent_oid', 'if (obj->lua_ref_cnt)',
        'if (!program_state.freeingdata)', 'obj->where = OBJ_DELETED', 'dealloc_obj_real(obj)');
    ordered(js('mkobj', 'dealloc_obj'), 'obj_stop_timers(obj)', 'obj_sheds_light(obj)',
        'obj === game.thrownobj', 'obj === game.kickedobj', 'obj === game.context?.tin?.tin',
        'game.context?.objsplit', 'if (obj.lua_ref_cnt)',
        'if (!game.program_state?.freeingdata)', 'obj.where = OBJ_DELETED', 'dealloc_obj_real(obj)');
});
check('canonical drain clears whole records after removing each queued owner', () => {
    ordered(c('mkobj.dobjsfree'), 'go.objs_deleted = otmp->nobj', 'obj_extract_self(otmp)', 'dealloc_obj_real(otmp)');
    ordered(js('mkobj', 'dobjsfree'), 'game.objs_deleted.shift()', 'obj_extract_self(obj)', 'dealloc_obj_real(obj)');
    assert.match(js('mkobj', 'dealloc_obj_real'), /for \(const key of Object.keys\(obj\)\)\s*delete obj\[key\]/);
});
check('bill-only records are excluded from ordinary object lookup but included in saved level ownership', () => {
    assert.match(c('shk.bp_to_obj'), /if \(bp->useup\)\s*obj = o_on\(id, gb.billobjs\)/);
    assert.doesNotMatch(c('shk.find_oid'), /gb.billobjs/);
    assert.doesNotMatch(js('shk', 'find_oid'), /game.billobjs/);
    ordered(js('save', 'savelev'), 'dobjsfree()', 'level._saved_billobjs = game.billobjs || []',
        'gamestate_encode(level)');
    assert.match(read('nethack-c/recorder/src/save.c'), /saveobjchn\(nhfp, &gb.billobjs\)/);
});
check('ordinary stats exposes nonempty bill-object ownership without a forced row', () => {
    assert.match(read('nethack-c/recorder/src/wizcmds.c'), /obj_chain\(win, "billobjs", gb.billobjs, FALSE/);
    assert.match(js('wizcmds', 'wiz_show_stats'), /obj_chain\(win, 'billobjs', game.billobjs, false/);
    assert.match(c('wizcmds.obj_chain'), /if \(count \|\| size \|\| force\)/);
});
check('only the existing canonical helper is imported; no new production export is needed', () => {
    assert.match(read('js/shk.js'), /import \{[^}]*\bdealloc_obj\b[^}]*\} from '.\/mkobj.js'/);
    assert.ok(update.startsWith('function update_bill('));
    assert.ok(js('shk', 'dopayobj').startsWith('async function dopayobj('));
    assert.doesNotMatch(update, /\b(?:await|Promise|rn2|rnd)\b/);
});

console.log(JSON.stringify({ evidence: 'pinned C/JS source, no C execution',
    passed: passed.length, total: passed.length + failures.length,
    checks: passed, failures, sources }, null, 4));
process.exitCode = failures.length ? 1 : 0;
