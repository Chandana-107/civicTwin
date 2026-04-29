# seed_tenders.py
# Seeds the tenders table with realistic data that exercises every fraud
# detection module in fraudPipeline.js:
#   - Contractor dominance (value + count share)
#   - Bid splitting (30-day rolling window)
#   - Near-threshold awards
#   - Sole-source / unknown bidder count
#   - Duplicate Aadhaar across beneficiaries
#   - Same address, different beneficiary IDs
#   - Post-death disbursements (death_date)
#   - Regional disbursement spike
#   - Approver–contractor identity conflict (circular)
#   - Name similarity (ghost beneficiaries)

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from infra.db import get_connection
import random, json, uuid
from datetime import datetime, timedelta, date

# ── Master data ───────────────────────────────────────────────────────────────

CONTRACTORS = [
    ("Shakti Infra Projects Pvt Ltd",   str(uuid.uuid4())),
    ("Namma Utility Services LLP",      str(uuid.uuid4())),
    ("SouthGrid Electrical Works",      str(uuid.uuid4())),
    ("Urban Axis Buildtech Pvt Ltd",    str(uuid.uuid4())),
    ("CivicRise Engineering Services",  str(uuid.uuid4())),
    ("Bharat Public Systems Ltd",       str(uuid.uuid4())),
    ("Pragati Maintenance Solutions",   str(uuid.uuid4())),
    ("Sahyadri Transport Infra",        str(uuid.uuid4())),
    ("BlueRiver Watertech Services",    str(uuid.uuid4())),
    ("Annapurna Procurement Services",  str(uuid.uuid4())),
]

# Dominant contractor — used for value/count share fraud signals
DOMINANT = CONTRACTORS[0]

DEPARTMENTS   = ["PWD", "Municipal", "Water Board", "Electricity Dept", "IT Dept", "Health Dept"]
CATEGORIES    = ["Construction", "IT Services", "Electrical", "Maintenance", "Transport", "Supplies"]
INDIAN_CITIES = ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi", "Davanagere"]
AREAS         = ["Indiranagar", "Koramangala", "Whitefield", "HSR Layout", "Jayanagar", "Marathahalli"]

SPLIT_THRESHOLD = 1_000_000   # ₹10 lakh — matches THRESHOLDS.TENDER_SPLIT_VALUE default

def rand_date(days_ago_max=365, days_ago_min=0):
    delta = random.randint(days_ago_min, days_ago_max)
    return (datetime.now() - timedelta(days=delta)).date()

def rand_phone():
    return f"9{random.randint(600000000, 999999999)}"

def rand_address(city=None, area=None):
    city = city or random.choice(INDIAN_CITIES)
    area = area or random.choice(AREAS)
    return f"{random.randint(1,250)}, {area} Main Road, {city}, Karnataka"

def rand_aadhaar():
    return f"{random.randint(1000, 9999)}{random.randint(1000, 9999)}{random.randint(1000, 9999)}"

def insert_tender(cur, **kwargs):
    meta = kwargs.pop("meta", {})
    cur.execute("""
        INSERT INTO tenders (
            tender_number, title, contractor, contractor_id,
            amount, date, category, department,
            beneficiary_id, phone, address, death_date, meta
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (tender_number) DO NOTHING;
    """, (
        kwargs.get("tender_number", f"TDR-{random.randint(10000,99999)}"),
        kwargs.get("title", "General Civic Works"),
        kwargs.get("contractor", CONTRACTORS[0][0]),
        kwargs.get("contractor_id", CONTRACTORS[0][1]),
        kwargs.get("amount", 500000),
        kwargs.get("date", rand_date()),
        kwargs.get("category", random.choice(CATEGORIES)),
        kwargs.get("department", random.choice(DEPARTMENTS)),
        kwargs.get("beneficiary_id", None),
        kwargs.get("phone", None),
        kwargs.get("address", None),
        kwargs.get("death_date", None),
        json.dumps(meta),
    ))


