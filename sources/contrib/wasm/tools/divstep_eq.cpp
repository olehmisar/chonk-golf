#include <cstdint>
#include <cstdio>
#include <random>
using u64 = uint64_t; using i64 = int64_t;
struct M { i64 u, v, q, r; };
constexpr int BATCH = 58;
M old_fn(i64& delta, u64 f_lo, u64 g_lo) {
    i64 u = 1, v = 0, q = 0, r = 1;
    for (int i = 0; i < BATCH; ++i) {
        if (g_lo & 1) {
            if (delta > 0) {
                u64 nf = g_lo, ng = (g_lo - f_lo) >> 1;
                i64 nu = q << 1, nv = r << 1, nq = q - u, nr = r - v;
                f_lo = nf; g_lo = ng; u = nu; v = nv; q = nq; r = nr; delta = 1 - delta;
            } else { g_lo = (g_lo + f_lo) >> 1; q = q + u; r = r + v; u <<= 1; v <<= 1; delta = delta + 1; }
        } else { g_lo >>= 1; u <<= 1; v <<= 1; delta = delta + 1; }
    }
    return { u, v, q, r };
}
M new_fn(i64& delta, u64 f, u64 g) {
    u64 u = 1, v = 0, q = 0, r = 1;
    int remaining = BATCH;
    while (true) {
        const int zeros = __builtin_ctzll(g | (~0ULL << remaining));
        g >>= zeros; u <<= zeros; v <<= zeros; delta += zeros; remaining -= zeros;
        if (remaining == 0) break;
        u64 w;
        int limit;
        if (delta > 0) {
            const u64 tf = f; f = g; g = 0 - tf;
            const u64 tu = u; u = q; q = 0 - tu;
            const u64 tv = v; v = r; r = 0 - tv;
            delta = -delta;
            limit = (1 - delta) > remaining ? remaining : (int)(1 - delta);
            const u64 m = (~0ULL >> (64 - limit)) & 63U;
            w = (f * g * (f * f - 2)) & m;
        } else {
            limit = (1 - delta) > remaining ? remaining : (int)(1 - delta);
            const u64 m = (~0ULL >> (64 - limit)) & 15U;
            w = f + (((f + 1) & 4) << 1);
            w = ((0 - w) * g) & m;
        }
        g += f * w; q += u * w; r += v * w;
    }
    return { (i64)u, (i64)v, (i64)q, (i64)r };
}
int main() { // old_fn = the per-step loop being replaced, new_fn = the batched version
    std::mt19937_64 rng(1);
    long bad = 0, n = 0;
    for (long it = 0; it < 50000000; ++it) {
        u64 f = rng() | 1, g = rng();
        if ((it & 7) == 0) g &= rng(); // sparser
        if ((it & 15) == 1) g = rng() & 0xff;
        i64 d0;
        switch (it % 4) { case 0: d0 = 1; break; case 1: d0 = (i64)(rng() % 41) - 20; break; case 2: d0 = (i64)(rng() % 401) - 200; break; default: d0 = (i64)(rng() % 3000) - 1500; }
        i64 da = d0, db = d0;
        M a = old_fn(da, f, g), b = new_fn(db, f, g);
        ++n;
        if (a.u != b.u || a.v != b.v || a.q != b.q || a.r != b.r || da != db) { if (bad++ < 5) printf("MISMATCH f=%llx g=%llx d=%lld\n", (unsigned long long)f, (unsigned long long)g, (long long)d0); }
    }
    printf("checked %ld bad %ld\n", n, bad);
}
