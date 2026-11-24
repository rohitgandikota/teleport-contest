// Recorded ordinary inputs with read-only JS observations and native message evidence.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ART_FROST_BRAND} from '../js/artilist_data.js';
import {has_ceiling} from '../js/dungeon.js';
import {Stone_resistance, Blind} from '../js/youprop.js';
import {OBJ_FLOOR} from '../js/const.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};

const names = ['toss-up-branches','toss-up-stamina'];
const recipes = names.map(name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url))));
const nativeHashes = [
    '329be290c20270867cb4614f0562d62d08abab129e86875de6e91ed776bc666d',
    'b95919bea499c3361d6c5a2b00b5879bf7d17854fc24aeb8cfea1fd4a88f4d6b',
];
const nativeBytes = names.map(name => readFileSync(new URL(
    `gen-sessions/generated/${name}.session.json`, import.meta.url)));
const fixtures = nativeBytes.map(bytes => JSON.parse(bytes));
const screenText = screen => decodeScreen(screen)
    .map(row => row.map(cell => cell.ch).join('')).join('\n');
const object = o => o ? {id:o.o_id,type:o.otyp,weight:o.owt,where:o.where,
    letter:o.invlet,mask:o.owornmask,erosion:o.oeroded||0,artifact:o.oartifact,
    blessed:!!o.blessed,corpsenm:o.corpsenm} : null;

test('recorded recipe names, registered coverage and observable assertions', () => {
    const registered = new Set(tags.requirements.map(r => r.id));
    recipes.forEach((recipe,i) => {
        assert.equal(recipe.name,names[i]);
        for (const tag of recipe.coverage) assert.ok(registered.has(tag),tag);
        assert.deepEqual(branchAssertionErrors(recipe),[]);
    });
    assert.equal(recipes[0].segments.length,18);
    assert.equal(recipes[1].segments.length,2);
});

for (const [i,recipe] of recipes.entries()) test(`${names[i]}: native provenance and branches`, () => {
    const fixture = fixtures[i];
    assert.equal(createHash('sha256').update(nativeBytes[i]).digest('hex'),nativeHashes[i]);
    assert.equal(fixture.source,'c'); assert.equal(fixture.version,5);
    assert.equal(fixture.segments.length,recipe.segments.length);
    for(const [index,part] of fixture.segments.entries()) {
        for(const field of ['name','seed','datetime','nethackrc','moves'])
            assert.equal(part[field],recipe.segments[index][field]);
        assert.equal(part.steps.length,part.moves.length+1);
        for(const [step,recorded] of part.steps.entries())
            assert.equal(recorded.key,step ? part.moves[step-1] : null);
    }
    assert.deepEqual(branchAssertionErrors(recipe,fixture),[]);
});

