// Test-only private access, observation, and an explicit completion pause.
export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    let source = result.source && Buffer.from(result.source).toString('utf8');
    if (url === new URL('../js/artifact.js', import.meta.url).href) {
        if (source.includes('export { invoke_property };')) return result;
        const entry = 'async function invoke_property(obj, prop) {';
        if (!source.includes(entry)) throw Error('invoke_property entry changed');
        source = source.replace(entry, entry + `
    const paused = globalThis.__invokedLossPause?.(obj, prop);
    if (paused) return paused;
`);
        source += '\nexport { invoke_property };\n';
    } else if (url === new URL('../js/nhlua.js', import.meta.url).href) {
        if (source.includes('export { nhl_gamestate_save,')) return result;
        source += '\nexport { nhl_gamestate_save, nhl_gamestate_restore };\n';
    } else if (url === new URL('../js/display.js', import.meta.url).href) {
        if (source.includes('__invokedLossNewsym')) return result;
        const entry = 'export function newsym(x, y) {';
        if (!source.includes(entry)) throw Error('newsym entry changed');
        source = source.replace(entry, entry + '\n    globalThis.__invokedLossNewsym?.(x, y);\n');
    } else return result;
    return { ...result, source };
}
