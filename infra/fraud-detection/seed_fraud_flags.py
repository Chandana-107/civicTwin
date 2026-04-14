# seed_fraud_flags.py
from infra.db import get_connection
import random
import json
from datetime import datetime, timedelta

RULES = [
    "repeat_winner",
    "price_outlier",
    "suspicious_beneficiary",
    "duplicate_phone",
    "high_risk_contractor",
    "rapid_award_cycle"
]

STATUSES = ["pending", "investigating", "confirmed", "dismissed"]

EVIDENCE_LIBRARY = {
    "repeat_winner": {
        "descriptions": [
            "Same contractor has won multiple ward-level tenders in a short duration.",
            "Bid history shows repeated awards to one vendor across similar categories.",
            "Award pattern indicates low distribution of contracts among eligible bidders."
        ],
        "analyses": [
            "Tender comparison across the last 6 months shows concentration of awards with the same contractor, especially for maintenance and road works.",
            "Participation records indicate frequent shortlisting overlap and repeated final selection for one bidder.",
            "Risk is elevated due to repeated successful outcomes despite comparable competitor quotations in prior rounds."
        ],
        "documents": ["award_history_report.pdf", "bid_participation_log.xlsx", "contractor_profile_note.pdf"]
    },
    "price_outlier": {
        "descriptions": [
            "Quoted amount is significantly above the median of comparable municipal tenders.",
            "Cost estimate deviates from benchmark values for the same work scope.",
            "Tender amount appears inflated relative to similar projects in nearby zones."
        ],
        "analyses": [
            "Rate analysis against category-level historical tenders in Bengaluru indicates a high pricing deviation.",
            "Unit cost components exceed typical estimates for materials, transport, and labor bands.",
            "Budget variance review suggests the submitted quote may require detailed technical justification."
        ],
        "documents": ["price_benchmark_sheet.xlsx", "rate_analysis_note.pdf", "comparative_cost_chart.pdf"]
    },
    "suspicious_beneficiary": {
        "descriptions": [
            "Beneficiary identity has incomplete verification in submitted records.",
            "Beneficiary details show inconsistencies across tender documents.",
            "Name and address pattern indicates potential proxy or linked beneficiary."
        ],
        "analyses": [
            "KYC fields and supporting records contain mismatched entries requiring manual verification.",
            "Cross-record checks indicate duplicate-like beneficiary signatures in separate submissions.",
            "Beneficiary mapping across prior projects suggests possible hidden affiliations."
        ],
        "documents": ["beneficiary_verification_checklist.pdf", "kyc_comparison_log.xlsx", "identity_review_note.pdf"]
    },
    "duplicate_phone": {
        "descriptions": [
            "Contact number appears in multiple contractor profiles.",
            "Phone number is reused across tenders linked to different entities.",
            "Submitted contact details overlap with previously flagged bidders."
        ],
        "analyses": [
            "Phone number clustering indicates repeated use of identical contact points across unrelated firms.",
            "Data quality checks found high-confidence duplicate communication details in bidder records.",
            "Network review suggests potential connected parties using common contact identifiers."
        ],
        "documents": ["contact_dedup_report.csv", "entity_link_map.pdf", "phone_overlap_analysis.xlsx"]
    },
    "high_risk_contractor": {
        "descriptions": [
            "Contractor has prior risk markers from earlier procurement cycles.",
            "Vendor risk profile exceeds acceptable threshold for current award value.",
            "Background checks show compliance gaps in previous assignments."
        ],
        "analyses": [
            "Historic performance logs show delayed milestones and repeated quality remarks.",
            "Risk scoring model indicates elevated exposure due to compliance and delivery history.",
            "Prior inspection and audit notes classify this contractor as medium-to-high risk."
        ],
        "documents": ["contractor_risk_profile.pdf", "past_performance_summary.xlsx", "compliance_observation_note.pdf"]
    },
    "rapid_award_cycle": {
        "descriptions": [
            "Tender moved from issue to award faster than standard review timelines.",
            "Bid processing timeline is unusually short for the project complexity.",
            "Approval stages were completed in compressed sequence compared to norms."
        ],
        "analyses": [
            "Workflow timestamps show reduced interval between technical evaluation and final approval.",
            "Timeline audit indicates expedited movement through multiple governance checkpoints.",
            "Cycle-time comparison with similar projects flags this tender for procedural review."
        ],
        "documents": ["award_timeline_audit.pdf", "workflow_events_export.csv", "approval_sequence_review.pdf"]
    }
}

def random_datetime(days=365):
    """Generate a random timestamp within last 'days' days."""
    return datetime.now() - timedelta(days=random.randint(0, days))


def build_evidence(rule):
    library = EVIDENCE_LIBRARY[rule]
    document_count = random.randint(1, 3)
    return {
        "description": random.choice(library["descriptions"]),
        "analysis": random.choice(library["analyses"]),
        "related_documents": random.sample(library["documents"], k=document_count),
        "risk_factor": round(random.uniform(0, 1), 3)
    }

def seed_fraud_flags(count=40):
    conn = get_connection()
    cur = conn.cursor()

    # fetch required foreign keys
    cur.execute("SELECT id FROM tenders;")
    tenders = [t[0] for t in cur.fetchall()]

    cur.execute("SELECT id FROM users;")
    users = [u[0] for u in cur.fetchall()]

    if not tenders:
        print("No tenders found. Seed tenders first!")
        return

    for _ in range(count):
        tender_id = random.choice(tenders)
        rule = random.choice(RULES)
        score = round(random.uniform(0, 1), 3)

        evidence = build_evidence(rule)

        status = random.choice(STATUSES)

        reviewed_by = None
        reviewed_at = None

        # if not pending, assign a reviewer
        if status != "pending" and users:
            reviewed_by = random.choice(users)
            reviewed_at = random_datetime()

        cur.execute("""
            INSERT INTO fraud_flags (
                tender_id, rule, score, evidence,
                status, reviewed_by, reviewed_at
            )
            VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s);
        """, (
            tender_id,
            rule,
            score,
            json.dumps(evidence),
            status,
            reviewed_by,
            reviewed_at
        ))

    conn.commit()
    cur.close()
    conn.close()

    print(f"Seeded {count} fraud flags!")


if __name__ == "__main__":
    seed_fraud_flags(60)
