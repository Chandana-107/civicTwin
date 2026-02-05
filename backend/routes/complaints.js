// routes/complaints.js 
const express = require("express"); 
const router = express.Router(); 
const auth = require("../middleware/auth"); 
const { pool } = require("../db"); 
const axios = require("axios"); 
 
// Create complaint (calls ML) 
router.post("/", auth, async (req, res) => { 
  const { title, text, lat, lng, attachment_url, location_address, consent_given } = req.body; 
  if (!title || !text || lat == null || lng == null) return res.status(400).json({ error: "Missing fields" }); 
  let category = null, priority = null; 
  try { 
    const ml = await axios.post(`${process.env.ML_SERVICE_URL}/classify`, { text }, { timeout: 
3000 }); 
    category = ml.data.category; 
    priority = ml.data.priority; 
  } catch (err) { 
    category = "other"; priority = 0.2; 
  } 
  try { 
    const q = `INSERT INTO complaints 
(user_id,title,text,category,priority,location_geometry,location_address,attachment_url,consent_given) 
               VALUES ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326),$8,$9,$10) 
RETURNING *`; 
    const vals = [req.user.id, title, text, category, priority, lng, lat, location_address || null, 
attachment_url || null, consent_given || false]; 
    const result = await pool.query(q, vals); 
    res.status(201).json(result.rows[0]); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
// List complaints (filters + pagination) 
router.get("/", auth, async (req, res) => { 
  const { status, category, page=1, limit=20 } = req.query; 
  const offset = (Number(page)-1) * Number(limit); 
  const filters = []; 
  const params = []; 
  let i=1; 
  if (status) { filters.push(`status=$${i++}`); params.push(status); } 
  if (category) { filters.push(`category=$${i++}`); params.push(category); } 
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""; 
  const sql = `SELECT id, user_id, title, text, category, priority, status, assigned_to, created_at, 
               ST_X(location_geometry::geometry) AS lng, 
               ST_Y(location_geometry::geometry) AS lat 
               FROM complaints ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`; 
  params.push(limit, offset); 
  try { 
    const r = await pool.query(sql, params); 
    console.log('Complaints query result:', r.rows.length, 'rows'); 
    if (r.rows.length > 0) {
      console.log('Sample complaint:', { id: r.rows[0].id, lat: r.rows[0].lat, lng: r.rows[0].lng });
    }
    res.json({ data: r.rows, page: Number(page) }); 
  } catch (err) { 
    console.error('Complaints query error:', err); 
    res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
// Complaint detail 
router.get("/:id", auth, async (req, res) => { 
  const id = req.params.id; 
  try { 
    const r = await pool.query(`SELECT id, user_id, title, text, category, priority, status, assigned_to, created_at, 
      ST_X(location_geometry::geometry) AS lng, 
      ST_Y(location_geometry::geometry) AS lat, 
      attachment_url, location_address 
      FROM complaints WHERE id=$1`, [id]); 
    if (!r.rows.length) return res.status(404).json({ error: "Not found" }); 
    // fetch labels & notes 
    const labels = (await pool.query("SELECT * FROM labels WHERE complaint_id=$1 ORDER BY created_at DESC", [id])).rows; 
    const notes = (await pool.query("SELECT * FROM complaint_notes WHERE complaint_id=$1 ORDER BY created_at DESC", [id])).rows; 
    res.json({ complaint: r.rows[0], labels, notes }); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
// Add label 
router.post("/:id/labels", auth, async (req, res) => { 
  const complaint_id = req.params.id; 
  const { category, priority, notes } = req.body; 
  if (!category) return res.status(400).json({ error: "category required" }); 
  try { 
    const r = await pool.query( 
      "INSERT INTO labels (complaint_id,labeled_by,category,priority,notes) VALUES ($1,$2,$3,$4,$5) RETURNING *", 
      [complaint_id, req.user.id, category, priority || null, notes || null] 
    ); 
    res.status(201).json(r.rows[0]); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
// Add note 
router.post("/:id/notes", auth, async (req, res) => { 
  const complaint_id = req.params.id; 
  const { note_type, text, metadata } = req.body; 
  if (!text) return res.status(400).json({ error: "text required" }); 
  try { 
    const r = await pool.query( 
      "INSERT INTO complaint_notes (complaint_id,user_id,note_type,text,metadata) VALUES ($1,$2,$3,$4,$5) RETURNING *", 
      [complaint_id, req.user.id, note_type || 'comment', text, metadata || null] 
    ); 
    res.status(201).json(r.rows[0]); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
// Update status / assign 
router.patch("/:id", auth, async (req, res) => { 
  const id = req.params.id; 
  const { status, assigned_to } = req.body; 
  try { 
    const fields = []; 
    const vals = []; 
    let i=1; 
    if (status) { fields.push(`status=$${i++}`); vals.push(status); } 
    if (assigned_to) { fields.push(`assigned_to=$${i++}`); vals.push(assigned_to); } 
    if (!fields.length) return res.status(400).json({ error: "no fields" }); 
    vals.push(id); 
    const q = `UPDATE complaints SET ${fields.join(",")}, updated_at=now() WHERE id=$${i} 
RETURNING *`; 
    const r = await pool.query(q, vals); 
    res.json(r.rows[0]); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
module.exports = router;