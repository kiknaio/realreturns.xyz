/*
 * Relic: a plaster coin that erodes into crystal.
 * The share of the coin face that is crystal equals the share of purchasing power
 * that inflation took. The geometry is seeded, so the same coin erodes the same way
 * every time, and more erosion only adds to what was already gone.
 *
 * Needs d3-delaunay (global `d3`) for the crystal facets.
 */
(function () {
    'use strict';

    const SEED = 1928;
    const GRID = 110;        // erosion cells across the coin diameter
    const FACETS = 320;      // crystal facets on the full face
    const CRACK_SHAPES = 40;
    const ERODE_DIR = norm(0.78, -0.62);   // erosion starts at the upper right
    const LIGHT = -Math.PI * 0.75;          // light comes from the upper left

    const THEMES = {
        light: {
            body0: '#faf9f5', body1: '#d3d0c7', bodyMid: '#e7e5df',
            rimHi: 'rgba(255,255,255,0.95)', rimLo: 'rgba(60,52,40,0.22)',
            engraveHi: 'rgba(255,255,255,0.9)', engraveLo: 'rgba(60,52,40,0.22)',
            wall: '#a8a398', shadow: 'rgba(55,45,30,0.24)', crack: 'rgba(70,62,50,0.38)', pore: 'rgba(70,62,50,0.10)',
            grain: 0.10,
            crystal: ['#164e70', '#4f9fca', '#dcf2fb'],
        },
        dark: {
            body0: '#5d5b56', body1: '#272624', bodyMid: '#3f3d3a',
            rimHi: 'rgba(255,255,255,0.22)', rimLo: 'rgba(0,0,0,0.55)',
            engraveHi: 'rgba(255,255,255,0.16)', engraveLo: 'rgba(0,0,0,0.5)',
            wall: '#141413', shadow: 'rgba(0,0,0,0.6)', crack: 'rgba(0,0,0,0.55)', pore: 'rgba(0,0,0,0.2)',
            grain: 0.14,
            crystal: ['#123f5a', '#3f9ccb', '#d2f0fc'],
        },
    };

    function norm(x, y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }

    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function makeFbm(rand) {
        const P = 64;
        const g = new Float32Array(P * P).map(() => rand());
        const at = (x, y) => g[(((y % P) + P) % P) * P + (((x % P) + P) % P)];
        const s = t => t * t * (3 - 2 * t);
        const value = (x, y) => {
            const xi = Math.floor(x), yi = Math.floor(y), u = s(x - xi), v = s(y - yi);
            const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
            return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
        };
        return (x, y) => {
            let sum = 0, amp = 0.5, f = 1;
            for (let o = 0; o < 5; o++) { sum += amp * value(x * f, y * f); amp *= 0.5; f *= 2.03; }
            return sum;
        };
    }

    function hexRgb(h) { const p = parseInt(h.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; }
    function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
    function rgb(c, a = 1) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
    // Three-stop ramp: deep -> mid -> light.
    function ramp(stops, t) {
        t = Math.max(0, Math.min(1, t));
        return t < 0.5 ? mix(stops[0], stops[1], t * 2) : mix(stops[1], stops[2], (t - 0.5) * 2);
    }

    // ---------- Seeded geometry (unit disk, radius 1) ----------
    const rand = mulberry32(SEED);
    const fbm = makeFbm(rand);

    const cells = [];
    for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
            const u = ((i + 0.5) / GRID) * 2 - 1, v = ((j + 0.5) / GRID) * 2 - 1;
            const r = Math.hypot(u, v);
            if (r > 0.985) continue;
            const f = 0.62 * fbm((u + 1) * 2.1, (v + 1) * 2.1)
                + 0.34 * (u * ERODE_DIR.x + v * ERODE_DIR.y)
                + 0.22 * Math.pow(r, 4)
                + 0.04 * rand();
            // Jitter position and size so the eroded edge looks broken, not gridded.
            const step = 2 / GRID;
            cells.push({ u: u + (rand() - 0.5) * step * 0.9, v: v + (rand() - 0.5) * step * 0.9, f, s: 0.75 + rand() * 0.5 });
        }
    }
    // Most eroded first: erosion e uses the first round(e * n) cells.
    cells.sort((a, b) => b.f - a.f);

    const cracks = [];
    for (let c = 0; c < CRACK_SHAPES; c++) {
        const pts = [[0, 0]];
        let ang = Math.atan2(-ERODE_DIR.y, -ERODE_DIR.x) + (rand() - 0.5) * 2.4;
        const steps = 5 + Math.floor(rand() * 5);
        const len = 0.012 + rand() * 0.018;
        for (let s = 0; s < steps; s++) {
            ang += (rand() - 0.5) * 0.9;
            const [x, y] = pts[pts.length - 1];
            pts.push([x + Math.cos(ang) * len, y + Math.sin(ang) * len]);
        }
        cracks.push(pts);
    }

    let facets = null;
    function buildFacets() {
        if (facets || !window.d3?.Delaunay) return facets;
        const pts = [];
        for (let k = 0; k < FACETS; k++) {
            // Smaller facets toward the upper right, where erosion starts.
            const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 1.02;
            pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        const vor = window.d3.Delaunay.from(pts).voronoi([-1.05, -1.05, 1.05, 1.05]);
        facets = pts.map((p, k) => ({
            poly: vor.cellPolygon(k),
            angle: rand() * Math.PI * 2,
            tone: rand(),
            sparkle: rand() < 0.07,
        })).filter(f => f.poly);
        return facets;
    }

    // ---------- Cached layers per size, theme and label ----------
    const cache = new Map();
    let grainPattern = null;

    function canvas(size) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        return c;
    }

    function grain(ctx) {
        if (!grainPattern) {
            const g = canvas(160), gc = g.getContext('2d');
            const img = gc.createImageData(160, 160);
            const r = mulberry32(SEED + 1);
            for (let p = 0; p < img.data.length; p += 4) {
                const v = 90 + r() * 165;
                img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
                img.data[p + 3] = 255;
            }
            gc.putImageData(img, 0, 0);
            grainPattern = g;
        }
        return ctx.createPattern(grainPattern, 'repeat');
    }

    function geometry(S) {
        return { S, cx: S / 2, cy: S * 0.47, R: S * 0.4, unit: S / 400 };
    }

    function engrave(ctx, t, draw, e) {
        ctx.save();
        ctx.fillStyle = t.engraveHi; ctx.translate(e, e); draw(); ctx.translate(-e, -e);
        ctx.fillStyle = t.engraveLo; ctx.translate(-e, -e); draw(); ctx.translate(e, e);
        ctx.fillStyle = t.bodyMid; draw();
        ctx.restore();
    }

    function buildCoin(S, theme, label) {
        const t = THEMES[theme];
        const { cx, cy, R, unit } = geometry(S);
        const c = canvas(S), ctx = c.getContext('2d');

        // Body with a soft cast shadow.
        ctx.save();
        ctx.shadowColor = t.shadow;
        ctx.shadowBlur = R * 0.22;
        ctx.shadowOffsetX = R * 0.04;
        ctx.shadowOffsetY = R * 0.09;
        const body = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.05, cx, cy, R * 1.2);
        body.addColorStop(0, t.body0);
        body.addColorStop(1, t.body1);
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

        // Raised rim: lit at the upper left, in shade at the lower right.
        const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
        rim.addColorStop(0, t.rimHi);
        rim.addColorStop(1, t.rimLo);
        ctx.strokeStyle = rim;
        ctx.lineWidth = R * 0.07;
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.965, 0, Math.PI * 2); ctx.stroke();
        const step = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
        step.addColorStop(0, t.rimLo);
        step.addColorStop(1, t.rimHi);
        ctx.strokeStyle = step;
        ctx.lineWidth = unit * 1.6;
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.925, 0, Math.PI * 2); ctx.stroke();

        // Incised dollar sign.
        ctx.font = `600 ${R * 1.06}px "Inter Tight", Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        engrave(ctx, t, () => ctx.fillText('$', cx, cy + R * 0.05), unit * 1.8);

        // Text around the rim.
        const text = `PURCHASING POWER · ONE DOLLAR · ${label} · `;
        ctx.font = `500 ${R * 0.072}px "IBM Plex Mono", ui-monospace, monospace`;
        const ring = R * 0.8;
        const chars = [...text];
        const total = chars.reduce((w, ch) => w + ctx.measureText(ch).width, 0);
        const scale = (Math.PI * 2 * ring) / total;
        let a = -Math.PI / 2;
        for (const ch of chars) {
            const w = ctx.measureText(ch).width * scale;
            const mid = a + w / 2 / ring;
            ctx.save();
            ctx.translate(cx + Math.cos(mid) * ring, cy + Math.sin(mid) * ring);
            ctx.rotate(mid + Math.PI / 2);
            engrave(ctx, t, () => ctx.fillText(ch, 0, 0), unit * 0.8);
            ctx.restore();
            a += w / ring;
        }

        // Plaster pores and grain.
        const r = mulberry32(SEED + 2);
        ctx.fillStyle = t.pore;
        for (let p = 0; p < 260; p++) {
            const ang = r() * Math.PI * 2, d = Math.sqrt(r()) * R;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, unit * (0.4 + r() * 1.1), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = t.grain;
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = grain(ctx);
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        ctx.restore();
        return c;
    }

    function buildCrystal(S, theme) {
        const t = THEMES[theme];
        const { cx, cy, R, unit } = geometry(S);
        const c = canvas(S), ctx = c.getContext('2d');
        const stops = t.crystal.map(hexRgb);
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.995, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = t.crystal[0];
        ctx.fillRect(0, 0, S, S);

        const list = buildFacets();
        if (!list) { ctx.restore(); return c; }
        const sparkles = [];
        for (const f of list) {
            const poly = f.poly.map(([x, y]) => [cx + x * R, cy + y * R]);
            let mx = 0, my = 0;
            for (const [x, y] of poly) { mx += x; my += y; }
            mx /= poly.length; my /= poly.length;
            const lit = 0.5 + 0.42 * Math.cos(f.angle - LIGHT) + (f.tone - 0.5) * 0.2;
            const span = R * 0.12;
            const g = ctx.createLinearGradient(
                mx - Math.cos(f.angle) * span, my - Math.sin(f.angle) * span,
                mx + Math.cos(f.angle) * span, my + Math.sin(f.angle) * span);
            g.addColorStop(0, rgb(ramp(stops, lit + 0.2)));
            g.addColorStop(1, rgb(ramp(stops, lit - 0.22)));
            ctx.fillStyle = g;
            ctx.beginPath();
            poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${0.25 + f.tone * 0.4})`;
            ctx.lineWidth = unit * 0.7;
            ctx.stroke();
            if (f.sparkle) sparkles.push(poly[Math.floor(f.tone * poly.length) % poly.length]);
        }
        for (const [x, y] of sparkles) {
            const glow = ctx.createRadialGradient(x, y, 0, x, y, unit * 7);
            glow.addColorStop(0, 'rgba(255,255,255,0.85)');
            glow.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(x - unit * 7, y - unit * 7, unit * 14, unit * 14);
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = unit * 0.6;
            ctx.beginPath();
            ctx.moveTo(x - unit * 5, y); ctx.lineTo(x + unit * 5, y);
            ctx.moveTo(x, y - unit * 5); ctx.lineTo(x, y + unit * 5);
            ctx.stroke();
        }
        ctx.restore();
        return c;
    }

    function layers(S, theme, label) {
        const key = `${S}|${theme}|${label}`;
        let l = cache.get(key);
        if (!l) {
            if (cache.size > 6) cache.clear();
            l = { coin: buildCoin(S, theme, label), crystal: buildCrystal(S, theme), work: canvas(S) };
            cache.set(key, l);
        }
        return l;
    }

    function cellPath(ctx, g, k, radius, dx, dy) {
        const { cx, cy, R } = g;
        ctx.beginPath();
        for (let i = 0; i < k; i++) {
            const c = cells[i];
            const x = cx + c.u * R + dx, y = cy + c.v * R + dy, r = radius * c.s;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
        }
    }

    // Paints the relic into a square region of `ctx` (device pixels).
    function paintTo(ctx, x, y, S, { erosion = 0, theme = 'light', label = '' } = {}) {
        S = Math.round(S);
        const g = geometry(S);
        const l = layers(S, theme, label);
        const t = THEMES[theme];
        const k = Math.round(Math.max(0, Math.min(1, erosion)) * cells.length);
        const cell = (2 * g.R) / GRID;

        ctx.save();
        ctx.translate(x, y);
        ctx.drawImage(l.coin, 0, 0);
        if (k > 0) {
            ctx.save();
            ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R * 0.997, 0, Math.PI * 2); ctx.clip();

            // Hairline cracks that run from the eroded edge into the solid plaster.
            const frontier = Math.max(1, Math.ceil(cells.length * 0.05));
            ctx.strokeStyle = t.crack;
            ctx.lineWidth = g.unit * 0.8;
            ctx.lineJoin = 'round';
            for (let n = 0; n < 9; n++) {
                const i = k - 1 - Math.floor((n / 9) * Math.min(frontier, k));
                if (i < 0) break;
                const shape = cracks[(i * 7) % CRACK_SHAPES];
                const ox = g.cx + cells[i].u * g.R, oy = g.cy + cells[i].v * g.R;
                ctx.beginPath();
                shape.forEach(([px, py], s) => {
                    const X = ox + px * g.R, Y = oy + py * g.R;
                    s ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
                });
                ctx.stroke();
            }

            // Cavity wall, then the crystal set slightly down and right so the wall shows.
            cellPath(ctx, g, k, cell * 1.0, 0, 0);
            ctx.fillStyle = t.wall;
            ctx.fill();

            const w = l.work, wc = w.getContext('2d');
            wc.globalCompositeOperation = 'source-over';
            wc.clearRect(0, 0, S, S);
            wc.drawImage(l.crystal, 0, 0);
            wc.globalCompositeOperation = 'destination-in';
            cellPath(wc, g, k, cell * 0.82, g.unit * 1.1, g.unit * 1.5);
            wc.fillStyle = '#000';
            wc.fill();
            wc.globalCompositeOperation = 'source-over';
            ctx.drawImage(w, 0, 0);
            ctx.restore();
        }
        ctx.restore();
    }

    function paint(cv, opts) {
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        paintTo(ctx, 0, 0, Math.min(cv.width, cv.height), opts);
    }

    window.Relic = {
        paint,
        paintTo,
        // Call after web fonts load, so the engraving uses the right typeface.
        reset() { cache.clear(); },
    };
})();
