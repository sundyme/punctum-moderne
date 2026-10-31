"""Punctum Song (点宋) draft 0.2 — drafting prototype.

Changes from proto.py (draft 0.1):
  1. Skeleton, not cell sampling. The stroke's centre line is thinned to one pixel and traced as a graph;
     dots run along each path one per step on its major axis, so a stroke is never two dots wide.
  2. Stroke allocation. Straight horizontals and verticals are fitted to rows / columns so that parallel
     strokes that overlap keep one free row between them; the rest of the skeleton is moved by
     interpolating those displacements along the paths (the way an autohinter aligns stems, then
     interpolates the untouched points). Past its last anchor a path eases back to its source position
     over 2.5 pitches, and an isolated stroke (both ends free) is not moved at all, so tips and short
     strokes stay where the source has them.
  3. Serif flag. The Song serifs are dropped from the skeleton: the slanted start of a vertical and the
     bent tips of a horizontal are trimmed, and the beak (right end of a horizontal) and the shoulder
     (spur at a 横折 corner) each become one ornament dot, which vanishes at CNTR 0.
  4. Odd lattice. Columns sit on whole pitches 1 … 23, so the em's centre line (x = 12) is a column.
     Rows are unchanged (centres at j + ½, j = 0 … 23).

Source: Noto Serif CJK SC (Source Han Serif, OFL), whose stroke widths HAIR / THICK are calibrated for.
python3 cjk/proto2.py <NotoSerifCJKsc-Regular.otf> 永三的   → ASCII dot maps
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

N = 24
S = 768                     # raster px per em
P = S / N                   # 32 px per pitch
ASC = 0.875                 # em box −0.125 … 0.875, the same box as the font (−300 … 2100 at UPM 2400)
HAIR, THICK = 0.038, 0.058  # stroke-width thresholds for Noto Serif CJK SC (full width, em)
BALL_W = 0.074              # an endpoint this wide is a ball (a 点 drop, a 捺 foot)
ORN = 1.31
SPUR_MIN, SERIF_MAX = 0.45 * P, 2.0 * P   # spur length: below MIN noise, up to SERIF_MAX a serif
FONT = None
HERE = os.path.dirname(os.path.abspath(__file__))


def setup(font_path, cjk_dir=HERE, n=24):
    """Load the source face; n = dots per em (the proposal compares 16, 24 and 32; the design is 24)."""
    global FONT, radius, N, P, SPUR_MIN, SERIF_MAX, DECAY
    FONT = ImageFont.truetype(font_path, S)
    N, P = n, S / n
    SPUR_MIN, SERIF_MAX, DECAY = 0.45 * P, 2.0 * P, 2.5 * P
    sys.path.insert(0, os.path.join(cjk_dir, "..", "src"))
    from radii import radius as _r
    radius = _r


def rad(t, w, c, f=0.0):
    if t == ORN:
        return radius(1.3, w, c, f) * (c / 100) ** 1.5
    return radius(t, w, c, f)


def bitmap(ch):
    img = Image.new("L", (S, S), 0)
    ImageDraw.Draw(img).text((0, ASC * S), ch, font=FONT, fill=255, anchor="ls")
    return np.asarray(img) > 127


def dist(B):
    """Octagonal distance to the background (alternating 4/8-neighbour erosion), in px (as proto.py)."""
    D = np.zeros(B.shape, np.int32)
    cur = B.copy()
    k = 0
    while cur.any():
        k += 1
        D[cur] = k
        n = cur.copy()
        n[1:] &= cur[:-1]; n[:-1] &= cur[1:]; n[:, 1:] &= cur[:, :-1]; n[:, :-1] &= cur[:, 1:]
        if k % 2 == 0:
            n[1:, 1:] &= cur[:-1, :-1]; n[:-1, :-1] &= cur[1:, 1:]; n[1:, :-1] &= cur[:-1, 1:]; n[:-1, 1:] &= cur[1:, :-1]
        cur = n
    return D


# ── skeleton ───────────────────────────────────────────────────────────────────
def thin(B):
    """Zhang–Suen thinning, then removal of staircase corners, → a one-pixel 8-connected skeleton."""
    ys, xs = np.nonzero(B)
    if not len(ys):
        return B.copy()
    y0, y1, x0, x1 = max(ys.min() - 2, 0), ys.max() + 3, max(xs.min() - 2, 0), xs.max() + 3
    I = np.pad(B[y0:y1, x0:x1].astype(np.uint8), 1)
    while True:
        changed = False
        for step in (0, 1):
            C = I[1:-1, 1:-1]
            p2, p3, p4, p5 = I[:-2, 1:-1], I[:-2, 2:], I[1:-1, 2:], I[2:, 2:]
            p6, p7, p8, p9 = I[2:, 1:-1], I[2:, :-2], I[1:-1, :-2], I[:-2, :-2]
            nb = [p2, p3, p4, p5, p6, p7, p8, p9]
            Bn = sum(x.astype(np.int16) for x in nb)
            seq = nb + [p2]
            A = sum(((seq[k] == 0) & (seq[k + 1] == 1)).astype(np.int16) for k in range(8))
            if step == 0:
                m = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else:
                m = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            rem = (C == 1) & (Bn >= 2) & (Bn <= 6) & (A == 1) & m
            if rem.any():
                C[rem] = 0
                changed = True
        if not changed:
            break
    sk = I[1:-1, 1:-1].astype(bool)
    # staircase corners: a pixel with two 4-neighbours forming an L whose removal keeps 8-connectivity
    pts = list(zip(*np.nonzero(sk)))
    for y, x in pts:
        if not sk[y, x]:
            continue
        g = lambda dy, dx: bool(sk[y + dy, x + dx]) if 0 <= y + dy < sk.shape[0] and 0 <= x + dx < sk.shape[1] else False  # noqa: E731
        n, e, s, w = g(-1, 0), g(0, 1), g(1, 0), g(0, -1)
        if not ((n and e) or (e and s) or (s and w) or (w and n)):
            continue
        x2, x3, x4, x5, x6, x7, x8, x9 = n, g(-1, 1), e, g(1, 1), s, g(1, -1), w, g(-1, -1)
        nb = [x2, x3, x4, x5, x6, x7, x8, x9, x2, x3]
        inv = [not v for v in nb]
        nc8 = sum(inv[k] and not (inv[k] and inv[k + 1] and inv[k + 2]) for k in (0, 2, 4, 6))
        if nc8 == 1 and sum(nb[:8]) >= 2:
            sk[y, x] = False
    out = np.zeros_like(B)
    out[y0:y1, x0:x1] = sk
    return out


def graph(sk):
    """Trace the skeleton into nodes (endpoints, junction clusters) and edges (pixel paths between them)."""
    pts = set(zip(*[a.tolist() for a in np.nonzero(sk)]))

    def nbrs(p):
        y, x = p
        return [(y + a, x + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a or b) and (y + a, x + b) in pts]
    deg = {p: len(nbrs(p)) for p in pts}
    node = {p for p in pts if deg[p] != 2}
    cid, clusters = {}, []
    for p in node:
        if p in cid:
            continue
        cid[p] = len(clusters)
        comp, st = [], [p]
        while st:
            q = st.pop()
            comp.append(q)
            if deg[q] >= 3:
                for n in nbrs(q):
                    if n in node and deg[n] >= 3 and n not in cid:
                        cid[n] = cid[p]
                        st.append(n)
        clusters.append(comp)
    edges, seen, used = [], set(), set()
    for c, comp in enumerate(clusters):
        for p in comp:
            for n in nbrs(p):
                if n in node:
                    if cid[n] != c and frozenset((p, n)) not in used:
                        used.add(frozenset((p, n)))
                        edges.append(dict(px=[p, n], a=c, b=cid[n]))
                    continue
                if n in seen:
                    continue
                path, prev, cur = [p, n], p, n
                seen.add(n)
                while True:
                    nb = nbrs(cur)
                    nxt = nb[0] if nb[0] != prev else nb[1]
                    path.append(nxt)
                    if nxt in node:
                        break
                    if nxt in seen:            # closed back on itself
                        break
                    seen.add(nxt)
                    prev, cur = cur, nxt
                edges.append(dict(px=path, a=c, b=cid.get(path[-1], c)))
    for p in pts:                              # pure loops with no node on them
        if p in node or p in seen:
            continue
        path, prev, cur = [p], None, p
        seen.add(p)
        while True:
            nb = [q for q in nbrs(cur) if q != prev]
            nxt = next((q for q in nb if q not in seen), None)
            if nxt is None:
                path.append(p)
                break
            path.append(nxt)
            seen.add(nxt)
            prev, cur = cur, nxt
        c = len(clusters)
        clusters.append([p])
        edges.append(dict(px=path, a=c, b=c))
    kind = ["end" if len(comp) == 1 and deg[comp[0]] <= 1 else "junction" for comp in clusters]
    return clusters, kind, edges


def plen(px):
    return sum(math.hypot(a[0] - b[0], a[1] - b[1]) for a, b in zip(px, px[1:]))


def direction(px, from_start, span=None):
    """Unit (dy, dx) of the path leaving its start (from_start) or its end, over about `span` px."""
    span = P if span is None else span
    seq = px if from_start else px[::-1]
    k, acc = 1, 0.0
    while k < len(seq) - 1 and acc < span:
        acc += math.hypot(seq[k][0] - seq[k - 1][0], seq[k][1] - seq[k - 1][1])
        k += 1
    dy, dx = seq[k][0] - seq[0][0], seq[k][1] - seq[0][1]
    h = math.hypot(dy, dx) or 1
    return dy / h, dx / h


def trim_tails(kind, edges):
    """A free end that bends away from a straight stroke is the Song serif, not stroke: the slanted start of a
    vertical (dropped) and the bent tips of a horizontal (dropped; a beak is re-added by tone()). Hooks at the
    bottom of a vertical are kept."""
    for e in edges:
        if e["role"] != "stroke" or e["len"] < 3.5 * P:
            continue
        for at_start in (True, False):
            c = e["a"] if at_start else e["b"]
            if kind[c] != "end":
                continue
            seq = e["px"] if at_start else e["px"][::-1]
            acc = [0.0]
            for p, q in zip(seq, seq[1:]):
                acc.append(acc[-1] + math.hypot(p[0] - q[0], p[1] - q[1]))
            def at(d):
                return seq[min(range(len(seq)), key=lambda k: abs(acc[k] - d))]
            cut = None
            for L in np.arange(2.0 * P, 0.4 * P, -0.1 * P):
                if acc[-1] - L < 2.0 * P:
                    continue
                b, m = at(L), at(L + 1.6 * P)
                my, mx = b[0] - m[0], b[1] - m[1]            # main direction, pointing out of the stroke
                ty, tx = seq[0][0] - b[0], seq[0][1] - b[1]  # tail chord, pointing out
                hm, ht = math.hypot(my, mx) or 1, math.hypot(ty, tx) or 1
                my, mx, ty, tx = my / hm, mx / hm, ty / ht, tx / ht
                vertical, horizontal = abs(my) > .9, abs(mx) > .9
                if not (vertical or horizontal):
                    continue
                if vertical and my > 0:                      # bottom of a vertical: hooks live here
                    continue
                if my * ty + mx * tx < math.cos(math.radians(35)):
                    cut = L
                    break
            if cut is None:
                continue
            k = min(range(len(seq)), key=lambda q: abs(acc[q] - cut))
            if horizontal and mx > 0:
                e["beak"] = True                             # the right end of a horizontal lost its beak
            seq = seq[k:]
            e["px"] = seq if at_start else seq[::-1]
            e["len"] = plen(e["px"])
    return edges


def classify(clusters, kind, edges):
    """Mark spurs: serif (→ one ornament dot), noise (dropped) or continuation/real stroke (kept)."""
    for e in edges:
        e["len"] = plen(e["px"])
        e["role"] = "stroke"
        ea, eb = kind[e["a"]] == "end", kind[e["b"]] == "end"
        e["spur"] = (ea != eb) and e["len"] <= SERIF_MAX     # one end free, the other on a junction
        if e["spur"] and ea:                                  # orient: px[0] at the junction
            e["px"] = e["px"][::-1]
            e["a"], e["b"] = e["b"], e["a"]
    at = {}
    for k, e in enumerate(edges):
        for c in {e["a"], e["b"]}:
            at.setdefault(c, []).append(k)
    for c, ks in at.items():
        if kind[c] != "junction":
            continue
        spurs = [k for k in ks if edges[k]["spur"] and edges[k]["a"] == c]
        mains = [k for k in ks if k not in spurs]
        if not spurs:
            continue
        if len(mains) == 1:
            m = edges[mains[0]]
            dm = direction(m["px"], m["a"] == c)          # direction leaving the junction along the main
            want = (-dm[0], -dm[1])                       # a continuation leaves the other way
            best = max(spurs, key=lambda k: sum(a * b for a, b in zip(direction(edges[k]["px"], True), want)))
            if sum(a * b for a, b in zip(direction(edges[best]["px"], True), want)) > math.cos(math.radians(55)):
                edges[best]["role"] = "stroke"
                spurs = [k for k in spurs if k != best]
        elif not mains:                                   # a small star (a 点 with bumps): keep the longest
            best = max(spurs, key=lambda k: edges[k]["len"])
            spurs = [k for k in spurs if k != best]
        outs = [direction(edges[k]["px"], edges[k]["a"] == c) for k in mains]
        corner = any(dx < -.7 for dy, dx in outs) and any(dy > .7 for dy, dx in outs)   # a 横折: left + down
        for k in spurs:
            dy, dx = direction(edges[k]["px"], True)
            shoulder = corner and edges[k]["len"] >= SPUR_MIN and dx > .5 and dy < .3
            edges[k]["role"] = "serif" if shoulder else "noise"
    return edges


# ── lattice fitting ────────────────────────────────────────────────────────────
def uv(p):
    """raster pixel (y, x) → lattice coordinates (u from the left, v from the bottom), in pitches."""
    return (p[1] + .5) / P, (S - (p[0] + .5)) / P


def straight_runs(px, axis, min_len=None, tol=None):
    """Maximal straight horizontal (axis 0: constant y) or vertical (axis 1: constant x) runs on a path."""
    min_len = 2 * P if min_len is None else min_len
    tol = 0.42 * P if tol is None else tol
    a = np.array([q[0] if axis == 0 else q[1] for q in px], float)   # the coordinate that stays constant
    b = np.array([q[1] if axis == 0 else q[0] for q in px], float)
    runs, i = [], 0
    while i < len(px):
        j, lo, hi = i, a[i], a[i]
        while j + 1 < len(px) and max(hi, a[j + 1]) - min(lo, a[j + 1]) <= tol:
            j += 1
            lo, hi = min(lo, a[j]), max(hi, a[j])
        if abs(b[j] - b[i]) >= min_len:
            runs.append((i, j, float(np.median(a[i:j + 1])), min(b[i], b[j]), max(b[i], b[j])))
            i = j + 1
        else:
            i += 1
    return runs


def allocate(groups, lo, hi, gap=2):
    """groups: list of (coordinate c in lattice units, interval (s, t)). → integer lattice index per group,
    keeping order and a gap of `gap` between groups whose intervals overlap by more than half a pitch."""
    n = len(groups)
    if not n:
        return []
    cons = []
    order = sorted(range(n), key=lambda k: groups[k][0])
    for ia in range(n):
        for ib in range(ia + 1, n):
            a, b = order[ia], order[ib]
            (ca, (sa, ta)), (cb, (sb, tb)) = groups[a], groups[b]
            ov = min(ta, tb) - max(sa, sb)
            if ov > .5 and cb - ca < 6:
                cons.append((a, b, gap))
    x = np.array([g[0] for g in groups], float)
    for _ in range(400):
        moved = False
        for a, b, g in cons:
            d = g - (x[b] - x[a])
            if d > 1e-6:
                x[a] -= d / 2
                x[b] += d / 2
                moved = True
        x = np.clip(x, lo, hi)
        if not moved:
            break
    r = np.round(x).astype(int)
    for _ in range(3):                               # integer fix-up, bottom-up then top-down
        for a, b, g in sorted(cons, key=lambda c: x[c[0]]):
            if r[b] - r[a] < g:
                r[b] = r[a] + g
        r = np.minimum(r, hi)
        for a, b, g in sorted(cons, key=lambda c: -x[c[1]]):
            if r[b] - r[a] < g:
                r[a] = r[b] - g
        r = np.maximum(r, lo)
    return r.tolist()


def fit(edges, keep):
    """Per-pixel displacement (du, dv) in pitches. Anchored runs move exactly onto their row / column;
    other pixels interpolate along their path between anchored pixels and junctions; anything left uses
    a global interpolation of the anchor displacements."""
    disp = {0: {}, 1: {}}                            # axis 0: dv (rows, horizontals); axis 1: du (cols, verticals)
    anchors = {0: [], 1: []}
    for axis in (0, 1):
        runs = []
        for k in keep:
            for (i, j, c, s, t) in straight_runs(edges[k]["px"], axis):
                if axis == 0:
                    cl, sl, tl = (S - (c + .5)) / P, (s + .5) / P, (t + .5) / P      # v, u-range
                else:
                    cl, sl, tl = (c + .5) / P, (S - (t + .5)) / P, (S - (s + .5)) / P  # u, v-range
                runs.append(dict(k=k, i=i, j=j, c=cl, s=sl, t=tl))
        # group collinear pieces (a bar split by stems into several edges)
        parent = list(range(len(runs)))

        def find(a):
            while parent[a] != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a
        span = {a: (runs[a]["c"], runs[a]["c"]) for a in range(len(runs))}   # per root: lowest, highest c
        pairs = []
        for a in range(len(runs)):
            for b in range(a + 1, len(runs)):
                ra, rb = runs[a], runs[b]
                gap = max(ra["s"], rb["s"]) - min(ra["t"], rb["t"])
                if abs(ra["c"] - rb["c"]) < .45 and gap < 1.6:
                    pairs.append((abs(ra["c"] - rb["c"]), a, b))
        for _, a, b in sorted(pairs):             # merge only while the whole group stays within 0.45 pitch,
            fa, fb = find(a), find(b)             # so a gently sloped or curved stroke is not flattened
            if fa == fb:
                continue
            lo, hi = min(span[fa][0], span[fb][0]), max(span[fa][1], span[fb][1])
            if hi - lo < .45:
                parent[fa] = fb
                span[fb] = (lo, hi)
        gid = {}
        for a in range(len(runs)):
            gid.setdefault(find(a), []).append(a)
        groups, members = [], []
        for root, ms in gid.items():
            w = np.array([runs[m]["t"] - runs[m]["s"] for m in ms]) + 1e-6
            c = float(np.average([runs[m]["c"] for m in ms], weights=w))
            groups.append((c - .5 if axis == 0 else c, (min(runs[m]["s"] for m in ms), max(runs[m]["t"] for m in ms))))
            members.append(ms)
        idx = allocate(groups, 1, N - 2, 2) if axis == 0 else allocate(groups, 1, N - 1, 2)
        for g, ms in enumerate(members):
            target = idx[g] + .5 if axis == 0 else float(idx[g])
            for m in ms:
                r = runs[m]
                d = target - r["c"]
                anchors[axis].append((r["c"], d))
                for q in range(r["i"], r["j"] + 1):
                    disp[axis][(r["k"], q)] = d
    fallback = {}
    for axis in (0, 1):
        A = sorted(anchors[axis])
        if A:
            xs = np.array([a for a, _ in A]); ds = np.array([d for _, d in A])
            fallback[axis] = lambda c, xs=xs, ds=ds: float(np.interp(c, xs, ds))
        else:
            fallback[axis] = lambda c: 0.0
    return disp, fallback


DECAY = 2.5 * P             # past its last anchor, a path returns to its source position over this length


def displaced(edges, keep, disp, fallback, kind):
    """→ for each kept edge, list of (u', v') lattice coordinates per pixel."""
    # junction values: from anchored pixels within 0.8 pitch along any incident path
    jval = {0: {}, 1: {}}
    for axis in (0, 1):
        acc = {}
        for k in keep:
            px = edges[k]["px"]
            for end, c in ((0, edges[k]["a"]), (len(px) - 1, edges[k]["b"])):
                rng = range(len(px)) if end == 0 else range(len(px) - 1, -1, -1)
                walked = 0.0
                prev = None
                for q in rng:
                    if prev is not None:
                        walked += math.hypot(px[q][0] - px[prev][0], px[q][1] - px[prev][1])
                    if walked > .8 * P:
                        break
                    if (k, q) in disp[axis]:
                        acc.setdefault(c, []).append(disp[axis][(k, q)])
                        break
                    prev = q
        for c, v in acc.items():
            jval[axis][c] = float(np.mean(v))
    out = {}
    for k in keep:
        px = edges[k]["px"]
        U = np.array([uv(p)[0] for p in px]); V = np.array([uv(p)[1] for p in px])
        res = []
        for axis, coord in ((0, V), (1, U)):
            known = {}
            for q in range(len(px)):
                if (k, q) in disp[axis]:
                    known[q] = disp[axis][(k, q)]
            for q, c in ((0, edges[k]["a"]), (len(px) - 1, edges[k]["b"])):
                if q not in known and c in jval[axis]:
                    known[q] = jval[axis][c]
                elif q not in known and kind[c] == "junction" and len(px) > 2 * DECAY / P:
                    known[q] = 0.0                       # an unanchored junction stays where the source has it
            if known:
                qs = sorted(known)
                d = np.interp(np.arange(len(px)), qs, [known[q] for q in qs])
                arc = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(U), np.diff(V)))]) * P
                q0, q1 = qs[0], qs[-1]                   # free tails: the shift fades out instead of carrying on
                d[:q0] = known[q0] * np.clip(1 - (arc[q0] - arc[:q0]) / DECAY, 0, 1)
                d[q1 + 1:] = known[q1] * np.clip(1 - (arc[q1 + 1:] - arc[q1]) / DECAY, 0, 1)
            elif kind[edges[k]["a"]] == "end" and kind[edges[k]["b"]] == "end":
                d = np.zeros(len(px))                    # an isolated stroke (a 撇 of 彡, a 点) keeps its place
            else:
                d = np.array([fallback[axis](c) for c in coord])
            res.append(coord + d)
        Vd, Ud = res
        out[k] = list(zip(Ud.tolist(), np.clip(Vd, 0.01, N - 0.01).tolist()))
    return out


def cells(path_uv):
    """Lattice cells along a displaced path: one per step, gaps bridged, staircase corners removed."""
    seq = []
    for u, v in path_uv:
        c = (int(round(min(max(u, 1), N - 1))), int(math.floor(v)))
        if not seq or seq[-1] != c:
            if seq:
                (i0, j0), (i1, j1) = seq[-1], c
                steps = max(abs(i1 - i0), abs(j1 - j0))
                for s in range(1, steps):                 # bridge a jump left by the warp
                    seq.append((round(i0 + (i1 - i0) * s / steps), round(j0 + (j1 - j0) * s / steps)))
            if c not in seq[-2:]:
                seq.append(c)
    out = []
    for c in seq:
        out.append(c)
        while len(out) >= 3:
            a, b, d = out[-3], out[-2], out[-1]
            if max(abs(a[0] - d[0]), abs(a[1] - d[1])) <= 1 and a != d:
                out.pop(-2)                               # b is a corner of a staircase
            else:
                break
    return out


def dots(ch):
    """→ list of (col i, row j, tone); column centre u = i (1 … 23), row centre v = j + ½."""
    B = bitmap(ch)
    if not B.any():
        return []
    D = dist(B)
    sk = thin(B)
    clusters, kind, edges = graph(sk)
    classify(clusters, kind, edges)
    trim_tails(kind, edges)
    keep = [k for k, e in enumerate(edges) if e["role"] == "stroke"]
    disp, fallback = fit(edges, keep)
    puv = displaced(edges, keep, disp, fallback, kind)
    tone = {}
    width = lambda p: 2 * D[p] / S  # noqa: E731

    def put(c, t):
        if c not in tone or (t != ORN and (tone[c] == ORN or t > tone[c])):
            tone[c] = t
    cell_of = {}
    for k in keep:
        px = edges[k]["px"]
        cs = cells(puv[k])
        # widths: pixels whose cell is c
        per = {}
        for p, (u, v) in zip(px, puv[k]):
            per.setdefault((int(round(min(max(u, 1), N - 1))), int(math.floor(v))), []).append(width(p))
        for c in cs:
            w = float(np.median(per[c])) if c in per else min(width(p) for p in px)
            put(c, 1.0 if w >= THICK else 0.5 if w >= HAIR else 0.0)
        cell_of[k] = cs
        if not cs:
            continue
        cw = {c: (float(np.max(per[c])) if c in per else 0.0) for c in cs}
        runs = straight_runs(px, 0, min_len=3 * P)
        for end_c, tip in ((edges[k]["a"], cs[:3]), (edges[k]["b"], cs[-3:][::-1])):
            if kind[end_c] != "end":
                continue
            right_end = runs and tip[0][0] >= max(c[0] for c in cs) - 1 and tip[0][0] > min(c[0] for c in cs) + 2
            med = float(np.median([cw[c] for c in cs]))
            hair = runs and med < THICK
            if right_end and hair:                                   # a beak on a horizontal
                heavy = [c for c in tip if cw[c] >= max(THICK, 1.5 * med)]
                if not heavy and edges[k].get("beak"):
                    heavy = [tip[0]]
                if heavy:
                    j0 = int(np.median([c[1] for c in cs]))
                    for c in heavy:
                        tone[c] = 0.0
                    i = max(c[0] for c in heavy)
                    for c in tip:
                        if c[1] != j0:
                            tone.pop(c, None)
                    if (i, j0) not in tone:
                        tone[(i, j0)] = 0.0
                    tone[(i, j0 + 1)] = ORN
                continue
            other = cs[-1] if tip[0] == cs[0] else cs[0]
            lower = tip[0][1] < other[1] - 1                     # balls sit at the lower end (捺 foot, 点)
            best = max(tip, key=lambda c: cw[c])
            if lower and cw[best] >= BALL_W and cw[best] >= 1.15 * np.median(list(cw.values())):
                tone[best] = 1.3
    # an isolated short stroke with two free ends is a 点: one ball at its widest place, tapering away
    parent = {}

    def find(a):
        parent.setdefault(a, a)
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for k in keep:
        parent[find(edges[k]["a"])] = find(edges[k]["b"])
    comps = {}
    for k in keep:
        comps.setdefault(find(edges[k]["a"]), []).append(k)
    for ks in comps.values():
        if len(ks) != 1:
            continue
        e = edges[ks[0]]
        if kind[e["a"]] != "end" or kind[e["b"]] != "end" or e["len"] > 10 * P:
            continue
        cs = cell_of[ks[0]]
        if len(cs) < 2:
            continue
        px = e["px"]
        ws = [width(p) for p in px]
        if max(ws) < THICK or max(ws) < 1.15 * float(np.median(ws)):
            continue
        q = int(np.argmax(ws))
        u, v = puv[ks[0]][q]
        ball = min(cs, key=lambda c: (c[0] - u) ** 2 + (c[1] + .5 - v) ** 2)
        b = cs.index(ball)
        short, long_ = (cs[b + 1:], cs[:b][::-1]) if b >= len(cs) - 1 - b else (cs[:b][::-1], cs[b + 1:])
        for c in short[1:]:
            tone.pop(c, None)
        if short:
            tone[short[0]] = 0.5
        tone[ball] = 1.3
        if long_:
            tone[long_[0]] = min(tone.get(long_[0], 0.5), 1.0)
    # serifs → one ornament dot next to where the spur leaves the stroke
    for e in edges:
        if e["role"] != "serif":
            continue
        base = e["px"][0]
        # where did the junction land? nearest displaced pixel of a kept edge to the base pixel
        best, bd = None, 1e9
        for k in keep:
            for p, q in zip(edges[k]["px"], puv[k]):
                d = (p[0] - base[0]) ** 2 + (p[1] - base[1]) ** 2
                if d < bd:
                    best, bd = q, d
        if best is None:
            continue
        u0, v0 = best
        bu, bv = uv(base); tu, tv = uv(e["px"][-1])
        du, dv = tu - bu, tv - bv
        h = math.hypot(du, dv) or 1
        step = (int(round(du / h)), int(round(dv / h)))
        if step == (0, 0):
            continue
        c0 = (int(round(min(max(u0, 1), N - 1))), int(math.floor(v0)))
        c = (c0[0] + step[0], c0[1] + step[1])
        if c in tone and tone[c] != ORN:
            c = (c[0] + step[0], c[1] + step[1])
        if 1 <= c[0] <= N - 1 and 0 <= c[1] < N and c not in tone:
            tone[c] = ORN
    return [(i, j, t) for (i, j), t in tone.items()]


SYM = {0.0: "-", 0.5: "+", 1.0: "#", 1.3: "O", ORN: "^"}


def ascii_map(ds, odd=True):
    on = {(i, j): t for i, j, t in ds}
    cols = range(1, N) if odd else range(N)
    return ["".join(SYM[on[(i, j)]] if (i, j) in on else "." for i in cols) for j in range(N - 1, -1, -1)]


if __name__ == "__main__":
    setup(sys.argv[1])
    for ch in sys.argv[2]:
        print(ch)
        print("\n".join(ascii_map(dots(ch))))
