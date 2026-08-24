"""Blockout mesh generator for the yellow fur bull character.

Builds quad-dominant base meshes (good for sculpting/subdivision) and writes
one OBJ per body part plus a combined file.

Axes: +X = character's right, +Y = up, +Z = forward (the direction it faces).
"""
import numpy as np
import os

OUT = "/home/user/Claude/nomad-sculpt-yellow-bull-kit/models"
os.makedirs(OUT, exist_ok=True)


# ---------------------------------------------------------------------------
# mesh container
# ---------------------------------------------------------------------------
class Mesh:
    def __init__(self, verts=None, faces=None):
        self.verts = list(verts) if verts is not None else []
        self.faces = list(faces) if faces is not None else []  # lists of 0-based idx

    def add(self, other):
        off = len(self.verts)
        self.verts.extend(other.verts)
        self.faces.extend([[i + off for i in f] for f in other.faces])
        return self

    def transform(self, scale=(1, 1, 1), translate=(0, 0, 0)):
        s = np.asarray(scale, float)
        t = np.asarray(translate, float)
        self.verts = [tuple(np.asarray(v, float) * s + t) for v in self.verts]
        return self

    def signed_volume(self):
        """Positive when faces wind counter-clockwise seen from outside."""
        v = np.asarray(self.verts, float)
        total = 0.0
        for f in self.faces:
            for k in range(1, len(f) - 1):  # fan-triangulate
                a, b, c = v[f[0]], v[f[k]], v[f[k + 1]]
                total += np.dot(a, np.cross(b, c)) / 6.0
        return total

    def fix_winding(self):
        if self.signed_volume() < 0:
            self.faces = [list(reversed(f)) for f in self.faces]
        return self

    def bounds(self):
        v = np.asarray(self.verts, float)
        return v.min(axis=0), v.max(axis=0)


