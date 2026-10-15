"""Builds gst-rates.json: the GST rate book both apps use.

Goods: CBIC GST Ready Reckoner as on 22.09.2025 (Notification 9/2025-CT(Rate)
schedules, exemptions 10/2025-CT(Rate)), with Notification 19/2025-CT(Rate)
applied from 1 Feb 2026 (28% schedule omitted: tobacco and pan masala 40%,
biris 18%). Services: Notification 11/2017-CT(Rate) as amended by 15/2025,
per the 56th GST Council decisions (PIB FAQ, 2025).
"""
import csv, json, re, sys
sys.stdout.reconfigure(encoding='utf-8')

out = json.load(open('schedule.json', encoding='utf-8'))
CODE = re.compile(r'\d{2}(?:\s?\d{2}){0,3}')


def expand_ranges(spec):
    # "5208 to 5212" means every heading from 5208 to 5212; "50 to 55" every chapter.
    def repl(m):
        a, b = m.group(1), m.group(2)
        if len(a) != len(b):
            return m.group(0)
        return ', '.join(str(n).zfill(len(a)) for n in range(int(a), int(b) + 1))
    return re.sub(r"\b(\d{4}|\d{2})\s+to\s+(\d{4}|\d{2})\b", repl, spec)


def parse(spec):
    if 'any chapter' in spec.lower():
        return None, None
    spec = expand_ranges(spec)
    cut = re.split(r'\[?\(?\s*(?:except|other than|excluding)', spec, flags=re.I)
    inc = [c.replace(' ', '') for c in CODE.findall(cut[0])]
    exc = [c.replace(' ', '') for part in cut[1:] for c in CODE.findall(part)]
    return inc, exc


def clean(desc):
    d = ' '.join(desc.replace('\u2015', '"').replace('\u2013', '-').split())
    return d if len(d) <= 220 else d[:217].rsplit(' ', 1)[0] + '…'


goods = []
for o in out:
    inc, exc = parse(o['hsn'])
    if not inc:
        continue
    rate = 40 if o['sched'] == 'VII' else o['rate']  # 19/2025: 28% schedule omitted from 1 Feb 2026
    goods.append({'r': rate, 'inc': inc, 'exc': exc, 'd': clean(o['desc']) or 'All goods',
                  'src': f"{'Exempt' if o['sched'] == 'EXEMPT' else 'Sch ' + o['sched']} #{o['sno']}"})
goods.append({'r': 18, 'inc': ['24031921', '24031929'], 'exc': [], 'd': 'Biris', 'src': '19/2025 Sch II'})

# Chapter-wide rows are usually about one specific product (renewable energy
# devices, listed medicines, khadi, idols …). They stay as "special cases"
# instead of competing with an item's own rate. These chapter-wide rows are
# general rules for everything in the chapter, so they stay main choices:
MAIN_BROAD = {
    'Sch I #60',   # Chapter 12, all goods other than of seed quality
    'Sch I #387',  # Knitted or crocheted fabrics, all goods
    'Sch I #388', 'Sch I #389', 'Sch I #390',  # Apparel and made-ups up to Rs 2,500 a piece
    'Sch I #392',  # Footwear up to Rs 2,500 a pair
    'Sch I #440', 'Sch I #441',  # Fuel-cell and electric vehicles
    'Sch II #35', 'Sch II #36',  # All inorganic / organic chemicals
    'Sch II #197', 'Sch II #198', 'Sch II #199',  # Apparel and made-ups above Rs 2,500 a piece
}
for g in goods:
    if any(len(x) == 2 for x in g['inc']) and g['src'] not in MAIN_BROAD:
        g['x'] = 1

# Outside GST altogether (Article 366(12A); s.9(2) CGST Act): no GST is charged.
outside = [
    {'inc': ['2203', '2204', '2205', '2206', '2208'],
     'd': 'Alcoholic liquor for human consumption: outside GST (state excise / VAT applies). Issue a bill of supply at 0%.'},
    {'inc': ['2207'], 'd': 'Undenatured ethyl alcohol for human consumption: outside GST.'},
    {'inc': ['2709'], 'd': 'Crude petroleum: outside GST.'},
    {'inc': ['2710'], 'd': 'Petrol, high-speed diesel and aviation turbine fuel: outside GST (lubricants, kerosene and other oils are taxable).'},
    {'inc': ['27111100', '27112100'], 'd': 'Natural gas (incl. LNG): outside GST.'},
]

