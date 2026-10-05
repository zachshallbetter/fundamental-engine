//! Clusters — where matter actually pooled, found in the settled particle field (#1044).
//!
//! Single-link connected components over particle proximity: two particles join the same cluster when
//! they are within `radius` of each other, transitively. This reads the field's OWN verdict about what
//! belongs together, rather than re-deriving groups from the inputs that produced it — which is the
//! whole reason to run a field instead of clustering the records directly.
//!
//! Union-find with path compression and union by size, so the pass is near-linear and does not care
//! what order the pool happens to be in — a pool that reordered between runs must still cluster the
//! same way, or a rebuild reshuffles the site.

use crate::engine::{Body, FieldStore};
use crate::math::Vec3;

/// A pool of matter that settled together.
#[derive(Clone, Debug, PartialEq)]
pub struct Cluster {
    /// Particle ids in this cluster, ascending — sorted so the membership is comparable run to run.
    pub members: Vec<u64>,
    /// Centre of mass.
    pub centroid: Vec3,
}

impl Cluster {
    pub fn size(&self) -> usize {
        self.members.len()
    }
}

struct Dsu {
    parent: Vec<usize>,
    size: Vec<usize>,
}

impl Dsu {
    fn new(n: usize) -> Self {
        Dsu {
            parent: (0..n).collect(),
            size: vec![1; n],
        }
    }
    fn find(&mut self, mut x: usize) -> usize {
        while self.parent[x] != x {
            self.parent[x] = self.parent[self.parent[x]]; // path halving
            x = self.parent[x];
        }
        x
    }
    fn union(&mut self, a: usize, b: usize) {
        let (mut ra, mut rb) = (self.find(a), self.find(b));
        if ra == rb {
            return;
        }
        if self.size[ra] < self.size[rb] {
            std::mem::swap(&mut ra, &mut rb);
        }
        self.parent[rb] = ra;
        self.size[ra] += self.size[rb];
    }
}

/// Connected components of the settled pool at `radius`, largest first.
///
/// `min_size` drops specks: a CMS wants the basins, not every pair of particles that happened to
/// drift near each other. Ties in size keep the lowest member id first, so the ordering is stable.
pub fn clusters(store: &FieldStore, radius: f64, min_size: usize) -> Vec<Cluster> {
    let ps = &store.particles;
    let n = ps.len();
    if n == 0 || !(radius > 0.0) {
        return Vec::new();
    }
    // Bucket into a uniform grid at `radius`, so each particle only tests its own cell and the
    // neighbours it could possibly reach. The naive pass is O(n²) and a settled CMS field is not small.
    let cell = radius;
    let key = |p: &crate::engine::Particle| ((p.position.x / cell).floor() as i64, (p.position.y / cell).floor() as i64);
    let mut bins: std::collections::HashMap<(i64, i64), Vec<usize>> = std::collections::HashMap::new();
    for (i, p) in ps.iter().enumerate() {
        bins.entry(key(p)).or_default().push(i);
    }
    let r2 = radius * radius;
    let mut dsu = Dsu::new(n);
    for (i, p) in ps.iter().enumerate() {
        let (cx, cy) = key(p);
        for dx in -1..=1 {
            for dy in -1..=1 {
                let Some(others) = bins.get(&(cx + dx, cy + dy)) else {
                    continue;
                };
                for &j in others {
                    if j <= i {
                        continue; // each pair once
                    }
                    let q = &ps[j];
                    let (ax, ay, az) = (
                        p.position.x - q.position.x,
                        p.position.y - q.position.y,
                        p.position.z - q.position.z,
                    );
                    if ax * ax + ay * ay + az * az <= r2 {
                        dsu.union(i, j);
                    }
                }
            }
        }
    }
    let mut groups: std::collections::HashMap<usize, Vec<usize>> = std::collections::HashMap::new();
    for i in 0..n {
        let r = dsu.find(i);
        groups.entry(r).or_default().push(i);
    }
    let mut out: Vec<Cluster> = groups
        .into_values()
        .filter(|g| g.len() >= min_size.max(1))
        .map(|g| {
            let (mut sx, mut sy, mut sz) = (0.0, 0.0, 0.0);
            for &i in &g {
                sx += ps[i].position.x;
                sy += ps[i].position.y;
                sz += ps[i].position.z;
            }
            let k = g.len() as f64;
            let mut members: Vec<u64> = g.iter().map(|&i| ps[i].id).collect();
            members.sort_unstable();
            Cluster {
                members,
                centroid: Vec3::new(sx / k, sy / k, sz / k),
            }
        })
        .collect();
    out.sort_by(|a, b| {
        b.size()
            .cmp(&a.size())
            .then(a.members.first().cmp(&b.members.first()))
    });
    out
}

/// The body nearest each cluster's centroid — how a pool of matter becomes "these records belong
/// together". `None` when there are no bodies to attribute to.
pub fn attribute(cluster: &Cluster, bodies: &[Body]) -> Option<usize> {
    bodies
        .iter()
        .enumerate()
        .map(|(i, b)| {
            let d = (b.center.x - cluster.centroid.x).powi(2)
                + (b.center.y - cluster.centroid.y).powi(2)
                + (b.center.z - cluster.centroid.z).powi(2);
            (i, d)
        })
        .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, _)| i)
}
