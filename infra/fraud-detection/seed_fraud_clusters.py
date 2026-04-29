# seed_fraud_clusters.py
# Seeds fraud_clusters with realistic network cluster data.
# Run AFTER seed_tenders.py and seed_fraud_flags.py.

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from infra.db import get_connection
import random, json, uuid

EDGE_TYPE_COMBOS = [
    ["awarded_by", "shared_phone"],
    ["shared_address", "serves_beneficiary"],
    ["awarded_by", "shared_address", "shared_phone"],
    ["uses_bank", "serves_beneficiary"],
    ["awarded_by", "uses_bank"],
]

NETWORK_PATTERNS = [
    "Repeated contractor-beneficiary linkage across ward-level tenders in Bengaluru.",
    "High overlap of vendor contacts across road, lighting, and sanitation projects.",
    "Sequential awards concentrated within connected entities in adjacent municipal zones.",
    "Frequent participation by linked bidders in small-value maintenance contracts.",
    "Potential collusive bidding ring across public works tenders in Karnataka districts.",
]

ANALYST_COMMENTS = [
    "Cluster review suggests coordinated participation behavior and non-random bid outcomes.",
    "Graph relationships indicate concentrated contract flow among a small connected group.",
    "Procurement timelines and bidder metadata show repeated linkage signatures.",
    "Risk posture is elevated and merits manual audit with supporting procurement records.",
    "Pattern is consistent with potential bid rotation and proxy participation signals.",
]


def seed_fraud_clusters(count=25):
    conn = get_connection()
    cur  = conn.cursor()

    # Fetch latest completed run for run_id FK
    cur.execute("SELECT id FROM fraud_audit_runs WHERE status='completed' ORDER BY completed_at DESC LIMIT 1;")
    row = cur.fetchone()
    run_id = str(row[0]) if row else None

    # Fetch contractor and beneficiary IDs from tenders to use as node IDs
    cur.execute("SELECT contractor_id, beneficiary_id FROM tenders WHERE contractor_id IS NOT NULL LIMIT 100;")
    rows = cur.fetchall()
    node_pool = []
    for r in rows:
        if r[0]: node_pool.append(f"contractor:{r[0]}")
        if r[1]: node_pool.append(f"beneficiary:{r[1]}")

    if not node_pool:
        print("⚠  No tenders found — run seed_tenders.py first.")
        conn.close()
        return

    seeded = 0
    for _ in range(count):
        node_count    = random.randint(3, 10)
        cluster_nodes = random.sample(node_pool, min(node_count, len(node_pool)))

        edge_types            = random.choice(EDGE_TYPE_COMBOS)
        suspiciousness_score  = round(random.uniform(0.3, 1.0), 3)
        total_amount          = round(random.uniform(500_000, 100_000_000), 2)
        edge_density          = round(random.uniform(0.2, 1.0), 3)
        has_cycle             = random.random() < 0.3   # 30% chance of circular relationship

        evidence = {
            "reason":                   "Connected via: " + ", ".join(edge_types),
            "pattern":                  random.choice(NETWORK_PATTERNS),
            "size":                     len(cluster_nodes),
            "internal_edges":           random.randint(len(cluster_nodes) - 1, len(cluster_nodes) * 2),
            "has_circular_relationship":has_cycle,
            "risk_factor":              round(random.uniform(0, 1), 3),
            "comments":                 random.choice(ANALYST_COMMENTS),
        }

        cluster_hash = str(uuid.uuid4())

        cur.execute("""
            INSERT INTO fraud_clusters (
                run_id, cluster_hash, cluster_nodes,
                suspiciousness_score, total_amount, edge_density,
                evidence, created_at, updated_at
            )
            VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s::jsonb, now(), now())
            ON CONFLICT (cluster_hash) DO NOTHING;
        """, (
            run_id,
            cluster_hash,
            json.dumps(cluster_nodes),
            suspiciousness_score,
            total_amount,
            edge_density,
            json.dumps(evidence),
        ))
        seeded += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"✅  Seeded {seeded} fraud clusters (run_id: {run_id}).")


if __name__ == "__main__":
    seed_fraud_clusters(30)
