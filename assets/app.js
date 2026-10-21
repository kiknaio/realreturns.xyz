(() => {
    'use strict';

    // ---------- Constants ----------
    const DEFAULTS = { from: 2005, to: 2025, amount: 10000 };

    // Each asset keeps its color everywhere (color follows the asset, not its rank).
    const ASSETS = [
        { key: 'sp500', name: 'S&P 500', note: '500 large US companies, dividends reinvested', color: '--series-1', img: 'sp500' },
        { key: 'gold', name: 'Gold', note: 'Gold price. Fixed by law until 1971', color: '--series-4', img: 'gold' },
        { key: 'baa', name: 'Corporate bonds', note: 'Bonds of US companies (Baa rated)', color: '--series-6', img: 'bonds' },
        { key: 'tbond', name: '10-year Treasury', note: 'US government bonds', color: '--series-2', img: 'treasury' },
        { key: 'realEstate', name: 'US homes', note: 'Home prices only, no rent or costs', color: '--series-5', img: 'homes' },
        { key: 'tbill', name: 'Savings', note: '3-month Treasury bills, like a savings account', color: '--series-3', img: 'savings' },
        { key: 'cash', name: 'Cash', note: 'Dollar bills that earn nothing', color: '--neutral-series', img: 'cash' },
    ];

    const INFO = {
        sp500: {
            lede: 'A share of the 500 largest US companies, in one fund.',
            what: 'The S&P 500 follows about 500 large US companies, such as Apple, Microsoft and Nvidia. Bigger companies count for more. The returns here include dividends, put back in.',
            own: 'Most people buy a low-cost S&P 500 index fund or ETF through a broker or a retirement account. Large funds charge less than 0.1% a year.',
            inflation: 'Companies can raise their prices and grow their profits when prices rise. That is why stocks have beaten inflation over long periods, but not in every decade.',
            risk: 'Big, fast falls. The index lost more than a third of its value in 1931 and again in 2008, and buying power can take many years to come back.',
        },
        gold: {
            lede: 'A metal that people have used to store value for thousands of years.',
            what: 'The price of gold in dollars. Gold pays no interest and no dividends, so its return is only the change in its price.',
            own: 'Bars and coins, or a gold ETF that holds metal in a vault. Bars and coins cost extra to buy, store and insure.',
            inflation: 'Gold is often called a hedge against inflation. Over very long periods it kept up, but with long gaps: after its 1980 high, its buying power fell by more than three quarters and only came back in 2011.',
            risk: 'Large price swings, with no income to soften them.',
            note: 'Until 1971 the US government fixed the price of gold, so the early years change very little.',
        },
        baa: {
            lede: 'Loans to US companies that pay you interest.',
            what: 'A bond is a loan. The company pays interest every year and pays the loan back at the end. Baa is the lowest “investment grade” rating: solid companies, but not the safest.',
            own: 'Usually through a corporate bond fund or ETF, which holds hundreds of bonds at once.',
            inflation: 'Company bonds pay more interest than government bonds, to make up for the extra risk. That extra has kept them ahead of inflation over the long run.',
            risk: 'A company can fail to pay. Bond prices also fall when interest rates rise, as they did in 2022.',
        },
        tbond: {
            lede: 'A 10-year loan to the US government.',
            what: 'The US Treasury borrows money for 10 years at a fixed interest rate. The return here includes the interest and the change in the bond’s price.',
            own: 'Through a broker, TreasuryDirect, or a Treasury bond fund.',
            inflation: 'The interest is fixed, so surprise inflation hurts. In the 1970s and in 2022, Treasury bonds lost a lot of buying power. TIPS are Treasury bonds that adjust for inflation.',
            risk: 'Almost no risk that the US does not pay. But prices fall when interest rates rise, and fixed payments buy less when inflation is high.',
        },
        realEstate: {
            lede: 'The price of a typical US home.',
            what: 'A national index of US home prices. It shows only the change in price: no rent, repairs, property tax or mortgage.',
            own: 'By buying a home. Real estate funds (REITs) own buildings too, but they behave more like stocks.',
            inflation: 'Home prices have stayed a little ahead of inflation over the long run. Owners also get a place to live, which this number does not count.',
            risk: 'Prices can fall, as they did from 2007 to 2011. Homes are slow and costly to buy and sell.',
        },
        tbill: {
            lede: 'Very short loans to the US government. Close to a savings account.',
            what: '3-month US Treasury bills. Their interest rate is close to what a high-yield savings account or a money market fund pays.',
            own: 'A money market fund, a T-bill ETF, TreasuryDirect, or a high-yield savings account.',
            inflation: 'The rate follows the Federal Reserve’s rate. When it is below inflation, as in most years from 2009 to 2022, savings lose buying power.',
            risk: 'The value almost never falls, but buying power can shrink slowly for years.',
        },
        cash: {
            lede: 'Dollar bills that earn nothing.',
            what: 'Money in a drawer, or in an account that pays no interest. The number of dollars never changes.',
            own: 'Everyone has some. It is useful for daily spending and emergencies.',
            inflation: 'Cash loses exactly the inflation rate. Prices rise, so each dollar buys a little less every year.',
            risk: 'No risk of a market crash, but a sure, slow loss of buying power.',
        },
    };

    // ---------- Helpers ----------
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const MINUS = '−';

    const money = v => (v < 0 ? MINUS : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
    const moneyShort = v => {
        const a = Math.abs(v);
        if (a >= 1e9) return '$' + +(v / 1e9).toFixed(1) + 'B';
        if (a >= 1e6) return '$' + +(v / 1e6).toFixed(1) + 'M';
        if (a >= 1e3) return '$' + +(v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K';
        return '$' + Math.round(v);
    };
    const pct = (v, digits = 1, signed = true) => {
        const abs = Math.abs(v * 100).toFixed(digits);
        if (abs === (0).toFixed(digits)) return abs + '%';
        return (v < 0 ? MINUS : signed ? '+' : '') + abs + '%';
    };

    const el = (tag, attrs = {}, children = []) => {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'class') node.className = v;
            else if (k === 'text') node.textContent = v;
            else if (k === 'style') Object.assign(node.style, v);
            else node.setAttribute(k, v);
        }
        for (const c of [].concat(children)) if (c != null) node.append(c);
        return node;
    };

    function withAlpha(hex, a) {
        const p = parseInt(hex.slice(1), 16);
        return `rgba(${(p >> 16) & 255}, ${(p >> 8) & 255}, ${p & 255}, ${a})`;
    }

    let toastTimer;
    function toast(msg) {
        const t = $('#toast');
        t.textContent = msg;
        t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.hidden = true; }, 2000);
    }

    // False during the first render: a reload shows the final state, not an animation.
    let animate = false;
    const motion = () => animate && !reducedMotion();

    // ---------- State (kept in the URL so every view can be shared) ----------
    let D = null;
    const state = { ...DEFAULTS };

    function readUrl() {
        const p = new URLSearchParams(location.search);
        const num = (k, lo, hi) => {
            if (!p.has(k)) return;
            const v = Number(p.get(k));
            if (Number.isFinite(v)) state[k] = clamp(Math.round(v), lo, hi);
        };
        num('from', D.firstYear, D.lastYear);
        num('to', D.firstYear, D.lastYear);
        num('amount', 1, 1e12);
        if (state.from > state.to) [state.from, state.to] = [state.to, state.from];
    }

    function writeUrl() {
        const p = new URLSearchParams();
        for (const k of Object.keys(DEFAULTS)) if (state[k] !== DEFAULTS[k]) p.set(k, state[k]);
        const q = p.toString();
        history.replaceState(null, '', (q ? `?${q}` : location.pathname) + location.hash);
    }

    // ---------- Math ----------
    const idx = y => y - D.firstYear;
    const yearReturn = (key, y) => (key === 'cash' ? 0 : D[key][idx(y)]);

    // Buying power of `amount` over the period, in start-year dollars.
    function calc(key, { from, to, amount }) {
        let nominal = amount, cpi = 1;
        const path = [{ x: from, y: amount }];
        for (let y = from; y <= to; y++) {
            nominal *= 1 + yearReturn(key, y);
            cpi *= 1 + D.inflation[idx(y)];
            path.push({ x: y + 1, y: nominal / cpi });
        }
        const real = nominal / cpi;
        const n = to - from + 1;
        return { nominal, real, cpi, path, perYear: Math.pow(real / amount, 1 / n) - 1, lost: Math.max(0, 1 - real / amount) };
    }

    // Current color theme: the toggle's choice, or the system setting.
    function theme() {
        const t = document.documentElement.dataset.theme;
        if (t) return t;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    // ---------- Logo fire ----------
    // Small flames rise from the charred edge of the logo bill. The emitters are the dark pixels
    // that touch transparency on the burned (right) side of the logo image.
    function startLogoFire() {
        const img = $('.brand-mark'), cv = $('#logoFire');
        if (!img || !cv || reducedMotion()) return;
        const ready = img.complete && img.naturalWidth ? Promise.resolve() : new Promise(r => img.addEventListener('load', r, { once: true }));
        ready.then(() => {
            const W = img.naturalWidth, H = img.naturalHeight;
            const probe = document.createElement('canvas');
            probe.width = W; probe.height = H;
            const pctx = probe.getContext('2d', { willReadFrequently: true });
            pctx.drawImage(img, 0, 0);
            const d = pctx.getImageData(0, 0, W, H).data;
            const alpha = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3]);
            const edge = [];
            for (let y = 0; y < H; y++) {
                for (let x = Math.floor(W * 0.35); x < W; x++) {
                    const i = (y * W + x) * 4;
                    if (d[i + 3] < 120 || d[i] + d[i + 1] + d[i + 2] > 330) continue;   // only opaque, charred pixels
                    if (alpha(x + 1, y) < 20 || alpha(x, y - 1) < 20 || alpha(x, y + 1) < 20 || alpha(x - 1, y) < 20) edge.push([x, y]);
                }
            }
            if (!edge.length) return;

            const ctx = cv.getContext('2d');
            let map = null;
            const layout = () => {
                const dpr = Math.min(2, window.devicePixelRatio || 1);
                const cr = cv.getBoundingClientRect(), ir = img.getBoundingClientRect();
                cv.width = Math.round(cr.width * dpr);
                cv.height = Math.round(cr.height * dpr);
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                const k = ir.width / W;
                map = ([x, y]) => [ir.left - cr.left + x * k, ir.top - cr.top + y * k];
            };
            layout();
            window.addEventListener('resize', layout);

            const sparks = [], smoke = [];
            const rand = (a, b) => a + Math.random() * (b - a);
            const tick = () => {
                const cr = cv.getBoundingClientRect();
                const dark = theme() === 'dark';
                ctx.clearRect(0, 0, cr.width, cr.height);
                // New flames from random points on the burned edge.
                for (let n = 0; n < 4; n++) {
                    const [x, y] = map(edge[(Math.random() * edge.length) | 0]);
                    sparks.push({ x, y, vx: rand(-0.1, 0.1), vy: rand(-0.8, -0.35), r: rand(1.1, 2.4), age: 0, life: rand(22, 44), seed: Math.random() * 6 });
                }

                // Smoke: faint gray wisps that rise slowly above the flames.
                ctx.globalCompositeOperation = 'source-over';
                for (let i = smoke.length - 1; i >= 0; i--) {
                    const s = smoke[i];
                    s.age++;
                    if (s.age > s.life) { smoke.splice(i, 1); continue; }
                    const t = s.age / s.life;
                    s.x += Math.sin(s.age * 0.08 + s.seed) * 0.15;
                    s.y += s.vy;
                    ctx.fillStyle = dark ? `rgba(200, 190, 180, ${0.1 * (1 - t)})` : `rgba(90, 80, 70, ${0.13 * (1 - t)})`;
                    ctx.beginPath(); ctx.arc(s.x, s.y, 1.2 + t * 3.5, 0, Math.PI * 2); ctx.fill();
                }

                // Flames: tall teardrops, yellow core, orange middle, red tips. Additive glow only on dark.
                ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
                for (let i = sparks.length - 1; i >= 0; i--) {
                    const s = sparks[i];
                    s.age++;
                    if (s.age > s.life) {
                        if (Math.random() < 0.35) smoke.push({ x: s.x, y: s.y, vy: rand(-0.35, -0.2), age: 0, life: rand(40, 70), seed: Math.random() * 6 });
                        sparks.splice(i, 1);
                        continue;
                    }
                    const t = s.age / s.life;
                    s.x += s.vx + Math.sin(s.age * 0.3 + s.seed) * 0.14;
                    s.y += s.vy;
                    const r = s.r * (1 - t * 0.7);
                    const a = (1 - t) * (t < 0.12 ? t / 0.12 : 1);
                    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
                    g.addColorStop(0, `rgba(255, 214, 110, ${0.95 * a})`);
                    g.addColorStop(0.45, `rgba(250, 128, 34, ${0.75 * a})`);
                    g.addColorStop(1, `rgba(200, 52, 22, 0)`);
                    ctx.save();
                    ctx.translate(s.x, s.y);
                    ctx.scale(1, 1.9);
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }

                // Glowing embers along the rim.
                for (let n = 0; n < 5; n++) {
                    const [x, y] = map(edge[(Math.random() * edge.length) | 0]);
                    ctx.fillStyle = `rgba(255, ${(90 + Math.random() * 70) | 0}, 30, ${rand(0.25, 0.6)})`;
                    ctx.beginPath(); ctx.arc(x, y, rand(0.5, 1.1), 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalCompositeOperation = 'source-over';
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }

    // ---------- Intro ----------
    // What one dollar from the start of the period buys at five points, one under each note in the image.
    // ---------- Burned bills ----------
    // One bill image, burned from the corners inward. The burned share of each bill equals the
    // share of buying power lost. A seeded noise field decides the order in which pixels burn, so
    // more loss only adds to what was already gone.
    const burn = { base: null, field: null, sorted: null, w: 600, h: 258, ready: null };

    function mulberry32(a) {
        return () => {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function makeNoise(seed) {
        const rand = mulberry32(seed), P = 64;
        const g = Float32Array.from({ length: P * P }, rand);
        const at = (x, y) => g[(((y % P) + P) % P) * P + (((x % P) + P) % P)];
        const s = t => t * t * (3 - 2 * t);
        const value = (x, y) => {
            const xi = Math.floor(x), yi = Math.floor(y), u = s(x - xi), v = s(y - yi);
            const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
            return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
        };
        return (x, y) => {
            let sum = 0, amp = 0.5, f = 1;
            for (let o = 0; o < 5; o++) { sum += amp * value(x * f, y * f); amp *= 0.5; f *= 2.1; }
            return sum;
        };
    }

    function loadBill() {
        if (burn.ready) return burn.ready;
        burn.ready = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const { w, h } = burn;
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const ctx = c.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, w, h);
                burn.base = ctx.getImageData(0, 0, w, h);
                // Low values burn first. The fire starts mostly at the lower right corner, less at the
                // others, and noise at two scales makes the edge ragged instead of geometric.
                const coarse = makeNoise(1913), fine = makeNoise(2025);
                const corners = [[w, h, 0.62], [w, 0, 0.85], [0, h, 0.95], [0, 0, 1.15]];
                const field = new Float32Array(w * h);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        let dist = Infinity;
                        for (const [cx, cy, weight] of corners) dist = Math.min(dist, weight * Math.hypot(x - cx, y - cy) / h);
                        const edge = Math.min(x, w - x, y, h - y) / h;
                        field[y * w + x] = 0.5 * dist + 0.18 * edge + 0.55 * coarse(x / 120, y / 120) + 0.12 * fine(x / 18, y / 18);
                    }
                }
                burn.field = field;
                burn.sorted = Float32Array.from(field).sort();
                resolve();
            };
            img.onerror = reject;
            img.src = 'assets/img/dollar.jpg';
        });
        return burn.ready;
    }

    function paintBill(canvas, lost) {
        const { w, h, field, sorted, base } = burn;
        const n = field.length;
        const thr = lost <= 0 ? -Infinity : sorted[Math.min(n - 1, Math.floor(lost * n))];
        const out = new ImageData(new Uint8ClampedArray(base.data), w, h);
        const d = out.data;
        const CHAR = 0.02, SCORCH = 0.11;
        for (let i = 0; i < n; i++) {
            const k = field[i] - thr, p = i * 4;
            if (k < 0) { d[p + 3] = 0; continue; }            // burned away
            if (k < CHAR) {                                      // charred rim, glowing at the very edge
                const t = k / CHAR;
                const ember = t < 0.25 ? (0.25 - t) * 2.4 : 0;
                d[p] = 34 + 150 * ember; d[p + 1] = 24 + 40 * ember; d[p + 2] = 18;
                continue;
            }
            if (k < SCORCH) {                                    // brown scorch fading into the paper
                const t = Math.pow(1 - (k - CHAR) / (SCORCH - CHAR), 1.6);
                d[p] = d[p] * (1 - 0.62 * t) + 92 * 0.62 * t;
                d[p + 1] = d[p + 1] * (1 - 0.7 * t) + 52 * 0.7 * t;
                d[p + 2] = d[p + 2] * (1 - 0.78 * t) + 22 * 0.78 * t;
            }
        }
        canvas.getContext('2d').putImageData(out, 0, 0);
    }

    // What one dollar from the start of the period buys at five points, one bill each.
    function renderSteps() {
        const { from, to } = state;
        const n = to - from + 1;
        const years = [from, ...[0.25, 0.5, 0.75, 1].map(f => Math.round(from - 1 + f * n))];
        const items = $$('#dollarSteps li');
        const losses = [];
        let cpi = 1, y = from;
        years.forEach((year, k) => {
            if (k > 0) for (; y <= year; y++) cpi *= 1 + D.inflation[idx(y)];
            losses.push(Math.max(0, 1 - 1 / cpi));
            items[k].querySelector('strong').textContent = '$' + (1 / cpi).toFixed(2);
            items[k].querySelector('.step-year').textContent = String(year);
        });
        $('#dollarSteps').setAttribute('aria-label', `What one dollar from ${from} buys over time`);
        $('#seqCaption').textContent = from === to
            ? `One dollar at the start of ${from}, and what it buys at the end of the year. The burned part is the buying power lost.`
            : `One dollar at the start of ${from}, and what it buys at the end of each year shown. The burned part is the buying power lost.`;
        loadBill().then(() => items.forEach((li, k) => paintBill(li.querySelector('.bill'), losses[k]))).catch(() => {});
    }

    function renderIntro(cash) {
        const { from, to } = state;
        const span = from === to ? `in ${from}` : `from ${from} to ${to}`;
        if (cash.cpi >= 1) {
            $('#introText').textContent = `Prices rose ${pct(cash.cpi - 1, 0, false)} ${span}. A dollar kept as cash lost ${pct(cash.lost, 0, false)} of its buying power. Here is what kept up.`;
        } else {
            $('#introText').textContent = `Prices fell ${pct(1 - cash.cpi, 0, false)} ${span}, so even cash gained buying power. Here is how each asset did.`;
        }
        renderSteps();
    }

    // ---------- Asset rows ----------
    let results = [];
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = (tag, attrs) => {
        const node = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
        return node;
    };

    // One log scale for every row, so the lines can be compared with each other.
    function sparkScale(amount, list = results) {
        const all = list.flatMap(r => r.path.map(p => p.y)).concat(amount);
        const lo = Math.log(Math.min(...all)), hi = Math.log(Math.max(...all));
        const span = hi - lo || 1;
        return v => 38 - ((Math.log(v) - lo) / span) * 36;   // viewBox height 40, 2 units of padding
    }

    let sparkId = 0;   // clip-path ids must be unique in the page
    function spark(r, y, amount, color) {
        const n = r.path.length - 1;
        const pts = r.path.map((p, i) => [(i / n) * 100, y(p.y)]);
        const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`).join(' ');
        const base = y(amount).toFixed(2);
        const box = svg('svg', { viewBox: '0 0 100 40', preserveAspectRatio: 'none', class: 'spark' });
        // Area above the dashed line (gained buying power) in the asset color, below it (lost) in red.
        const uid = ++sparkId;
        const above = `clip-up-${uid}`, below = `clip-down-${uid}`;
        const defs = svg('defs', {});
        const clipUp = svg('clipPath', { id: above });
        clipUp.append(svg('rect', { x: 0, y: -10, width: 100, height: +base + 10 }));
        const clipDown = svg('clipPath', { id: below });
        clipDown.append(svg('rect', { x: 0, y: base, width: 100, height: 50 - base }));
        defs.append(clipUp, clipDown);
        const area = `${line} L100,${base} L0,${base} Z`;
        box.append(
            defs,
            svg('path', { d: area, fill: withAlpha(color, 0.24), 'clip-path': `url(#${above})` }),
            svg('path', { d: area, fill: withAlpha(cssVar('--critical'), 0.16), 'clip-path': `url(#${below})` }),
            svg('line', { x1: 0, x2: 100, y1: base, y2: base, class: 'spark-base' }),
            svg('path', { d: line, fill: 'none', stroke: color, class: 'spark-line' }),
        );
        const end = pts[pts.length - 1][1];
        return el('div', { class: 'asset-spark', 'aria-hidden': 'true' }, [
            box,
            el('span', { class: 'spark-dot', style: { top: (end / 40) * 100 + '%', background: color } }),
        ]);
    }

    function renderRows() {
        const { from, to, amount } = state;
        $('#resultsTitle').textContent = `What ${money(amount)} from ${from} buys at the end of ${to}`;
        $('#resultsSub').textContent = `In ${from} dollars, so you can compare it with what you put in. Before fees and taxes.`;
        $('#sparkHead').textContent = from === to ? `Buying power in ${from}` : `Buying power, ${from} → ${to}`;

        const y = sparkScale(amount);
        const sorted = [...results].sort((a, b) => b.real - a.real);
        $('#assetList').replaceChildren(...sorted.map(r => {
            const color = cssVar(r.color);
            const kept = r.real >= amount;
            const open = el('button', { type: 'button', class: 'asset-open', 'aria-label': `About ${r.name}` });
            open.addEventListener('click', () => openAsset(r.key));
            const row = el('li', { class: 'asset', 'data-key': r.key }, [
                open,
                el('img', { class: 'asset-photo', src: `assets/img/${r.img}.jpg`, alt: '', width: '160', height: '160', decoding: 'async' }),
                el('div', { class: 'asset-name' }, [
                    el('span', { class: 'asset-title' }, [el('span', { class: 'swatch', style: { background: color } }), r.name]),
                    el('span', { class: 'asset-note', text: r.note }),
                ]),
                spark(r, y, amount, color),
                el('div', { class: 'asset-value' }, [
                    el('span', { class: 'asset-real', text: money(r.real) }),
                    el('span', { class: `asset-rate ${kept ? 'up' : 'down'}`, text: `${pct(r.perYear)} a year` }),
                    el('span', { class: 'asset-nominal', text: `${money(r.nominal)} in dollars` }),
                ]),
                el('span', { class: 'asset-chevron', 'aria-hidden': 'true', text: '›' }),
            ]);
            row.setAttribute('aria-label',
                `${r.name}: buys what ${money(r.real)} bought in ${from}. ${pct(r.perYear)} a year after inflation. ${money(r.nominal)} in dollars.`);
            return row;
        }));
    }

    // ---------- Asset modal ----------
    let modalKey = null;

    // Longest time, since the data starts, that the asset stayed below an earlier buying-power high.
    function longestWait(key) {
        let level = 1, peak = 1, peakAt = D.firstYear - 1, best = { years: 0 };
        for (let y = D.firstYear; y <= D.lastYear; y++) {
            level *= (1 + yearReturn(key, y)) / (1 + D.inflation[idx(y)]);
            if (level >= peak) {
                if (y - peakAt > best.years && y - peakAt > 1) best = { years: y - peakAt, from: peakAt, to: y };
                peak = level; peakAt = y;
            }
        }
        if (D.lastYear - peakAt > best.years) best = { years: D.lastYear - peakAt, from: peakAt, to: null };
        return best;
    }

    function bestWorst(key) {
        let best = null, worst = null;
        for (let y = D.firstYear; y <= D.lastYear; y++) {
            const v = (1 + yearReturn(key, y)) / (1 + D.inflation[idx(y)]) - 1;
            if (!best || v > best.v) best = { v, y };
            if (!worst || v < worst.v) worst = { v, y };
        }
        return { best, worst };
    }

    function stat(label, value, detail, cls = '') {
        return el('div', { class: 'm-stat' }, [
            el('span', { class: 'm-stat-label', text: label }),
            el('span', { class: `m-stat-value ${cls}`, text: value }),
            detail ? el('span', { class: 'm-stat-detail', text: detail }) : null,
        ]);
    }

    // Fills the space around the square photo with the photo's own top and bottom colors,
    // so the sculpture shows whole and the frame looks like one continuous studio wall.
    function matchBackdrop(img) {
        try {
            const c = document.createElement('canvas');
            c.width = c.height = 32;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, 8, 8);
            const px = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return `rgb(${d[0]}, ${d[1]}, ${d[2]})`; };
            img.parentElement.style.background = `linear-gradient(${px(4, 0)} 30%, ${px(4, 7)} 70%)`;
        } catch (e) { /* keep the default plaster background */ }
    }

    function openAsset(key) {
        const r = results.find(x => x.key === key);
        if (!r) return;
        const info = INFO[key];
        const { from, to, amount } = state;
        const color = cssVar(r.color);
        const longRun = calc(key, { from: D.firstYear, to: D.lastYear, amount: 1 });
        const { best, worst } = bestWorst(key);
        const wait = longestWait(key);
        modalKey = key;

        const m = $('#assetModal');
        m.style.setProperty('--asset', color);
        const img = $('#mImage');
        img.onload = () => matchBackdrop(img);
        img.src = `assets/img/large/${r.img}.jpg`;
        img.alt = `A white plaster sculpture for ${r.name}, partly eroded into blue crystal.`;
        $('#mTitle').textContent = r.name;
        $('#mLede').textContent = info.lede;
        $('#mSwatch').style.background = color;

        $('#mStats').replaceChildren(
            stat(from === to ? `In ${from}` : `${from} to ${to}`, money(r.real), `${pct(r.perYear)} a year after inflation`, r.real >= amount ? 'up' : 'down'),
            stat(`Since ${D.firstYear}`, `${pct(longRun.perYear)}`, 'a year after inflation, on average', longRun.perYear >= 0 ? 'up' : 'down'),
            stat('Best and worst year', `${pct(best.v, 0)} / ${pct(worst.v, 0)}`, `${best.y} and ${worst.y}, after inflation`),
            stat('Longest wait', `${wait.years} years`, wait.to ? `to get back buying power, ${wait.from} to ${wait.to}` : `below its ${wait.from} buying power, and counting`),
        );

        const y = sparkScale(amount, [r]);
        $('#mChart').replaceChildren(spark(r, y, amount, color));
        $('#mChartFrom').textContent = String(from);
        $('#mChartTo').textContent = String(to);
        $('#mChartCaption').textContent = `Buying power of ${money(amount)} in ${from} dollars. Dashed line: what you put in.`;

        $('#mWhat').textContent = info.what;
        $('#mOwn').textContent = info.own;
        $('#mInflation').textContent = info.inflation;
        $('#mRisk').textContent = info.risk;
        $('#mNote').textContent = info.note || '';
        $('#mNote').hidden = !info.note;

        const order = $$('#assetList .asset').map(li => li.dataset.key);
        const at = order.indexOf(key);
        const prev = results.find(x => x.key === order[(at - 1 + order.length) % order.length]);
        const next = results.find(x => x.key === order[(at + 1) % order.length]);
        $('#mPrev').dataset.key = prev.key;
        $('#mPrevName').textContent = prev.name;
        $('#mNext').dataset.key = next.key;
        $('#mNextName').textContent = next.name;

        $('#mBody').scrollTop = 0;
        if (!m.open) {
            m.showModal();
            document.documentElement.classList.add('modal-open');
        }
        // Readable link to this asset, for example #gold or #savings.
        history.replaceState(null, '', location.pathname + location.search + `#${r.img}`);
    }

    function closeAsset() {
        const m = $('#assetModal');
        if (!m.open) return;
        const done = () => {
            m.classList.remove('closing');
            m.close();
            document.documentElement.classList.remove('modal-open');
            modalKey = null;
            history.replaceState(null, '', location.pathname + location.search);
            const row = $(`#assetList .asset[data-key="${CSS.escape(m.dataset.lastKey || '')}"] .asset-open`);
            row?.focus({ preventScroll: true });
        };
        m.dataset.lastKey = modalKey || '';
        if (reducedMotion()) { done(); return; }
        m.classList.add('closing');
        setTimeout(done, 180);
    }

    function bindModal() {
        const m = $('#assetModal');
        $('#mClose').addEventListener('click', closeAsset);
        // A click on the backdrop (outside the panel) closes the modal.
        m.addEventListener('click', e => { if (e.target === m) closeAsset(); });
        m.addEventListener('cancel', e => { e.preventDefault(); closeAsset(); });
        $('#mPrev').addEventListener('click', () => openAsset($('#mPrev').dataset.key));
        $('#mNext').addEventListener('click', () => openAsset($('#mNext').dataset.key));
        m.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft') openAsset($('#mPrev').dataset.key);
            if (e.key === 'ArrowRight') openAsset($('#mNext').dataset.key);
        });
    }

    // ---------- Chart ----------
    let chart = null;

    // Writes each asset's name at the end of its line, so the pastel colors never carry identity alone.
    const endLabels = {
        id: 'endLabels',
        afterDatasetsDraw(c) {
            const items = c.data.datasets
                .map((ds, i) => ({ ds, el: c.getDatasetMeta(i).data.at(-1) }))
                .filter(x => x.ds.assetKey && x.el)
                .map(x => ({ name: x.ds.label, color: x.ds.borderColor, x: x.el.x, y: x.el.y }))
                .sort((a, b) => a.y - b.y);
            const gap = 15, { top, bottom } = c.chartArea;
            for (let i = 0; i < items.length; i++) items[i].y = Math.max(items[i].y, i ? items[i - 1].y + gap : top + 6);
            for (let i = items.length - 1; i >= 0; i--) items[i].y = Math.min(items[i].y, i < items.length - 1 ? items[i + 1].y - gap : bottom - 2);
            const ctx = c.ctx;
            ctx.save();
            ctx.font = `500 12px ${Chart.defaults.font.family}`;
            ctx.textBaseline = 'middle';
            for (const it of items) {
                ctx.fillStyle = it.color;
                ctx.beginPath(); ctx.arc(it.x + 10, it.y, 3.5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = cssVar('--ink-2');
                ctx.fillText(it.name, it.x + 18, it.y);
            }
            ctx.restore();
        },
    };

    function renderChart() {
        if (!window.Chart) return;
        const { from, to, amount } = state;
        const n = to - from + 1;
        const log = n >= 30;
        Chart.defaults.font.family = 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif';
        Chart.defaults.font.size = 12;
        Chart.defaults.color = cssVar('--muted');

        $('#chartSub').textContent = `In ${from} dollars. The dashed line is ${money(amount)}: above it, your money buys more than at the start.`;

        chart?.destroy();
        chart = new Chart($('#chart'), {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: `Break-even (${money(amount)})`,
                        data: [{ x: from, y: amount }, { x: to + 1, y: amount }],
                        borderColor: cssVar('--axis'), borderDash: [4, 4], borderWidth: 1.25, pointRadius: 0, pointHoverRadius: 0,
                    },
                    ...results.map(r => ({
                        assetKey: r.key,
                        label: r.name,
                        data: r.path,
                        borderColor: cssVar(r.color),
                        backgroundColor: cssVar(r.color),
                        borderWidth: r.key === 'sp500' ? 2.5 : 1.75,
                        borderDash: r.key === 'cash' ? [5, 4] : [],
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        tension: 0,
                    })),
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: motion() ? { duration: 350 } : false,
                interaction: { mode: 'index', intersect: false },
                layout: { padding: { right: window.innerWidth < 600 ? 92 : 128 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: cssVar('--ink'),
                        titleColor: cssVar('--page'),
                        bodyColor: cssVar('--page'),
                        padding: 10,
                        cornerRadius: 10,
                        boxPadding: 4,
                        usePointStyle: true,
                        filter: item => item.datasetIndex > 0,
                        itemSort: (a, b) => b.parsed.y - a.parsed.y,
                        callbacks: {
                            title: items => (items[0].parsed.x === from ? `Start of ${from}` : `End of ${items[0].parsed.x - 1}`),
                            label: item => ` ${item.dataset.label}: ${money(item.parsed.y)}`,
                        },
                    },
                },
                scales: {
                    x: {
                        type: 'linear', min: from, max: to + 1,
                        grid: { display: false }, border: { color: cssVar('--axis') },
                        ticks: { callback: v => (Number.isInteger(v) && v <= to ? String(v) : ''), maxRotation: 0, autoSkipPadding: 18, precision: 0 },
                    },
                    y: {
                        type: log ? 'logarithmic' : 'linear',
                        grid: { color: cssVar('--grid') }, border: { display: false },
                        ticks: { callback: v => moneyShort(v), maxTicksLimit: 6 },
                    },
                },
            },
            plugins: [endLabels],
        });
    }

    // ---------- Controls ----------
    function setupYearRange() {
        for (const input of [$('#fromYear'), $('#toYear')]) {
            input.min = D.firstYear;
            input.max = D.lastYear;
        }
    }

    // Updates the period text and the filled part of the timeline.
    function paintPeriod(from, to) {
        const span = D.lastYear - D.firstYear;
        $('#yearFill').style.left = ((from - D.firstYear) / span) * 100 + '%';
        $('#yearFill').style.right = ((D.lastYear - to) / span) * 100 + '%';
        // When the handles meet in the right half, put the start handle on top so it can move left.
        $('#fromYear').style.zIndex = from === to && from > (D.firstYear + D.lastYear) / 2 ? 2 : '';
        const n = to - from + 1;
        $('#periodText').textContent = from === to ? String(from) : `${from} to ${to}`;
        $('#periodLen').textContent = `${n} year${n > 1 ? 's' : ''}`;
    }

    // Keeps start <= end while a handle moves: the moving handle pushes the other one.
    function readYears(moving) {
        const f = $('#fromYear'), t = $('#toYear');
        let from = +f.value, to = +t.value;
        if (from > to) {
            if (moving === f) { to = from; t.value = to; } else { from = to; f.value = from; }
        }
        return { from, to };
    }

    const parseAmount = text => Number(String(text).replace(/[^0-9.]/g, '')) || 0;
    const formatAmount = v => Math.round(v).toLocaleString('en-US');

    function syncControls() {
        $('#fromYear').value = state.from;
        $('#toYear').value = state.to;
        paintPeriod(state.from, state.to);
        if (document.activeElement !== $('#amount')) $('#amount').value = formatAmount(state.amount);
        for (const chip of $$('.chip')) {
            chip.setAttribute('aria-pressed', String(+chip.dataset.from === state.from && +chip.dataset.to === state.to));
        }
    }

    let debounce;
    function bindControls() {
        for (const input of [$('#fromYear'), $('#toYear')]) {
            input.addEventListener('input', () => {
                const { from, to } = readYears(input);
                paintPeriod(from, to);
                clearTimeout(debounce);
                debounce = setTimeout(() => { Object.assign(state, { from, to }); update(); }, 120);
            });
        }
        const amount = $('#amount');
        amount.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                const v = parseAmount(amount.value);
                if (v > 0) { state.amount = clamp(v, 1, 1e12); update(); }
            }, 250);
        });
        amount.addEventListener('blur', () => { amount.value = formatAmount(state.amount); });
        for (const chip of $$('.chip')) {
            chip.addEventListener('click', () => {
                state.from = +chip.dataset.from;
                state.to = +chip.dataset.to;
                update();
            });
        }
        $('#copyLink').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(location.href); toast('Link copied'); }
            catch (e) { window.prompt('Copy this link:', location.href); }
        });
    }

    function bindTheme() {
        $('#themeToggle').addEventListener('click', () => {
            const next = theme() === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            try { localStorage.setItem('theme', next); } catch (e) {}
            render();
        });
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
            if (!document.documentElement.dataset.theme) render();
        });
    }

    // ---------- Render ----------
    function render() {
        results = ASSETS.map(a => ({ ...a, ...calc(a.key, state) }));
        renderIntro(results.find(r => r.key === 'cash'));
        renderRows();
        renderChart();
    }

    function update() {
        writeUrl();
        syncControls();
        render();
    }

    function init() {
        bindTheme();
        startLogoFire();
        // data/returns.js sets the data synchronously, so the page renders in one pass.
        D = window.RETURNS_DATA;
        if (!D) { toast('Could not load the data. Reload the page.'); return; }
        $('#dataNote').textContent = `Data ${D.firstYear} to ${D.lastYear}`;

        setupYearRange();
        readUrl();
        bindControls();
        bindModal();
        update();

        // Redraw once web fonts load, so the chart text uses them.
        // Animations start only after that, when the reader changes something.
        const ready = document.fonts ? document.fonts.ready : Promise.resolve();
        ready.then(() => render()).finally(() => { animate = true; });
        const linked = ASSETS.find(a => `#${a.img}` === location.hash);
        if (linked) openAsset(linked.key);
        // Smooth scrolling only after load, so a reload with #section does not glide.
        window.addEventListener('load', () => document.documentElement.classList.add('smooth'), { once: true });
    }

    init();
})();
