// Test-only private exports and a read-only look_here observation point.
// Always delegate to the current module source. No replacement runtime modules.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const targets = new Map(['invent', 'bones', 'muse', 'monmove'].map(name => [
    pathToFileURL(realpathSync(new URL(`../js/${name}.js`, import.meta.url))).href,
    name
]));
const exports = {
    bones: 'strip_objs as audit_strip_objs',
    muse: 'fhito_loc as audit_fhito_loc',
    monmove: 'objects_at as audit_objects_at'
};

export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    const name = targets.get(url);
    if (!name) {
        return result;
    }

    let source = result.source.toString();
    if (name === 'invent') {
        const anchor = '    if (!pile.length || is_lava';
        if (source.split(anchor).length !== 2) {
            throw Error('look_here observation anchor changed');
        }
        source = source.replace(anchor, '    globalThis.__nexthereOrderObserve?.(pile);\n' + anchor);
    } else {
        source += `\nexport {${exports[name]}};\n`;
    }
    return { ...result, source };
}
