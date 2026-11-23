// Test-only access to C's private landing selection helper.
export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    if (url === new URL('../js/steed.js', import.meta.url).href)
        return {...result, source: result.source.toString()
            + '\nexport {landing_spot as audit_landing_spot};\n'};
    return result;
}
