// Reuse the maintained C gate, then pin this packet's unchanged source inputs.
import './corpse-impact-preflight.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const evidence='gen-sessions/evidence/ismnum-upper-bound/';
for(const [file,digest]of [
    ['boundary-lock.json','1eef0b7967f9852697497ce88eb2b01208a022e3e5da22b2423822f2cfd14587'],
    ['input-lock.json','4012f7b6109ffac1ed7401f3560a84147742ad5d0e8fa742ef1909113f2328b4'],
    ['verification.json','c265d2d8b301981afdd28caa4d5698038e284c82a3734deac935b1dda724adf5'],
]){
    const bytes=readFileSync(new URL(evidence+file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,file);
}
