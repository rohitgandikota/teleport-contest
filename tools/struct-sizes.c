/* struct-sizes.c: print the sizeof() values js/const.js SIZEOF_* keep for
 * #stats (wizcmds.c wiz_show_stats()). Build against the configured
 * recorder tree, e.g.
 *   cc -I nethack-c/recorder/include -I nethack-c/recorder/lib/lua-5.4.8/src \
 *      -DNOTPARMDECL -DNO_TIMED_DELAY -DDLB -DSYSCF -DSECURE -DNOMAIL \
 *      -o /tmp/struct-sizes tools/struct-sizes.c && /tmp/struct-sizes
 */
#include "hack.h"
struct wseg { struct wseg *nseg; coordxy wx, wy; };
int main(void) {
    printf("wseg %zu\n", sizeof (struct wseg));
    printf("obj %zu\n", sizeof (struct obj));
    printf("oextra %zu\n", sizeof (struct oextra));
    printf("monst %zu\n", sizeof (struct monst));
    printf("mextra %zu\n", sizeof (struct mextra));
    printf("egd %zu\n", sizeof (struct egd));
    printf("epri %zu\n", sizeof (struct epri));
    printf("eshk %zu\n", sizeof (struct eshk));
    printf("emin %zu\n", sizeof (struct emin));
    printf("edog %zu\n", sizeof (struct edog));
    printf("ebones %zu\n", sizeof (struct ebones));
    printf("mapseen %zu\n", sizeof (mapseen));
    printf("cemetery %zu\n", sizeof (struct cemetery));
    printf("trap %zu\n", sizeof (struct trap));
    printf("engr %zu\n", sizeof (struct engr));
    printf("light_source %zu\n", sizeof (light_source));
    printf("timer_element %zu\n", sizeof (timer_element));
    printf("damage %zu\n", sizeof (struct damage));
    printf("NhRegion %zu\n", sizeof (NhRegion));
    printf("NhRect %zu\n", sizeof (NhRect));
    printf("kinfo %zu\n", sizeof (struct kinfo));

    printf("region_monsters_elem %zu\n", sizeof (unsigned));
    return 0;
}
