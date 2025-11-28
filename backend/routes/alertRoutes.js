// backend/routes/alertRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Helper: compute mean and std
function mean(arr){
  if(!arr.length) return 0;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}
function std(arr, mu){
  const m = mu === undefined ? mean(arr) : mu;
  const v = arr.reduce((s,x)=> s + Math.pow(x - m,2), 0) / (arr.length || 1);
  return Math.sqrt(v);
}

// GET /api/alerts/sentiment_spike
router.get('/sentiment_spike', async (req, res) => {
  const client = await pool.connect();
  try {
    // compute negative percent per day for last 7 days from social_feed (could include complaints if required)
    const daysQ = `
      SELECT
        date_trunc('day', posted_at)::date as day,
        count(*) as total,
        sum(case when sentiment = 'negative' then 1 else 0 end) as negative
      FROM social_feed
      WHERE posted_at >= (current_date - INTERVAL '8 days')
      GROUP BY 1
      ORDER BY 1;
    `;
    const rs = await client.query(daysQ);
    const rows = rs.rows;
    // get last 7 days array (we will ensure all 7 entries exist)
    const negPercents = rows.map(r => {
      const total = parseInt(r.total,10) || 0;
      const neg = parseInt(r.negative,10) || 0;
      return total === 0 ? 0.0 : (neg / total);
    });

    // compute baseline mean and std
    const baselineMean = mean(negPercents);
    const baselineStd = std(negPercents, baselineMean);

    // compute today's negative percent
    const todayQ = `
      SELECT count(*) as total, sum(case when sentiment = 'negative' then 1 else 0 end) as negative
      FROM (
        SELECT sentiment FROM social_feed WHERE posted_at::date = current_date
      ) s;
    `;
    const tRes = await client.query(todayQ);
    const tRow = tRes.rows[0] || { total: 0, negative: 0 };
    const tTotal = parseInt(tRow.total || 0, 10);
    const tNeg = parseInt(tRow.negative || 0, 10);
    const todayNegPercent = tTotal === 0 ? 0.0 : (tNeg / tTotal);

    const threshold = baselineMean + 3 * baselineStd;
    const spike = todayNegPercent > threshold;

    return res.json({
      spike,
      todayNegPercent,
      baselineMean,
      baselineStd,
      threshold
    });
  } catch (err) {
    console.error('alert error', err.message);
    return res.status(500).json({ error: err.toString() });
  } finally {
    client.release();
  }
});

module.exports = router;