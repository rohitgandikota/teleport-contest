// Test-only access to C's static disturb. No runtime body or return is replaced.
const target = new URL('../js/monmove.js', import.meta.url).href;
export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    if (url !== target) return result;
    const source = Buffer.from(result.source).toString('utf8');
    if (source.includes('\nexport { disturb };\n')) return result;
    if (!source.includes('async function disturb(mtmp) {'))
        throw Error('disturb test access: source function missing');
    return {...result, source:source+'\nexport { disturb };\n'};
}
