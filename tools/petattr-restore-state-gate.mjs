// C saves flags but keeps instance_flags from the new process.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {runSegment} from '../js/jsmain.js';
import {game,resetGame} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {boolean_option} from '../js/options.js';
import {gamestate_decode,gamestate_encode,dorecover} from '../js/save.js';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/instance-options-save-restore.json',import.meta.url)));
const bind='BIND=^T:toggle(hilite_pet)\n';
const config=(base,opts)=>base.nethackrc+bind+(opts?`OPTIONS=${opts}\n`:'');

async function restorePair({from,to,toggleSave=false,toggleRestore=false,legacy=false,missing=false}) {
    const storage=new InMemoryStorage(),first=recipe.segments[0],second=recipe.segments[1];
    const savedRun=await runSegment({...first,nethackrc:config(first,from),
        moves:' i\x1b'+(toggleSave?'\x14 ':'')+'Sy',storage});
    assert.ok(savedRun.getScreens().some(s=>s.includes('Be seeing you')),'save path reached');
    const key=`save:${game.plname}`,snap=gamestate_decode(JSON.parse(storage.getItem(key)));
    const savedFlags=structuredClone(snap.flags),savedAttr=game.iflags.wc2_petattr;
    if(missing)delete snap.flags.hilite_pet;
    if(legacy) {
        // Old snapshots could include iflags. Current startup must still win.
        snap.legacy_iflags={wc2_petattr:5,marker:'old instance'};
    }
    if(legacy||missing) {
        const encoded=gamestate_encode(snap);
        if(legacy) {
            encoded.$o.iflags=encoded.$o.legacy_iflags;
            delete encoded.$o.legacy_iflags;
        }
        storage.setItem(key,JSON.stringify(encoded));
    }
    const transitions=[];let previous;
    globalThis.__step_snapshot={step:'*',cb:(s,step)=>{
        const state=[s.iflags.wc2_petattr,boolean_option('hilite_pet')];
        const key=JSON.stringify(state);
        if(key!==previous){transitions.push(state);previous=key;}
    }};
    let restoredRun;
    try {
        restoredRun=await runSegment({...second,nethackrc:config(second,to),
            moves:'i\x1b'+(toggleRestore?'\x14 ':'')+'V\f',storage});
    } finally {delete globalThis.__step_snapshot;}
    assert.ok(restoredRun.getScreens().some(s=>s.includes('welcome back')),'restore path reached');
    const withoutPet=flags=>Object.fromEntries(Object.entries(flags).filter(([k])=>k!=='hilite_pet'));
    assert.deepEqual(withoutPet(game.flags),withoutPet(savedFlags),'all other saved flags retain their values');
    assert.equal(game.flags.autopickup,false,'saved autopickup overrides new config true');
    assert.deepEqual(game.iflags.menu_headings,{color:4,attr:4},'new instance menu attributes win');
    assert.equal(game.iflags.marker,undefined);
    return {savedFlags,savedAttr,transitions};
}

for(const [label,from,to,attr,hilite] of [
    ['none to bold','petattr:none','petattr:bold',1,true],
    ['bold to none','petattr:bold','petattr:none',0,false],
    ['bold to underline','petattr:bold','petattr:underline',4,true],
    ['highlight explicitly off','petattr:bold','!hilite_pet,petattr:underline',4,false],
    ['startup toggle from none','petattr:none','hilite_pet,petattr:none',7,true],
    ['new process default is off','petattr:bold','',7,false],
]) test(`restore ${label}`,async()=>{
    await restorePair({from,to});
    assert.equal(game.iflags.wc2_petattr,attr);
    assert.equal(boolean_option('hilite_pet'),hilite);
});

for(const [label,from,to,savedHilite,attr,hilite] of [
    ['saved off toggle','petattr:bold','petattr:bold',false,1,true],
    ['saved on toggle','petattr:none','petattr:none',true,0,false],
]) test(label,async()=>{
    const {savedFlags}=await restorePair({from,to,toggleSave:true});
    assert.equal(savedFlags.hilite_pet,savedHilite,'bound toggle reached before save');
    assert.equal(game.iflags.wc2_petattr,attr);
    assert.equal(boolean_option('hilite_pet'),hilite);
});

for(const [label,from,to,expected] of [
    ['disable fresh bold after restore','petattr:none','petattr:bold',[[1,true],[1,false]]],
    ['enable fresh none after restore','petattr:bold','petattr:none',[[0,false],[7,true]]],
]) test(label,async()=>{
    const {transitions}=await restorePair({from,to,toggleRestore:true});
    assert.deepEqual(transitions,expected);
});

for(const [from,to,attr,hilite] of [
    ['petattr:none','petattr:bold',1,true],
    ['petattr:bold','petattr:none',0,false],
]) test(`legacy instance data ignored: ${from} to ${to}`,async()=>{
    await restorePair({from,to,legacy:true});
    assert.equal(game.iflags.wc2_petattr,attr);
    assert.equal(boolean_option('hilite_pet'),hilite);
});

test('old save without hilite_pet does not erase the new setting',async()=>{
    await restorePair({from:'petattr:none',to:'petattr:bold',missing:true});
    assert.equal(game.iflags.wc2_petattr,1);
    assert.equal(boolean_option('hilite_pet'),true);
});

for(const raw of [null,'bad JSON']) test(`failed restore preserves fresh options: ${raw}`,()=>{
    resetGame();game.plname='RestoreProbe';game.storage=new InMemoryStorage();
    game.flags={hilite_pet:true,autopickup:false};game.iflags={wc2_petattr:1};
    if(raw!==null)game.storage.setItem('save:RestoreProbe',raw);
    const flags=game.flags,iflags=game.iflags;
    assert.equal(dorecover(),false);
    assert.equal(game.flags,flags);assert.equal(game.iflags,iflags);
    assert.deepEqual(game.flags,{hilite_pet:true,autopickup:false});
});

// These frames come from four independent C save/restore pairs.
test('native restore paths retain the fresh pet highlight and subsequent toggles', () => {
    const samples = {
        'none-bold': [[0, 0, 0], [1, 0, 2]],
        'bold-none': [[0, 0, 2], [1, 0, 0], [1, 24, 1]],
        'saved-toggle-off': [[0, 0, 2], [0, 5, 0], [1, 0, 2], [1, 24, 0], [1, 26, 2]],
        'saved-toggle-on': [[0, 0, 0], [0, 5, 1], [1, 0, 0], [1, 24, 4]],
    };
    for (const [suffix, frames] of Object.entries(samples)) {
        const fixture = JSON.parse(readFileSync(new URL(
            `gen-sessions/generated/petattr-restore-${suffix}.session.json`, import.meta.url)));
        for (const [segment, step, attr] of frames) {
            const cell = decodeScreen(fixture.segments[segment].steps[step].screen)[5][12];
            assert.deepEqual([cell.ch, cell.color, cell.attr], ['f', 15, attr],
                `${suffix}: segment ${segment}, step ${step}`);
        }
    }
});
