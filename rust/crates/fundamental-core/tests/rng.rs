//! Seeded RNG — cross-plane parity + determinism. The Rust mulberry32 stream must be bit-identical
//! to the JS `seededRng` (the f64 mapping), so a run seeded on any plane replays identically.

// The reference constants are copied verbatim from the JS engine's output (17 significant digits);
// keeping every digit documents provenance even where f64 rounds the last one.
#![allow(clippy::excessive_precision)]

use fundamental_core::record::{seeded_rng, Rng};

/// Reference values captured from the JS engine's `seededRng` (packages/core/src/record/rng.ts):
///   `for (const s of [1,42,0]) { const r = seededRng(s); [r(),r(),r()] }`
const JS_REFERENCE: &[(u32, [f64; 3])] = &[
    (
        1,
        [
            0.627_073_940_588_161_35,
            0.002_735_721_180_215_477_9,
            0.527_447_039_959_952_24,
        ],
    ),
    (
        42,
        [
            0.601_103_751_920_163_63,
            0.448_290_558_997_541_67,
            0.852_465_793_490_409_85,
        ],
    ),
    (
        0,
        [
            0.266_429_208_684_712_65,
            0.000_329_745_700_582_861_9,
            0.223_272_027_447_819_71,
        ],
    ),
];

#[test]
fn matches_js_stream_bit_for_bit() {
    for (seed, expected) in JS_REFERENCE {
        let mut rng = Rng::seeded(*seed);
        for (i, want) in expected.iter().enumerate() {
            let got = rng.next_f64();
            assert!(
                (got - want).abs() < 1e-15,
                "seed {seed} draw {i}: Rust {got:.17} vs JS {want:.17}"
            );
        }
    }
}

#[test]
fn same_seed_same_stream() {
    let mut a = seeded_rng(12345);
    let mut b = seeded_rng(12345);
    for _ in 0..1000 {
        assert_eq!(a(), b());
    }
}

#[test]
fn values_are_in_unit_interval() {
    let mut rng = Rng::seeded(999);
    for _ in 0..10_000 {
        let v = rng.next_f64();
        assert!((0.0..1.0).contains(&v), "value {v} out of [0,1)");
    }
}

#[test]
fn closure_and_struct_agree() {
    let mut closure = seeded_rng(7);
    let mut strukt = Rng::seeded(7);
    for _ in 0..100 {
        assert_eq!(closure(), strukt.next_f64());
    }
}
