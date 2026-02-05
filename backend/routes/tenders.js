const express = require("express"); 
const router = express.Router(); 
const auth = require("../middleware/auth"); 
const { pool } = require("../db"); 
const { v4: uuidv4 } = require("uuid"); 
 
// Create tender 
router.post("/", auth, async (req, res) => { 
  const { 
    tender_number, title, contractor, contractor_id, amount, date, 
    category, department, beneficiary_id, phone, address, meta 
  } = req.body; 
  if (!tender_number || !title || !contractor || !amount || !date) return res.status(400).json({ error: 
"Missing fields" }); 
  try { 
    const r = await pool.query( 
      `INSERT INTO tenders 
(id,tender_number,title,contractor,contractor_id,amount,date,category,department,beneficiary_id,phone,address,meta) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, 
      [uuidv4(), tender_number, title, contractor, contractor_id || null, amount, date, category || null, 
department || null, beneficiary_id || null, phone || null, address || null, meta || null] 
    ); 
    res.status(201).json(r.rows[0]); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
// List tenders with filters 
router.get("/", auth, async (req, res) => { 
  const { contractor, contractor_id, date_from, date_to, page=1, limit=50 } = req.query; 
  const filters = []; 
  const vals = []; 
  let i=1; 
  if (contractor) { filters.push(`contractor ILIKE $${i++}`); vals.push(`%${contractor}%`); } 
  if (contractor_id) { filters.push(`contractor_id=$${i++}`); vals.push(contractor_id); } 
  if (date_from) { filters.push(`date >= $${i++}`); vals.push(date_from); } 
  if (date_to) { filters.push(`date <= $${i++}`); vals.push(date_to); } 
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""; 
  const offset = (Number(page)-1)*Number(limit); 
  try { 
    const q = `SELECT * FROM tenders ${where} ORDER BY date DESC LIMIT $${i++} OFFSET 
$${i++}`; 
    vals.push(limit, offset); 
    const r = await pool.query(q, vals); 
    res.json({ data: r.rows, page: Number(page) }); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "DB error" }); 
  } 
}); 

// Get contractor names by IDs (for fraud detection)
router.post("/contractor-names", auth, async (req, res) => {
  try {
    const { contractor_ids } = req.body;
    if (!contractor_ids || !Array.isArray(contractor_ids)) {
      return res.status(400).json({ error: "contractor_ids array required" });
    }
    
    // Get distinct contractor names for these IDs
    const r = await pool.query(
      `SELECT DISTINCT contractor_id, contractor 
       FROM tenders 
       WHERE contractor_id = ANY($1) AND contractor_id IS NOT NULL`,
      [contractor_ids]
    );
    
    // Build a map of contractor_id -> contractor name
    const mapping = {};
    r.rows.forEach(row => {
      if (row.contractor_id && row.contractor) {
        mapping[row.contractor_id] = row.contractor;
      }
    });
    
    res.json(mapping);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB error" });
  }
});
 
// Get tender 
router.get("/:id", auth, async (req, res) => { 
  try { 
    const r = await pool.query("SELECT * FROM tenders WHERE id=$1", [req.params.id]); 
    if (!r.rows.length) return res.status(404).json({ error: "Not found" }); 
    res.json(r.rows[0]); 
  } catch (err) { 
    console.error(err); 
    res.status(500).json({ error: "DB error" }); 
  } 
}); 
 
module.exports = router; 