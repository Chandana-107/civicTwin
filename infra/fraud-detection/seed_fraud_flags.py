# seed_fraud_findings.py  (replaces old seed_fraud_flags.py)
# Seeds fraud_audit_runs and fraud_findings tables with realistic
# sample data matching the unified fraudReport.js canonical schema.
# Run AFTER seed_tenders.py.

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from infra.db import get_connection
import random, json, uuid
from datetime import datetime, timedelta

DETECTION_TYPES = [
    "contractor_risk",
    "duplicate_aadhaar",
    "duplicate_beneficiary",
    "inactive_claims",
    "deceased_active",
    "phone_reuse",
    "bank_reuse",
    "shared_address",
    "identity_similarity",
    "regional_spike",
    "circular_identity",
]

ENTITY_TYPE_MAP = {
    "contractor_risk":      "contractor",
    "duplicate_aadhaar":    "beneficiary",
    "duplicate_beneficiary":"beneficiary",
    "inactive_claims":      "beneficiary",
    "deceased_active":      "beneficiary",
    "phone_reuse":          "beneficiary",
    "bank_reuse":           "beneficiary",
    "shared_address":       "beneficiary",
    "identity_similarity":  "beneficiary",
    "regional_spike":       "department",
    "circular_identity":    "tender",
}

SEVERITY_MAP = {
    "contractor_risk":      ["Medium", "High", "Critical"],
    "duplicate_aadhaar":    ["High", "Critical"],
    "duplicate_beneficiary":["Medium", "High"],
    "inactive_claims":      ["High", "Critical"],
    "deceased_active":      ["Critical"],
    "phone_reuse":          ["Medium"],
    "bank_reuse":           ["Medium", "High"],
    "shared_address":       ["Medium", "High"],
    "identity_similarity":  ["Medium"],
    "regional_spike":       ["High"],
    "circular_identity":    ["Critical"],
}

SCORE_MAP = {
    "Critical": (80, 100),
    "High":     (60, 80),
    "Medium":   (35, 60),
    "Low":      (10, 35),
}

SAMPLE_EXPLANATIONS = {
    "contractor_risk":      "Contractor won {pct}% of total contract value (₹{amount}) with {wins} awards in the lookback period.",
    "duplicate_aadhaar":    "Aadhaar {aadhaar}XXXX is linked to {count} different beneficiary IDs.",
    "duplicate_beneficiary":"Beneficiary ID appears {count} times across welfare disbursement records.",
    "inactive_claims":      "Beneficiary is marked deceased/inactive but continues to receive active disbursements.",
    "deceased_active":      "Beneficiary died on {death_date} but received {count} disbursement(s) after death (last: {last}).",
    "phone_reuse":          "Same phone number reused across {count} separate welfare claim records.",
    "bank_reuse":           "Same bank account reused across {count} separate beneficiary records.",
    "shared_address":       "{count} different beneficiary IDs share the same registered address.",
    "identity_similarity":  "Beneficiary name is >92% similar to another record — possible ghost/duplicate entry.",
    "regional_spike":       "Department '{dept}' disbursed ₹{amount} in {month} — {factor}× the 6-month rolling average.",
    "circular_identity":    "Approving official name/address/phone matches the winning contractor on tender {tnum}.",
}

STATUSES = ["open", "open", "open", "investigating", "escalated", "confirmed", "dismissed"]


def rand_amount(min_v, max_v):
    return round(random.uniform(min_v, max_v), 2)

def rand_datetime(days=180):
    return datetime.now() - timedelta(days=random.randint(0, days))


def build_evidence(ftype):
    if ftype == "contractor_risk":
        wins = random.randint(5, 20)
        return {
            "contractor":       f"Contractor-{random.randint(1,10)}",
            "tender_count":     wins,
            "win_rate":         round(random.uniform(0.3, 0.8), 3),
            "value_share":      round(random.uniform(0.3, 0.75), 3),
            "data_confidence":  random.choice(["low", "medium", "high"]),
            "score_parts": {
                "repeatWinner":   random.randint(10, 25),
                "bidCollusion":   random.randint(0, 20),
                "costAnomaly":    random.randint(0, 20),
                "tenderSplitting":random.randint(0, 15),
                "network":        0,
            },
        }
    elif ftype == "duplicate_aadhaar":
        count = random.randint(2, 4)
        return {
            "aadhaar_masked": f"{random.randint(1000,9999)}XXXX{random.randint(10,99)}",
            "linked_ids":     [str(uuid.uuid4()) for _ in range(count)],
            "count":          count,
        }
    elif ftype in ("duplicate_beneficiary", "phone_reuse", "bank_reuse"):
        return {"count": random.randint(2, 6)}
    elif ftype == "inactive_claims":
        return {"beneficiary_status": "deceased"}
    elif ftype == "deceased_active":
        death = (datetime.now() - timedelta(days=random.randint(90, 500))).strftime("%Y-%m-%d")
        last  = (datetime.now() - timedelta(days=random.randint(0, 89))).strftime("%Y-%m-%d")
        return {"death_date": death, "last_disbursement": last, "post_death_count": random.randint(1, 5)}
    elif ftype == "shared_address":
        count = random.randint(3, 7)
        return {"address": "12, HSR Layout Main Road, Bengaluru", "linked_ids": [str(uuid.uuid4()) for _ in range(count)], "count": count}
    elif ftype == "identity_similarity":
        return {"similar_to": str(uuid.uuid4()), "similarity_score": round(random.uniform(0.92, 0.99), 3)}
    elif ftype == "regional_spike":
        return {
            "department":   random.choice(["PWD", "Municipal", "Health Dept"]),
            "month":        (datetime.now() - timedelta(days=random.randint(0, 30))).strftime("%Y-%m"),
            "amount":       rand_amount(5_000_000, 30_000_000),
            "baseline_avg": rand_amount(500_000, 2_000_000),
            "spike_factor": round(random.uniform(2.5, 8.0), 2),
        }
    elif ftype == "circular_identity":
        return {
            "tender_number":  f"TDR-{random.randint(10000,99999)}",
            "contractor":     "CivicRise Engineering Services",
            "official_name":  "CivicRise Engineering",
            "matched_fields": random.sample(["name match", "shared address", "shared phone"], k=random.randint(1,3)),
            "amount":         rand_amount(1_000_000, 15_000_000),
        }
    return {}


