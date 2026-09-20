//! The environment seam — what a host has to provide, and the headless one that ships.
//!
//! `fundamental-core` is the physics and knows nothing about where it runs. [`FieldHost`] is the
//! whole surface an environment has to implement, and it is deliberately tiny: a volume, a clock,
//! and a set of bodies. Everything else a host might want — rendering, input, layout — belongs to a
//! surface crate above this one, not here.
//!
//! **Headless-first is the point.** The JS plane's host binds DOM elements because a web page is what
//! it has. A server, a CMS or a batch analysis has *data records* — rows, documents, content items —
//! so [`DataHost`] binds those. Nothing in this crate assumes a screen exists.

use fundamental_core::engine::Body;
use fundamental_core::math::Vec3;

/// The environment a field runs in.
pub trait FieldHost {
    /// The field's extent. `z = 0` is a flat field; a positive z makes it volumetric.
    fn volume(&self) -> Vec3;

    /// The bodies for this frame, in a stable order.
    ///
    /// Called once per frame in the `discover` phase. A host that binds mutable records re-derives
    /// them here; a static one can return the same set every time.
    fn bodies(&self) -> Vec<Body>;

    /// Seconds since the field started. Defaults to a fixed step, which is the right default for a
    /// headless host: a batch run wants reproducibility, not wall-clock.
    fn now(&self, frame: u64) -> f64 {
        frame as f64 / 60.0
    }
}

/// One bound record — a row, a document, a content item — and the field body it becomes.
///
/// The `data` is an opaque `usize` key rather than a generic payload on purpose: this crate's job is
/// to bind, not to own the host's model. The host keeps its records in whatever shape it already has
/// and hands over an index, so binding costs no clone and imposes no trait bounds on the host's type.
#[derive(Clone, Debug)]
pub struct Record {
    /// The host's own key for this record — an index, an id, whatever it uses to look the row back up.
    pub key: usize,
    /// The forces this record exerts on the field.
    pub tokens: Vec<String>,
    /// Where it sits.
    pub center: Vec3,
    /// How hard it pulls.
    pub strength: f64,
    /// How far it reaches. `0` is global.
    pub range: f64,
    /// Its mass, for the inverse-square forces.
    pub source_mass: f64,
    /// Whether the engine measures gathered density at this record.
    ///
    /// Defaults to **true**, unlike `Body::default()`. A DOM body is opt-in because measuring costs a
    /// layout read the page may not want; a data record exists in order to be READ — a CMS binds
    /// content precisely to find out what the field says about it — so the default flips here.
    pub feedback: bool,
}

impl Record {
    /// A record with the engine's own defaults, carrying one force.
    pub fn new(key: usize, token: &str, center: Vec3) -> Self {
        let d = Body::default();
        Record {
            key,
            tokens: vec![token.to_string()],
            center,
            strength: d.strength,
            range: d.range,
            source_mass: d.source_mass,
            feedback: true,
        }
    }

    /// The field body this record becomes.
    pub fn to_body(&self) -> Body {
        Body {
            tokens: self.tokens.clone(),
            center: self.center,
            strength: self.strength,
            range: self.range,
            source_mass: self.source_mass,
            feedback: self.feedback,
            ..Body::default()
        }
    }
}

/// The default headless host: a set of data records and a volume.
///
/// This is the shape a CMS rebuild actually has — content in, field out, scores back — and it is what
/// makes the Rust plane's "a body is a data record rather than a widget" claim concrete rather than
/// aspirational.
pub struct DataHost {
    pub volume: Vec3,
    pub records: Vec<Record>,
    /// Fixed timestep in seconds. A headless run wants reproducibility, not wall-clock.
    pub dt: f64,
}

impl DataHost {
    pub fn new(volume: Vec3) -> Self {
        DataHost {
            volume,
            records: Vec::new(),
            dt: 1.0 / 60.0,
        }
    }

    /// Bind a record. Chainable.
    pub fn bind(&mut self, record: Record) -> &mut Self {
        self.records.push(record);
        self
    }

    /// Bind many at once.
    pub fn bind_all(&mut self, records: impl IntoIterator<Item = Record>) -> &mut Self {
        self.records.extend(records);
        self
    }

    /// The record behind a body index, so a reading can be attributed back to the host's own row.
    /// This is the half that makes a result usable: a score is worth nothing if you cannot say which
    /// document it belongs to.
    pub fn record_at(&self, index: usize) -> Option<&Record> {
        self.records.get(index)
    }
}

impl FieldHost for DataHost {
    fn volume(&self) -> Vec3 {
        self.volume
    }

    fn bodies(&self) -> Vec<Body> {
        self.records.iter().map(Record::to_body).collect()
    }

    fn now(&self, frame: u64) -> f64 {
        frame as f64 * self.dt
    }
}
