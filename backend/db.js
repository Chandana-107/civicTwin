// db.js
const { Pool } = require("pg");
const { MongoClient, GridFSBucket } = require("mongodb");
require("dotenv").config({path:'../.env'});

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "mydb"
});

let mongoClient = null;
let gridBucket = null;
let complaintBucket = null;

const connectGridFS = async () => {
  if (gridBucket && complaintBucket) return { db: mongoClient.db(), bucket: gridBucket, complaintBucket };

  try {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/civictwin";
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    const db = mongoClient.db();
    gridBucket = new GridFSBucket(db, { bucketName: "socialFeedImages" });
    complaintBucket = new GridFSBucket(db, { bucketName: "complaintImages" });
    return { db, bucket: gridBucket, complaintBucket };
  } catch (err) {
    console.warn("⚠️ MongoDB connection failed. GridFS image storage will be unavailable.", err.message);
    return { db: null, bucket: null, complaintBucket: null };
  }
};

const getGridBucket = () => gridBucket;
const getComplaintBucket = () => complaintBucket;

module.exports = { pool, connectGridFS, getGridBucket, getComplaintBucket };