def build_explanation(ftype, evidence):
    tmpl = SAMPLE_EXPLANATIONS.get(ftype, "Fraud signal detected.")
    try:
        return tmpl.format(
            pct    = round((evidence.get("value_share", 0) or 0) * 100, 1),
            amount = f"{int(evidence.get('amount', evidence.get('baseline_avg', 0)) or 0):,}",
            wins   = evidence.get("tender_count", "N/A"),
            aadhaar= evidence.get("aadhaar_masked", "XXXXXXXXXX")[:4],
            count  = evidence.get("count", evidence.get("post_death_count", 2)),
            death_date = evidence.get("death_date", "unknown"),
            last   = evidence.get("last_disbursement", "unknown"),
            dept   = evidence.get("department", "unknown"),
            month  = evidence.get("month", "unknown"),
            factor = evidence.get("spike_factor", "N/A"),
            tnum   = evidence.get("tender_number", "TDR-00000"),
        )
    except Exception:
        return f"Fraud signal: {ftype}"


def seed_fraud_findings(count=50):
    conn = get_connection()
    cur  = conn.cursor()

    # Fetch tender IDs for related_tender_ids
    cur.execute("SELECT id FROM tenders LIMIT 200;")
    tender_ids = [str(r[0]) for r in cur.fetchall()]

    # Fetch a user for reviewed_by
    cur.execute("SELECT id FROM users LIMIT 10;")
    user_ids = [str(r[0]) for r in cur.fetchall()]

    if not tender_ids:
        print("⚠  No tenders found — run seed_tenders.py first.")
        conn.close()
        return

    # Create a synthetic completed audit run
    run_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO fraud_audit_runs (id, status, started_at, completed_at, summary)
        VALUES (%s, 'completed', now() - INTERVAL '5 minutes', now(), %s);
    """, (run_id, json.dumps({
        "flags_detected":  count,
        "high_risk_cases": count // 3,
        "evidence_truncated": count > 100,
        "external_services": {"graph_invoked": False, "anomaly_invoked": False},
    })))

    seeded = 0
    for i in range(count):
        ftype      = random.choice(DETECTION_TYPES)
        entity_type= ENTITY_TYPE_MAP[ftype]
        entity_id  = (
            str(uuid.uuid4()) if entity_type in ("beneficiary", "tender")
            else random.choice(["PWD", "Municipal", "Health Dept"]) if entity_type == "department"
            else f"contractor-{random.randint(1,10)}"
        )

        severity   = random.choice(SEVERITY_MAP[ftype])
        lo, hi     = SCORE_MAP[severity]
        risk_score = round(random.uniform(lo, hi), 1)
        evidence   = build_evidence(ftype)
        explanation= build_explanation(ftype, evidence)
        status     = random.choice(STATUSES)
        finding_key= f"{ftype}:{entity_type}:{entity_id}"

        reviewed_by  = None
        reviewed_at  = None
        if status in ("confirmed", "dismissed", "investigating") and user_ids:
            reviewed_by = random.choice(user_ids)
            reviewed_at = rand_datetime(60)

        related = random.sample(tender_ids, min(random.randint(1, 4), len(tender_ids)))

        cur.execute("""
            INSERT INTO fraud_findings (
                run_id, finding_key, entity_type, entity_id, finding_type,
                severity, risk_score, anomaly_score, graph_score,
                title, explanation, evidence,
                related_tender_ids, related_cluster_ids,
                status, reviewed_by, reviewed_at,
                created_at, updated_at
            ) VALUES (
                %s,%s,%s,%s,%s,
                %s,%s,%s,%s,
                %s,%s,%s::jsonb,
                %s::jsonb,%s::jsonb,
                %s,%s,%s,
                now()-%s * INTERVAL '1 day', now()
            )
            ON CONFLICT (finding_key) DO NOTHING;
        """, (
            run_id, finding_key, entity_type, entity_id, ftype,
            severity, risk_score, None, None,
            f"[{severity}] {ftype.replace('_',' ').title()}: {entity_id[:16]}",
            explanation,
            json.dumps(evidence),
            json.dumps(related),
            json.dumps([]),
            status, reviewed_by, reviewed_at,
            random.randint(0, 180),
        ))
        seeded += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"✅  Seeded {seeded} fraud findings across {len(DETECTION_TYPES)} detection types.")
    print(f"   Audit run ID: {run_id}")


if __name__ == "__main__":
    seed_fraud_findings(60)
