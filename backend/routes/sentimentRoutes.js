// backend/routes/sentimentRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../db'); // adjust import to your db.js export

// POST /sentiment -> proxy to VADER service
router.post('/', async (req, res) => {
  const text = req.body.text || '';
  try {
    const resp = await axios.post('http://localhost:6001/sentiment', { text });
    return res.json(resp.data);
  } catch (err) {
    console.error('Sentiment service error', err.message);
    return res.status(500).json({ error: 'Sentiment service error' });
  }
});

/*
  POST /sentiment/store
  body: { table: 'social_feed'|'complaints', id: '<uuid>', text: '...', posted_at: optional ISO }
  -> calls VADER, updates the corresponding table row with sentiment and sentiment_score
*/
router.post('/store', async (req, res) => {
  const { table, id, text } = req.body;
  if (!table || !id || !text) return res.status(400).json({ error: 'table,id,text required' });

  try {
    const resp = await axios.post('http://localhost:6001/sentiment', { text });
    const { label, score } = resp.data;

    // sanitize table
    if (!['social_feed', 'complaints'].includes(table)) {
      return res.status(400).json({ error: 'invalid table' });
    }

    // Update appropriate columns
    const client = await pool.connect();
    try {
      const updateQuery = `
        UPDATE ${table}
        SET sentiment = $1, sentiment_score = $2
        WHERE id = $3
      `;
      await client.query(updateQuery, [label, score, id]);
      return res.json({ ok: true, sentiment: label, score });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error storing sentiment', err.message);
    return res.status(500).json({ error: err.toString() });
  }
});

module.exports = router;
