//! The acceptance path (#1046): a headless host drives a field end to end — bind records, run, read.

use fundamental_core::math::Vec3;
use fundamental_platform::{
    DataHost, FieldHost, FieldPlatform, Phase, PlatformOptions, Record,
};
use std::cell::RefCell;
use std::rc::Rc;

fn host_with(records: Vec<Record>) -> DataHost {
    let mut h = DataHost::new(Vec3::new(800.0, 600.0, 0.0));
    h.bind_all(records);
    h
}

#[test]
fn bind_records_run_then_read_them_back_attributed() {
    // The whole point of the layer: content in, field out, and a result you can trace to a row.
    let host = host_with(vec![
        Record::new(0, "attract", Vec3::new(200.0, 300.0, 0.0)),
        Record::new(1, "attract", Vec3::new(600.0, 300.0, 0.0)),
    ]);
    let mut field = FieldPlatform::new(
        host,
        PlatformOptions {
            particles: 300,
            ..Default::default()
        },
    );
    field.run(120).expect("no phase violations");

    let readings = field.readings();
    assert_eq!(readings.len(), 2, "one reading per bound record");
    assert!(
        readings.iter().any(|r| r.count > 0.0),
        "the field gathered matter at the records: {readings:?}"
    );
    // and each reading names the record it came from
    for (i, r) in readings.iter().enumerate() {
        assert_eq!(r.index, i, "readings stay in host order");
        assert!(field.host.record_at(r.index).is_some(), "and resolve to a record");
    }
}

#[test]
fn a_stronger_record_outranks_a_weaker_one() {
    // The CMS read: rank content by what the field says about it, not by what the caller asserted.
    let mut weak = Record::new(0, "attract", Vec3::new(200.0, 300.0, 0.0));
    weak.strength = 0.2;
    let mut strong = Record::new(1, "attract", Vec3::new(600.0, 300.0, 0.0));
    strong.strength = 3.0;

    let mut field = FieldPlatform::new(
        host_with(vec![weak, strong]),
        PlatformOptions {
            particles: 400,
            ..Default::default()
        },
    );
    field.run(200).unwrap();

    let ranked = field.ranked();
    assert_eq!(ranked[0].index, 1, "the strong record ranks first: {ranked:?}");
    assert!(ranked[0].count > ranked[1].count, "and by a real margin: {ranked:?}");
}

#[test]
fn the_same_records_produce_the_same_ranking_every_run() {
    // A rebuild of unchanged content must not reshuffle. Seeded rng + deterministic particle spread.
    let build = || {
        let mut f = FieldPlatform::new(
            host_with(vec![
                Record::new(0, "attract", Vec3::new(200.0, 300.0, 0.0)),
                Record::new(1, "attract", Vec3::new(600.0, 300.0, 0.0)),
                Record::new(2, "attract", Vec3::new(400.0, 120.0, 0.0)),
            ]),
            PlatformOptions {
                particles: 250,
                ..Default::default()
            },
        );
        f.run(150).unwrap();
        f.ranked()
    };
    assert_eq!(build(), build(), "same content in, same ranking out");
}

#[test]
fn a_host_whose_records_change_is_honoured_without_rewiring() {
    // Bodies are re-read in `discover` every frame, so a host that grows is picked up.
    let mut field = FieldPlatform::new(
        host_with(vec![Record::new(0, "attract", Vec3::new(200.0, 300.0, 0.0))]),
        PlatformOptions {
            particles: 100,
            ..Default::default()
        },
    );
    field.run(10).unwrap();
    assert_eq!(field.readings().len(), 1);

    field
        .host
        .bind(Record::new(1, "attract", Vec3::new(600.0, 300.0, 0.0)));
    field.run(10).unwrap();
    assert_eq!(field.readings().len(), 2, "the new record joined the field");
}

#[test]
fn the_default_host_is_a_fixed_timestep_not_a_wall_clock() {
    // A batch run wants reproducibility. 60 frames of the default dt is one second.
    let h = DataHost::new(Vec3::new(800.0, 600.0, 0.0));
    assert!((h.now(60) - 1.0).abs() < 1e-12, "60 frames = 1s, got {}", h.now(60));
    assert_eq!(h.now(0), 0.0);
}

// ── the scheduler ────────────────────────────────────────────────────────────

