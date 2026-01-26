// routes/fraud.js 
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { pool } = require("../db");
const { v4: uuidv4 } = require("uuid");

// List flags 
router.get("/flags", auth, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM fraud_flags ORDER BY created_at DESC");
    res.json(r.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

// List clusters 
router.get("/clusters", auth, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM fraud_clusters ORDER BY created_at DESC");
    res.json(r.rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

// Run fraud detection rules (admin) 
router.post("/run", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  try {
    await pool.query("BEGIN");

    // 1) repeat_winner: contractors who won > REPEAT_WINNER_THRESHOLD tenders in last 365 days 
    const threshold = Number(process.env.REPEAT_WINNER_THRESHOLD || 5);
    const q1 = ` 
      SELECT contractor_id, contractor, COUNT(*) as wins, array_agg(id) as tender_ids 
      FROM tenders 
      WHERE date >= (now() - INTERVAL '365 days') AND contractor_id IS NOT NULL 
      GROUP BY contractor_id, contractor 
      HAVING COUNT(*) >= $1 
    `;
    const r1 = await pool.query(q1, [threshold]);
    for (const row of r1.rows) {
      const tenderIds = row.tender_ids;
      const score = Math.min(1, Math.log10(Number(row.wins) + 1) / 2); // heuristic score 0..1 
      for (const tid of tenderIds) {
        await pool.query(
          `INSERT INTO fraud_flags (id,tender_id,rule,score,evidence,status,created_at) VALUES 
($1,$2,$3,$4,$5,$6,now()) 
           ON CONFLICT (id) DO NOTHING`,
          [uuidv4(), tid, 'repeat_winner', score, JSON.stringify({
            contractor: row.contractor, wins:
              Number(row.wins)
          }), 'pending']
        );
      }
    }

    // 2) price_outlier: per category mean + k*std; flag where amount > mean + k*std 
    const k = Number(process.env.PRICE_OUTLIER_STD_MULTIPLIER || 3);
    const categories = (await pool.query("SELECT DISTINCT category FROM tenders WHERE category IS NOT NULL")).rows.map(r => r.category);
    for (const cat of categories) {
      const stats = await pool.query("SELECT AVG(amount) as mean, STDDEV_POP(amount) as std FROM tenders WHERE category=$1", [cat]);
      const mean = Number(stats.rows[0].mean || 0);
      const std = Number(stats.rows[0].std || 0);
      if (std === 0) continue;
      const cutoff = mean + k * std;
      const outliers = await pool.query("SELECT id, tender_number, amount FROM tenders WHERE category=$1 AND amount > $2", [cat, cutoff]);
      for (const o of outliers.rows) {
        const score = Math.min(1, (o.amount - mean) / (3 * std)); // heuristic 
        await pool.query(
          `INSERT INTO fraud_flags (id,tender_id,rule,score,evidence,status,created_at) VALUES 
($1,$2,$3,$4,$5,$6,now())`,
          [uuidv4(), o.id, 'price_outlier', score, JSON.stringify({
            category: cat, amount: o.amount, mean,
            std, cutoff
          }), 'pending']
        );
      }
    }

    // 3) duplicate_beneficiary: beneficiary_id appearing in multiple tenders in recent period 
    const dups = await pool.query(` 
      SELECT beneficiary_id, COUNT(*) as cnt, array_agg(id) as tender_ids 
      FROM tenders 
      WHERE beneficiary_id IS NOT NULL 
      GROUP BY beneficiary_id 
      HAVING COUNT(*) > 1 
    `);
    for (const d of dups.rows) {
      const tenderIds = d.tender_ids;
      for (const tid of tenderIds) {
        await pool.query(
          `INSERT INTO fraud_flags (id,tender_id,rule,score,evidence,status,created_at) VALUES 
($1,$2,$3,$4,$5,$6,now())`,
          [uuidv4(), tid, 'duplicate_beneficiary', Math.min(1, Number(d.cnt) / 10), JSON.stringify({
            beneficiary_id: d.beneficiary_id, count: Number(d.cnt)
          }), 'pending']
        );
      }
    }

    // 4) simple cluster generation: group by contractor_id and shared phone/address => cluster nodes 
    // For a quick graph: group contractors who share phone or address or beneficiary_id with each other 
    const nodesRes = await pool.query("SELECT id, contractor, contractor_id, phone, address, beneficiary_id FROM tenders WHERE contractor_id IS NOT NULL");
    const nodes = nodesRes.rows;
    // build a simple adjacency map 
    const adj = {};
    for (const n of nodes) {
      adj[n.contractor_id] = adj[n.contractor_id] || {
        contractor: n.contractor, contractor_id:
          n.contractor_id, tenders: [], phones: new Set(), addrs: new Set(), beneficiaries: new Set()
      };
      adj[n.contractor_id].tenders.push(n.id);
      if (n.phone) adj[n.contractor_id].phones.add(n.phone);
      if (n.address) adj[n.contractor_id].addrs.add(n.address);
      if (n.beneficiary_id) adj[n.contractor_id].beneficiaries.add(n.beneficiary_id);
    }
    // naive cluster: connect contractor_ids that share phone/address/beneficiary 
    const contractorIds = Object.keys(adj);
    const clusters = [];
    const visited = new Set();
    for (let i = 0; i < contractorIds.length; i++) {
      const a = contractorIds[i];
      if (visited.has(a)) continue;
      const cluster = new Set([a]);
      // compare with others 
      for (let j = i + 1; j < contractorIds.length; j++) {
        const b = contractorIds[j];
        if (visited.has(b)) continue;
        // check intersection of phone/address/beneficiaries 
        const phonesA = adj[a].phones, phonesB = adj[b].phones;
        const addrsA = adj[a].addrs, addrsB = adj[b].addrs;
        const bensA = adj[a].beneficiaries, bensB = adj[b].beneficiaries;
        const intersects = [...phonesA].some(x => phonesB.has(x)) || [...addrsA].some(x => addrsB.has(x))
          || [...bensA].some(x => bensB.has(x));
        if (intersects) {
          cluster.add(b);
          visited.add(b);
        }
      }
      // compute simple cluster score 
      const clusterNodes = Array.from(cluster);
      // total_amount for cluster: sum amounts of tenders for these contractors 
      let total_amount = 0, tenderCount = 0;
      for (const cid of clusterNodes) {
        for (const tid of adj[cid].tenders) {
          tenderCount++;
          const tr = await pool.query("SELECT amount FROM tenders WHERE id=$1", [tid]);
          if (tr.rows.length) total_amount += Number(tr.rows[0].amount || 0);
        }
      }
      const edge_density = Math.min(1, (clusterNodes.length > 1 ? (tenderCount /
        (clusterNodes.length * (clusterNodes.length - 1))) : 0));
      const suspiciousness_score = Math.min(1, Math.log10(1 + total_amount) / 6 + edge_density / 2);
      clusters.push({
        cluster_nodes: clusterNodes, suspiciousness_score, total_amount, edge_density,
        evidence: { reason: "shared phone/address/beneficiary" }
      });
      visited.add(a);
    }

    // insert clusters 
    for (const c of clusters) {
      await pool.query(`INSERT INTO fraud_clusters 
  (id,cluster_nodes,suspiciousness_score,total_amount,edge_density,evidence,created_at) 
                          VALUES ($1,$2,$3,$4,$5,$6,now())`, [uuidv4(), JSON.stringify(c.cluster_nodes),
      c.suspiciousness_score, c.total_amount, c.edge_density, JSON.stringify(c.evidence)]);
    }

    // 5) CALL ML SERVICE FOR ADVANCED GRAPH ANALYSIS
    try {
      // Prepare graph data for ML
      const graphNodes = nodes.map(n => ({ id: n.contractor_id, type: 'contractor', label: n.contractor }));
      const graphEdges = [];

      // Add edges from adjacency
      const visitedEdges = new Set();
      for (let i = 0; i < contractorIds.length; i++) {
        const u = contractorIds[i];
        for (let j = i + 1; j < contractorIds.length; j++) {
          const v = contractorIds[j];

          const phonesA = adj[u].phones, phonesB = adj[v].phones;
          const addrsA = adj[u].addrs, addrsB = adj[v].addrs;
          const bensA = adj[u].beneficiaries, bensB = adj[v].beneficiaries;

          let relation = null;
          if ([...phonesA].some(x => phonesB.has(x))) relation = 'shared_phone';
          else if ([...addrsA].some(x => addrsB.has(x))) relation = 'shared_address';
          else if ([...bensA].some(x => bensB.has(x))) relation = 'shared_beneficiary';

          if (relation) {
            graphEdges.push({ source: u, target: v, type: relation });
          }
        }
      }

      if (process.env.ML_SERVICE_URL && graphEdges.length > 0) {
        const axios = require('axios'); // Ensure axios is required at top if not already
        const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/fraud/graph`, {
          nodes: graphNodes,
          edges: graphEdges
        });

        const { communities, suspicious_nodes } = mlRes.data;

        // Store ML-detected communities as new clusters if they don't overlap existing simple ones
        // For simplicity, we'll just log or add them as specific "ML_DETECTED" clusters
        for (const comm of communities) {
          if (comm.length < 2) continue;
          // distinct cluster logic here... simplified:
          const commScore = 0.8; // High confidence for ML
          await pool.query(`INSERT INTO fraud_clusters 
                    (id,cluster_nodes,suspiciousness_score,total_amount,edge_density,evidence,created_at) 
                    VALUES ($1,$2,$3,$4,$5,$6,now())`,
            [uuidv4(), JSON.stringify(comm), commScore, 0, 1.0, JSON.stringify({ reason: "ML Graph Community Detection", method: "greedy_modularity" })]
          );
        }
      }
    } catch (mlErr) {
      console.error("ML Graph Analysis failed:", mlErr.message);
      // Don't fail the whole transaction, just log
    }

    await pool.query("COMMIT");
    res.json({ status: "ok", flags_created: "see DB", clusters_created: clusters.length });
  } catch (err) {
    console.error(err);
    try { await pool.query("ROLLBACK"); } catch (e) { console.error(e); }
    res.status(500).json({ error: "fraud run failed" });
  }
});

// Admin: update flag status 
router.patch("/flags/:id", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const id = req.params.id;
  const { status, reviewed_by } = req.body;
  try {
    const r = await pool.query("UPDATE fraud_flags SET status=$1, reviewed_by=$2, reviewed_at=now() WHERE id=$3 RETURNING *", [status, reviewed_by || req.user.id, id]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

module.exports = router;