# Services (SAC). Options carry the condition; "noItc" marks rates without input credit.
services = [
    {'inc': ['9963'], 'o': [
        {'r': 5, 'd': 'Restaurant, café or eating place (not in a hotel charging over ₹7,500 a night), incl. takeaway and delivery — no input credit'},
        {'r': 18, 'd': 'Restaurant or outdoor catering in "specified premises" (hotel with any room over ₹7,500 a night)'},
        {'r': 5, 'd': 'Hotel room up to ₹7,500 a night — no input credit'},
        {'r': 18, 'd': 'Hotel room over ₹7,500 a night'},
    ]},
    {'inc': ['9964'], 'o': [
        {'r': 5, 'd': 'Passenger transport by road, rail or cab — no input credit'},
        {'r': 18, 'd': 'Passenger transport by road or cab, opting for 18% with input credit'},
        {'r': 5, 'd': 'Air travel, economy class'},
        {'r': 18, 'd': 'Air travel, other than economy class'},
    ]},
    {'inc': ['9965'], 'o': [
        {'r': 5, 'd': 'Goods transport agency (GTA) or container train — no input credit'},
        {'r': 18, 'd': 'GTA or container train opting for 18% with input credit; local delivery through e-commerce'},
        {'r': 0, 'd': 'Transport of agricultural produce, milk, salt, food grains and other exempt essentials'},
    ]},
    {'inc': ['9967', '9968'], 'o': [{'r': 18, 'd': 'Courier, storage, warehousing and other logistics support'}]},
    {'inc': ['9954'], 'o': [
        {'r': 18, 'd': 'Works contract / construction services (general)'},
        {'r': 5, 'd': 'Residential real estate (non-affordable), no input credit'},
        {'r': 1, 'd': 'Affordable residential housing, no input credit'},
    ]},
    {'inc': ['9988'], 'o': [
        {'r': 5, 'd': 'Job work: textiles, printing, pharmaceuticals, leather, bricks and other specified items'},
        {'r': 18, 'd': 'Other job work (residuary), and job work for alcoholic liquor'},
    ]},
    {'inc': ['9996'], 'o': [
        {'r': 5, 'd': 'Cinema ticket up to ₹100'},
        {'r': 18, 'd': 'Cinema ticket over ₹100; other entertainment and recreation'},
        {'r': 40, 'd': 'Admission to IPL-type sporting events, casinos, race clubs'},
        {'r': 0, 'd': 'Admission to other sporting events up to ₹500'},
    ]},
    {'inc': ['9997'], 'o': [
        {'r': 5, 'd': 'Beauty and physical well-being: salons, barbers, gyms, health clubs, yoga — no input credit'},
        {'r': 18, 'd': 'Other services'},
    ]},
    {'inc': ['9971'], 'o': [
        {'r': 18, 'd': 'Financial, banking and other insurance services'},
        {'r': 0, 'd': 'Individual life and health insurance policies (incl. term, ULIP, family floater)'},
    ]},
    {'inc': ['9992'], 'o': [
        {'r': 0, 'd': 'School, college and other recognised education'},
        {'r': 18, 'd': 'Coaching and other education services'},
    ]},
    {'inc': ['9993'], 'o': [
        {'r': 0, 'd': 'Health care by clinics, hospitals and doctors'},
        {'r': 18, 'd': 'Other (e.g. cosmetic procedures)'},
    ]},
    {'inc': ['9972'], 'o': [
        {'r': 18, 'd': 'Renting of commercial property; real estate agents'},
        {'r': 0, 'd': 'Renting a home to an individual for residence'},
    ]},
]
# Everything else in Chapter 99 (IT, legal, consulting, telecom, repairs, advertising …) is 18%.
services_default = {'r': 18, 'd': 'Services not listed elsewhere (IT, consulting, legal, telecom, repairs, advertising and so on)'}

# Search catalog: HSN/SAC codes and plain descriptions, kept from the published book.
import os
published = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'data', 'gst-rates.json')
cat = {e['c']: e['d'] for e in json.load(open(published, encoding='utf-8'))['catalog']}

book = {
    'version': '2026-02-01.1',
    'effectiveFrom': '2026-02-01',
    'sources': [
        'Notification 9/2025-Central Tax (Rate), 17 Sep 2025, effective 22 Sep 2025 (CBIC GST Ready Reckoner as on 22.09.2025)',
        'Notification 10/2025-Central Tax (Rate): exempted goods',
        'Notification 19/2025-Central Tax (Rate), 31 Dec 2025, effective 1 Feb 2026: 28% schedule omitted; tobacco and pan masala 40%, biris 18%',
        'Notification 11/2017-Central Tax (Rate) as amended by 15/2025: services (56th GST Council decisions)',
    ],
    'note': 'Rates shown are total GST (CGST + SGST, or IGST). Only notifications in the Gazette have the force of law.',
    'goods': goods,
    'goodsDefault': {'r': 18, 'd': 'Goods not listed elsewhere (Schedule II residual entry)'},
    'outside': outside,
    'services': services,
    'servicesDefault': services_default,
    'catalog': [{'c': c, 'd': d} for c, d in sorted(cat.items()) if re.fullmatch(r'\d{2,8}', c.replace(' ', ''))],
}
json.dump(book, open('gst-rates.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('goods rules', len(goods), 'catalog', len(cat), 'bytes', len(json.dumps(book, ensure_ascii=False, separators=(',', ':')).encode()))
