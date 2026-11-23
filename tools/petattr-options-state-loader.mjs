// Test-only access to the private option parser and its state coordinator.
export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    if (url !== new URL('../js/options.js', import.meta.url).href)
        return result;
    return {...result, source: result.source.toString() + `
export {boolopt_side_effects as audit_bool_effects,
    set_bool_optval as audit_set_bool, get_option_value as audit_option_value,
    reset_needed_visuals as audit_reset_visuals};
export function audit_parse(text, initial=true, result={opts:{},errors:[]}) {
    config_error_data = result;
    try { return {accepted:parseoptions(text,initial,false,result),result}; }
    finally { config_error_data = null; }
}
`};
}
