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

    // ---------- Intro and the hero coin ----------
    const relic = { shown: 0, raf: 0, label: '' };

    function sizeCanvas(cv) {
        const px = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1));
        if (px > 0 && cv.width !== px) { cv.width = px; cv.height = px; }
    }

    function theme() {
        const t = document.documentElement.dataset.theme;
        if (t) return t;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function paintHero() {
        if (window.Relic) Relic.paint($('#relicCanvas'), { erosion: relic.shown, theme: theme(), label: relic.label });
    }

    function setHeroErosion(target, label) {
        relic.label = label;
        cancelAnimationFrame(relic.raf);
        if (!motion()) { relic.shown = target; paintHero(); return; }
        const start = relic.shown, t0 = performance.now(), dur = 1000;
        const step = now => {
            const t = Math.min(1, (now - t0) / dur);
            relic.shown = start + (target - start) * (1 - Math.pow(1 - t, 3));
            paintHero();
            if (t < 1) relic.raf = requestAnimationFrame(step);
        };
        relic.raf = requestAnimationFrame(step);
    }

    function renderIntro(cash) {
        const { from, to } = state;
        const span = from === to ? `in ${from}` : `from ${from} to ${to}`;
        if (cash.cpi >= 1) {
            $('#introText').textContent = `Prices rose ${pct(cash.cpi - 1, 0, false)} ${span}. A dollar kept as cash lost ${pct(cash.lost, 0, false)} of its buying power. Here is what kept up.`;
        } else {
            $('#introText').textContent = `Prices fell ${pct(1 - cash.cpi, 0, false)} ${span}, so even cash gained buying power. Here is how each asset did.`;
        }
        $('#plTitle').textContent = `One dollar, ${from}`;
        $('#plBody').textContent = cash.lost > 0
            ? `Plaster and calcite. ${pct(cash.lost, 0, false)} eroded by the end of ${to}.`
            : `Plaster. Not eroded: prices fell by the end of ${to}.`;
        $('#relicCanvas').setAttribute('aria-label',
            `A plaster one-dollar coin. ${pct(cash.lost, 0, false)} of it has eroded into blue crystal: the buying power cash lost from ${from} to ${to}.`);
        setHeroErosion(cash.lost, String(from));
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
    function sparkScale(amount) {
        const all = results.flatMap(r => r.path.map(p => p.y)).concat(amount);
        const lo = Math.log(Math.min(...all)), hi = Math.log(Math.max(...all));
        const span = hi - lo || 1;
        return v => 38 - ((Math.log(v) - lo) / span) * 36;   // viewBox height 40, 2 units of padding
    }

    function spark(r, y, amount, color) {
        const n = r.path.length - 1;
        const pts = r.path.map((p, i) => [(i / n) * 100, y(p.y)]);
        const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`).join(' ');
        const base = y(amount).toFixed(2);
        const box = svg('svg', { viewBox: '0 0 100 40', preserveAspectRatio: 'none', class: 'spark' });
        // Area above the dashed line (gained buying power) in the asset color, below it (lost) in red.
        const above = `clip-up-${r.key}`, below = `clip-down-${r.key}`;
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
            const row = el('li', { class: 'asset', 'data-key': r.key }, [
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
            ]);
            row.setAttribute('aria-label',
                `${r.name}: buys what ${money(r.real)} bought in ${from}. ${pct(r.perYear)} a year after inflation. ${money(r.nominal)} in dollars.`);
            return row;
        }));
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
        $('#periodText').textContent = from === to ? String(from) : `${from} – ${to}`;
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
        // data/returns.js sets the data synchronously, so the page renders in one pass.
        D = window.RETURNS_DATA;
        if (!D) { toast('Could not load the data. Reload the page.'); return; }
        $('#dataNote').textContent = `Data ${D.firstYear}–${D.lastYear}`;

        setupYearRange();
        readUrl();
        bindControls();
        sizeCanvas($('#relicCanvas'));
        update();

        new ResizeObserver(() => { sizeCanvas($('#relicCanvas')); paintHero(); }).observe($('#relicCanvas'));
        // Repaint once web fonts load, so the coin engraving and chart text use them.
        // Animations start only after that, when the reader changes something.
        const ready = document.fonts ? document.fonts.ready : Promise.resolve();
        ready.then(() => { window.Relic?.reset(); render(); }).finally(() => { animate = true; });
        // Smooth scrolling only after load, so a reload with #section does not glide.
        window.addEventListener('load', () => document.documentElement.classList.add('smooth'), { once: true });
    }

    init();
})();
