(() => {
    'use strict';

    // ---------- Constants ----------
    const DEFAULTS = { from: 2005, to: 2025, amount: 10000, monthly: 0, fee: 0, tax: 0, scale: 'linear' };

    // Each asset keeps its color in every view (color follows the entity, not its rank).
    const ASSETS = [
        { key: 'sp500', name: 'S&P 500', color: '--series-1' },
        { key: 'tbond', name: '10y Treasury', color: '--series-2' },
        { key: 'tbill', name: 'Cash (T-bills)', color: '--series-3' },
        { key: 'gold', name: 'Gold', color: '--series-4' },
        { key: 'realEstate', name: 'US homes', color: '--series-5' },
        { key: 'baa', name: 'Corporate bonds', color: '--series-6' },
        { key: 'mattress', name: 'Under the mattress', color: '--neutral-series' },
    ];

    const EVENTS = [
        [1929, '1929 crash'], [1937, '1937 recession'], [1941, 'WWII'], [1973, 'Oil shock'],
        [1980, 'Inflation peak'], [1987, 'Black Monday'], [2000, 'Dot-com bust'],
        [2008, 'Financial crisis'], [2020, 'COVID'], [2022, 'Inflation spike'],
    ];

    const HEAT_MIN = -0.10;
    const HEAT_MAX = 0.15;

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
    const signClass = v => (v < 0 ? 'down' : 'up');

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

    function mixHex(a, b, t) {
        const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
        const ch = (p, s) => (p >> s) & 255;
        const m = s => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
        return `rgb(${m(16)}, ${m(8)}, ${m(0)})`;
    }

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
        toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
    }

    // ---------- State (kept in the URL so every scenario can be shared) ----------
    let D = null;
    const state = { ...DEFAULTS };

    function readUrl() {
        const p = new URLSearchParams(location.search);
        const num = (k, lo, hi) => {
            if (!p.has(k)) return;
            const v = Number(p.get(k));
            if (Number.isFinite(v)) state[k] = clamp(v, lo, hi);
        };
        num('from', D.firstYear, D.lastYear);
        num('to', D.firstYear, D.lastYear);
        num('amount', 0, 1e12);
        num('monthly', 0, 1e9);
        num('fee', 0, 2);
        num('tax', 0, 2);
        if (p.get('scale') === 'logarithmic') state.scale = 'logarithmic';
        state.from = Math.round(state.from);
        state.to = Math.round(state.to);
        if (state.from > state.to) [state.from, state.to] = [state.to, state.from];
    }

    function writeUrl() {
        const p = new URLSearchParams();
        for (const k of Object.keys(DEFAULTS)) if (state[k] !== DEFAULTS[k]) p.set(k, state[k]);
        const q = p.toString();
        history.replaceState(null, '', q ? `?${q}` : location.pathname);
    }

    // ---------- Math ----------
    const idx = y => y - D.firstYear;

    function assetReturn(key, y) {
        if (key === 'mattress') return 0;
        return D[key][idx(y)];
    }

    // Simulates the S&P 500 investment year by year. Monthly deposits go in at the end
    // of each month, and each year's return and inflation are spread evenly over its months.
    function simulate({ from, to, amount, monthly, fee, tax }) {
        const cost = (fee + tax) / 100;
        let value = amount, cpi = 1, contrib = amount, contribReal = amount, idxN = 1, idxR = 1;
        const rows = [];
        for (let y = from; y <= to; y++) {
            const r = D.sp500[idx(y)];
            const i = D.inflation[idx(y)];
            const rn = (1 + r) * (1 - cost) - 1;
            if (monthly > 0) {
                const mr = Math.pow(1 + rn, 1 / 12) - 1;
                const mi = Math.pow(1 + i, 1 / 12) - 1;
                for (let m = 0; m < 12; m++) {
                    value = value * (1 + mr) + monthly;
                    cpi *= 1 + mi;
                    contrib += monthly;
                    contribReal += monthly / cpi;
                }
            } else {
                value *= 1 + rn;
                cpi *= 1 + i;
            }
            idxN *= 1 + rn;
            idxR *= (1 + rn) / (1 + i);
            rows.push({ year: y, r, rn, i, real: (1 + rn) / (1 + i) - 1, pp: 1 / cpi, nominal: value, realValue: value / cpi, contrib, contribReal });
        }
        const n = to - from + 1;
        return {
            rows, n, cost,
            nominal: value, realValue: value / cpi, contrib, contribReal, cpi,
            idxN, idxR,
            nominalCagr: Math.pow(idxN, 1 / n) - 1,
            realCagr: Math.pow(idxR, 1 / n) - 1,
            inflCagr: Math.pow(cpi, 1 / n) - 1,
            breakeven: contribReal * cpi,
        };
    }

    // Real growth of a lump sum in any asset, as {x, y} points from the start of `from`.
    function assetPath(key, from, to, amount) {
        let v = amount;
        const pts = [{ x: from, y: v }];
        for (let y = from; y <= to; y++) {
            v *= (1 + assetReturn(key, y)) / (1 + D.inflation[idx(y)]);
            pts.push({ x: y + 1, y: v });
        }
        return pts;
    }

    // Cumulative log real returns: prefix[k] covers years firstYear .. firstYear + k - 1.
    let realPrefix = null;
    function realAnnualized(s, e) {
        return Math.exp((realPrefix[idx(e) + 1] - realPrefix[idx(s)]) / (e - s + 1)) - 1;
    }

    // ---------- Hero, stats, sparklines ----------
    let heroShown = null;
    function animateNumber(node, from, to) {
        if (reducedMotion() || from == null || from === to) { node.textContent = money(to); return; }
        const t0 = performance.now(), dur = 650;
        const step = now => {
            const t = Math.min(1, (now - t0) / dur);
            const e = 1 - Math.pow(1 - t, 3);
            node.textContent = money(from + (to - from) * e);
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    function renderHero(sim) {
        const { from, to, amount, monthly } = state;
        animateNumber($('#heroNominal'), heroShown?.nominal, sim.nominal);
        animateNumber($('#heroReal'), heroShown?.real, sim.realValue);
        heroShown = { nominal: sim.nominal, real: sim.realValue };

        const costs = sim.cost > 0 ? ` after ${pct(sim.cost, 2, false)} a year in fees and taxes` : '';
        const period = from === to ? `during ${from}` : `from the start of ${from} to the end of ${to}`;
        let text;
        if (monthly > 0) {
            text = `${money(amount)} at the start of ${from} plus ${money(monthly)} a month (${money(sim.contrib)} in total) grew to ${money(sim.nominal)} by the end of ${to}${costs}. ` +
                `In ${from} dollars that is ${money(sim.realValue)}, and you put in the equivalent of ${money(sim.contribReal)}.`;
        } else {
            const verb = sim.nominal >= amount ? 'grew to' : 'fell to';
            text = `${money(amount)} in the S&P 500 ${period} ${verb} ${money(sim.nominal)}${costs}. ` +
                `Prices ${sim.cpi >= 1 ? 'rose' : 'fell'} ${pct(Math.abs(sim.cpi - 1), 1, false)} in that time, so it buys what ${money(sim.realValue)} bought in ${from}.`;
        }
        $('#heroSub').textContent = text;
    }

    function sparkPath(values) {
        const lo = Math.min(...values), hi = Math.max(...values);
        const span = hi - lo || 1;
        const pts = values.map((v, k) => [(k / (values.length - 1 || 1)) * 100, 30 - ((v - lo) / span) * 26]);
        const line = pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
        return { line, area: `${line} L100,32 L0,32 Z` };
    }

    function drawSpark(svg, values, colorVar) {
        const color = cssVar(colorVar);
        const { line, area } = sparkPath(values);
        svg.innerHTML = '';
        const ns = 'http://www.w3.org/2000/svg';
        const a = document.createElementNS(ns, 'path');
        a.setAttribute('d', area);
        a.setAttribute('fill', withAlpha(color, 0.14));
        const l = document.createElementNS(ns, 'path');
        l.setAttribute('d', line);
        l.setAttribute('fill', 'none');
        l.setAttribute('stroke', color);
        l.setAttribute('stroke-width', '1.5');
        l.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.append(a, l);
    }

    function renderStats(sim) {
        const { from } = state;
        $('#statReal').textContent = pct(sim.realCagr);
        $('#statRealDetail').textContent = `${pct(sim.nominalCagr)} before inflation` + (sim.cost > 0 ? ', after costs' : '');
        $('#statInfl').textContent = pct(sim.cpi - 1);
        $('#statInflDetail').textContent = `$1 now buys what $${(1 / sim.cpi).toFixed(2)} bought in ${from} · ${pct(sim.inflCagr, 1, false)} a year`;
        $('#statBreakeven').textContent = money(sim.breakeven);
        $('#statBreakevenDetail').textContent = state.monthly > 0
            ? `needed to keep up with prices on ${money(sim.contrib)} put in`
            : `needed just to keep up with prices`;
        const worst = sim.rows.reduce((a, b) => (b.real < a.real ? b : a));
        const best = sim.rows.reduce((a, b) => (b.real > a.real ? b : a));
        $('#statWorst').textContent = pct(worst.real);
        $('#statWorstDetail').textContent = sim.rows.length > 1 ? `${worst.year} · best: ${best.year}, ${pct(best.real)}` : `${worst.year}`;

        let level = 1;
        const realIdx = [1, ...sim.rows.map(r => (level *= 1 + r.real))];
        drawSpark($('#sparkReal'), realIdx, '--series-1');
        drawSpark($('#sparkInfl'), [1, ...sim.rows.map(r => r.pp)], '--critical');
    }

    function renderYtd() {
        const y = D.ytd;
        const strip = $('#ytdStrip');
        $('#dataUpdated').textContent = `data through ${D.lastYear}`;
        if (!y) return;
        const real = (1 + y.sp500) / (1 + y.inflation) - 1;
        const spDate = new Date(y.sp500Through + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        const cpiMonth = new Date(y.inflationThrough + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
        strip.replaceChildren(
            el('span', { class: 'ytd-dot', 'aria-hidden': 'true' }),
            el('span', {}, [el('strong', { text: `${y.year} so far:` }), ` S&P 500 ${pct(y.sp500)} (to ${spDate})`]),
            el('span', { text: `Prices ${pct(y.inflation)} (to ${cpiMonth})` }),
            el('span', {}, ['Real ≈ ', el('strong', { text: pct(real) })]),
        );
        strip.hidden = false;
    }

    // ---------- Relic: the eroded coin in the hero ----------
    const relic = { shown: 0, target: 0, raf: 0, label: '' };

    function sizeRelic() {
        const cv = $('#relicCanvas');
        const px = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1));
        if (px > 0 && cv.width !== px) { cv.width = px; cv.height = px; }
    }

    function paintRelic() {
        if (!window.Relic) return;
        Relic.paint($('#relicCanvas'), { erosion: relic.shown, theme: effectiveTheme(), label: relic.label });
    }

    function setRelic(target, label) {
        relic.target = target;
        relic.label = label;
        cancelAnimationFrame(relic.raf);
        if (reducedMotion()) { relic.shown = target; paintRelic(); return; }
        const from = relic.shown, t0 = performance.now(), dur = 1100;
        const step = now => {
            const t = Math.min(1, (now - t0) / dur);
            relic.shown = from + (target - from) * (1 - Math.pow(1 - t, 3));
            paintRelic();
            if (t < 1) relic.raf = requestAnimationFrame(step);
        };
        relic.raf = requestAnimationFrame(step);
    }

    function renderRelic(sim) {
        const { from, to } = state;
        // Eroded share = purchasing power lost to inflation (fees and taxes are not part of it).
        const lost = Math.max(0, 1 - 1 / sim.cpi);
        $('#plFrom').textContent = String(from);
        $('#plBody').textContent = lost > 0
            ? `Plaster and calcite. ${pct(lost, 1, false)} eroded by the end of ${to}.`
            : `Plaster. Not eroded: prices fell, so $1 bought ${pct(1 / sim.cpi - 1, 1, false)} more by the end of ${to}.`;
        $('#relicCanvas').setAttribute('aria-label',
            `A plaster one-dollar coin. ${pct(lost, 0, false)} of its face has eroded into blue crystal, the share of purchasing power lost from ${from} to ${to}.`);
        setRelic(lost, String(from));
    }

    // ---------- Charts ----------
    const charts = {};

    function chartBase() {
        Chart.defaults.font.family = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
        Chart.defaults.font.weight = 400;
        Chart.defaults.font.size = 11;
        Chart.defaults.color = cssVar('--muted');
        Chart.defaults.borderColor = cssVar('--grid');
    }

    // x = the start of a year, so the last point (start of to + 1) is the end of the range: no tick label there.
    const yearTick = v => (Number.isInteger(v) && v <= state.to ? String(v) : '');

    function tooltipStyle() {
        return {
            backgroundColor: cssVar('--ink'),
            titleColor: cssVar('--page'),
            bodyColor: cssVar('--page'),
            borderWidth: 0,
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            usePointStyle: true,
        };
    }

    // Vertical hover line for the index-mode tooltip.
    const crosshair = {
        id: 'crosshair',
        afterDatasetsDraw(chart) {
            const a = chart.tooltip?.getActiveElements?.();
            if (!a || !a.length) return;
            const x = a[0].element.x;
            const { top, bottom } = chart.chartArea;
            const c = chart.ctx;
            c.save();
            c.strokeStyle = cssVar('--axis');
            c.lineWidth = 1;
            c.beginPath(); c.moveTo(x, top); c.lineTo(x, bottom); c.stroke();
            c.restore();
        },
    };

    // Dashed lines and short labels for major market events inside the visible range.
    const eventMarks = {
        id: 'eventMarks',
        beforeDatasetsDraw(chart) {
            const xs = chart.scales.x;
            const { top, bottom } = chart.chartArea;
            const c = chart.ctx;
            let lastLabelX = -Infinity;
            c.save();
            c.font = '500 9.5px "IBM Plex Mono", ui-monospace, monospace';
            c.textBaseline = 'top';
            for (const [year, name] of EVENTS) {
                const label = name.toUpperCase();
                const xv = year + 0.5;
                if (xv < xs.min || xv > xs.max) continue;
                const x = xs.getPixelForValue(xv);
                c.strokeStyle = cssVar('--axis');
                c.setLineDash([3, 3]);
                c.beginPath(); c.moveTo(x, top); c.lineTo(x, bottom); c.stroke();
                c.setLineDash([]);
                const w = c.measureText(label).width;
                if (x - lastLabelX > w / 2 + 40 && x + w / 2 < chart.width) {
                    c.fillStyle = cssVar('--muted');
                    c.textAlign = 'center';
                    c.fillText(label, clamp(x, w / 2 + 2, chart.width - w / 2 - 2), top - 15);
                    lastLabelX = x + w / 2;
                }
            }
            c.restore();
        },
    };

    function renderGrowth(sim) {
        const { from, to } = state;
        const start = { x: from, y: state.amount };
        const real = [start, ...sim.rows.map(r => ({ x: r.year + 1, y: r.realValue }))];
        const nominal = [start, ...sim.rows.map(r => ({ x: r.year + 1, y: r.nominal }))];
        const contrib = [start, ...sim.rows.map(r => ({ x: r.year + 1, y: r.contribReal }))];
        const blue = cssVar('--series-1');
        const gray = cssVar('--neutral-series');
        const log = state.scale === 'logarithmic';

        $('#growthSub').textContent = `Real value is in ${from} dollars. Dashed lines mark major events.`;

        charts.growth?.destroy();
        charts.growth = new Chart($('#growthChart'), {
            type: 'line',
            data: {
                datasets: [
                    { label: `After inflation (${from} $)`, data: real, borderColor: blue, backgroundColor: withAlpha(blue, 0.12), fill: log ? false : 'origin', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0 },
                    { label: 'In dollars', data: nominal, borderColor: gray, borderDash: [5, 4], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0 },
                    { label: `Money put in (${from} $)`, data: contrib, borderColor: cssVar('--axis'), borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, stepped: state.monthly > 0 ? false : 'before', tension: 0 },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: reducedMotion() ? false : { duration: 400 },
                interaction: { mode: 'index', intersect: false },
                layout: { padding: { top: 18 } }, // room for event labels above the plot
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 14, boxHeight: 2, padding: 14, color: cssVar('--ink-2') } },
                    tooltip: {
                        ...tooltipStyle(),
                        filter: item => item.datasetIndex !== 2 || state.monthly > 0,
                        callbacks: {
                            title: items => (items[0].parsed.x === from ? `Start of ${from}` : `End of ${items[0].parsed.x - 1}`),
                            label: item => ` ${item.dataset.label}: ${money(item.parsed.y)}`,
                        },
                    },
                },
                scales: {
                    x: { type: 'linear', min: from, max: to + 1, grid: { display: false }, border: { color: cssVar('--axis') }, ticks: { callback: yearTick, maxRotation: 0, autoSkipPadding: 16, precision: 0 } },
                    y: { type: state.scale, grid: { color: cssVar('--grid') }, border: { display: false }, ticks: { callback: v => moneyShort(v), maxTicksLimit: 7 }, ...(log ? {} : { min: 0 }) },
                },
            },
            plugins: [eventMarks, crosshair],
        });
    }

    function renderCompare() {
        const { from, to, amount } = state;
        const n = to - from + 1;
        const base = amount > 0 ? amount : 10000;
        const rows = ASSETS.map(a => {
            const path = assetPath(a.key, from, to, base);
            return { ...a, path, cagr: Math.pow(path[path.length - 1].y / base, 1 / n) - 1 };
        });

        $('#compareSub').textContent = `Real return per year, ${from === to ? from : `${from}–${to}`}, one lump sum, before fees and taxes.`;

        // Bars: sorted by result; colors stay with the asset.
        const sorted = [...rows].sort((a, b) => b.cagr - a.cagr);
        const lo = Math.min(0, ...rows.map(r => r.cagr));
        const hi = Math.max(0, ...rows.map(r => r.cagr));
        const span = hi - lo || 1;
        const zero = ((0 - lo) / span) * 100;
        $('#compareBars').replaceChildren(...sorted.map(r => {
            const left = ((Math.min(0, r.cagr) - lo) / span) * 100;
            const width = (Math.abs(r.cagr) / span) * 100;
            const color = cssVar(r.color);
            return el('li', { class: 'bar-row' }, [
                el('span', { class: 'bar-name', title: r.name }, [el('span', { class: 'bar-key', style: { background: color } }), r.name]),
                el('span', { class: 'bar-track', 'aria-hidden': 'true' }, [
                    el('span', { class: 'bar-zero', style: { left: zero + '%' } }),
                    el('span', { class: 'bar-fill', style: { left: left + '%', width: Math.max(width, 0.5) + '%', background: color } }),
                ]),
                el('span', { class: `bar-val ${signClass(r.cagr)}`, text: pct(r.cagr) }),
            ]);
        }));

        const log = n >= 30;
        charts.compare?.destroy();
        charts.compare = new Chart($('#compareChart'), {
            type: 'line',
            data: {
                datasets: rows.map(r => ({
                    label: r.name,
                    data: r.path,
                    borderColor: cssVar(r.color),
                    backgroundColor: cssVar(r.color),
                    borderWidth: r.key === 'sp500' ? 2.5 : 1.75,
                    borderDash: r.key === 'mattress' ? [4, 4] : [],
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0,
                })),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: reducedMotion() ? false : { duration: 400 },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 14, boxHeight: 2, padding: 12, color: cssVar('--ink-2') } },
                    tooltip: {
                        ...tooltipStyle(),
                        itemSort: (a, b) => b.parsed.y - a.parsed.y,
                        callbacks: {
                            title: items => (items[0].parsed.x === from ? `Start of ${from}` : `End of ${items[0].parsed.x - 1} · in ${from} $`),
                            label: item => ` ${item.dataset.label}: ${money(item.parsed.y)}`,
                        },
                    },
                },
                scales: {
                    x: { type: 'linear', min: from, max: to + 1, grid: { display: false }, border: { color: cssVar('--axis') }, ticks: { callback: yearTick, maxRotation: 0, autoSkipPadding: 16, precision: 0 } },
                    y: { type: log ? 'logarithmic' : 'linear', grid: { color: cssVar('--grid') }, border: { display: false }, ticks: { callback: v => moneyShort(v), maxTicksLimit: 7 } },
                },
            },
            plugins: [crosshair],
        });
    }

    // ---------- Heatmap ----------
    const heat = { cell: 0, left: 34, bottom: 22, top: 4 };

    function heatColor(v, mid, pos, neg) {
        if (v >= 0) return mixHex(mid, pos, clamp(v / HEAT_MAX, 0, 1));
        return mixHex(mid, neg, clamp(v / HEAT_MIN, 0, 1));
    }

    function renderHeatmap() {
        const canvas = $('#heatCanvas');
        const wrap = canvas.parentElement;
        const N = D.years.length;
        const W = wrap.clientWidth;
        // Cap the cell size so the triangle stays about one screen tall on wide displays.
        const cell = clamp((W - heat.left - 4) / N, 2, 7.5);
        const H = heat.top + cell * N + heat.bottom;
        const CW = Math.min(W, heat.left + cell * N + 4);
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(CW * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = CW + 'px';
        canvas.style.height = H + 'px';
        heat.cell = cell;

        const c = canvas.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, CW, H);
        const mid = cssVar('--heat-mid'), pos = cssVar('--heat-pos'), neg = cssVar('--heat-neg');

        for (let s = 0; s < N; s++) {
            for (let e = s; e < N; e++) {
                c.fillStyle = heatColor(realAnnualized(D.firstYear + s, D.firstYear + e), mid, pos, neg);
                // Overlap by a fraction of a pixel so no seams show between cells.
                c.fillRect(heat.left + e * cell, heat.top + s * cell, cell + 0.6, cell + 0.6);
            }
        }

        // Axis labels every 10 years.
        c.fillStyle = cssVar('--muted');
        c.font = '10px "IBM Plex Mono", ui-monospace, monospace';
        for (let y = Math.ceil(D.firstYear / 10) * 10; y <= D.lastYear; y += 10) {
            const k = idx(y);
            c.textAlign = 'right'; c.textBaseline = 'middle';
            c.fillText(String(y), heat.left - 6, heat.top + (k + 0.5) * cell);
            c.textAlign = 'center'; c.textBaseline = 'top';
            c.fillText(String(y), heat.left + (k + 0.5) * cell, heat.top + N * cell + 6);
        }
        c.save();
        c.textAlign = 'left'; c.textBaseline = 'top';
        c.fillText('Start ↓  ·  End →', heat.left + 2, heat.top + N * cell - 14);
        c.restore();

        // Mark the selected period.
        const sx = heat.left + idx(state.to) * cell, sy = heat.top + idx(state.from) * cell;
        c.strokeStyle = cssVar('--ink');
        c.lineWidth = 1;
        c.globalAlpha = 0.35;
        c.beginPath();
        c.moveTo(heat.left, sy + cell / 2); c.lineTo(sx, sy + cell / 2);
        c.moveTo(sx + cell / 2, heat.top + N * cell); c.lineTo(sx + cell / 2, sy + cell);
        c.stroke();
        c.globalAlpha = 1;
        c.lineWidth = 2;
        const ring = Math.max(cell, 6);
        c.strokeRect(sx + cell / 2 - ring / 2 - 1, sy + cell / 2 - ring / 2 - 1, ring + 2, ring + 2);
    }

    function heatCellAt(evt) {
        const rect = $('#heatCanvas').getBoundingClientRect();
        const x = evt.clientX - rect.left - heat.left;
        const y = evt.clientY - rect.top - heat.top;
        const e = Math.floor(x / heat.cell), s = Math.floor(y / heat.cell);
        const N = D.years.length;
        if (e < 0 || s < 0 || e >= N || s >= N || e < s) return null;
        return { from: D.firstYear + s, to: D.firstYear + e };
    }

    function bindHeatmap() {
        const canvas = $('#heatCanvas');
        const pop = $('#tipPop');
        canvas.addEventListener('pointermove', evt => {
            const hit = heatCellAt(evt);
            if (!hit) { pop.hidden = true; return; }
            const v = realAnnualized(hit.from, hit.to);
            const n = hit.to - hit.from + 1;
            pop.textContent = `${hit.from}–${hit.to} (${n} yr${n > 1 ? 's' : ''}): ${pct(v)} a year after inflation. Click to load.`;
            showPopAt(evt.clientX, evt.clientY);
        });
        canvas.addEventListener('pointerleave', () => { pop.hidden = true; });
        canvas.addEventListener('click', evt => {
            const hit = heatCellAt(evt);
            if (!hit) return;
            state.from = hit.from;
            state.to = hit.to;
            syncForm();
            update();
            toast(`Loaded ${hit.from}–${hit.to}`);
        });
    }

    // ---------- Drawdowns ----------
    function renderDrawdowns() {
        const N = D.years.length;
        const real = [1], nom = [1];
        for (let k = 0; k < N; k++) {
            nom.push(nom[k] * (1 + D.sp500[k]));
            real.push(real[k] * (1 + D.sp500[k]) / (1 + D.inflation[k]));
        }
        const label = j => (j === 0 ? `Start ${D.firstYear}` : String(D.firstYear + j - 1));
        const episodes = [];
        let peak = 0, trough = 0;
        for (let j = 1; j <= N + 1; j++) {
            const done = j > N;
            if (!done && real[j] < real[peak]) {
                if (real[j] < real[trough] || trough < peak) trough = j;
                continue;
            }
            if (trough > peak) {
                const depth = real[trough] / real[peak] - 1;
                if (depth <= -0.2) {
                    let nomBack = null;
                    for (let k = peak + 1; k <= N; k++) if (nom[k] >= nom[peak]) { nomBack = k; break; }
                    episodes.push({ peak, trough, depth, realBack: done ? null : j, nomBack });
                }
            }
            if (!done) { peak = j; trough = j; }
        }

        const rows = episodes.map(ep => {
            const startYear = D.firstYear + ep.peak;      // first year of the fall
            const endYear = D.firstYear + (ep.realBack ?? N) - 1;
            const overlaps = startYear <= state.to && endYear >= state.from;
            const underwater = ep.realBack ? ep.realBack - ep.peak : N - ep.peak;
            return el('tr', { class: overlaps ? 'in-range' : '' }, [
                el('td', { text: label(ep.peak) }),
                el('td', { text: label(ep.trough) }),
                el('td', { class: 'down', text: pct(ep.depth, 0) }),
                el('td', { text: ep.nomBack ? label(ep.nomBack) : 'not yet' }),
                el('td', {}, [ep.realBack ? label(ep.realBack) : el('span', { class: 'pill', text: 'not yet' })]),
                el('td', {}, [el('strong', { text: `${underwater} yrs` }), ep.realBack ? '' : '+']),
            ]);
        });
        $('#ddTable tbody').replaceChildren(...rows.reverse());
    }

    // ---------- Year table and CSV ----------
    function renderTable(sim) {
        const { from, to } = state;
        $('#realColUnit').textContent = `in ${from} $`;
        $('#tableSub').textContent = `Values at the end of each year, ${from}–${to}.` + (sim.cost > 0 ? ' Real return is after fees and taxes.' : '');
        const tr = cells => el('tr', {}, cells.map(([text, cls]) => el('td', { class: cls || '', text })));
        const body = sim.rows.map(r => tr([
            [String(r.year)],
            [pct(r.r), signClass(r.r)],
            [pct(r.i, 1, false), r.i < 0 ? 'up' : ''],
            [pct(r.real), signClass(r.real)],
            ['$' + r.pp.toFixed(3)],
            [money(r.nominal)],
            [money(r.realValue)],
        ]));
        if (to === D.lastYear && D.ytd) {
            const y = D.ytd;
            const real = (1 + y.sp500) / (1 + y.inflation) - 1;
            const row = tr([[`${y.year} so far`], [pct(y.sp500)], [pct(y.inflation, 1, false)], [pct(real)], ['—'], ['—'], ['—']]);
            row.className = 'ytd-row';
            body.push(row);
        }
        $('#yearTable tbody').replaceChildren(...body);
        $('#yearTable tfoot').replaceChildren(
            tr([['Total'], [pct(sim.idxN - 1, 0), signClass(sim.idxN - 1)], [pct(sim.cpi - 1, 1, false)], [pct(sim.idxR - 1, 0), signClass(sim.idxR - 1)], ['$' + (1 / sim.cpi).toFixed(3)], [money(sim.nominal)], [money(sim.realValue)]]),
            tr([['Per year'], [pct(sim.nominalCagr), signClass(sim.nominalCagr)], [pct(sim.inflCagr, 1, false)], [pct(sim.realCagr), signClass(sim.realCagr)], ['—'], ['—'], ['—']]),
        );
    }

    function downloadCsv() {
        const sim = simulate(state);
        const lines = [['year', 'sp500_total_return', 'inflation_cpi_dec_dec', 'real_return', 'purchasing_power_of_1', 'value_nominal', `value_real_${state.from}_dollars`].join(',')];
        for (const r of sim.rows) lines.push([r.year, r.r.toFixed(6), r.i.toFixed(6), r.real.toFixed(6), r.pp.toFixed(6), r.nominal.toFixed(2), r.realValue.toFixed(2)].join(','));
        const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
        saveBlob(blob, `sp500-real-returns-${state.from}-${state.to}.csv`);
    }

    function saveBlob(blob, name) {
        const a = el('a', { href: URL.createObjectURL(blob), download: name });
        document.body.append(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    }

    // ---------- Share image (1200x630, same layout as the link preview) ----------
    async function downloadImage() {
        try { await document.fonts.ready; } catch (e) {}
        const sim = simulate(state);
        const lost = Math.max(0, 1 - 1 / sim.cpi);
        const W = 1200, H = 630;
        const cv = el('canvas', { width: W, height: H });
        const c = cv.getContext('2d');
        const display = (w, px) => `${w} ${px}px "Inter Tight", Inter, system-ui, sans-serif`;
        const mono = px => `500 ${px}px "IBM Plex Mono", ui-monospace, monospace`;
        const ink = '#1e1d1b', ink2 = '#4f4c46', muted = '#7a766d', wall = '#a8a398', blue = '#2b7fae';

        c.fillStyle = '#efede8';
        c.fillRect(0, 0, W, H);
        if (window.Relic) Relic.paintTo(c, 660, 40, 540, { erosion: lost, theme: 'light', label: String(state.from) });

        c.textBaseline = 'alphabetic';
        c.fillStyle = muted; c.font = mono(16);
        c.fillText(`EXHIBIT · S&P 500 AFTER INFLATION · ${state.from}–${state.to}`, 64, 92);

        // Shrink the headline until it fits beside the coin.
        const nom = money(sim.nominal), real = money(sim.realValue);
        let size = 76;
        c.font = display(700, size);
        while (size > 40 && Math.max(c.measureText(`Your ${nom}`).width, c.measureText(`is really ${real}.`).width) > 600) {
            size -= 2;
            c.font = display(700, size);
        }
        const y1 = 200, y2 = y1 + size * 1.02;
        let x = 64;
        c.fillStyle = ink; c.fillText('Your ', x, y1); x += c.measureText('Your ').width;
        c.fillStyle = wall; c.fillText(nom, x, y1);
        const nw = c.measureText(nom).width;
        c.strokeStyle = '#b4442c'; c.lineWidth = size * 0.06;
        c.beginPath(); c.moveTo(x, y1 - size * 0.3); c.lineTo(x + nw, y1 - size * 0.3); c.stroke();
        x = 64;
        c.fillStyle = ink; c.fillText('is really ', x, y2); x += c.measureText('is really ').width;
        c.fillStyle = blue; c.fillText(real, x, y2); x += c.measureText(real).width;
        c.fillStyle = ink; c.fillText('.', x, y2);

        c.font = '500 22px Inter, system-ui, sans-serif'; c.fillStyle = ink2;
        const lead = state.monthly > 0 ? `${money(state.amount)} + ${money(state.monthly)}/month` : money(state.amount);
        c.fillText(`${lead} in the S&P 500, in ${state.from} dollars.`, 64, y2 + 58);

        const stats = [
            ['REAL RETURN / YEAR', pct(sim.realCagr)],
            ['BEFORE INFLATION', pct(sim.nominalCagr)],
            ['PRICES ROSE', pct(sim.cpi - 1)],
        ];
        stats.forEach(([k, v], i) => {
            const sx = 64 + i * 200;
            c.fillStyle = muted; c.font = mono(14); c.fillText(k, sx, 478);
            c.fillStyle = ink; c.font = display(600, 40); c.fillText(v, sx, 524);
        });
        c.fillStyle = muted; c.font = mono(15);
        c.fillText('REALRETURNS.XYZ · DAMODARAN (NYU STERN) · BLS CPI-U', 64, 588);

        cv.toBlob(b => b && saveBlob(b, `realreturns-${state.from}-${state.to}.png`), 'image/png');
    }

    // ---------- Tooltips (hover, focus and tap) ----------
    function showPopAt(cx, cy) {
        const pop = $('#tipPop');
        pop.hidden = false;
        const r = pop.getBoundingClientRect();
        pop.style.left = clamp(cx - r.width / 2, 8, window.innerWidth - r.width - 8) + 'px';
        const below = cy + 18;
        pop.style.top = (below + r.height > window.innerHeight - 8 ? cy - r.height - 12 : below) + 'px';
    }

    function bindTips() {
        const pop = $('#tipPop');
        let pinned = null;
        const show = t => {
            pop.textContent = t.dataset.tip;
            const r = t.getBoundingClientRect();
            showPopAt(r.left + r.width / 2, r.bottom - 8);
        };
        document.addEventListener('mouseover', e => { const t = e.target.closest('.tip'); if (t) show(t); });
        document.addEventListener('mouseout', e => { const t = e.target.closest('.tip'); if (t && t !== pinned) pop.hidden = true; });
        document.addEventListener('focusin', e => { const t = e.target.closest('.tip'); if (t) show(t); });
        document.addEventListener('focusout', e => { if (e.target.closest('.tip')) { pop.hidden = true; pinned = null; } });
        document.addEventListener('click', e => {
            const t = e.target.closest('.tip');
            if (t) { e.preventDefault(); pinned = pinned === t ? null : t; pinned ? show(t) : (pop.hidden = true); }
            else if (pinned) { pinned = null; pop.hidden = true; }
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') { pop.hidden = true; pinned = null; } });
        window.addEventListener('scroll', () => { if (!pinned) pop.hidden = true; }, { passive: true });
    }

    // ---------- Form ----------
    function fillYearSelects() {
        const opts = () => D.years.map(y => el('option', { value: y, text: String(y) }));
        $('#fromYear').replaceChildren(...opts());
        $('#toYear').replaceChildren(...opts());
    }

    function syncForm() {
        $('#fromYear').value = state.from;
        $('#toYear').value = state.to;
        $('#amount').value = state.amount;
        $('#monthly').value = state.monthly;
        $('#fee').value = state.fee;
        $('#tax').value = state.tax;
        $('#feeOut').textContent = state.fee.toFixed(2) + '%';
        $('#taxOut').textContent = state.tax.toFixed(2) + '%';
        for (const b of $$('.segmented button')) b.setAttribute('aria-pressed', String(b.dataset.scale === state.scale));
        for (const chip of $$('.chip')) chip.setAttribute('aria-pressed', String(+chip.dataset.from === state.from && +chip.dataset.to === state.to));
    }

    let debounce;
    function bindForm() {
        const read = () => {
            state.from = +$('#fromYear').value;
            state.to = +$('#toYear').value;
            if (state.from > state.to) {
                if (document.activeElement === $('#fromYear')) state.to = state.from; else state.from = state.to;
            }
            state.amount = clamp(+$('#amount').value || 0, 0, 1e12);
            state.monthly = clamp(+$('#monthly').value || 0, 0, 1e9);
            state.fee = clamp(+$('#fee').value || 0, 0, 2);
            state.tax = clamp(+$('#tax').value || 0, 0, 2);
        };
        $('#calcForm').addEventListener('change', () => { read(); syncForm(); update(); });
        $('#calcForm').addEventListener('input', e => {
            if (e.target.type === 'range') {
                $('#feeOut').textContent = (+$('#fee').value).toFixed(2) + '%';
                $('#taxOut').textContent = (+$('#tax').value).toFixed(2) + '%';
            }
            clearTimeout(debounce);
            debounce = setTimeout(() => { read(); update(); }, 250);
        });
        for (const chip of $$('.chip')) {
            chip.addEventListener('click', () => {
                state.from = +chip.dataset.from;
                state.to = +chip.dataset.to;
                syncForm();
                update();
            });
        }
        for (const b of $$('.segmented button')) {
            b.addEventListener('click', () => { state.scale = b.dataset.scale; syncForm(); writeUrl(); renderGrowth(simulate(state)); });
        }
        $('#copyLink').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(location.href); toast('Link copied'); }
            catch (e) { window.prompt('Copy this link:', location.href); }
        });
        $('#downloadImage').addEventListener('click', downloadImage);
        $('#downloadCsv').addEventListener('click', downloadCsv);
    }

    // ---------- Theme ----------
    function effectiveTheme() {
        const t = document.documentElement.dataset.theme;
        if (t) return t;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function bindTheme() {
        $('#themeToggle').addEventListener('click', () => {
            const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            try { localStorage.setItem('theme', next); } catch (e) {}
            renderAll();
        });
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
            if (!document.documentElement.dataset.theme) renderAll();
        });
    }

    // ---------- S&P 500 companies drawer ----------
    let companies = null;

    function parseCsv(text) {
        const rows = [];
        let row = [], field = '', q = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (q) {
                if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
                else if (ch === '"') q = false;
                else field += ch;
            } else if (ch === '"') q = true;
            else if (ch === ',') { row.push(field); field = ''; }
            else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                row.push(field); rows.push(row); row = []; field = '';
            } else field += ch;
        }
        if (field || row.length) { row.push(field); rows.push(row); }
        return rows;
    }

    async function loadCompanies() {
        if (companies) return;
        try {
            const rows = parseCsv(await (await fetch('data/constituents.csv')).text());
            companies = rows.slice(1).filter(r => r[0]).map(r => ({ ticker: r[0], name: r[1], sector: r[2], hq: r[4], founded: r[7] }));
        } catch (e) {
            $('#companyCount').textContent = 'Could not load the company list.';
            return;
        }
        const bySector = {};
        for (const c of companies) bySector[c.sector] = (bySector[c.sector] || 0) + 1;
        const sectors = Object.entries(bySector).sort((a, b) => b[1] - a[1]);
        const max = sectors[0][1];
        $('#sectorBars').replaceChildren(...sectors.map(([name, n]) => {
            const li = el('li', { title: `Show ${name} companies` }, [
                el('span', { class: 'sector-name', text: name }),
                el('span', {}, [el('span', { class: 'sector-fill', style: { display: 'block', width: (n / max) * 100 + '%' } })]),
                el('span', { class: 'sector-count', text: String(n) }),
            ]);
            li.addEventListener('click', () => { $('#companySearch').value = name; filterCompanies(); });
            return li;
        }));
        filterCompanies();
    }

    function filterCompanies() {
        if (!companies) return;
        const q = $('#companySearch').value.trim().toLowerCase();
        const list = q ? companies.filter(c => [c.name, c.ticker, c.sector, c.hq].some(v => (v || '').toLowerCase().includes(q))) : companies;
        $('#companyCount').textContent = q
            ? `${list.length} of ${companies.length} securities`
            : `${companies.length} securities from about 500 companies, by number of companies per sector:`;
        $('#companyList').replaceChildren(...list.map(c => el('li', { class: 'company-item' }, [
            el('div', { class: 'company-main' }, [el('span', { class: 'company-name', text: c.name }), el('span', { class: 'company-ticker', text: c.ticker })]),
            el('div', { class: 'company-meta' }, [el('span', { text: c.sector }), c.hq ? el('span', { text: c.hq }) : null, c.founded ? el('span', { text: `Founded ${c.founded}` }) : null]),
        ])));
    }

    let drawerReturn = null;
    function openDrawer() {
        drawerReturn = document.activeElement;
        $('#drawer').hidden = false;
        $('#drawerOverlay').hidden = false;
        document.body.style.overflow = 'hidden';
        $('#companySearch').value = '';
        $('#companySearch').focus();
        if (companies) filterCompanies(); else loadCompanies();
    }
    function closeDrawer() {
        $('#drawer').hidden = true;
        $('#drawerOverlay').hidden = true;
        document.body.style.overflow = '';
        drawerReturn?.focus();
    }
    function bindDrawer() {
        $('#openDrawer').addEventListener('click', openDrawer);
        $('#openDrawer2').addEventListener('click', openDrawer);
        $('#drawerClose').addEventListener('click', closeDrawer);
        $('#drawerOverlay').addEventListener('click', closeDrawer);
        $('#companySearch').addEventListener('input', filterCompanies);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });
    }

    // ---------- Render ----------
    function update() {
        writeUrl();
        syncForm();
        const sim = simulate(state);
        renderHero(sim);
        renderRelic(sim);
        renderStats(sim);
        renderTable(sim);
        renderDrawdowns();
        renderHeatmap();
        if (window.Chart) {
            chartBase();
            renderGrowth(sim);
            renderCompare();
        }
    }

    function renderAll() {
        heroShown = { nominal: simulate(state).nominal, real: simulate(state).realValue };
        update();
    }

    async function init() {
        bindTips();
        bindTheme();
        bindDrawer();
        try {
            D = await (await fetch('data/returns.json')).json();
        } catch (e) {
            toast('Could not load the data. Reload the page.');
            return;
        }
        realPrefix = [0];
        for (let k = 0; k < D.years.length; k++) realPrefix.push(realPrefix[k] + Math.log((1 + D.sp500[k]) / (1 + D.inflation[k])));

        fillYearSelects();
        readUrl();
        syncForm();
        bindForm();
        bindHeatmap();
        renderYtd();
        // The HTML already shows the default numbers, so count up from them, not from zero.
        heroShown = { nominal: 83034, real: 48762 };
        sizeRelic();
        update();

        new ResizeObserver(() => { sizeRelic(); paintRelic(); }).observe($('#relicCanvas'));
        // Repaint once web fonts load, so the coin engraving and chart text use them.
        document.fonts?.ready.then(() => { window.Relic?.reset(); renderAll(); });

        let lastW = 0;
        new ResizeObserver(entries => {
            const w = entries[0].contentRect.width;
            if (Math.abs(w - lastW) > 1) { lastW = w; renderHeatmap(); }
        }).observe($('#heatCanvas').parentElement);
    }

    init();
})();
