// backend/routes/socialRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// POST /api/social/ingest
// body: { posts: [{source, source_id, text, author, posted_at}] }
router.post('/ingest', async (req, res) => {
  const posts = req.body.posts;
  if (!Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({ error: 'posts array required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of posts) {
      const id = p.id || uuidv4();
      const insertQ = `
        INSERT INTO social_feed(id, source, source_id, text, author, location_geometry, posted_at, created_at)
        VALUES ($1,$2,$3,$4,$5,null,$6, now())
        ON CONFLICT (id) DO NOTHING
      `;
      await client.query(insertQ, [id, p.source || 'synthetic', p.source_id || null, p.text || '', p.author || null, p.posted_at || new Date().toISOString()]);
      // call sentiment store to update sentiment for this row
      try {
        await axios.post('http://localhost:3000/api/sentiment/store', { table: 'social_feed', id, text: p.text });
      } catch (err) {
        console.warn('Warning: sentiment store failed for post id', id, err.message);
      }
    }
    await client.query('COMMIT');
    return res.json({ ok: true, inserted: posts.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error ingesting posts', err.message);
    return res.status(500).json({ error: err.toString() });
  } finally {
    client.release();
  }
});

module.exports = router;