// Test-only access to C-named private functions. Chain through nextLoad so
// source-replacement loaders can supply a baseline without changing the gates.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const extraExports = new Map([
    [pathToFileURL(realpathSync(new URL('../js/allmain.js', import.meta.url))).href,
        '\nexport { regen_pw };\n'],
    [pathToFileURL(realpathSync(new URL('../js/wizcmds.js', import.meta.url))).href,
        '\nexport { wiz_intrinsic_timeout };\n'],
]);

export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    const extra = extraExports.get(url);
    return extra ? { ...result, source: result.source.toString() + extra } : result;
}
