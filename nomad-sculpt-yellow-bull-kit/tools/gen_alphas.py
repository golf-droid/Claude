import numpy as np
from PIL import Image, ImageFilter
import os

OUT = "/home/user/Claude/nomad-sculpt-yellow-bull-kit/alphas"
REF = "/home/user/Claude/nomad-sculpt-yellow-bull-kit/reference"
os.makedirs(OUT, exist_ok=True)
os.makedirs(REF, exist_ok=True)

rng = np.random.default_rng(42)


def save(arr, path):
    arr = np.clip(arr, 0, 1)
    img = Image.fromarray((arr * 255).astype(np.uint8), mode="L")
    img.save(path)
    print("saved", path, img.size)


def seamless_fourier_noise(size, n_components=40, kmax=24, anisotropy=(1.0, 1.0),
                            power_falloff=1.3, seed=0):
    """Perfectly tileable pseudo-noise via random-phase sine sum.
    anisotropy=(ax,ay) stretches feature size along x / y (elongated features
    along the axis with the LARGER value)."""
    local_rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    field = np.zeros((size, size), dtype=np.float64)
    ax, ay = anisotropy
    for _ in range(n_components):
        kx = local_rng.integers(-kmax, kmax + 1)
        ky = local_rng.integers(-kmax, kmax + 1)
        if kx == 0 and ky == 0:
            continue
        kx_eff = kx / ax
        ky_eff = ky / ay
        freq = np.hypot(kx_eff, ky_eff)
        amp = 1.0 / (freq ** power_falloff + 1e-6)
        phase = local_rng.uniform(0, 2 * np.pi)
        field += amp * np.sin(2 * np.pi * (kx * x / size + ky * y / size) + phase)
    field -= field.min()
    field /= field.max()
    return field


def radial_coords(size):
    y, x = np.mgrid[0:size, 0:size].astype(np.float64)
    cx = cy = (size - 1) / 2
    dx, dy = x - cx, y - cy
    r = np.hypot(dx, dy) / (size / 2)
    theta = np.arctan2(dy, dx)
    return r, theta


# ---------------------------------------------------------------------------
# 1. fur_strand_tileable.png  -- fine directional fur, seamless
# ---------------------------------------------------------------------------
size = 2048
base = seamless_fourier_noise(size, n_components=90, kmax=40, anisotropy=(1.0, 5.0),
                               power_falloff=1.1, seed=1)
fine = seamless_fourier_noise(size, n_components=60, kmax=80, anisotropy=(1.0, 3.0),
                               power_falloff=1.0, seed=2)
fur = base * 0.65 + fine * 0.35
fur = fur ** 1.6
save(fur, f"{OUT}/fur_strand_tileable.png")

# ---------------------------------------------------------------------------
# 2. fur_clump_stamp.png -- single tuft of fur radiating outward, non-tileable
# ---------------------------------------------------------------------------
size = 1024
r, theta = radial_coords(size)
n_strands = 28
strand_noise = np.zeros((size, size))
rng2 = np.random.default_rng(3)
angle_jitter = rng2.uniform(-0.06, 0.06, n_strands)
base_angles = np.linspace(0, 2 * np.pi, n_strands, endpoint=False)
for a0, jitter in zip(base_angles, angle_jitter):
    a = a0 + jitter
    d = np.abs(((theta - a + np.pi) % (2 * np.pi)) - np.pi)
    strand_noise += np.exp(-(d ** 2) / (2 * 0.035 ** 2))
strand_noise /= strand_noise.max()
falloff = np.clip(1.0 - r, 0, 1) ** 1.4
clump = strand_noise * falloff
img = Image.fromarray((np.clip(clump, 0, 1) * 255).astype(np.uint8), mode="L")
img = img.filter(ImageFilter.GaussianBlur(1.2))
img.save(f"{OUT}/fur_clump_stamp.png")
print("saved", f"{OUT}/fur_clump_stamp.png")

# ---------------------------------------------------------------------------
# 3. horn_ridge_tileable.png -- ridged keratin bands for horns, seamless along Y
# ---------------------------------------------------------------------------
size = 2048
y, x = np.mgrid[0:size, 0:size].astype(np.float64)
n_rings = 26
ring = 0.5 + 0.5 * np.sin(2 * np.pi * n_rings * y / size)
perturb = seamless_fourier_noise(size, n_components=30, kmax=18, anisotropy=(3.0, 1.0),
                                  power_falloff=1.4, seed=4)
