// Test-only access to status helpers. No production exports or source replacements.
import {realpathSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const target=pathToFileURL(realpathSync(new URL('../js/tty/wintty.js',import.meta.url))).href;
export async function load(url,context,nextLoad) {
    const result=await nextLoad(url,context);
    if(url!==target)return result;
    return {...result,source:result.source.toString()+`
export {tty_curs_status as audit_status_curs,
    tty_putstatusfield as audit_putstatusfield,
    status_cl_end as audit_status_cl_end};
`};
}