#[test]
fn every_frame_walks_the_six_phases_in_order() {
    let seen = Rc::new(RefCell::new(Vec::new()));
    let mut field = FieldPlatform::new(
        host_with(vec![Record::new(0, "attract", Vec3::new(400.0, 300.0, 0.0))]),
        PlatformOptions::default(),
    );
    for phase in Phase::ALL {
        let log = Rc::clone(&seen);
        field.on(phase, move |ctx| log.borrow_mut().push(ctx.phase));
    }
    let report = field.tick().unwrap();
    assert_eq!(report.ran, Phase::ALL.to_vec(), "all six, in order");
    assert_eq!(*seen.borrow(), Phase::ALL.to_vec(), "handlers ran in that order too");
}

#[test]
fn a_geometry_read_in_a_write_phase_is_reported_not_swallowed() {
    // Reading during `write` sees a half-updated world — some handlers have written, others have not
    // — so it is a real bug that returns a plausible number. It must surface, not vanish.
    let mut field = FieldPlatform::new(
        host_with(vec![Record::new(0, "attract", Vec3::new(400.0, 300.0, 0.0))]),
        PlatformOptions::default(),
    );
    field.on(Phase::Write, |ctx| ctx.note_geometry_read("measure"));
    let report = field.tick().unwrap();

    assert_eq!(report.violations.len(), 1, "the illegal read was reported: {report:?}");
    let v = &report.violations[0];
    assert_eq!(v.phase, Phase::Write);
    assert_eq!(v.op, "measure", "and it names WHICH read was illegal");
    assert!(
        v.to_string().contains("discover and read"),
        "the message says where it would have been legal: {v}"
    );
}

#[test]
fn the_same_read_from_a_legal_phase_is_not_a_violation() {
    // The other half: this must not cry wolf, or hosts will learn to ignore it.
    let mut field = FieldPlatform::new(
        host_with(vec![Record::new(0, "attract", Vec3::new(400.0, 300.0, 0.0))]),
        PlatformOptions::default(),
    );
    field.on(Phase::Read, |ctx| ctx.note_geometry_read("measure"));
    field.on(Phase::Discover, |ctx| ctx.note_geometry_read("rect"));
    let report = field.tick().unwrap();
    assert!(report.violations.is_empty(), "legal reads are silent: {report:?}");
}

#[test]
fn strict_mode_turns_a_violation_into_a_hard_error() {
    let mut field = FieldPlatform::new(
        host_with(vec![Record::new(0, "attract", Vec3::new(400.0, 300.0, 0.0))]),
        PlatformOptions {
            strict: true,
            ..Default::default()
        },
    );
    field.on(Phase::Render, |ctx| ctx.note_geometry_read("rect"));
    let err = field.tick().expect_err("strict mode fails the frame");
    assert_eq!(err.phase, Phase::Render);
    assert_eq!(err.op, "rect");
}

#[test]
fn violations_do_not_leak_between_frames() {
    // A report describes ITS frame. A violation that persisted would make every later frame look
    // broken and the real one impossible to find.
    let mut field = FieldPlatform::new(
        host_with(vec![Record::new(0, "attract", Vec3::new(400.0, 300.0, 0.0))]),
        PlatformOptions::default(),
    );
    let token = field.on(Phase::Write, |ctx| ctx.note_geometry_read("measure"));
    assert_eq!(field.tick().unwrap().violations.len(), 1);
    field.scheduler.off(token);
    assert!(
        field.tick().unwrap().violations.is_empty(),
        "the next frame starts clean"
    );
}

#[test]
fn phases_know_where_reading_geometry_is_legal() {
    assert!(Phase::Discover.allows_read());
    assert!(Phase::Read.allows_read());
    for p in [Phase::Compute, Phase::State, Phase::Write, Phase::Render] {
        assert!(!p.allows_read(), "{p} must not permit a geometry read");
    }
}

#[test]
fn a_handler_can_be_removed() {
    let hits = Rc::new(RefCell::new(0));
    let mut field = FieldPlatform::new(
        host_with(vec![Record::new(0, "attract", Vec3::new(400.0, 300.0, 0.0))]),
        PlatformOptions::default(),
    );
    let h = Rc::clone(&hits);
    let token = field.on(Phase::Compute, move |_| *h.borrow_mut() += 1);
    field.tick().unwrap();
    assert_eq!(*hits.borrow(), 1);
    assert!(field.scheduler.off(token), "the handler was removed");
    field.tick().unwrap();
    assert_eq!(*hits.borrow(), 1, "and no longer runs");
}
