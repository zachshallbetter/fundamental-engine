//! # fundamental-platform
//!
//! The host / binding layer for the Fundamental field engine's Rust plane: the environment seam, the
//! six-phase frame scheduler, and data-record binding.
//!
//! ```text
//! fundamental-core  ←  fundamental-platform  ←  {surfaces}
//! ```
//!
//! The arrow points one way. [`fundamental_core`] is the physics and knows nothing about where it
//! runs; this crate is where an environment plugs in, and it is its ONLY dependency. A test
//! (`tests/dep_direction.rs`) keeps that honest.
//!
//! **Headless-first.** The JS plane's host binds DOM elements because a web page is what it has. A
//! server, a CMS or a batch analysis has *data records*, so [`DataHost`] binds those. Nothing here
//! assumes a screen exists.
//!
//! ```
//! use fundamental_platform::{DataHost, FieldPlatform, PlatformOptions, Record};
//! use fundamental_core::math::Vec3;
//!
//! let mut host = DataHost::new(Vec3::new(800.0, 600.0, 0.0));
//! host.bind(Record::new(0, "attract", Vec3::new(400.0, 300.0, 0.0)));
//!
//! let mut field = FieldPlatform::new(host, PlatformOptions { particles: 200, ..Default::default() });
//! field.run(120).unwrap();
//!
//! // read the result back, attributed to the record it came from
//! let top = field.ranked();
//! assert_eq!(top[0].index, 0);
//! ```

pub mod host;
pub mod platform;
pub mod scheduler;

pub use host::{DataHost, FieldHost, Record};
pub use platform::{FieldPlatform, PlatformOptions, Reading};
pub use scheduler::{FrameContext, FrameReport, FrameScheduler, Phase, PhaseViolation};
