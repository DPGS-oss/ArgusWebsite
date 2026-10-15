"""Reference rate lookup. lib/gst-rates.ts and lib/core/utils/gst_rate_book.dart must match it."""
import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')
book = json.load(open('gst-rates.json', encoding='utf-8'))


def options(code):
    """{'main': [...], 'special': [...]}; each option {rate, notes, outside}."""
    c = re.sub(r'\D', '', code or '')
    if len(c) < 2:
        return {'main': [], 'special': []}
    if c.startswith('99'):
        best = None
        for e in book['services']:
            for x in e['inc']:
                if c.startswith(x) and (best is None or len(x) > best[0]):
                    best = (len(x), e)
        opts = best[1]['o'] if best else [book['servicesDefault']]
        main = {}
        for o in opts:
            m = main.setdefault(o['r'], {'rate': o['r'], 'notes': [], 'outside': False})
            m['notes'].append(o['d'])
        return {'main': sorted(main.values(), key=lambda o: o['rate']), 'special': []}
    groups = {'main': {}, 'special': {}}
    covered = False
    # A main rule naming this code at 6+ digits overrides broader main rules for it.
    def spec(g):
        return max((len(x) for x in g['inc'] if c.startswith(x)), default=0)
    precise = max((spec(g) for g in book['goods'] if not g.get('x') and not any(c.startswith(e) for e in g['exc'])), default=0)
    def add(kind, rate, note, outside=False):
        key = 'x' if outside else rate
        o = groups[kind].setdefault(key, {'rate': rate, 'notes': [], 'outside': outside})
        if note not in o['notes']:
            o['notes'].append(note)
    for g in book['goods']:
        if any(c.startswith(e) for e in g['exc']):
            continue
        covers = any(c.startswith(x) for x in g['inc'])
        within = not covers and len(c) < 8 and any(x.startswith(c) for x in g['inc'])
        if not (covers or within):
            continue
        kind = 'special' if g.get('x') else 'main'
        if covers and kind == 'main' and precise >= 6 and spec(g) < precise:
            continue
        if covers and kind == 'main':
            covered = True
        add(kind, g['r'], g['d'])
    outside_only = False
    for e in book['outside']:
        if any(c.startswith(x) or x.startswith(c) for x in e['inc']):
            add('main', 0, e['d'], outside=True)
            if any(c.startswith(x) for x in e['inc']) and not covered:
                outside_only = True
    if not covered and not outside_only:
        add('main', book['goodsDefault']['r'], book['goodsDefault']['d'])
    result = {}
    for kind in ('main', 'special'):
        lst = sorted(groups[kind].values(), key=lambda o: (o['outside'], o['rate']))
        for o in lst:
            o['notes'] = o['notes'][:4]
        result[kind] = lst
    return result


if __name__ == '__main__':
    for code in sys.argv[1:]:
        r = options(code)
        print(code, 'MAIN', [(o['rate'], 'OUT' if o['outside'] else '', o['notes'][0][:55]) for o in r['main']],
              '| special', sorted({o['rate'] for o in r['special']}))
