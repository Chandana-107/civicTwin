// routes/users.js 
const express = require("express"); 
const router = express.Router(); 
const auth = require("../middleware/auth"); 
const { pool } = require("../db"); 
 
// Get profile 
router.get("/me", auth, async (req, res) => { 
  const id = req.user.id; 
  try { 
    const r = await pool.query("SELECT id,name,email,phone,role,created_at FROM users WHERE id=$1", [id]); 
    if (!r.rows.length) return res.status(404).json({ error: "User not found" }); 
    res.json(r.rows[0]); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "Server error" }); 
  } 
}); 
 
// Admin: list users 
router.get("/", auth, async (req, res) => { 
  if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" }); 
  try { 
    const r = await pool.query("SELECT id,name,email,phone,role,created_at FROM users ORDER BY created_at DESC"); 
    res.json(r.rows); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "Server error" }); 
  } 
}); 
 
module.exports = router;  