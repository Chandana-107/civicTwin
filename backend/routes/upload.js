// routes/upload.js 
const express = require("express"); 
const multer = require("multer"); 
const path = require("path"); 
const fs = require("fs"); 
require("dotenv").config({path:'../.env'}); 
const router = express.Router(); 
 
const uploadDir = process.env.UPLOADS_DIR || "./uploads"; 
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); 
 
const { getGridBucket } = require("../db");

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); 
 
router.post("/", upload.single("file"), (req, res) => { 
  if (!req.file) return res.status(400).json({ error: "No file" }); 
  
  const bucket = getGridBucket();
  if (!bucket) {
    return res.status(503).json({ error: "Image storage unavailable" });
  }

  const uploadStream = bucket.openUploadStream(req.file.originalname, {
    contentType: req.file.mimetype
  });

  uploadStream.end(req.file.buffer);

  uploadStream.on("finish", () => {
    res.json({ url: uploadStream.id.toString() });
  });

  uploadStream.on("error", (err) => {
    console.error("GridFS upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  });
}); 
 
module.exports = router;