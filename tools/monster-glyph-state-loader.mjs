// Test-only access to detect.c's private glyph producers.
export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    if (url === new URL('../js/detect.js', import.meta.url).href)
        return {...result, source: result.source.toString()
            + '\nexport {mon_cell as audit_mon_cell, map_monst as audit_map_monst};\n'};
    return result;
}
