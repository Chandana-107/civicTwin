const { pool } = require('./backend/db');

async function checkComplaints() {
    try {
        const res = await pool.query('SELECT count(*) FROM complaints');
        console.log('Total Complaints:', res.rows[0].count);

        const sample = await pool.query('SELECT id, title, user_id FROM complaints LIMIT 5');
        console.log('Sample Complaints:', sample.rows);

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        pool.end();
    }
}

checkComplaints();
