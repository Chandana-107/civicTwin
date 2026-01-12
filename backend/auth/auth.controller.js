const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const aadhaarService = require("./aadhaar.service");
const otpService = require("./otp.service");
const whatsappService = require("./whatsapp.service");
const { issueJWT } = require("./auth.utils");

/* 1️⃣ REQUEST OTP */
exports.requestOTP = async (req, res) => {
  const { aadhaar } = req.body;

  if (!aadhaar)
    return res.status(400).json({ error: "Aadhaar required" });

  const aadhaarData = await aadhaarService.fetchLinkedMobile(aadhaar);
  if (!aadhaarData)
    return res.status(404).json({ error: "Invalid Aadhaar number" });

  const otp = otpService.generateOTP();
  await otpService.saveOTP(aadhaar, otp);
  await whatsappService.sendOTP(aadhaarData.phone, otp);


  res.json({ message: "OTP sent to registered mobile number" });
};

/* 2️⃣ VERIFY OTP */
exports.verifyOTP = async (req, res) => {
  const { aadhaar, otp } = req.body;

  const valid = await otpService.verifyOTP(aadhaar, otp);
  if (!valid)
    return res.status(401).json({ error: "Invalid or expired OTP" });

  res.json({ message: "Aadhaar verified successfully" });
};

/* 3️⃣ REGISTER */
exports.register = async (req, res) => {
  const { name, email, password, aadhaar, phone } = req.body;

  if (!name || !email || !password || !aadhaar || !phone)
    return res.status(400).json({ error: "Missing fields" });

  const hash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users
     (name, email, password_hash, aadhaar_number, phone, is_aadhaar_verified)
     VALUES ($1,$2,$3,$4,$5,true)
     RETURNING id`,
    [name, email, hash, aadhaar, phone]
  );

  res.status(201).json({
    message: "User registered successfully",
    userId: result.rows[0].id
  });
};

/* 4️⃣ LOGIN */
exports.login = async (req, res) => {
  const { email, password, aadhaar } = req.body;

  const result = await pool.query(
    `SELECT * FROM users
     WHERE email=$1 AND aadhaar_number=$2 AND is_aadhaar_verified=true`,
    [email, aadhaar]
  );

  if (!result.rows.length)
    return res.status(401).json({ error: "Invalid credentials" });

  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);

  if (!ok)
    return res.status(401).json({ error: "Invalid credentials" });

  const token = issueJWT({
    id: user.id,
    role: user.role
  });

  res.json({ token });
};
