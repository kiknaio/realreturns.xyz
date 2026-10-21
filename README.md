# realreturns.xyz

What your money really buys: the buying power of the S&P 500, gold, corporate bonds,
10-year Treasuries, US homes, savings (T-bills) and cash after inflation, for any period since 1928.

Choose an amount and a period. Each asset shows what your money buys at the end, in start-year
dollars, and its real return per year. A small plaster coin erodes into crystal by the share of
buying power the asset lost. The view is kept in the URL, so you can share it.

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
