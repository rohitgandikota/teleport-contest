const DEC_GRAPHICS = {
    j: '┘', k: '┐', l: '┌', m: '└', n: '┼',
    q: '─', t: '├', u: '┤', v: '┴', w: '┬',
    x: '│', '~': '·', a: '▒', f: '°', g: '±',
    y: '≤', z: '≥', '{': 'π', '|': '≠', '}': '£',
    '.': '▼', ',': '←', '+': '→', '-': '↑',
    '0': '■', '`': '◆',
};

export function decodeScreen(screen) {
    const rows = [];
    for (const line of (screen || '').split('\n')) {
        let out = '';
        let i = 0;
        let dec = false;
        while (i < line.length) {
            const ch = line[i];
            if (ch === '\x1b') {
                if (line[i + 1] === '[') {
                    let j = i + 2;
                    while (j < line.length && !/[A-Za-z]/.test(line[j]))
                        j++;
                    const fin = line[j];
                    const params = line.slice(i + 2, j);
                    if (fin === 'C')
                        out += ' '.repeat(parseInt(params, 10) || 1);
                    i = j + 1;
                    continue;
                }
                i++;
                continue;
            }
            if (ch === '\x0e') {
                dec = true;
                i++;
                continue;
            }
            if (ch === '\x0f') {
                dec = false;
                i++;
                continue;
            }
            out += dec ? (DEC_GRAPHICS[ch] || ch) : ch;
            i++;
        }
        rows.push(out);
    }
    while (rows.length < 24)
        rows.push('');
    return rows.slice(0, 24).map((row) =>
        (row + ' '.repeat(80)).slice(0, 80));
}
