# realreturns.xyz

What the S&P 500 really returned after inflation, for any period since 1928.

- Calculator: start and end year, lump sum, monthly deposits, fund fee and tax drag. The state is kept in the URL, so every scenario has a link.
- Growth chart with major market events, linear or log scale.
- Comparison with 10-year Treasuries, T-bills, gold, US homes, corporate bonds and cash.
- Heatmap of the real annual return for every start and end year.
- Real recovery time after each crash of 20% or more.
- Year-by-year table with CSV download, and a share image for each scenario.

## Data

All numbers on the page are calculated in the browser from one file, [`data/returns.json`](data/returns.json).

- Annual total returns (S&P 500 with dividends, T-bills, 10-year Treasury, Baa corporate, real estate, gold): [Aswath Damodaran, NYU Stern](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histret.html)
- Inflation: CPI-U, not seasonally adjusted, December over December ([FRED CPIAUCNS](https://fred.stlouisfed.org/series/CPIAUCNS) / BLS)
- Current year to date: S&P 500 Total Return index (^SP500TR) and the latest CPI month
- S&P 500 companies: [datasets/s-and-p-500-companies](https://github.com/datasets/s-and-p-500-companies)

To update the data:

```
pip install xlrd
python3 scripts/build_data.py
```

## Run locally

```
bun run server.ts
```
