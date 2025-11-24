// routes/topics.js 
const express = require("express"); 
const router = express.Router(); 
const auth = require("../middleware/auth"); 
const { pool } = require("../db"); 
 
// list topics by date 
router.get("/daily", auth, async (req, res) => { 
  const { date } = req.query; 
  try { 
    const r = await pool.query("SELECT * FROM daily_topics WHERE date=$1 ORDER BY score DESC", [date]); 
    res.json(r.rows); 
  } catch (err) { 
    console.error(err); res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
// insert (admin or worker) 
router.post("/daily", auth, async (req, res) => { 
  const { date, topic, category, score, occurrences } = req.body; 
  try { 
    const r = await pool.query("INSERT INTO daily_topics (date,topic,category,score,occurrences) VALUES ($1,$2,$3,$4,$5) RETURNING *",[date, topic, category || null, score || 0, occurrences || 0]); res.status(201).json(r.rows[0]);} catch (err) 
 { 
    console.error(err); res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
module.exports = router; 