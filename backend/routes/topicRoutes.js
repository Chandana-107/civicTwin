// backend/routes/topicRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../db');

// POST /api/topics/extract_and_store
// body: { date: 'YYYY-MM-DD' }  -> aggregates texts for that date and stores top topics
router.post('/extract_and_store', async (req, res) => {
  const date = req.body.date;
  if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });

  const client = await pool.connect();
  try {
    // fetch complaints and social_feed texts for that date
    const complaintsQ = `
      SELECT text FROM complaints
      WHERE created_at::date = $1
    `;
    const socialQ = `
      SELECT text FROM social_feed
      WHERE posted_at::date = $1
    `;
    const compRes = await client.query(complaintsQ, [date]);
    const socRes = await client.query(socialQ, [date]);

    const documents = [
      ...compRes.rows.map(r => r.text),
      ...socRes.rows.map(r => r.text)
    ];

    // call topic microservice
    const resp = await axios.post('http://localhost:6002/extract', { documents, top_n: 30 });
    const topics = resp.data.topics || [];

    // store into daily_topics table (date, topic, category=null, score, occurrences=null)
    const insertQ = `
      INSERT INTO daily_topics(date, topic, category, score, occurrences, created_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (date, topic, category) DO UPDATE
      SET score = EXCLUDED.score, occurrences = EXCLUDED.occurrences, created_at = now()
    `;
    for (const t of topics) {
      const topicText = t.topic;
      const score = t.score || 0;
      // we don't calculate occurrences here; leave as null or compute if needed
      await client.query(insertQ, [date, topicText, null, score, null]);
    }

    return res.json({ ok: true, count: topics.length, topics });
  } catch (err) {
    console.error('Error extracting topics', err.message);
    return res.status(500).json({ error: err.toString() });
  } finally {
    client.release();
  }
});

// GET /api/topics?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: 'date query required' });
  const client = await pool.connect();
  try {
    const q = `SELECT topic, score, occurrences FROM daily_topics WHERE date = $1 ORDER BY score DESC LIMIT 50`;
    const r = await client.query(q, [date]);
    return res.json(r.rows);
  } catch (err) {
    console.error('Error fetching topics', err.message);
    return res.status(500).json({ error: err.toString() });
  } finally {
    client.release();
  }
});

module.exports = router;