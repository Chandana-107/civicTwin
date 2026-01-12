const { pool } = require("../db");

exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.saveOTP = async (aadhaar, otp) => {
  await pool.query(
    `INSERT INTO aadhaar_otps (aadhaar_number, otp, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
    [aadhaar, otp]
  );
};

exports.verifyOTP = async (aadhaar, otp) => {
  const result = await pool.query(
    `SELECT * FROM aadhaar_otps
     WHERE aadhaar_number=$1
       AND otp=$2
       AND expires_at > NOW()
       AND verified=false`,
    [aadhaar, otp]
  );

  if (!result.rows.length) return false;

  await pool.query(
    `UPDATE aadhaar_otps SET verified=true WHERE id=$1`,
    [result.rows[0].id]
  );

  return true;
};
