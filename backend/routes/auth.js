// routes/auth.js 
const express = require("express"); 
const router = express.Router(); 
const bcrypt = require("bcryptjs"); 
const jwt = require("jsonwebtoken"); 
const { pool } = require("../db"); 
 
router.post("/register", async (req, res) => { 
  const { name, email, password, phone, role } = req.body; 
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" }); 
  try { 
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [email]); 
    if (exists.rows.length) return res.status(409).json({ error: "Email exists" }); 
    const hash = await bcrypt.hash(password, 10); 
    const r = await pool.query( 
      "INSERT INTO users (name,email,password_hash,role,phone) VALUES ($1,$2,$3,$4,$5) RETURNING id,email,name,role", 
      [name, email, hash, role || "citizen", phone || null] 
    ); 
    const user = r.rows[0]; 
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, 
process.env.JWT_SECRET); 
    return res.status(201).json({ id: user.id, token }); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "Server error" +err}); 
  } 
}); 
 
router.post("/login", async (req, res) => { 
  const { email, password } = req.body; 
  if (!email || !password) return res.status(400).json({ error: "Missing fields" }); 
  try { 
    const r = await pool.query("SELECT id,password_hash,role FROM users WHERE email=$1", 
[email]); 
    if (!r.rows.length) return res.status(401).json({ error: "Invalid credentials" }); 
    const user = r.rows[0]; 
    const ok = await bcrypt.compare(password, user.password_hash); 
    if (!ok) return res.status(401).json({ error: "Invalid credentials" }); 
    const token = jwt.sign({ id: user.id, email, role: user.role }, process.env.JWT_SECRET); 
    res.json({ id: user.id, token }); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "Server error" }); 
  } 
}); 
 
module.exports = router;