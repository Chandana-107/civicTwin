# seed_fraud_clusters.py
from infra.db import get_connection
import random
import json

NETWORK_PATTERNS = [
    "Repeated contractor-beneficiary linkage across ward-level tenders in Bengaluru.",
    "High overlap of vendor contacts across road, lighting, and sanitation projects.",
    "Sequential awards concentrated within connected entities in adjacent municipal zones.",
    "Frequent participation by linked bidders in small-value maintenance contracts.",
    "Potential collusive bidding ring across public works tenders in Karnataka districts."
]

INDICATOR_POOL = [
    "shared_phone",
    "repeat_beneficiary",
    "common_address_pattern",
    "rapid_award_interval",
    "high_bid_correlation",
    "same_bank_branch",
    "director_name_overlap",
    "identical_document_format",
    "price_clustering",
    "geo_proximity"
]

ANALYST_COMMENTS = [
    "Cluster review suggests coordinated participation behavior and non-random bid outcomes.",
    "Graph relationships indicate concentrated contract flow among a small connected group.",
    "Procurement timelines and bidder metadata show repeated linkage signatures.",
    "Risk posture is elevated and merits manual audit with supporting procurement records.",
    "Pattern is consistent with potential bid rotation and proxy participation signals."
]


def build_cluster_evidence():
    indicator_count = random.randint(3, 7)
    return {
        "pattern": random.choice(NETWORK_PATTERNS),
        "indicators": random.sample(INDICATOR_POOL, k=indicator_count),
        "risk_factor": round(random.uniform(0, 1), 3),
        "comments": random.choice(ANALYST_COMMENTS)
    }

def seed_fraud_clusters(count=20):
    conn = get_connection()
    cur = conn.cursor()

    # Fetch tenders (used as "nodes" in clusters)
    cur.execute("SELECT id FROM tenders;")
    tenders = [t[0] for t in cur.fetchall()]

    if not tenders:
        print("No tenders found. Seed tenders first!")
        return

    for _ in range(count):

        # Pick 3–10 tender nodes per cluster
        node_count = random.randint(3, 10)
        cluster_nodes = random.sample(tenders, min(node_count, len(tenders)))

        suspiciousness_score = round(random.uniform(0, 1), 3)
        total_amount = round(random.uniform(100000, 100000000), 2)  # 1 lakh – 10 crore
        edge_density = round(random.uniform(0.1, 1.0), 3)

        evidence = build_cluster_evidence()

        cur.execute("""
            INSERT INTO fraud_clusters (
                cluster_nodes, suspiciousness_score, total_amount,
                edge_density, evidence
            )
            VALUES (%s::jsonb, %s, %s, %s, %s::jsonb);
        """, (
            json.dumps(cluster_nodes),
            suspiciousness_score,
            total_amount,
            edge_density,
            json.dumps(evidence)
        ))

    conn.commit()
    cur.close()
    conn.close()

    print(f"Seeded {count} fraud clusters!")


if __name__ == "__main__":
    seed_fraud_clusters(30)
