const { pool } = require("../db");

exports.fetchLinkedMobile = async (aadhaar) => {
  const result = await pool.query(
    `SELECT phone FROM aadhaar_registry WHERE aadhaar_number=$1`,
    [aadhaar]
  );

  return result.rows[0]; // { phone }
};