for (const recipe of recipes) for (const [index,part] of recipe.segments.entries()) {
    test(part.name, async () => {
        const states = [];
        const previous = Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
        let run;
        try {
            globalThis.__step_snapshot = {step:'*',cb(g,step) {
                states.push({step,text:g._toplines||'',hp:g.u.uhp,max:g.u.uhpmax,
                    mh:g.u.mh,mhmax:g.u.mhmax,form:g.u.umonnum,
                    mortality:g.u.umortality||0,cream:g.u.ucreamed||0,
                    blind:Blind(),stone:Stone_resistance(),ceiling:has_ceiling(g.u.uz),
                    capacity:g.wc,dir:[g.u.dx,g.u.dy,g.u.dz],
                    helm:object(g.u.uarmh),gloves:object(g.u.uarmg),amulet:object(g.u.uamul),
                    thrown:object(g.thrownobj),inventory:(g.invent||[]).map(object),
                    floor:g.level.objectsAt(g.u.ux,g.u.uy).map(object)});
            }};
            run = await runSegment({...part,storage:new InMemoryStorage()});
        } finally {
            if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
            else delete globalThis.__step_snapshot;
        }
        const screens = run.getScreens(), slices = run.getRngSlices();
        assert.equal(screens.length,part.moves.length+1);
        const generated = {source:'js',segments:recipe.segments.map((s,i) => i === index
            ? {...s,steps:screens.map((screen,j) => ({screen,rng:slices[j]}))} : null)};
        const assertionRecipe = {...recipe,segments:[part],
            branches:[recipe.branches[index]],branchAssertions:[recipe.branchAssertions[index]]};
        assert.deepEqual(branchAssertionErrors(assertionRecipe,generated),[]);
        const text = states.map(s => s.text).concat(game._msg_history||[]).join('\n');
        const visible = screens.map(s => decodeScreen(s).map(r => r.map(c=>c.ch).join('')).join('\n')).join('\n');
        assert.ok(!/Die\? \[yn\]|OK, so you don't die/.test(visible),'no Wizard recovery');
        const native = fixtures[names.indexOf(recipe.name)].segments[index];
        assert.ok(!/Die\? \[yn\]|OK, so you don't die/.test(
            native.steps.map(s=>screenText(s.screen)).join('\n')),'native input has no Wizard recovery');
        const last = states.at(-1);
        const saved = ['corpse-lifesave','egg-lifesave-seed102201'].includes(part.name);
        assert.equal(last.mortality,saved?1:0);
        assert.ok(last.hp>0);
        const carried = type => states.find(s => s.inventory.some(o => o.type===type));
        const ended = type => last.floor.find(o => o.type===type);

        switch (part.name) {
        case 'mirror-roof':
            assert.ok(carried(O.MIRROR)); assert.ok(!ended(O.MIRROR));
            assert.equal(last.hp,last.max); assert.ok(!/falls back on top/.test(text)); break;
        case 'cream-ground-102204':
            assert.ok(states.some(s => s.cream>0 && s.blind));
            assert.ok(!ended(O.CREAM_PIE)); assert.equal(last.hp,last.max); break;
        case 'crystal-armor-cracking':
            for (const erosion of [1,2,3]) assert.ok(states.some(s =>
                [...s.inventory,...s.floor].some(o => o.type===O.CRYSTAL_PLATE_MAIL && o.erosion===erosion)));
            assert.ok(!ended(O.CRYSTAL_PLATE_MAIL));
            assert.ok(!last.inventory.some(o => o.type===O.CRYSTAL_PLATE_MAIL)); break;
        case 'hard-helm':
            assert.equal(last.helm.type,O.HELMET); assert.equal(last.hp,11);
            assert.match(text,/wearing a hard helmet/); assert.ok(ended(O.CHEST)); break;
        case 'soft-hat':
            assert.equal(last.helm.type,O.ELVEN_LEATHER_HELM); assert.equal(last.hp,6);
            assert.match(text,/hat does not protect/); assert.ok(ended(O.CHEST)); break;
        case 'weight-chest':
            assert.equal(last.helm,null); assert.equal(last.hp,9);
            assert.ok(ended(O.CHEST).weight>600); break;
        case 'corpse-lifesave':
        case 'egg-lifesave-seed102201': {
            const type = part.name==='corpse-lifesave'?O.CORPSE:O.EGG;
            const setup = states.find(s => s.amulet?.type===O.AMULET_OF_LIFE_SAVING
                && s.inventory.some(o => o.type===type && o.corpsenm===P.PM_COCKATRICE));
            assert.ok(setup); assert.equal(setup.stone,false);
            if (type===O.CORPSE) assert.ok(setup.gloves);
            assert.equal(last.amulet,null);
            assert.ok(!last.inventory.some(o => o.type===O.AMULET_OF_LIFE_SAVING));
            // C's visible Constitution loss accompanies the recorded survival.
            // Mortality and amulet ownership above are JS state observations.
            const [before,after] = type===O.CORPSE ? [115,117] : [68,70];
            const constitution = step => Number(screenText(native.steps[step].screen)
                .match(/Co:(\d+)/)?.[1]);
            assert.ok(Number.isFinite(constitution(before)));
            assert.equal(constitution(after),constitution(before)-1);
            assert.equal(!!ended(type),type===O.CORPSE); break;
        }
        case 'corpse-helmet':
            assert.ok(last.helm && last.gloves); assert.equal(last.hp,11);
            assert.ok(ended(O.CORPSE)); assert.ok(!last.stone); break;
        case 'flesh-golem-corpse':
            assert.ok(states.some(s => s.form===P.PM_FLESH_GOLEM && !s.stone));
            assert.equal(last.form,P.PM_STONE_GOLEM); assert.ok(last.stone);
            assert.equal(last.mh,99); assert.ok(ended(O.CORPSE)); break;
        case 'stone-golem-corpse':
            assert.ok(states.some(s => s.form===P.PM_STONE_GOLEM && s.inventory.some(o => o.type===O.CORPSE)));
            assert.equal(last.form,P.PM_STONE_GOLEM); assert.ok(last.stone);
            assert.equal(last.mh,99); assert.ok(ended(O.CORPSE)); break;
        case 'xorn-rock':
            assert.equal(last.form,P.PM_XORN); assert.equal(last.helm,null);
            assert.equal(last.mh,last.mhmax); assert.match(text,/doesn't hurt/);
            assert.ok(ended(O.ROCK)); break;
        case 'xorn-hat':
            assert.equal(last.form,P.PM_XORN); assert.equal(last.helm.type,O.ELVEN_LEATHER_HELM);
            assert.ok(last.mh<last.mhmax); assert.match(text,/Unfortunately, you are wearing a hat/);
            assert.ok(ended(O.ROCK)); break;
        case 'vampire-blessed':
        case 'vampire-unblessed':
        case 'vampire-silver': {
            assert.equal(last.form,P.PM_VAMPIRE); assert.equal(last.helm,null);
            const silver = part.name==='vampire-silver';
            const obj = ended(silver?O.BELL_OF_OPENING:O.BELL);
            assert.ok(obj); assert.equal(obj.blessed,part.name==='vampire-blessed');
            assert.equal(last.mh,part.name==='vampire-blessed'?45:silver?36:48);
            assert.equal(text.includes('silver sears you'),silver); break;
        }
        case 'artifact-healed':
            assert.ok(states.some(s => s.hp===28 && s.inventory.some(o => o.artifact===ART_FROST_BRAND)));
            assert.equal(ended(O.LONG_SWORD).artifact,ART_FROST_BRAND);
            assert.equal(last.hp,14); assert.equal(last.max,28);
            assert.ok(slices.slice(100).flat().some(s => s.startsWith('rn2(18)='))); break;
        case 'air-dagger':
            assert.equal(last.ceiling,false);
            assert.ok(states.some(s => !s.ceiling && s.inventory.some(o => o.type===O.DAGGER && o.letter==='c')));
            assert.ok(ended(O.DAGGER)); assert.equal(last.hp,10);
            assert.match(text,/flies up into the sky/); break;
        case 'stamina-soft-heavy-confirm': {
            const before = states.find(s => s.hp===6 && s.inventory.some(o => o.type===O.CHEST)
                && s.inventory.some(o => o.type===O.HEAVY_IRON_BALL));
            assert.ok(before); assert.equal(before.max,12); assert.equal(before.capacity,600);
            assert.equal(before.inventory.reduce((n,o) => n+o.weight,0),1259);
            assert.match(text,/have so little stamina, the chest drops from your grasp/);
            assert.equal(last.hp,6); assert.equal(last.dir[2],1);
            assert.equal(ended(O.CHEST).where,OBJ_FLOOR); break;
        }
        case 'stamina-hp10-boundary':
            assert.ok(states.some(s => s.hp===10 && s.thrown?.type===O.CHEST
                && s.inventory.some(o => o.type===O.HEAVY_IRON_BALL)));
            assert.ok(!text.includes('drops from your grasp')); assert.equal(last.hp,4);
            assert.ok(ended(O.CHEST)); break;
        default: assert.fail('unclassified proposal '+part.name);
        }
    });
}
