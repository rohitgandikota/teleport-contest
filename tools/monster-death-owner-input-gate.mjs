// Current repository gate. Usage: node tools/monster-death-owner-input-gate.mjs [report.json]
// Read-only observation and full output neutrality. No runtime hooks are added.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {outputs,deferred} from './monster-death-owner-deferred.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {createHash} from 'node:crypto';
const mod=name=>import(new URL(`../js/${name}.js`,import.meta.url));
const {runSegment}=await mod('jsmain');
const {InMemoryStorage}=await mod('storage');
const {PMNAMES:P}=await mod('monst_data');
const {ACH_MEDU}=await mod('const');
const {decodeScreen,renderCell}=await import('../frozen/screen-decode.mjs');
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const recipeURL=new URL('gen-sessions/recipes/monster-death-owner.json',import.meta.url);
const nativeURL=new URL('gen-sessions/generated/monster-death-owner.session.json',import.meta.url);
const recipeBytes=readFileSync(recipeURL),recipe=JSON.parse(recipeBytes),cases=recipe.segments;
const fields=part=>['name','seed','datetime','nethackrc','moves'].map(field=>
    ({field,present:Object.hasOwn(part,field),value:part[field]}));
assert.deepEqual(cases.map(p=>p.name),['vampire-bat','vampire-fog','vampire-lord-wolf',
    'plain-bat','steam-vortex','fog-cloud','medusa','newt']);
// Native output parity is separate; validate its inputs and reach claims here.
const nativeBytes=readFileSync(nativeURL),native=JSON.parse(nativeBytes);
assert.equal(native.source,'c'); assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.deepEqual(native.segments.map(fields),cases.map(fields));
for(const part of native.segments) {
    assert.ok(part.steps?.length,'native fixture must contain recorded steps');
    assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
}
const nativeSHA256=createHash('sha256').update(nativeBytes).digest('hex');
const deadline=setTimeout(()=>{console.error('55 second ordinary worker limit');process.exit(2);},55000);
const reports=[];
for(const part of cases) {
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let out;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            if(!g.u||!g.level) return;
            states.push({step,hp:g.u.uhp,mortality:g.u.umortality||0,
                monsters:g.level.monsters.filter(m=>m.mhp>0).map(m=>({id:m.m_id,
                    type:m.mnum,hp:m.mhp,cham:m.cham})),
                clouds:(g.regions||[]).map(r=>({damage:r.arg,cells:r.rects.length})),
                deaths:[P.PM_VAMPIRE,P.PM_VAMPIRE_LEADER,P.PM_VAMPIRE_BAT,
                    P.PM_STEAM_VORTEX,P.PM_FOG_CLOUD,P.PM_MEDUSA,P.PM_NEWT]
                    .map(n=>g.mvitals[n]?.died||0),
                medusa:!!g.u.uachieved?.includes(ACH_MEDU)});
        }};
        out=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    } finally {
        if(prior) Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    const row={name:part.name,inputSHA256:hash(part)};
    let texts;
    try {
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        const plain=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        assert.deepEqual(out,plain,'all five collections observer neutral');
        assert.deepEqual(out,await deferred(part),'all five collections deferred neutral');
        assert.equal(out.screens.length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.calls);
        texts=out.screens.map(screen=>decodeScreen(screen)
            .map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        const last=states.at(-1);
        assert.match(texts.at(-1),/NetHack Version/,'final command completes');
        assert.ok(states.every(s=>s.hp>0&&!s.mortality),'survives without resurrection');
        let reached;
        if(part.name.startsWith('vampire-')) {
            reached=texts.some(t=>/rises as a vampire/.test(t))
                && last.monsters.some(m=>[P.PM_VAMPIRE,P.PM_VAMPIRE_LEADER].includes(m.type));
        } else if(part.name==='steam-vortex') {
            reached=states.some(s=>s.clouds.some(c=>c.damage===0&&c.cells>=5))
                && last.deaths[3]===1;
        } else if(part.name==='medusa') reached=last.medusa&&last.deaths[5]===1;
        else {
            const idx={'plain-bat':2,'fog-cloud':4,newt:6}[part.name];
            reached=last.deaths[idx]===1;
        }
        Object.assign(row,{pass:!!reached,reached:!!reached,observerNeutral:true,deferredNeutral:true,
            boundaries:out.screens.length,calls:out.calls.length,frames:out.frames.flat().length,
            hashes:Object.fromEntries(Object.entries(out).map(([k,v])=>[k,hash(v)])),
            transitions:states.filter((s,i)=>i&&hash({...s,step:0})!==hash({...states[i-1],step:0})).length});
        if(recipe.unchangedOutputHashes[part.name])
            assert.deepEqual(row.hashes,recipe.unchangedOutputHashes[part.name]);
        if(!reached) row.firstFailure={lastMessage:texts.at(-1).split('\n')[0],
            messages:texts.map(t=>t.split('\n').slice(0,2).join('\n'))
                .filter((t,i,a)=>!i||t!==a[i-1]).slice(-5)};
    } catch(error) {
        Object.assign(row,{pass:false,error:error.message.slice(0,500),final:states.at(-1),
            firstFailure:{messages:texts?.map(t=>t.split('\n').slice(0,2).join('\n'))
                .filter((t,i,a)=>!i||t!==a[i-1]).slice(-5)}});
    }
    reports.push(row);
}
clearTimeout(deadline);
const report={kind:'ordinary current-runtime reach and observer/deferred neutrality; native parity is separate',
    recipeSHA256:createHash('sha256').update(recipeBytes).digest('hex'),nativeSHA256,
    inputSHA256:hash(cases.map(fields)),passed:reports.filter(r=>r.pass).length,total:reports.length,reports};
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:reports.filter(r=>r.pass).length,total:reports.length,
    boundaries:reports.reduce((n,r)=>n+(r.boundaries||0),0),calls:reports.reduce((n,r)=>n+(r.calls||0),0),
    frames:reports.reduce((n,r)=>n+(r.frames||0),0),failures:reports.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error,firstFailure:r.firstFailure,final:r.final}))}));
if(reports.some(r=>!r.pass)) process.exitCode=1;