def seed_tenders():
    conn = get_connection()
    cur  = conn.cursor()
    tnum = [10000]  # mutable counter

    def next_tnum():
        tnum[0] += random.randint(1, 99)
        return f"TDR-{tnum[0]}"

    # ── 1. Normal background tenders (diverse contractors) ────────────────────
    print("  Seeding background tenders...")
    for i in range(30):
        name, cid = random.choice(CONTRACTORS[2:])
        city, area = random.choice(INDIAN_CITIES), random.choice(AREAS)
        insert_tender(cur,
            tender_number=next_tnum(),
            title=f"General civic work in {area}, {city}",
            contractor=name, contractor_id=cid,
            amount=round(random.uniform(200_000, 8_000_000), 2),
            date=rand_date(),
            department=random.choice(DEPARTMENTS),
            category=random.choice(CATEGORIES),
            meta={"bidder_count": random.randint(3, 8), "risk_score": round(random.uniform(0, 0.3), 3)},
        )

    # ── 2. Dominant contractor — many wins to trigger count+value share ───────
    print("  Seeding dominant contractor pattern...")
    dom_name, dom_id = DOMINANT
    for i in range(18):   # 18 out of ~60 total = >30% count share
        insert_tender(cur,
            tender_number=next_tnum(),
            title=f"Road resurfacing phase {i+1} — Koramangala",
            contractor=dom_name, contractor_id=dom_id,
            amount=round(random.uniform(3_000_000, 12_000_000), 2),  # high value
            date=rand_date(),
            department="PWD",
            category="Construction",
            meta={
                "bidder_count": random.choice([1, 2, None]),  # sole-source signals
                "execution_cost": round(random.uniform(3_500_000, 15_000_000), 2),
                "risk_score": round(random.uniform(0.5, 0.9), 3),
            },
        )

    # ── 3. Bid splitting — same contractor, same dept, within 30 days ─────────
    print("  Seeding bid splitting pattern...")
    split_name, split_id = CONTRACTORS[1]
    split_anchor = rand_date(days_ago_max=300, days_ago_min=60)
    for i in range(4):
        split_date = split_anchor + timedelta(days=random.randint(0, 25))
        insert_tender(cur,
            tender_number=next_tnum(),
            title=f"Drain maintenance package {i+1} — Whitefield",
            contractor=split_name, contractor_id=split_id,
            amount=round(random.uniform(700_000, 950_000), 2),  # each below 10L threshold
            date=split_date,
            department="Municipal",
            category="Maintenance",
            meta={"bidder_count": 1, "risk_score": 0.75},
        )

    # ── 4. Near-threshold single award (85–99% of 10L limit) ──────────────────
    print("  Seeding near-threshold award...")
    nt_name, nt_id = CONTRACTORS[2]
    insert_tender(cur,
        tender_number=next_tnum(),
        title="LED streetlight near-threshold contract — Jayanagar",
        contractor=nt_name, contractor_id=nt_id,
        amount=920_000,   # 92% of 10L threshold
        date=rand_date(),
        department="Electricity Dept",
        category="Electrical",
        meta={"bidder_count": 1, "risk_score": 0.8},
    )

    # ── 5. Ghost beneficiaries — duplicate Aadhaar ────────────────────────────
    print("  Seeding duplicate Aadhaar pattern...")
    shared_aadhaar = rand_aadhaar()
    for i in range(3):
        bid = str(uuid.uuid4())
        insert_tender(cur,
            tender_number=next_tnum(),
            title=f"Welfare disbursement — duplicate Aadhaar record {i+1}",
            contractor=random.choice(CONTRACTORS)[0],
            contractor_id=random.choice(CONTRACTORS)[1],
            amount=round(random.uniform(5_000, 50_000), 2),
            date=rand_date(),
            department="Health Dept",
            category="Supplies",
            beneficiary_id=bid,
            phone=rand_phone(),
            address=rand_address(),
            meta={
                "aadhaar_number": shared_aadhaar,   # same Aadhaar, different beneficiary_id
                "beneficiary_name": f"Beneficiary {chr(65+i)}",
                "bank_account": f"STATE{random.randint(10000000,99999999)}",
                "bidder_count": 1,
            },
        )

    # ── 6. Same address, 4 different beneficiary IDs ──────────────────────────
    print("  Seeding same-address cluster...")
    shared_addr  = "12, HSR Layout Main Road, Bengaluru, Karnataka"
    shared_phone = rand_phone()
    for i in range(4):
        bid = str(uuid.uuid4())
        insert_tender(cur,
            tender_number=next_tnum(),
            title=f"Welfare scheme — shared address record {i+1}",
            contractor=random.choice(CONTRACTORS)[0],
            contractor_id=random.choice(CONTRACTORS)[1],
            amount=round(random.uniform(3_000, 30_000), 2),
            date=rand_date(),
            department="Health Dept",
            category="Supplies",
            beneficiary_id=bid,
            phone=rand_phone(),
            address=shared_addr,    # same address, different IDs
            meta={
                "aadhaar_number": rand_aadhaar(),
                "beneficiary_name": f"Resident {i+1}",
                "bank_account": f"STATE{random.randint(10000000,99999999)}",
            },
        )

    # ── 7. Deceased beneficiary — death_date before latest tender ─────────────
    print("  Seeding post-death disbursement pattern...")
    deceased_bid = str(uuid.uuid4())
    death = date(2023, 6, 15)
    # Record before death (valid)
    insert_tender(cur,
        tender_number=next_tnum(),
        title="Ration scheme disbursement — pre-death (valid)",
        contractor=random.choice(CONTRACTORS)[0],
        contractor_id=random.choice(CONTRACTORS)[1],
        amount=12_000,
        date=date(2023, 4, 10),
        department="Health Dept",
        category="Supplies",
        beneficiary_id=deceased_bid,
        phone=rand_phone(),
        address=rand_address(),
        death_date=death,
        meta={
            "aadhaar_number": rand_aadhaar(),
            "beneficiary_name": "Ramaiah B",
            "beneficiary_status": "deceased",
            "bank_account": "STATE12345678",
        },
    )
    # Record AFTER death (should be flagged)
    for i in range(2):
        insert_tender(cur,
            tender_number=next_tnum(),
            title=f"Ration scheme disbursement — POST-DEATH record {i+1}",
            contractor=random.choice(CONTRACTORS)[0],
            contractor_id=random.choice(CONTRACTORS)[1],
            amount=12_000,
            date=date(2023, 6, 15) + timedelta(days=30*(i+1)),
            department="Health Dept",
            category="Supplies",
            beneficiary_id=deceased_bid,
            phone=rand_phone(),
            address=rand_address(),
            death_date=death,
            meta={
                "aadhaar_number": rand_aadhaar(),
                "beneficiary_name": "Ramaiah B",
                "beneficiary_status": "deceased",
                "bank_account": "STATE12345678",
            },
        )

    # ── 8. Regional disbursement spike (PWD dept spike this month vs history) ──
    print("  Seeding regional disbursement spike...")
    spike_name, spike_id = CONTRACTORS[3]
    # 6 months of normal amounts
    for m in range(6):
        spike_d = (datetime.now() - timedelta(days=30*(m+2))).date()
        insert_tender(cur,
            tender_number=next_tnum(),
            title=f"Road works — baseline month {m+1}",
            contractor=spike_name, contractor_id=spike_id,
            amount=round(random.uniform(500_000, 1_500_000), 2),
            date=spike_d,
            department="PWD",
            category="Construction",
            meta={"bidder_count": random.randint(3, 6)},
        )
    # Spike month — 10× normal
    spike_d = (datetime.now() - timedelta(days=15)).date()
    for _ in range(5):
        insert_tender(cur,
            tender_number=next_tnum(),
            title="Emergency infrastructure — spike month",
            contractor=spike_name, contractor_id=spike_id,
            amount=round(random.uniform(8_000_000, 15_000_000), 2),
            date=spike_d,
            department="PWD",
            category="Construction",
            meta={"bidder_count": 1, "risk_score": 0.85},
        )

    # ── 9. Approver–contractor identity conflict (official_name ≈ contractor) ──
    print("  Seeding circular identity pattern...")
    circ_name, circ_id = CONTRACTORS[4]
    shared_phone_circ = rand_phone()
    insert_tender(cur,
        tender_number=next_tnum(),
        title="IT platform upgrade — conflict of interest",
        contractor=circ_name, contractor_id=circ_id,
        amount=9_500_000,
        date=rand_date(),
        department="IT Dept",
        category="IT Services",
        phone=shared_phone_circ,
        address="45, Koramangala 4th Block, Bengaluru, Karnataka",
        meta={
            "bidder_count": 1,
            # official_name similar to contractor → circular identity flag
            "official_id":      "OFF-001",
            "official_name":    "CivicRise Engineering",   # similar to "CivicRise Engineering Services"
            "official_address": "45, Koramangala 4th Block, Bengaluru, Karnataka",
            "official_phone":   shared_phone_circ,
            "risk_score": 0.9,
        },
    )

    # ── 10. Name-similarity ghost beneficiaries ────────────────────────────────
    print("  Seeding fuzzy ghost beneficiary names...")
    ghost_names = ["Ramesh Kumar", "Ramesh Kumaar", "Raamesh Kumar"]  # very similar
    ghost_addr  = rand_address()
    for gname in ghost_names:
        bid = str(uuid.uuid4())
        insert_tender(cur,
            tender_number=next_tnum(),
            title="Subsidy disbursement — similar name",
            contractor=random.choice(CONTRACTORS)[0],
            contractor_id=random.choice(CONTRACTORS)[1],
            amount=round(random.uniform(2_000, 20_000), 2),
            date=rand_date(),
            department="Health Dept",
            category="Supplies",
            beneficiary_id=bid,
            phone=rand_phone(),
            address=ghost_addr,
            meta={
                "aadhaar_number":    rand_aadhaar(),
                "beneficiary_name":  gname,
                "bank_account":      f"STATE{random.randint(10000000,99999999)}",
            },
        )

    conn.commit()
    cur.close()
    conn.close()

    total = 30 + 18 + 4 + 1 + 3 + 4 + 3 + 11 + 1 + 3
    print(f"\n✅  Seeded ~{total} tenders with fraud signals across all 10 detection modules.")
    print("   Run the fraud pipeline (POST /fraud/run) to see flags generated.")


if __name__ == "__main__":
    seed_tenders()
