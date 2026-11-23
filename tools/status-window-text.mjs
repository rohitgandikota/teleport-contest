// Refresh and read the actual tty status for source-state assertions.
// Condition evaluation, labels and formatting stay in the game windowport.
import {game} from '../js/gstate.js';
import {bot_via_windowport} from '../js/botl.js';
import {tty_get_nhwindow} from '../js/tty/wintty.js';

export function status_window_text() {
    bot_via_windowport();
    const window=tty_get_nhwindow(game.WIN_STATUS);
    return game.nhDisplay.grid.slice(window.offy,window.offy+window.rows)
        .map(row=>row.map(cell=>cell.ch).join('')).join('\n');
}
