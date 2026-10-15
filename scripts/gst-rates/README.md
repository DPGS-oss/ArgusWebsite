# GST rate book

`public/data/gst-rates.json` says which GST rate(s) the law gives each HSN/SAC
code. The website loads it from `/data/gst-rates.json`; the Android app ships a
copy (`argus/assets/data/gst-rates.json`) and downloads newer versions from the
same URL. Publishing a new file updates every shop without an app release.

Sources in use (version `2026-02-01.1`):

- Goods: CBIC GST Ready Reckoner as on 22.09.2025 (Notification 9/2025-Central
  Tax (Rate) schedules; exemptions 10/2025), with Notification 19/2025 from
  1 Feb 2026 (28% schedule omitted: tobacco and pan masala 40%, biris 18%).
- Services: Notification 11/2017 as amended by 15/2025 (56th GST Council
  decisions; PIB FAQ). Edited by hand in `build_rates.py`.
- Outside GST (alcohol for drinking, petrol, diesel, ATF, natural gas, crude):
  edited by hand in `build_rates.py`.

## When rates change

1. Get the new CBIC reckoner PDF (or the amending notification).
2. `python extract_reckoner.py reckoner.pdf` → `schedule.json`.
   For an amending notification, edit `build_rates.py` the way 19/2025 is
   applied there (schedule VII → 40%, biris → 18%).
3. Bump `version` and `effectiveFrom` in `build_rates.py`, then
   `python build_rates.py` → `gst-rates.json`.
4. Regenerate the golden file with `resolve_ref.py` (see the bottom of this
   README) and copy the outputs:
   - `gst-rates.json` → `public/data/gst-rates.json` and `argus/assets/data/gst-rates.json`
   - golden → `lib/gst-rate-golden.json` and `argus/test/fixtures/gst_rate_golden.json`
5. Run both test suites (they check the TS and Dart lookups against the
   golden file), then deploy the website. Phones pick the new file up on
   their next start; no app release is needed.

```python
import json
from resolve_ref import options, book
codes = sorted({e['c'] for e in book['catalog']})
golden = {c: {k: [[o['rate'], o['outside']] for o in options(c)[k]] for k in ('main', 'special')} for c in codes}
json.dump({'version': book['version'], 'codes': golden}, open('gst-rate-golden.json', 'w'), separators=(',', ':'))
```

Bills dated before a book's `effectiveFrom` are not checked against it, so old
bills keep the rate that applied when they were made.
