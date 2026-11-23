// Test-only private access and pause point. No production exports or effects.
export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    if (url === new URL('../js/artifact.js', import.meta.url).href) {
        const source = Buffer.from(result.source).toString('utf8');
        if (source.includes('__artifactHalresAuditPause')) return result;
        const at = 'export function set_artifact_intrinsic(obj, on, wp_mask) {';
        if (!source.includes(at)) throw Error('artifact setter entry changed');
        return { ...result, source: source.replace(at, at + `
    const pause = globalThis.__artifactHalresAuditPause?.(obj, on, wp_mask);
    if (pause) return pause;
`) };
    }
    if (url === new URL('../js/nhlua.js', import.meta.url).href) {
        const source = Buffer.from(result.source).toString('utf8');
        if (source.includes('export { nhl_gamestate_save,')) return result;
        return { ...result, source: source + '\nexport { nhl_gamestate_save, nhl_gamestate_restore };\n' };
    }
    return result;
}
