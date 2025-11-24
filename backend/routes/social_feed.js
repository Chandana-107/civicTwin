// routes/social_feed.js 
const express = require("express"); 
const router = express.Router(); 
const auth = require("../middleware/auth"); 
const { pool } = require("../db"); 
 
// ingest social post 
router.post("/", auth, async (req, res) => { 
  const { source, source_id, text, author, sentiment, sentiment_score, lat, lng, posted_at } = req.body; 
  if (!source || !text || !posted_at) return res.status(400).json({ error: "Missing fields" }); 
  try { 
    const q = `INSERT INTO social_feed 
(id,source,source_id,text,author,sentiment,sentiment_score,location_geometry,posted_at,created_at) 
               VALUES 
(gen_random_uuid(),$1,$2,$3,$4,$5,$6,ST_SetSRID(ST_MakePoint($7,$8),4326),$9,now()) 
RETURNING *`; 
    const vals = [source, source_id || null, text, author || null, sentiment || null, sentiment_score || null, 
lng || null, lat || null, posted_at]; 
    const r = await pool.query(q, vals); 
    res.status(201).json(r.rows[0]); 
  } catch (err) { 
    console.error(err); res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
// list recent posts 
router.get("/", auth, async (req, res) => { 
  try { 
    const r = await pool.query("SELECT * FROM social_feed ORDER BY posted_at DESC LIMIT 200"); 
    res.json(r.rows); 
  } catch (err) { 
    console.error(err); res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
module.exports = router;