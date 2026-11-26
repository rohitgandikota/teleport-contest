import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {root, reportPath, sha, families, sourcePreflight, nativePreflight, legacyPrimaryErrors} from './config-menu-bindings-preflight.mjs';
const {recipe, recipeBytes, lock, negative} = families.prerequisite;
const {runSegment} = await import(new URL('js/jsmain.js', root));
const {InMemoryStorage} = await import(new URL('js/storage.js', root));
const {rfilter, roles} = await import(new URL('js/role.js', root));
const {outputs, hashes, deferred} = await import(new URL('tools/half-damage-reader-observe.mjs', root));
const {decodeScreen, renderCell} = await import(new URL('frozen/screen-decode.mjs', root));
const wizardRole = roles.findIndex(role => role.name.m === 'Wizard');
const timer = setTimeout(() => process.exit(124), 55000), rows = [];
try {
    for (const [i, part] of recipe.segments.entries()) {
        const expected = recipe.expectations[i], states = [], checks = [];
        const check = (name, body) => {
            try { body(); checks.push({name, pass:true}); }
            catch (error) { checks.push({name, pass:false, error:error.message.slice(0,600)}); }
        };
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        let output;
        try {
            globalThis.__step_snapshot = {step:'*', cb(g, step) {
                states.push({step, errors:[...g.rc.errors], unhandled:[...g.rc.unhandled],
                    role:g.flags.initrole, race:g.flags.initrace, gender:g.flags.initgend,
                    alignment:g.flags.initalign, filters:structuredClone(rfilter),
                    moves:g.moves ?? null, inventory:g.invent.map(o => [o.o_id,o.invlet,o.otyp,o.quan])});
            }};
            output = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), prior);
        const plain = outputs(await runSegment({...part, storage:new InMemoryStorage()}));
        const late = await deferred(part);
        const screens = output.screens.map(s => decodeScreen(s).map(row => row.map(renderCell).join('')));
        const text = screens.map(lines => lines.join('\n'));
        const entries = screens.map(lines => lines.flatMap((line,y) => {
            const m = line.match(/^\s*([a-zA-Z$]) ([-+#*]) /);
            return m ? [{x:line.indexOf(m[1])+2,y,selector:m[1],mark:m[2],text:line.trim()}] : [];
        }));
        check('observer/plain/deferred preserve all five streams and every boundary', () => {
            assert.deepEqual(output, plain); assert.deepEqual(output, late);
            assert.deepEqual(output.slices.flat(), output.calls);
            for (const key of ['screens','cursors','slices','frames']) assert.equal(output[key].length, part.moves.length+1);
            assert.equal(states.length, part.moves.length+1);
        });
        check('valid C configuration has no parser errors or unhandled statements', () =>
            assert.ok(states.every(s => !s.errors.length && !s.unhandled.length)));
        check('role filters remain unchanged through the actual caller', () => {
            for (const state of states) assert.deepEqual(state.filters, states[0].filters);
        });
        if (expected.searchStep !== undefined) check('typed search reaches its real input prompt', () =>
            assert.ok(text[expected.searchStep].includes('Search for:')));
        if (expected.confirmationStep !== undefined) check('Wizard selection reaches the C confirmation caller', () => {
            assert.ok(text[expected.confirmationStep].includes('Is this ok?'));
            assert.ok(text[expected.confirmationStep].includes('Wizard'));
            assert.equal(states[expected.confirmationStep].role, wizardRole);
        });
        if (expected.kind === 'filter') {
            check('real filter menu applies the source selection branch', () => {
                const step = expected.selectionStep;
                assert.ok(text[step].includes('Unacceptable roles'));
                assert.ok(entries[step].length > 1);
                const selected = entries[step].filter(e => e.mark === '+');
                assert.equal(selected.length, expected.selected === 'all' ? entries[step].length : 1);
                if (expected.selected === 'one') assert.equal(selected[0].selector, 'a');
            });
            check('filter ESC returns to the role menu without applying filters', () =>
                assert.ok(text[expected.returnStep].includes('Pick a role or profession')));
        }
        if (expected.family === 'capacity') {
            check('early output is absent at recorded boundaries without an acknowledgement key', () => {
                assert.ok(text.every(t => !t.includes('out of menu map space.') && !t.includes('Hit space to continue:')));
                assert.ok(text[2].includes('What would you like to drop?'));
            });
            check('capacity probes leave the actual inventory and turn fixed', () => {
                for (const state of states) {
                    assert.deepEqual(state.inventory, states[0].inventory);
                    assert.equal(state.moves, states[0].moves);
                }
            });
            if (expected.ignoredStep !== undefined) check('unmapped hash is ignored before any selection', () => {
                assert.ok(text[expected.ignoredStep].includes('What would you like to drop?'));
                assert.ok(!text[expected.ignoredStep].includes('Search for:'));
                assert.ok(entries[expected.ignoredStep].length > 1);
                assert.ok(entries[expected.ignoredStep].every(e => e.mark === '-'));
            });
            if (expected.selectionStep !== undefined) check('earlier alias still selects after capacity rejection', () => {
                assert.ok(entries[expected.selectionStep].length > 1);
                assert.ok(entries[expected.selectionStep].every(e => e.mark === '+'));
            });
        }
        rows.push({name:part.name, family:expected.family, positive:expected.positive,
            pass:checks.every(c => c.pass), checks, hashes:hashes(output),
            boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length,
            states:states.map(({inventory,filters,...s}) => ({...s, inventoryCount:inventory.length,
                filterRoleCount:filters.roles.filter(Boolean).length, filterMask:filters.mask})),
            relevantScreens:screens.map((lines,step) => ({step,
                titles:lines.map(l => l.trim()).filter(l => /Search for:|Is this ok|Pick a role|Pick all that|Unacceptable|Select     |What would you like/.test(l)),
                entries:entries[step]})).filter(s => s.titles.length || s.entries.length)});
    }
    const report = {classification:'Current installed runtime, original eight ordinary cases unchanged',
        sourcePreflight,nativePreflight,legacyPrimaryErrors,recipeSHA256:lock.recipeSHA256,
        total:rows.length,passed:rows.filter(row => row.pass).length,rows};
    const controls = rows.filter(row => !row.positive);
    assert.equal(controls.length, 4); assert.ok(controls.every(row => row.pass));
    const retained = negative.controls;
    assert.deepEqual(controls.map(({name,hashes}) => ({name,hashes})),
        retained.map(({name,hashes}) => ({name,hashes})), 'all five hashes of every original negative');
    if (reportPath) writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:report.passed,total:report.total,negativePassed:controls.filter(r=>r.pass).length,
        failures:rows.filter(r=>!r.pass).map(r=>({name:r.name,checks:r.checks.filter(c=>!c.pass)}))}));
    if (report.passed !== report.total) process.exitCode = 1;
} finally { clearTimeout(timer); }
