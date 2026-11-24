// Frozen public checks: require both successful process exit and passed result.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const sessions=process.argv[2]||fileURLToPath(new URL('../sessions/',import.meta.url));
const worker=fileURLToPath(new URL('../frozen/ps_test_runner.mjs',import.meta.url));
const names=['seed0030-ten-diverse-deaths','seed0360-wizard-world-tour',
    'seed0367-priest-quest-tour','seed0373-barbarian-quest-tour','seed5006-tourist-stress-disaster'];
const results=[];
for(const name of names) {
    const file=path.join(sessions,`${name}.session.json`);
    const child=spawnSync(process.execPath,[worker,`--worker-session=${file}`],
        {encoding:'utf8',timeout:45000});
    const mark='__RESULT_ONE__', start=child.stdout?.lastIndexOf(mark)??-1;
    const result=start<0?null:JSON.parse(child.stdout.slice(start+mark.length));
    const passed=child.status===0 && !child.error && result?.passed===true && !result.error;
    results.push({name,passed,processExit:child.status,error:child.error?.message,
        stderr:child.stderr,result});
    console.log(JSON.stringify(results.at(-1)));
}
assert.ok(results.every(r=>r.passed),'every frozen worker must pass; exit zero alone is insufficient');
