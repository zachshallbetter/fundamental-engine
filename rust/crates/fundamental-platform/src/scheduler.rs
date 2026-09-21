//! The six-phase frame loop — `discover → read → compute → state → write → render`.
//!
//! Mirrors the Swift `FrameScheduler` and the Kotlin one. The phase ORDER is a hard invariant, and
//! the reason it exists is not tidiness: without one shared ordered loop, two subsystems that both
//! read geometry and both write it will interleave differently from frame to frame, and the field
//! develops a stutter that reproduces only sometimes. Ordering the phases makes "who runs first"
//! a property of the system rather than of registration order.
//!
//! **Reading geometry is legal only in `discover` and `read`.** A read during `write` sees a
//! half-updated world — some handlers have written, others have not — so it is a real bug that
//! reports a plausible number. [`FrameScheduler::note`] records such a violation rather than
//! swallowing it, and strict mode turns it into a hard error.

use std::cell::RefCell;
use std::fmt;

/// One phase of the frame. `Ord` follows the run order, so phases sort into the sequence they run in.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Phase {
    Discover,
    Read,
    Compute,
    State,
    Write,
    Render,
}

impl Phase {
    /// Every phase, in run order.
    pub const ALL: [Phase; 6] = [
        Phase::Discover,
        Phase::Read,
        Phase::Compute,
        Phase::State,
        Phase::Write,
        Phase::Render,
    ];

    /// Whether reading world geometry is legal in this phase.
    pub fn allows_read(self) -> bool {
        matches!(self, Phase::Discover | Phase::Read)
    }
}

impl fmt::Display for Phase {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Phase::Discover => "discover",
            Phase::Read => "read",
            Phase::Compute => "compute",
            Phase::State => "state",
            Phase::Write => "write",
            Phase::Render => "render",
        };
        f.write_str(s)
    }
}

/// What a handler is told about the frame it is running in — and how it reports an illegal read.
///
/// Carries a borrowed violation sink rather than being `Copy`, because a handler has to be able to
/// SAY that it just read geometry it should not have. A context that could only be read would make
/// [`note_geometry_read`](FrameContext::note_geometry_read) callable from everywhere except the one
/// place violations actually happen.
pub struct FrameContext<'a> {
    pub now: f64,
    pub frame: u64,
    pub phase: Phase,
    sink: &'a RefCell<Vec<PhaseViolation>>,
}

impl FrameContext<'_> {
    /// Record that `op` read world geometry. A no-op in a read-legal phase; a violation otherwise.
    ///
    /// Takes the operation's name rather than inferring it, because the useful half of the report is
    /// *which* read was illegal — "measure" and "rect" fail for different reasons and are fixed in
    /// different places.
    pub fn note_geometry_read(&self, op: &str) {
        if self.phase.allows_read() {
            return;
        }
        self.sink.borrow_mut().push(PhaseViolation {
            phase: self.phase,
            op: op.to_string(),
            frame: self.frame,
        });
    }
}

/// An operation that ran in a phase that does not permit it.
#[derive(Clone, Debug, PartialEq)]
pub struct PhaseViolation {
    pub phase: Phase,
    pub op: String,
    pub frame: u64,
}

impl fmt::Display for PhaseViolation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "\"{}\" ran in the {} phase (frame {}); geometry reads are legal only in discover and read",
            self.op, self.phase, self.frame
        )
    }
}

/// What one frame did.
#[derive(Clone, Debug)]
pub struct FrameReport {
    pub frame: u64,
    pub now: f64,
    pub ran: Vec<Phase>,
    pub violations: Vec<PhaseViolation>,
}

type Handler = Box<dyn for<'a> FnMut(&FrameContext<'a>)>;

/// One shared loop with explicit, ordered phases, so registries never fight each other.
pub struct FrameScheduler {
    handlers: Vec<(Phase, u64, Handler)>,
    next_token: u64,
    frame: u64,
    /// When set, a phase violation is returned as an error from [`FrameScheduler::tick`] instead of
    /// being collected. Off by default: a host should be able to SEE its violations before it is
    /// forced to fix them, and a scheduler that panics on the first one is a scheduler nobody enables.
    pub strict: bool,
    violations: RefCell<Vec<PhaseViolation>>,
    current: Option<Phase>,
}

impl Default for FrameScheduler {
    fn default() -> Self {
        FrameScheduler::new()
    }
}

impl FrameScheduler {
    pub fn new() -> Self {
        FrameScheduler {
            handlers: Vec::new(),
            next_token: 1,
            frame: 0,
            strict: false,
            violations: RefCell::new(Vec::new()),
            current: None,
        }
    }

    /// Register a handler for a phase. Returns a token that [`off`](Self::off) removes.
    pub fn on(
        &mut self,
        phase: Phase,
        handler: impl for<'a> FnMut(&FrameContext<'a>) + 'static,
    ) -> u64 {
        let token = self.next_token;
        self.next_token += 1;
        self.handlers.push((phase, token, Box::new(handler)));
        token
    }

    /// Remove a handler. Returns whether one was removed.
    pub fn off(&mut self, token: u64) -> bool {
        if let Some(i) = self.handlers.iter().position(|(_, t, _)| *t == token) {
            drop(self.handlers.remove(i)); // the boxed closure is #[must_use]; dropping it IS the point
            true
        } else {
            false
        }
    }

    /// The phase currently running, if a frame is in flight.
    pub fn current_phase(&self) -> Option<Phase> {
        self.current
    }

    pub fn frame(&self) -> u64 {
        self.frame
    }

    /// Run one frame: every phase in order, every handler within a phase in registration order.
    pub fn tick(&mut self, now: f64) -> Result<FrameReport, PhaseViolation> {
        self.frame += 1;
        self.violations.borrow_mut().clear();
        let mut ran = Vec::with_capacity(Phase::ALL.len());

        for phase in Phase::ALL {
            self.current = Some(phase);
            ran.push(phase);
            // Indices, not an iterator: a handler may call back into the scheduler (to note a read),
            // which needs &mut self. Taking each boxed handler out for the call keeps that legal.
            for i in 0..self.handlers.len() {
                if self.handlers[i].0 != phase {
                    continue;
                }
                let ctx = FrameContext {
                    now,
                    frame: self.frame,
                    phase,
                    sink: &self.violations,
                };
                let mut h = std::mem::replace(&mut self.handlers[i].2, Box::new(|_| {}));
                h(&ctx);
                self.handlers[i].2 = h;
            }
        }
        self.current = None;

        if self.strict {
            if let Some(v) = self.violations.borrow().first() {
                return Err(v.clone());
            }
        }
        Ok(FrameReport {
            frame: self.frame,
            now,
            ran,
            violations: std::mem::take(&mut *self.violations.borrow_mut()),
        })
    }
}
