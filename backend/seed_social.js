require('dotenv').config();
const { pool } = require('./db');

const socialPosts = [
    {
        source: 'Twitter',
        source_id: 'tw_001',
        text: 'The new road work in Indiranagar is causing major traffic. #CivicIssues',
        sentiment: 'negative',
        sentiment_score: -0.8,
        posted_at: new Date().toISOString()
    },
    {
        source: 'Facebook',
        source_id: 'fb_102',
        text: 'Great initiative by the municipality to plant more trees! 🌳',
        sentiment: 'positive',
        sentiment_score: 0.9,
        posted_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
        source: 'Instagram',
        source_id: 'in_205',
        text: 'Water supply has been consistent this week. Hoping it stays this way.',
        sentiment: 'positive',
        sentiment_score: 0.6,
        posted_at: new Date(Date.now() - 7200000).toISOString()
    },
    {
        source: 'Twitter',
        source_id: 'tw_045',
        text: 'Street lights are not working in Koramangala block 5.',
        sentiment: 'negative',
        sentiment_score: -0.7,
        posted_at: new Date(Date.now() - 10800000).toISOString()
    }
];

async function seed() {
    try {
        console.log('Seeding social feed...');
        for (const post of socialPosts) {
            await pool.query(
                `INSERT INTO social_feed (id, source, source_id, text, sentiment, sentiment_score, posted_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now())`,
                [post.source, post.source_id, post.text, post.sentiment, post.sentiment_score, post.posted_at]
            );
        }
        console.log('Seeding complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding:', err);
        process.exit(1);
    }
}

seed();
