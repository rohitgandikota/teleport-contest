/* Standalone profile canary. No NetHack source or runtime is involved. */
#include <stdio.h>
#include <unistd.h>

static volatile int result;

__attribute__((noinline)) int decision(int value)
{
    if (value > 0)
        return 11;
    return 17;
}

int main(int argc, char **argv)
{
    (void) argv;
    result = decision(1);
    result = decision(0);
    puts("ready");
    fflush(stdout);
    if (argc > 1)
        for (;;)
            pause();
    return 0;
}
