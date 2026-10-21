# realreturns.xyz

What your money really buys: the buying power of the S&P 500, gold, corporate bonds,
10-year Treasuries, US homes, savings (T-bills) and cash after inflation, for any period since 1928.

Choose an amount and a period. Each asset shows what your money buys at the end, in start-year
dollars, its real return per year, and a small line of its buying power over the period.
Click an asset to open a short explanation: what it is, how people own it, how it does against
inflation, and its main risk. The view is kept in the URL (for example `?from=2000#gold`), so you
can share it.

The asset sculptures in `assets/img` were generated with an image model (Codex).

## Data

All numbers are calculated in the browser from one file, [`data/returns.json`](data/returns.json)
(also loaded as `data/returns.js`).

- Annual total returns: [Aswath Damodaran, NYU Stern](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histret.html)
- Inflation: CPI-U, not seasonally adjusted, December over December ([FRED CPIAUCNS](https://fred.stlouisfed.org/series/CPIAUCNS))

To update the data:

```
pip install xlrd
python3 scripts/build_data.py
```

## Run locally

```
bun run server.ts
```
