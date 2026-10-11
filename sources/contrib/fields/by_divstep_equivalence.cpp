// Equivalence + speed check for contrib/fields/0001 (Bernstein-Yang batched divsteps).
// Compares the patched Native5x64::compute_divstep_matrix / invert_vartime against the original header
// bit-for-bit. Build from aztec-packages/barretenberg/cpp with the patch applied (B = that directory):
//   git show start:barretenberg/cpp/src/barretenberg/ecc/fields/bernstein_yang_inverse.hpp \
//     | sed 's/namespace bb::bernstein_yang/namespace bb::bernstein_yang_orig/; s|#include "./bernstein_yang_inverse_wasm.hpp"||; s/^#pragma once//' > orig_by.hpp
//   echo 'extern "C" void throw_or_abort_impl(const char*) { __builtin_trap(); }' > stub.cpp
//   clang++ -O3 -march=skylake -std=gnu++20 -DMSGPACK_NO_BOOST -I$B/src -I$B/build/_deps/tracy-src/public \
//     -I$B/build/_deps/msgpack-c/src/msgpack-c/include by_divstep_equivalence.cpp stub.cpp -o by_eq && ./by_eq
// Expected: "mismatches 0" and "inv mismatches 0".
#include "barretenberg/numeric/uint256/uint256.hpp"
#include <random>
#include <cstdio>
#include <chrono>
#include "orig_by.hpp"
#include "barretenberg/ecc/fields/bernstein_yang_inverse.hpp"
using namespace bb::bernstein_yang;
int main(){
    std::mt19937_64 rng(7); long bad=0;
    for(long it=0; it<30000000; ++it){
        u64 f=rng()|1, g=rng();
        if(it%5==0) g&=~0ULL<<(rng()%64);
        if(it%11==0) g=0;
        i64 d=(i64)(rng()%400)-200; if(it%3==0) d=(i64)(rng()%9)-4;
        i64 d1=d,d2=d;
        auto a=bb::bernstein_yang_orig::Native5x64::compute_divstep_matrix(d1,f,g);
        auto b=Native5x64::compute_divstep_matrix(d2,f,g);
        if(a.u!=b.u||a.v!=b.v||a.q!=b.q||a.r!=b.r||d1!=d2) bad++;
    }
    printf("mismatches %ld\n",bad);
    // full inversion timing with BN254 Fq modulus
    bb::numeric::uint256_t p("0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47");
    u64 pinv = Native5x64::p_inv_mod_2k_from_montgomery_r_inv(0x87d20782e4866389ULL);
    std::vector<bb::numeric::uint256_t> xs; for(int i=0;i<200000;i++){ bb::numeric::uint256_t x(rng(),rng(),rng(),rng()>>3); xs.push_back(x % p);}
    volatile u64 s=0;
    auto t0=std::chrono::steady_clock::now();
    for(auto&x:xs) s+=bb::bernstein_yang_orig::invert_vartime<bb::bernstein_yang_orig::Native5x64>(x,p,pinv).data[0];
    auto t1=std::chrono::steady_clock::now();
    for(auto&x:xs) s+=invert_vartime<Native5x64>(x,p,pinv).data[0];
    auto t2=std::chrono::steady_clock::now();
    long badinv=0; for(auto&x:xs){ if(bb::bernstein_yang_orig::invert_vartime<bb::bernstein_yang_orig::Native5x64>(x,p,pinv)!=invert_vartime<Native5x64>(x,p,pinv)) badinv++; }
    printf("inv mismatches %ld; old %.0f ns new %.0f ns per inversion\n", badinv, std::chrono::duration<double,std::nano>(t1-t0).count()/xs.size(), std::chrono::duration<double,std::nano>(t2-t1).count()/xs.size());
}
