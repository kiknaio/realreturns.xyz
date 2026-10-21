"""Rebuild data/returns.json and data/constituents.csv from the original sources.

Usage:
    pip install xlrd
    python3 scripts/build_data.py

Every number on the site is derived in the browser from data/returns.json,
so this script is the only place where data enters the project.
"""
import csv
import datetime as dt
import io
import json
import pathlib
import urllib.request

import xlrd

ROOT = pathlib.Path(__file__).resolve().parent.parent
# FRED times out on browser-like agents and Yahoo rate-limits curl-like ones.
UA_CURL = {"User-Agent": "curl/8.7.1", "Accept": "*/*"}
UA_BROWSER = {"User-Agent": "Mozilla/5.0"}

DAMODARAN = "https://pages.stern.nyu.edu/~adamodar/pc/datasets/histretSP.xls"
FRED_CPI = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCNS"
SP500TR = "https://query1.finance.yahoo.com/v8/finance/chart/%5ESP500TR?range=2y&interval=1d"
CONSTITUENTS = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"


def get(url, headers=UA_CURL):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as r:
        return r.read()


def damodaran():
    sheet = xlrd.open_workbook(file_contents=get(DAMODARAN)).sheet_by_name("Returns by year")
    # Columns: year, S&P 500 (incl. dividends), small cap, 3m T-bill, 10y T-bond, Baa corp, real estate, gold
    rows = {}
    for r in range(sheet.nrows):
        year = sheet.cell_value(r, 0)
        if isinstance(year, float) and 1900 < year < 2200 and isinstance(sheet.cell_value(r, 1), float):
            v = [sheet.cell_value(r, c) for c in (1, 3, 4, 5, 6, 7)]
            rows[int(year)] = v
    return rows


def cpi_monthly():
    text = get(FRED_CPI).decode()
    out = {}
    for row in csv.DictReader(io.StringIO(text)):
        if not row["CPIAUCNS"]:  # BLS skipped some months (e.g. Oct 2025 shutdown)
            continue
        d = dt.date.fromisoformat(row["observation_date"])
        out[(d.year, d.month)] = float(row["CPIAUCNS"])
    return out


def sp500_ytd(last_full_year):
    data = json.loads(get(SP500TR, UA_BROWSER))["chart"]["result"][0]
    points = [
        (dt.datetime.utcfromtimestamp(t).date(), c)
        for t, c in zip(data["timestamp"], data["indicators"]["quote"][0]["close"])
        if c is not None
    ]
    base = [c for d, c in points if d.year == last_full_year][-1]
    last_date, last = points[-1]
    if last_date.year != last_full_year + 1:
        return None
    return {"through": last_date.isoformat(), "value": round(last / base - 1, 6)}


def r6(x):
    return round(x, 6)


def main():
    assets = damodaran()
    cpi = cpi_monthly()
    years = sorted(y for y in assets if (y, 12) in cpi and (y - 1, 12) in cpi)

    series = {k: [] for k in ("sp500", "tbill", "tbond", "baa", "realEstate", "gold", "inflation")}
    for y in years:
        sp, tb, bond, baa, re_, gold = assets[y]
        for key, val in zip(("sp500", "tbill", "tbond", "baa", "realEstate", "gold"), (sp, tb, bond, baa, re_, gold)):
            series[key].append(r6(val))
        series["inflation"].append(r6(cpi[(y, 12)] / cpi[(y - 1, 12)] - 1))

    last = years[-1]
    ytd = None
    try:
        sp = sp500_ytd(last)
    except Exception as e:  # YTD is optional; the full-year data is enough to build the site
        print(f"warning: no YTD S&P 500 data ({e})")
        sp = None
    cpi_months = sorted(m for (yy, m) in cpi if yy == last + 1)
    if sp and cpi_months:
        m = cpi_months[-1]
        ytd = {
            "year": last + 1,
            "sp500": sp["value"],
            "sp500Through": sp["through"],
            "inflation": r6(cpi[(last + 1, m)] / cpi[(last, 12)] - 1),
            "inflationThrough": f"{last + 1}-{m:02d}",
        }

    out = {
        "updated": dt.date.today().isoformat(),
        "firstYear": years[0],
        "lastYear": last,
        "notes": {
            "returns": "Calendar-year total returns from Aswath Damodaran (NYU Stern), histretSP.xls.",
            "inflation": "CPI-U, not seasonally adjusted (BLS series CUUR0000SA0 via FRED CPIAUCNS), December over December.",
            "ytd": "S&P 500 Total Return index (^SP500TR) from the last close of the prior year; CPI through the latest month published.",
        },
        "years": years,
        **series,
        "ytd": ytd,
    }
    text = json.dumps(out, separators=(",", ":"))
    (ROOT / "data" / "returns.json").write_text(text + "\n")
    # Same data as a script, so the page can render before first paint without a fetch.
    (ROOT / "data" / "returns.js").write_text(f"window.RETURNS_DATA = {text};\n")
    (ROOT / "data" / "constituents.csv").write_bytes(get(CONSTITUENTS))
    print(f"{years[0]}-{last}, {len(years)} years; ytd={ytd}")


if __name__ == "__main__":
    main()
