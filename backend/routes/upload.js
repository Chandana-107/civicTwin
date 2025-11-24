// routes/upload.js 
const express = require("express"); 
const multer = require("multer"); 
const path = require("path"); 
const fs = require("fs"); 
require("dotenv").config({path:'../.env'}); 
const router = express.Router(); 
 
const uploadDir = process.env.UPLOADS_DIR || "./uploads"; 
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); 
 
const storage = multer.diskStorage({ 
  destination: function (req, file, cb) { cb(null, uploadDir); }, 
  filename: function (req, file, cb) { 
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9) + 
path.extname(file.originalname); 
    cb(null, name); 
  } 
}); 
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); 
 
router.post("/", upload.single("file"), (req, res) => { 
  if (!req.file) return res.status(400).json({ error: "No file" }); 
  const url = `/uploads/${req.file.filename}`; 
  res.json({ url }); 
}); 
 
module.exports = router;