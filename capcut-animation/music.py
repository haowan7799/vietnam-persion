"""Original 30s BGM + SFX for the CapCut workshop animation.

120 BPM, C major, I-V-vi-IV. One beat = 0.5s, one bar = 2s, so every visual
event in scene.html lands exactly on the grid used here. No vocals.

Usage: python3 music.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)

BEAT = 0.5
STEP = BEAT / 4  # 16th note


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    gl = gain * np.sqrt(0.5 * (1 - pan))
    gr = gain * np.sqrt(0.5 * (1 + pan))
    L[i : i + len(sig)] += sig * gl
    R[i : i + len(sig)] += sig * gr


def tt(d):
    return np.arange(int(d * SR)) / SR


def env_adsr(n, a=0.005, d=0.1, s=0.6, r=0.05, hold=None):
    t = np.arange(n) / SR
    total = n / SR
    hold = total - r if hold is None else hold
    e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((total - t) / r, 0, 1)
    return e * rel


def additive(freq_t, harmonics, amps):
    phase = 2 * np.pi * np.cumsum(freq_t) / SR
    out = np.zeros_like(phase)
    for k, a in zip(harmonics, amps):
        mask = (freq_t * k) < SR / 2.2
        out += a * np.sin(k * phase) * mask
    return out


def fft_filter(sig, lo=None, hi=None):
    spec = np.fft.rfft(sig)
    f = np.fft.rfftfreq(len(sig), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(spec * m, len(sig))


# ---------------------------------------------------------------- instruments
def kick():
    t = tt(0.4)
    f = 45 + 110 * np.exp(-t * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    s[:200] += rng.standard_normal(200) * np.linspace(0.6, 0, 200)
    return np.tanh(s * 1.6)


def clap():
    t = tt(0.25)
    n = fft_filter(rng.standard_normal(len(t)), 900, 5000)
    e = np.zeros_like(t)
    for off in (0, 0.011, 0.022):
        e += np.where(t >= off, np.exp(-(t - off) * 90), 0)
    e += np.exp(-t * 18) * 0.6
    return n * e / 3


def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    n = fft_filter(rng.standard_normal(len(t)), 7000, None)
    return n * np.exp(-t * (14 if open_ else 70))


def crash():
    t = tt(2.2)
    n = fft_filter(rng.standard_normal(len(t)), 3500, 14000)
    return n * np.exp(-t * 2.2)


def snare():
    t = tt(0.18)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    n = fft_filter(rng.standard_normal(len(t)), 1500, 9000) * np.exp(-t * 25)
    return body * 0.6 + n * 0.8


def bass(m, d):
    t = tt(d)
    f = np.full(len(t), midi_hz(m))
    s = additive(f, range(1, 9), [1 / k for k in range(1, 9)])
    return s * env_adsr(len(t), 0.003, 0.12, 0.5, 0.03)


def stab(ms, d=0.14):
    t = tt(d)
    out = np.zeros(len(t))
    for i, m in enumerate(ms):
        f = np.full(len(t), midi_hz(m) * (1 + 0.003 * (i - 1)))
        out += additive(f, range(1, 12), [1 / k for k in range(1, 12)])
    return out * np.exp(-t * 16) / len(ms)


def bell(m, d=0.6):
    """Cute FM marimba/bell."""
    t = tt(d)
    fc = midi_hz(m)
    mod = np.sin(2 * np.pi * fc * 3.5 * t) * 2.2 * np.exp(-t * 12)
    s = np.sin(2 * np.pi * fc * t + mod)
    s += 0.25 * np.sin(2 * np.pi * fc * 4 * t) * np.exp(-t * 20)
    return s * np.exp(-t * 6) * np.clip(t / 0.002, 0, 1)


def lead(m, d):
    t = tt(d + 0.05)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.12) * 5, 0, 1)
    f = midi_hz(m) * vib
    odd = [1, 3, 5, 7, 9, 11, 13]
    s = additive(f, odd, [1 / k for k in odd]) * 0.7
    s += additive(f * 1.004, odd, [1 / k for k in odd]) * 0.3
    return s * env_adsr(len(t), 0.006, 0.15, 0.7, 0.05)


def pad(ms, d):
    t = tt(d)
    out = np.zeros(len(t))
    for m in ms:
        for det in (-0.004, 0.004):
            f = np.full(len(t), midi_hz(m) * (1 + det))
            out += additive(f, range(1, 7), [1 / k ** 1.5 for k in range(1, 7)])
    a = np.clip(t / 0.3, 0, 1) * np.clip((d - t) / 0.3, 0, 1)
    return out * a / (len(ms) * 2)


# ---------------------------------------------------------------- sfx
def sfx_pop(pitch=1.0):
    t = tt(0.12)
    f = (500 + 1400 * (1 - np.exp(-t * 60))) * pitch
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35)


def sfx_whoosh(d=0.5, up=True):
    t = tt(d)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    seg = 2048
    for i in range(0, len(t), seg):
        p = i / len(t)
        c = 400 + 4000 * (p if up else 1 - p)
        out[i : i + seg] = fft_filter(n[i : i + seg], c * 0.6, c * 1.6)[: len(out[i : i + seg])]
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return out * e


def sfx_snip():
    t = tt(0.09)
    c = fft_filter(rng.standard_normal(len(t)), 3000, 12000)
    e = np.exp(-t * 120) + np.where(t > 0.04, np.exp(-(t - 0.04) * 150), 0)
    return c * e + np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 80) * 0.4


def sfx_boing():
    t = tt(0.5)
    f = 220 + 160 * np.sin(2 * np.pi * 14 * t) * np.exp(-t * 4) + 300 * t
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)


def sfx_bonk():
    t = tt(0.3)
    f = 300 * np.exp(-t * 8) + 90
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12)
    s[:300] += rng.standard_normal(300) * np.linspace(0.8, 0, 300)
    return s


def sfx_sparkle():
    out = np.zeros(int(0.7 * SR))
    for i, m in enumerate([84, 88, 91, 96, 100]):
        b = bell(m, 0.4) * 0.5
        st = int(i * 0.045 * SR)
        out[st : st + len(b)] += b[: len(out) - st]
    return out


def sfx_type():
    t = tt(0.04)
    return fft_filter(rng.standard_normal(len(t)), 1500, 8000) * np.exp(-t * 160)


def sfx_bwomp():
    t = tt(0.6)
    f = 330 * np.exp(-t * 2.2)
    s = additive(f, [1, 2, 3, 4], [1, 0.5, 0.3, 0.2])
    return s * np.clip(t / 0.01, 0, 1) * np.clip((0.6 - t) / 0.1, 0, 1)


def sfx_scratch():
    t = tt(0.45)
    # wobbling pitch like a record being dragged
    rate = 1 + 0.9 * np.sin(2 * np.pi * 7 * t) * np.exp(-t * 1.5) - t
    f = np.clip(rate, 0.05, None) * 900
    s = additive(f, range(1, 6), [1, 0.5, 0.33, 0.25, 0.2])
    n = fft_filter(rng.standard_normal(len(t)), 600, 4000) * 0.6
    return (s * 0.6 + n * np.abs(np.sin(2 * np.pi * 7 * t))) * np.exp(-t * 3)


def sfx_inflate(d=0.9):
    t = tt(d)
    f = 180 + 700 * (t / d) ** 1.5 + 25 * np.sin(2 * np.pi * 18 * t)
    s = additive(f, [1, 2, 3], [1, 0.4, 0.2])
    return s * np.clip(t / 0.05, 0, 1) * 0.5


def sfx_ding():
    return bell(96, 1.2) + 0.5 * bell(103, 1.2)


def sfx_glitch():
    out = np.zeros(int(0.35 * SR))
    for i in range(7):
        t = tt(0.04)
        f = rng.choice([300, 600, 1200, 2400])
        sq = np.sign(np.sin(2 * np.pi * f * t)) * 0.4
        st = int(i * 0.045 * SR)
        out[st : st + len(t)] += sq[: len(out) - st]
    return out


def sfx_thump():
    t = tt(0.35)
    f = 120 * np.exp(-t * 10) + 50
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


# ---------------------------------------------------------------- arrangement
CHORDS = [  # root midi (bass octave), triad (mid octave)
    (36, [60, 64, 67]),  # C
    (43, [59, 62, 67]),  # G
    (45, [60, 64, 69]),  # Am
    (41, [60, 65, 69]),  # F
]
HOOK = [  # per bar: (step, len_steps, midi)
    [(0, 2, 76), (2, 2, 79), (4, 3, 84), (8, 2, 79), (10, 2, 81), (12, 4, 79)],
    [(0, 2, 79), (2, 2, 77), (4, 2, 76), (6, 2, 74), (8, 2, 71), (10, 2, 74), (12, 4, 79)],
    [(0, 2, 81), (2, 2, 84), (4, 3, 88), (8, 2, 84), (10, 2, 83), (12, 4, 81)],
    [(0, 2, 81), (2, 2, 79), (4, 2, 77), (6, 2, 76), (8, 3, 72), (12, 2, 74), (14, 2, 76)],
]
ARP = [0, 1, 2, 1, 0, 2, 1, 2]

BREAK = (20.5, 22.0)  # record-scratch gag: band stops


def in_break(t):
    return BREAK[0] <= t < BREAK[1]


def drums_on(t):
    return (3.0 <= t < 20.5) or (22.0 <= t < 28.0)


kick_env = np.zeros(N)

for bar in range(15):
    b0 = bar * 2.0
    root, triad = CHORDS[bar % 4]
    hook = HOOK[bar % 4]
    for beat in range(4):
        tb = b0 + beat * BEAT
        if drums_on(tb):
            add(kick(), tb, 0.95)
            i = int(tb * SR)
            seg = np.exp(-np.arange(int(0.3 * SR)) / SR * 12)
            kick_env[i : i + len(seg)] = np.maximum(kick_env[i : i + len(seg)], seg[: N - i])
            if beat % 2 == 1:
                add(clap(), tb, 0.55)
            add(hat(), tb + BEAT / 2, 0.22, 0.3)
            if bar >= 6:
                add(hat(), tb + BEAT / 4, 0.08, -0.3)
                add(hat(), tb + 3 * BEAT / 4, 0.08, -0.3)
        elif 2.0 <= tb < 3.0 or (0.0 <= tb < 2.0 and beat % 2 == 1):
            add(hat(), tb + BEAT / 2, 0.15, 0.3)

    # bass
    if b0 + 1 > 3.0 and bar < 14:
        for s in range(0, 16, 2):
            ts = b0 + s * STEP
            if not drums_on(ts):
                continue
            m = root + (12 if s % 4 == 2 else 0)
            add(bass(m, STEP * 1.6), ts, 0.38)

    # chord stabs on offbeats / pad in intro + break
    for s in (2, 6, 10, 14):
        ts = b0 + s * STEP
        if drums_on(ts):
            add(stab(triad), ts, 0.22, -0.25)
            add(stab([n + 12 for n in triad]), ts + 0.012, 0.1, 0.35)
    if bar < 2:
        add(pad(triad, 2.0), b0, 0.18)

    # bells: arpeggio in intro, hook during verse, harmony later
    if bar < 2:
        for s in range(8):
            ts = b0 + s * BEAT / 2
            if True:
                add(bell(triad[ARP[s]] + 12, 0.4), ts, 0.16, 0.2 if s % 2 else -0.2)
    if 2 <= bar <= 5:
        for st, ln, m in hook:
            add(bell(m, 0.5), b0 + st * STEP, 0.2, 0.15)
    if 6 <= bar <= 9 or 11 <= bar <= 13:
        for st, ln, m in hook:
            ts = b0 + st * STEP
            if in_break(ts):
                continue
            add(lead(m, ln * STEP * 0.9), ts, 0.16)
            add(bell(m + 12, 0.35), ts, 0.07, 0.4)

# build into the break: snare roll 19.0 -> 20.5
for i in range(12):
    ts = 19.0 + i * STEP
    add(snare(), ts, 0.12 + 0.03 * i, 0.0)
# drum fill after the gag 21.5 -> 22
for i, ts in enumerate([21.5, 21.625, 21.75, 21.8125, 21.875, 21.9375]):
    add(snare(), ts, 0.35 + 0.05 * i)

# final hit + outro
add(kick(), 28.0, 1.0)
add(crash(), 28.0, 0.35)
add(pad([48, 60, 64, 67, 72], 2.0), 28.0, 0.5)
add(stab([60, 64, 67, 72]), 28.0, 0.4)
for i, m in enumerate([72, 76, 79, 84, 88, 91, 96]):
    add(bell(m, 0.8), 28.25 + i * STEP, 0.16, (-1) ** i * 0.3)
add(bell(84, 1.0), 29.0, 0.3)

# crashes at section starts
for tc in (3.0, 12.0, 22.0):
    add(crash(), tc, 0.28)

# sidechain pump on the music bus
pump = 1 - 0.45 * kick_env
L *= np.where(kick_env > 0, pump, 1)
R *= np.where(kick_env > 0, pump, 1)

# ---------------------------------------------------------------- sfx track
def sfx(sig, t, g=0.5, pan=0.0):
    add(sig, t, g, pan)


sfx(sfx_pop(1.0), 0.5, 0.5)
sfx(sfx_whoosh(0.8), 0.9, 0.35)
for i, ts in enumerate([3.5, 4.0, 4.5, 5.0, 5.5]):
    sfx(sfx_pop(0.8 + 0.12 * i), ts, 0.45, -0.4 + 0.2 * i)
sfx(sfx_whoosh(0.5), 6.0, 0.25)
sfx(sfx_sparkle(), 7.0, 0.45)
for ts in (7.5, 8.0, 8.5, 9.0, 9.5):
    sfx(sfx_snip(), ts, 0.55)
sfx(sfx_boing(), 9.55, 0.45)
sfx(sfx_bonk(), 10.0, 0.6)
sfx(sfx_whoosh(0.5, up=False), 10.5, 0.25)
for ts in (11.5, 12.5, 13.5):
    sfx(sfx_whoosh(0.4), ts - 0.15, 0.4)
sfx(sfx_glitch(), 14.5, 0.35)
for i in range(12):  # typing
    sfx(sfx_type(), 15.0 + i * 0.125, 0.4, 0.3)
sfx(sfx_bwomp(), 16.5, 0.45)
for i in range(4):  # backspace
    sfx(sfx_type(), 17.5 + i * 0.0625 * 2, 0.4, 0.3)
sfx(sfx_ding(), 18.0, 0.35)
sfx(sfx_sparkle(), 18.0, 0.3)
sfx(sfx_sparkle(), 19.0, 0.35)
sfx(sfx_pop(1.3), 19.5, 0.35)
sfx(sfx_whoosh(0.35), 19.85, 0.3)
sfx(sfx_scratch(), 20.5, 0.6)
sfx(sfx_inflate(0.8), 20.6, 0.4)
sfx(sfx_pop(0.6), 21.5, 0.6)
sfx(sfx_thump(), 25.0, 0.7)
sfx(sfx_pop(1.6), 25.0, 0.3)
for i, ts in enumerate([25.5, 26.0, 26.5]):
    sfx(sfx_pop(1.0 + 0.25 * i), ts, 0.3)
sfx(sfx_ding(), 27.0, 0.4)
sfx(sfx_pop(0.7), 27.0, 0.5)
sfx(crash(), 27.0, 0.2)
sfx(sfx_sparkle(), 28.0, 0.35)

if "--family" in sys.argv:  # family pops out of the monitor + kids hopping
    for i in range(4):
        sfx(sfx_pop(1.0 + 0.15 * i), 22.0 + i * 0.07, 0.45, -0.6 + 0.2 * i)
    sfx(sfx_sparkle(), 19.5, 0.4)
    for ts in (25.5, 26.0, 26.5):
        sfx(sfx_boing(), ts, 0.18, -0.5)
    sfx(sfx_boing(), 27.4, 0.3, -0.4)

# ---------------------------------------------------------------- master
mix = np.stack([L, R], axis=1)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
fade = np.clip((DUR - np.arange(N) / SR) / 0.4, 0, 1)
mix *= fade[:, None] * 0.89
pcm = (mix * 32767).astype("<i2")

out = next((a for a in sys.argv[1:] if not a.startswith("--")), "bgm.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok")
