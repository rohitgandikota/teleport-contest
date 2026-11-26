// BEGIN mandatory canonical C preflight. Metadata only, before game imports.
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const canonicalRoot = new URL('../', import.meta.url);
const canonicalSHA = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/row-refresh-owner.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalRecipeBytes), '5ae0788985abccda96baf4e1c94106e7b6bf067c60782f11906ab7b271206351', 'unchanged recording recipe');
const canonicalRecipe = JSON.parse(canonicalRecipeBytes);
const canonicalLockBytes = readFileSync(new URL('tools/gen-sessions/evidence/row-refresh-owner/input-lock.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalLockBytes), '83356d2b8cd26371560325e2da949b51f12850449c5b818fdb9007f2f249bd58', 'original final input lock');
const canonicalLock = JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256, canonicalSHA(canonicalRecipeBytes));
const canonicalFields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
assert.deepEqual(canonicalLock.tupleFields, canonicalFields);
const canonicalTuples = canonicalRecipe.segments.map(s => canonicalFields.map(field => ({field, present:Object.hasOwn(s,field), value:s[field]})));
assert.equal(canonicalSHA(JSON.stringify(canonicalTuples)), 'eb01f6a7f477cb0c5214ce900b7935b5c8c733cae375a0053804d50584a962af');
assert.equal(canonicalLock.tupleSHA256, canonicalSHA(JSON.stringify(canonicalTuples)));
assert.equal(canonicalLock.cases, 7);
assert.equal(canonicalLock.keys, 158);
assert.equal(canonicalLock.boundaries, 165);
assert.equal(canonicalRecipe.requireBranchAssertions, true);
assert.equal(canonicalRecipe.segments.length, 7);
assert.equal(canonicalRecipe.branches.length, 7);
assert.equal(canonicalRecipe.branchAssertions.length, 7);
assert.deepEqual(canonicalRecipe.branchAssertions.map(a => a.segment), [0, 1, 2, 3, 4, 5, 6]);
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/generated/row-refresh-owner.session.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalBytes), '7b1be02ec8062856a39860d4095c0ffdb5a25be97fdf5cdd7f01a3330e1587cf', 'locked canonical C raw');
assert.equal(canonicalBytes.length, 969822);
const canonicalNative = JSON.parse(canonicalBytes);
assert.equal(canonicalNative.source, 'c');
assert.equal(canonicalNative.version, 5);
assert.equal(canonicalNative.segments.length, 7);
assert.deepEqual(recordingIntegrityErrors(canonicalNative), [], 'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe, canonicalNative), [], 'all seven original primary branches');
for (let i = 0; i < 7; i++) {
    const actual = canonicalNative.segments[i], expected = canonicalRecipe.segments[i];
    for (const field of canonicalFields) {
        assert.ok(Object.hasOwn(expected, field), `recipe field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(actual, field), Object.hasOwn(expected, field), `C field presence ${i} ${field}`);
        assert.deepEqual(actual[field], expected[field], `C field value ${i} ${field}`);
    }
    assert.deepEqual(canonicalLock.segments[i], {name:expected.name, keys:expected.moves.length, tupleSHA256:canonicalSHA(JSON.stringify(canonicalTuples[i]))});
    assert.deepEqual(actual.steps.map(step => step.key), [null, ...expected.moves], `every C key ${i}`);
}
assert.equal(canonicalRecipe.segments.reduce((n,s) => n + s.moves.length, 0), 158);
assert.equal(canonicalNative.segments.reduce((n,s) => n + s.steps.length, 0), 165);
// END mandatory canonical C preflight.
// Read-only debugger observation of a private owner, without runtime exports or mocks.
// Windows background-glyph branches are constructed source evidence, not tty reach.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Session} from 'node:inspector';
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const rowRefreshState = await import('../js/gstate.js');
let game = rowRefreshState.game;
const C = await import('../js/const.js');
const {cmap_names:CM} = await import('../js/drawing_data.js');
const {set_levltyp} = await import('../js/mkmaze.js');
const {cansee} = await import('../js/vision.js');
const {show_glyph_cell,row_refresh,gbuf_at} = await import('../js/display.js');
const {NO_COLOR} = await import('../js/terminal.js');
const {outputs,hashes} = await import('./half-damage-reader-observe.mjs');

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/row-refresh-owner.json',import.meta.url)));
const sourceURL=new URL('../js/display.js',import.meta.url);
const lines=readFileSync(sourceURL,'utf8').split('\n');
const returnLine=lines.findIndex(l=>l.trim()==='return { glyph, framecolor };');
const inspector=new Session(),values=[],results=[];
const timer=setTimeout(()=>process.exit(2),55000);
const post=(method,params={})=>new Promise((resolve,reject)=>inspector.post(method,params,(e,r)=>e?reject(e):resolve(r)));
let readError=null;
if(returnLine>=0){
    inspector.connect();await post('Debugger.enable');
    inspector.on('Debugger.paused',({params})=>{
        const frame=params.callFrames.find(f=>f.functionName==='get_bkglyph_and_framecolor');
        const scope=frame?.scopeChain.find(s=>s.type==='local');
        if(!scope){readError='private owner local scope missing';inspector.post('Debugger.resume');return;}
        inspector.post('Runtime.getProperties',{objectId:scope.object.objectId,ownProperties:true},(error,response)=>{
            if(error)readError=error.message;
            else{
                const local=Object.fromEntries(response.result.map(p=>[p.name,p.value?.value]));
                values.push({glyph:local.glyph,framecolor:local.framecolor});
            }
            inspector.post('Debugger.resume');
        });
    });
    await post('Debugger.setBreakpointByUrl',{url:sourceURL.href,lineNumber:returnLine});
}
// Expected background identities follow the independent C switch, display.c:2517.
const tests=[
    ['unseen excludes actual terrain',C.POOL,CM.S_pool,{unseen:true},null],
    ['unexplored glyph excludes remembered terrain',C.POOL,CM.S_pool,{unexplored:true},null],
    ['disabled background flag',C.POOL,CM.S_pool,{disabled:true},null],
    ['stone',C.STONE,CM.S_stone,{},CM.S_stone],
    ['secret corridor',C.SCORR,CM.S_stone,{},CM.S_stone],
    ['arboreal stone',C.STONE,CM.S_tree,{arboreal:true},CM.S_tree],
    ['ordinary room keeps unexplored background',C.ROOM,CM.S_room,{},null],
    ['dark unlit room',C.ROOM,CM.S_room,{waslit:false},CM.S_darkroom],
    ['dark room option',C.ROOM,CM.S_room,{dark:true},CM.S_darkroom],
    ['dark room without color',C.ROOM,CM.S_room,{dark:true,color:false},CM.S_stone],
    ['unlit room without dark-room display',C.ROOM,CM.S_room,{waslit:false},CM.S_stone,false],
    ['lit corridor',C.CORR,CM.S_corr,{},CM.S_litcorr],
    ['unlit corridor',C.CORR,CM.S_corr,{waslit:false},CM.S_corr],
    ['lit-corridor option still darkens unseen unlit corridor',C.CORR,CM.S_corr,{waslit:false,litCorridor:true},CM.S_corr],
    ['ice',C.ICE,CM.S_ice,{},CM.S_ice],
    ['air',C.AIR,CM.S_air,{},CM.S_air],
    ['cloud',C.CLOUD,CM.S_cloud,{},CM.S_cloud],
    ['pool',C.POOL,CM.S_pool,{},CM.S_pool],
    ['moat',C.MOAT,CM.S_pool,{},CM.S_pool],
    ['water',C.WATER,CM.S_water,{},CM.S_water],
    ['lava pool',C.LAVAPOOL,CM.S_lava,{},CM.S_lava],
    ['lava wall',C.LAVAWALL,CM.S_lavawall,{},CM.S_lavawall],
    ['other terrain defaults to room background',C.DOOR,CM.S_room,{},null],
];
try{
    for(const [name,typ,cmap,options,expected,darkDefault] of tests){
        const r={name,classification:'constructed non-tty background metadata control'};
        try{
            assert.ok(returnLine>=0,'complete private background owner absent');
            const run=await runSegment({...recipe.segments[0],moves:'',storage:new InMemoryStorage()});
            game = rowRefreshState.game;
            const before=hashes(outputs(run)),x=70,y=0;
            assert.equal(cansee(x,y),false);assert.ok(set_levltyp(x,y,typ));
            game.level.at(x,y).seenv=options.unseen?0:255;
            game.level.at(x,y).waslit=options.waslit!==false;
            game.level.flags.arboreal=!!options.arboreal;
            game.flags.color=options.color!==false;
            game.flags.dark_room=options.dark??(darkDefault??options.waslit===false);
            game.flags.lit_corridor=!!options.litCorridor;
            game.iflags.use_background_glyph=!options.disabled;
            // The existing public glyph producer supplies the expected numeric identity.
            let expectedGlyph=C.GLYPH_UNEXPLORED_OFF;
            if(expected!==null){
                show_glyph_cell(69,0,'?',NO_COLOR,false,0,{kind:'cmap',cmap:expected});
                expectedGlyph=gbuf_at(69,0).disp_glyphnum;
            }
            show_glyph_cell(x,y,'?',NO_COLOR,false,0,options.unexplored?{kind:'unexplored'}:{kind:'cmap',cmap});
            values.length=0;await row_refresh(x,x,y);
            assert.equal(readError,null);assert.deepEqual(values,[{glyph:expectedGlyph,framecolor:NO_COLOR}]);
            r.observed=values[0];r.beforeRNG=before.calls;r.afterRNG=hashes(outputs(run)).calls;
            assert.equal(r.afterRNG,r.beforeRNG);r.pass=true;
        }catch(e){r.pass=false;r.error=e.message.slice(0,600);}
        results.push(r);
    }
}finally{if(returnLine>=0){await post('Debugger.disable');inspector.disconnect();}clearTimeout(timer);}
const report={classification:'read-only debugger observation of constructed C background contracts; no private export or native claim',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error}))}));
if(report.total!==report.passed)process.exitCode=1;