def normalize(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v


# ---------------------------------------------------------------------------
# primitives
# ---------------------------------------------------------------------------
def quad_sphere(radii=(1, 1, 1), n=12):
    """Cube projected onto a sphere: all-quad, evenly distributed, no poles.
    Far better sculpting topology than a UV sphere."""
    verts = []
    index = {}
    faces = []

    def vid(p):
        key = tuple(np.round(p, 6))
        if key not in index:
            index[key] = len(verts)
            verts.append(key)
        return index[key]

    # six cube faces, each parameterised by (u, v) in [-1, 1]
    axes = [
        (np.array([1, 0, 0]), np.array([0, 1, 0]), np.array([0, 0, 1])),
        (np.array([-1, 0, 0]), np.array([0, 1, 0]), np.array([0, 0, -1])),
        (np.array([0, 1, 0]), np.array([0, 0, 1]), np.array([1, 0, 0])),
        (np.array([0, -1, 0]), np.array([0, 0, -1]), np.array([1, 0, 0])),
        (np.array([0, 0, 1]), np.array([1, 0, 0]), np.array([0, 1, 0])),
        (np.array([0, 0, -1]), np.array([-1, 0, 0]), np.array([0, 1, 0])),
    ]
    r = np.asarray(radii, float)
    for base, du, dv in axes:
        grid = []
        for i in range(n + 1):
            row = []
            for j in range(n + 1):
                u = -1 + 2 * i / n
                v = -1 + 2 * j / n
                p = base + du * u + dv * v
                p = normalize(p.astype(float)) * r
                row.append(vid(p))
            grid.append(row)
        for i in range(n):
            for j in range(n):
                faces.append([grid[i][j], grid[i + 1][j],
                              grid[i + 1][j + 1], grid[i][j + 1]])
    return Mesh(verts, faces).fix_winding()


def bezier(points, t):
    """Cubic bezier over 4 control points (works on scalars or vectors)."""
    p = [np.asarray(x, float) for x in points]
    mt = 1 - t
    return (mt**3 * p[0] + 3 * mt**2 * t * p[1]
            + 3 * mt * t**2 * p[2] + t**3 * p[3])


def sweep_tube(spine, radii, segs=20, cap_rings=4):
    """Sweep a circular cross-section along a spine using parallel-transport
    frames (no twisting), with rounded caps at both ends."""
    spine = [np.asarray(p, float) for p in spine]
    radii = [float(r) for r in radii]
    m = len(spine)

    # tangents
    tang = []
    for i in range(m):
        if i == 0:
            t = spine[1] - spine[0]
        elif i == m - 1:
            t = spine[-1] - spine[-2]
        else:
            t = spine[i + 1] - spine[i - 1]
        tang.append(normalize(t))

    # parallel-transported frames
    seed = np.array([0.0, 0.0, 1.0])
    if abs(np.dot(seed, tang[0])) > 0.9:
        seed = np.array([1.0, 0.0, 0.0])
    normals = [normalize(seed - tang[0] * np.dot(seed, tang[0]))]
    for i in range(1, m):
        axis = np.cross(tang[i - 1], tang[i])
        s = np.linalg.norm(axis)
        if s < 1e-9:
            normals.append(normals[-1])
            continue
        axis = axis / s
        ang = np.arctan2(s, np.dot(tang[i - 1], tang[i]))
        n = normals[-1]
        # Rodrigues rotation
        n = (n * np.cos(ang) + np.cross(axis, n) * np.sin(ang)
             + axis * np.dot(axis, n) * (1 - np.cos(ang)))
        normals.append(normalize(n))

    def ring(center, radius, nrm, tgt):
        b = np.cross(tgt, nrm)
        out = []
        for k in range(segs):
            a = 2 * np.pi * k / segs
            out.append(center + radius * (np.cos(a) * nrm + np.sin(a) * b))
        return out

    rings = []  # each entry: list of segs points

    # start cap (built outward from the first ring, then reversed)
    start_caps = []
    for k in range(1, cap_rings + 1):
        a = (k / cap_rings) * (np.pi / 2)
        c = spine[0] - tang[0] * radii[0] * np.sin(a)
        rad = radii[0] * np.cos(a)
        start_caps.append(ring(c, rad, normals[0], tang[0]))
    rings.extend(reversed(start_caps[:-1]))  # drop the degenerate last one

    for i in range(m):
        rings.append(ring(spine[i], radii[i], normals[i], tang[i]))

    for k in range(1, cap_rings):
        a = (k / cap_rings) * (np.pi / 2)
        c = spine[-1] + tang[-1] * radii[-1] * np.sin(a)
        rad = radii[-1] * np.cos(a)
        rings.append(ring(c, rad, normals[-1], tang[-1]))

    verts = []
    for rg in rings:
        verts.extend([tuple(p) for p in rg])
    pole_a = len(verts)
    verts.append(tuple(spine[0] - tang[0] * radii[0]))
    pole_b = len(verts)
    verts.append(tuple(spine[-1] + tang[-1] * radii[-1]))

    faces = []
    for i in range(len(rings) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            a = i * segs + k
            b = i * segs + k2
            c = (i + 1) * segs + k2
            dd = (i + 1) * segs + k
            faces.append([a, b, c, dd])
    for k in range(segs):  # pole fans
        k2 = (k + 1) % segs
        faces.append([pole_a, k2, k])
        last = (len(rings) - 1) * segs
        faces.append([pole_b, last + k, last + k2])

    return Mesh(verts, faces).fix_winding()


def rot_y(mesh, deg, pivot=(0, 0, 0)):
    a = np.radians(deg)
    ca, sa = np.cos(a), np.sin(a)
    p = np.asarray(pivot, float)
    out = []
    for v in mesh.verts:
        q = np.asarray(v, float) - p
        out.append(tuple(np.array([q[0] * ca + q[2] * sa, q[1],
                                   -q[0] * sa + q[2] * ca]) + p))
    mesh.verts = out
    return mesh


def scale_about(mesh, scale, pivot):
    s = np.asarray(scale, float)
    p = np.asarray(pivot, float)
    mesh.verts = [tuple((np.asarray(v, float) - p) * s + p) for v in mesh.verts]
    return mesh


def mirror_x(mesh):
    """Mirror across the YZ plane and flip winding so normals stay outward."""
    m = Mesh([(-v[0], v[1], v[2]) for v in mesh.verts],
             [list(reversed(f)) for f in mesh.faces])
    return m


# ---------------------------------------------------------------------------
# 1. HEAD  (skull, muzzle, ears, horns)
# ---------------------------------------------------------------------------
def build_head():
    parts = {}

    skull = quad_sphere((17.5, 18.5, 17.0), n=14)
    skull.transform(translate=(0, 78, 0))
    parts["head_skull"] = skull

    # big soft muzzle pushed forward and down off the skull
    muzzle = quad_sphere((10.5, 8.8, 9.5), n=12)
    muzzle.transform(translate=(0, 70.5, 13.0))
    parts["head_muzzle"] = muzzle

    # ears: sit level with the eyes, well below the horn bases, and point
    # almost straight out to the side so they never read as a second horn pair
    ear_spine = [bezier([(12.0, 79.0, -2.0), (17.0, 80.0, -4.0),
                         (21.5, 81.0, -6.0), (25.0, 82.0, -7.5)], t)
                 for t in np.linspace(0, 1, 10)]
    ear_radii = [bezier([4.4, 4.0, 2.5, 0.5], t) for t in np.linspace(0, 1, 10)]
    ear = sweep_tube(ear_spine, ear_radii, segs=16, cap_rings=3)
    scale_about(ear, (1.0, 1.0, 0.50), (18, 80, -4.5))  # flatten front-to-back
    parts["ear_R"] = ear
    parts["ear_L"] = mirror_x(ear)

    # horns: curve outward from the top of the skull, then sweep up, tapering
    horn_spine = [bezier([(7.5, 90.0, 1.0), (14.0, 95.5, 0.0),
                          (18.0, 101.0, -2.0), (19.0, 107.0, -4.5)], t)
                  for t in np.linspace(0, 1, 14)]
    horn_radii = [bezier([3.8, 3.1, 1.9, 0.35], t) for t in np.linspace(0, 1, 14)]
    horn = sweep_tube(horn_spine, horn_radii, segs=18, cap_rings=3)
    parts["horn_R"] = horn
    parts["horn_L"] = mirror_x(horn)

    # brow ridges above the eyes
    brow = quad_sphere((6.0, 1.8, 3.0), n=8)
    brow.transform(translate=(7.0, 83.0, 13.5))
    rot_y(brow, -14, pivot=(0, 83, 13.5))
    parts["brow_R"] = brow
    parts["brow_L"] = mirror_x(brow)

    # eyeballs, sunk into the skull so the sculpt has something to build lids on
    eye = quad_sphere((2.6, 2.6, 2.6), n=8)
    eye.transform(translate=(6.8, 79.5, 14.0))
    parts["eye_R"] = eye
    parts["eye_L"] = mirror_x(eye)

    return parts


# ---------------------------------------------------------------------------
# 2. BODY  (barrel torso, no neck)
# ---------------------------------------------------------------------------
def build_body():
    torso = quad_sphere((21.5, 25.0, 18.5), n=16)
    torso.transform(translate=(0, 47, 0))
    # let the belly sag forward and widen toward the bottom
    v = []
    for x, y, z in torso.verts:
        t = np.clip((47 - y) / 25.0, 0, 1)          # 0 at chest, 1 at the base
        widen = 1.0 + 0.10 * t
        v.append((x * widen, y, z * widen + 1.6 * t * t))
    torso.verts = v
    return {"body_torso": torso}


# ---------------------------------------------------------------------------
# 3. ARMS  (upper arm -> forearm -> hand)
# ---------------------------------------------------------------------------
def build_arms():
    spine = [bezier([(19.0, 62.0, 1.0), (24.5, 54.0, 0.5),
                     (26.0, 43.0, 0.0), (25.5, 34.0, 0.0)], t)
             for t in np.linspace(0, 1, 12)]
    radii = [bezier([6.8, 6.2, 5.2, 4.3], t) for t in np.linspace(0, 1, 12)]
    arm = sweep_tube(spine, radii, segs=20, cap_rings=4)

    hand = quad_sphere((4.6, 5.4, 4.0), n=10)
    hand.transform(translate=(25.5, 29.5, 0.5))

    return {
        "arm_R": arm, "arm_L": mirror_x(arm),
        "hand_R": hand, "hand_L": mirror_x(hand),
    }


# ---------------------------------------------------------------------------
# 4. LEGS  (short stout leg + cloven hoof)
# ---------------------------------------------------------------------------
def build_legs():
    # short and stout: the reference character has very little leg showing
    spine = [bezier([(9.0, 31.0, 0.0), (10.5, 25.0, 0.5),
                     (11.0, 17.0, 0.5), (11.0, 11.0, 0.0)], t)
             for t in np.linspace(0, 1, 12)]
    radii = [bezier([9.8, 9.2, 8.4, 7.0], t) for t in np.linspace(0, 1, 12)]
    leg = sweep_tube(spine, radii, segs=20, cap_rings=4)

    # cloven hoof: two tapered toes side by side
    toes = Mesh()
    for dx in (-2.6, 2.6):
        toe_spine = [bezier([(11.0 + dx, 10.0, 0.0), (11.0 + dx, 8.0, 1.6),
                             (11.0 + dx, 6.0, 3.2), (11.0 + dx, 4.8, 4.4)], t)
                     for t in np.linspace(0, 1, 8)]
        toe_radii = [bezier([3.4, 3.1, 2.5, 1.6], t) for t in np.linspace(0, 1, 8)]
        toes.add(sweep_tube(toe_spine, toe_radii, segs=14, cap_rings=3))
    toes.fix_winding()

    return {
        "leg_R": leg, "leg_L": mirror_x(leg),
        "hoof_R": toes, "hoof_L": mirror_x(toes),
    }


# ---------------------------------------------------------------------------
# OBJ writing
# ---------------------------------------------------------------------------
def write_obj(path, parts, header=""):
    lines = []
    if header:
        for ln in header.strip().splitlines():
            lines.append(f"# {ln.strip()}")
    off = 1
    for name, mesh in parts.items():
        lines.append(f"o {name}")
        for x, y, z in mesh.verts:
            lines.append(f"v {x:.5f} {y:.5f} {z:.5f}")
        for f in mesh.faces:
            lines.append("f " + " ".join(str(i + off) for i in f))
        off += len(mesh.verts)
    with open(path, "w") as fh:
        fh.write("\n".join(lines) + "\n")
    nv = sum(len(m.verts) for m in parts.values())
    nf = sum(len(m.faces) for m in parts.values())
    print(f"{os.path.basename(path):32s} {len(parts)} objects  {nv:6d} verts  {nf:6d} faces")


if __name__ == "__main__":
    head, body, arms, legs = build_head(), build_body(), build_arms(), build_legs()

    # settle the upper body down onto the legs -- the reference character is
    # squat, with the belly nearly resting on the thighs and no neck at all
    for group in (head, body, arms):
        for m in group.values():
            m.transform(translate=(0, -4, 0))

    # drop everything so the hooves rest on y = 0
    allp = {**head, **body, **arms, **legs}
    combined = Mesh()
    for m in allp.values():
        combined.add(m)
    miny = combined.bounds()[0][1]
    for m in allp.values():
        m.transform(translate=(0, -miny, 0))

    hdr = ("Yellow fur bull character - sculpting blockout\n"
           "+X right, +Y up, +Z forward. Quad-dominant base mesh.\n"
           "Import into Nomad Sculpt, then subdivide and sculpt.")
    write_obj(f"{OUT}/01_head.obj", head, hdr)
    write_obj(f"{OUT}/02_body.obj", body, hdr)
    write_obj(f"{OUT}/03_arms.obj", arms, hdr)
    write_obj(f"{OUT}/04_legs.obj", legs, hdr)
    write_obj(f"{OUT}/00_full_blockout.obj", allp, hdr)

    lo, hi = Mesh().add(list(allp.values())[0]).bounds()
    c2 = Mesh()
    for m in allp.values():
        c2.add(m)
    lo, hi = c2.bounds()
    print("bounds min", np.round(lo, 2), "max", np.round(hi, 2))
    print("height", round(hi[1] - lo[1], 2), "width", round(hi[0] - lo[0], 2))
