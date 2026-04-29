const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { runFraudPipeline } = require('../services/fraudPipeline');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get('/flags', auth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT *
      FROM fraud_findings
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 500
    `);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.get('/clusters', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM fraud_clusters WHERE cluster_hash IS NOT NULL ORDER BY updated_at DESC, created_at DESC LIMIT 200');
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.get('/runs/latest', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM fraud_audit_runs ORDER BY started_at DESC LIMIT 1');
    res.json(r.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.get('/runs', auth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const r = await pool.query('SELECT * FROM fraud_audit_runs ORDER BY started_at DESC LIMIT $1', [limit]);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.post('/run', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const summary = await runFraudPipeline(pool);
    res.json(summary);
  } catch (err) {
    // Log full error server-side; never expose stack traces to client
    console.error('[fraud/run]', err);
    res.status(500).json({ error: 'Fraud detection run failed. Check server logs.' });
  }
});

router.patch('/flags/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  const { status, reviewed_by } = req.body;
  const allowed = new Set(['open', 'investigating', 'escalated', 'dismissed', 'confirmed']);
  if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const candidate = UUID_RE.test(String(reviewed_by || '')) ? reviewed_by : (UUID_RE.test(String(req.user.id || '')) ? req.user.id : null);
    let reviewer = null;
    if (candidate) {
      const check = await pool.query('SELECT id FROM users WHERE id=$1', [candidate]);
      reviewer = check.rows.length ? candidate : null;
    }

    const r = await pool.query(
      'UPDATE fraud_findings SET status=$1, reviewed_by=$2, reviewed_at=now(), updated_at=now() WHERE id=$3 RETURNING *',
      [status, reviewer, id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET /fraud/report        → plain-English auditor text report
// GET /fraud/report?format=json → canonical JSON
router.get('/report', auth, async (req, res) => {
  try {
    const runRes = await pool.query(
      "SELECT * FROM fraud_audit_runs WHERE status='completed' ORDER BY completed_at DESC LIMIT 1"
    );
    if (!runRes.rows.length) return res.status(404).json({ error: 'No completed run found. Run detection first.' });

    const run    = runRes.rows[0];
    const summary = typeof run.summary === 'string' ? JSON.parse(run.summary) : (run.summary || {});
    const report  = summary.unified_report;

    if (!report) return res.status(404).json({ error: 'No report in this run — re-run detection to regenerate.' });

    const format = req.query.format || 'text';
    if (format === 'json') return res.json(report);

    // Use standalone function — avoids broken class reconstruction via Object.assign
    const { generateTextReport } = require('../services/fraudReport');
    res.type('text/plain').send(generateTextReport(report));
  } catch (err) {
    console.error('[fraud/report]', err);
    res.status(500).json({ error: 'Report generation failed' });
  }
});


module.exports = router;

