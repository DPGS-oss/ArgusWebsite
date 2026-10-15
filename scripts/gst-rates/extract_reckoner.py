"""Turns CBIC's GST Ready Reckoner (goods) PDF into schedule.json.

Usage: python extract_reckoner.py reckoner.pdf   (needs: pip install pymupdf)

Each schedule restarts its serial numbers at 1, so rows are assigned to
schedules by order: I (CGST 2.5% = 5% GST), II (9% = 18%), III (20% = 40%),
IV (1.5% = 3%), V (0.125% = 0.25%), VI (0.75% = 1.5%), VII (14% = 28%,
omitted from 1 Feb 2026 by 19/2025), then the exempted goods (Nil). Rows the
table reader garbles are refilled from the page text.
"""
import json, re, sys
import pymupdf

SCHED = [('I', 5), ('II', 18), ('III', 40), ('IV', 3), ('V', 0.25), ('VI', 1.5), ('VII', 28), ('EXEMPT', 0)]
LAST_PAGE = 81  # after this: other notifications and compensation cess (ended 1 Feb 2026)


def main(path):
    doc = pymupdf.open(path)
    rows = []
    for pno in range(min(doc.page_count, LAST_PAGE)):
        for t in doc[pno].find_tables().tables:
            for r in t.extract():
                cells = [(c or '').replace('\n', ' ').strip() for c in r]
                if len(cells) >= 4 and re.match(r'^\d+[A-Z]?\.?$', cells[0] or ''):
                    rows.append({'page': pno + 1, 'sno': int(re.match(r'\d+', cells[0]).group()), 'hsn': cells[1], 'desc': cells[2]})
    out, k, prev = [], -1, 10 ** 9
    for r in rows:
        if r['sno'] < prev and r['sno'] <= 2:
            k += 1
        prev = r['sno']
        name, rate = SCHED[k]
        out.append({'sched': name, 'rate': rate, **r})
    texts = {}
    for o in out:
        if o['hsn'] and o['desc']:
            continue
        t = texts.setdefault(o['page'], doc[o['page'] - 1].get_text())
        m = re.search(r'(?m)^\s*%d\.\s*\n(.*?)\n(.*?)(?=\n\s*(?:\d+(?:\.\d+)?%%|Nil|NIL)\s*\n)' % o['sno'], t, re.S)
        if m:
            o['hsn'] = o['hsn'] or m.group(1).strip()
            o['desc'] = o['desc'] or ' '.join(m.group(2).split())
    json.dump(out, open('schedule.json', 'w', encoding='utf-8'), ensure_ascii=False)
    print('rows', len(out), 'missing', sum(1 for o in out if not o['hsn']))


if __name__ == '__main__':
    main(sys.argv[1])