horn = ring * 0.75 + perturb * 0.25
horn = horn ** 1.3
save(horn, f"{OUT}/horn_ridge_tileable.png")

# ---------------------------------------------------------------------------
# 4. skin_pores_tileable.png -- fine bumpy skin texture for snout/muzzle, seamless
# ---------------------------------------------------------------------------
size = 2048
pores = seamless_fourier_noise(size, n_components=90, kmax=55, anisotropy=(1.0, 1.0),
                                power_falloff=1.15, seed=5)
_img = Image.fromarray((pores * 255).astype(np.uint8), mode="L")
_img = _img.filter(ImageFilter.GaussianBlur(1.5))
pores = np.asarray(_img).astype(np.float64) / 255.0
pores -= pores.min()
pores /= pores.max()
pores = pores ** 1.4
save(pores, f"{OUT}/skin_pores_tileable.png")

# ---------------------------------------------------------------------------
# 5. snout_wrinkle_stamp.png -- concentric wrinkles around nostrils/mouth
# ---------------------------------------------------------------------------
size = 1024
r, theta = radial_coords(size)
rng3 = np.random.default_rng(6)
noise_dist = seamless_fourier_noise(size, n_components=20, kmax=8, power_falloff=1.6, seed=7)
wrinkle = 0.5 + 0.5 * np.sin(2 * np.pi * (r * 9 + (noise_dist - 0.5) * 0.6))
mask = np.clip(1.0 - r, 0, 1) ** 0.8
wrinkle_stamp = wrinkle * mask
wrinkle_stamp = wrinkle_stamp ** 1.2
save(wrinkle_stamp, f"{OUT}/snout_wrinkle_stamp.png")

# ---------------------------------------------------------------------------
# 6. hoof_ridge_stamp.png -- growth-ring ridges for hooves / horn tips / claws
# ---------------------------------------------------------------------------
size = 1024
y, x = np.mgrid[0:size, 0:size].astype(np.float64)
n_rings = 10
rings = 0.5 + 0.5 * np.sin(2 * np.pi * n_rings * (y / size) ** 1.15)
side_noise = seamless_fourier_noise(size, n_components=25, kmax=15, anisotropy=(4.0, 1.0),
                                     power_falloff=1.5, seed=8)
hoof = rings * 0.8 + side_noise * 0.2
fade = np.clip(1.0 - np.abs((x - size / 2) / (size / 2)), 0.15, 1.0)
hoof = hoof * fade
hoof = hoof ** 1.2
save(hoof, f"{OUT}/hoof_ridge_stamp.png")

# ---------------------------------------------------------------------------
# 7. ear_inner_fold_stamp.png -- soft concentric folds for inner ear
# ---------------------------------------------------------------------------
size = 1024
r, theta = radial_coords(size)
noise_dist2 = seamless_fourier_noise(size, n_components=15, kmax=6, power_falloff=1.8, seed=9)
folds = 0.5 + 0.5 * np.sin(2 * np.pi * (r * 4.5 + (noise_dist2 - 0.5) * 0.4))
mask = np.clip(1.0 - r, 0, 1) ** 1.1
ear = folds * mask
img = Image.fromarray((np.clip(ear, 0, 1) * 255).astype(np.uint8), mode="L")
img = img.filter(ImageFilter.GaussianBlur(3.0))
img.save(f"{OUT}/ear_inner_fold_stamp.png")
print("saved", f"{OUT}/ear_inner_fold_stamp.png")

# ---------------------------------------------------------------------------
# 8. eyelid_crease_stamp.png -- a few smooth curved eyelid / brow creases
# ---------------------------------------------------------------------------
size = 1024
y, x = np.mgrid[0:size, 0:size].astype(np.float64)
xn = (x - size / 2) / (size / 2)
yn = (y - size / 2) / (size / 2)
crease = np.zeros((size, size))
curve_defs = [(-0.35, 0.55, 0.10), (0.05, 0.35, 0.09), (0.4, 0.15, 0.08)]
for cy0, curvature, width in curve_defs:
    curve_y = cy0 + curvature * xn ** 2
    d = np.abs(yn - curve_y)
    crease += np.exp(-(d ** 2) / (2 * width ** 2))
crease /= crease.max()
edge_fade = np.clip(1.0 - np.abs(xn) ** 3, 0, 1)
crease = crease * edge_fade
save(crease, f"{OUT}/eyelid_crease_stamp.png")

print("done")
