// routes/simulation.js 
const express = require("express"); 
const router = express.Router(); 
const auth = require("../middleware/auth"); 
const { pool } = require("../db"); 
const { v4: uuidv4 } = require("uuid"); 
 
// submit simulation run (stores params, queued) 
router.post("/run", auth, async (req, res) => { 
  const params = req.body.params || {}; 
  try { 
const id = uuidv4();
await pool.query(
  "INSERT INTO simulation_runs (id,user_id,params,status,created_at) VALUES ($1,$2,$3,$4,now())",
  [id, req.user.id, params, 'queued']
);
// You can run simulation asynchronously (worker) that updates status/result later. 
res.status(201).json({ run_id: id, status: 'queued' }); 
  } catch (err) { 
    console.error(err); res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
// get run 
router.get("/:id", auth, async (req, res) => { 
  try { 
    const r = await pool.query("SELECT * FROM simulation_runs WHERE id=$1", [req.params.id]); 
    if (!r.rows.length) return res.status(404).json({ error: "Not found" }); 
    res.json(r.rows[0]); 
  } catch (err) { 
    console.error(err); res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
module.exports = router; 