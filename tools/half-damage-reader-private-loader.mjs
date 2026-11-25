// Test-only private exports. No runtime bodies, imports or call sites change.
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../js/', import.meta.url));
const owners = {
    'allmain.js': ['regen_hp'],
    'monmove.js': ['mind_blast'],
    'potion.js': ['peffect_acid', 'peffect_levitation'],
    'trap.js': ['trapeffect_pit', 'trapeffect_rocktrap'],
};
registerHooks({load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (!url.startsWith('file:')) return result;
    const path = fileURLToPath(url);
    if (!path.startsWith(root)) return result;
    const extra = owners[path.slice(path.lastIndexOf('/') + 1)];
    return extra ? {...result, source: result.source.toString()
        + `\nexport {${extra.join(',')}};\n`} : result;
}});
