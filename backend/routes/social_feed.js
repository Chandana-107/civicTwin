// routes/social_feed.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const axios = require('axios');

const ALLOWED_REACTIONS = ['like', 'love', 'care', 'wow', 'concern'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let cachedResolvedGeminiModel = null;

let schemaReady = false;
const ensureSocialSchema = async () => {
  if (schemaReady) return;

  await pool.query(`
    ALTER TABLE social_feed
    ADD COLUMN IF NOT EXISTS image_url text;
  `);

  await pool.query(`
    ALTER TABLE social_feed
    ADD COLUMN IF NOT EXISTS posted_by uuid;
  `);

  await pool.query(`
    ALTER TABLE social_feed
    ADD COLUMN IF NOT EXISTS post_background text;
  `);

  // New columns for enhanced feed
  await pool.query(`
    ALTER TABLE social_feed
    ADD COLUMN IF NOT EXISTS category text;
  `);

  await pool.query(`
    ALTER TABLE social_feed
    ADD COLUMN IF NOT EXISTS department text;
  `);

  await pool.query(`
    ALTER TABLE social_feed
    ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
  `);

  await pool.query(`
    ALTER TABLE social_feed
    ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT FALSE;
  `);

  await pool.query(`
    ALTER TABLE social_feed
    ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT FALSE;
  `);

  await pool.query(`
    ALTER TABLE social_feed
    ADD COLUMN IF NOT EXISTS view_count bigint DEFAULT 0;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_post_reactions (
      id bigserial PRIMARY KEY,
      post_id uuid REFERENCES social_feed(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      reaction text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE (post_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_post_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid REFERENCES social_feed(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      comment_text text NOT NULL,
      created_at timestamptz DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_social_post_reactions_post_id
    ON social_post_reactions(post_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_social_post_comments_post_id
    ON social_post_comments(post_id, created_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_post_saves (
      id bigserial PRIMARY KEY,
      post_id uuid REFERENCES social_feed(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      UNIQUE (post_id, user_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_social_post_saves_post_id
    ON social_post_saves(post_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_social_feed_pinned_posted
    ON social_feed(is_pinned DESC, posted_at DESC);
  `);

  schemaReady = true;
};

// ─── Gemini helpers ──────────────────────────────────────────────────────────

const toSafeSummary = (value) => {
  const fallback = {
    overallSentiment: 'Unable to generate summary right now.',
    topTopics: 'No topics available',
    recommendedAction: 'Try again in a moment.'
  };
  if (!value || typeof value !== 'object') return fallback;
  return {
    overallSentiment: String(value.overallSentiment || fallback.overallSentiment),
    topTopics: String(value.topTopics || fallback.topTopics),
    recommendedAction: String(value.recommendedAction || fallback.recommendedAction)
  };
};

const parseGeminiJson = (rawText) => {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch (_) {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch (_) { return null; }
  }
};

const sanitizeModelName = (name) => String(name || '').replace(/^models\//, '').trim();

const resolveGeminiModel = async (apiKey) => {
  if (cachedResolvedGeminiModel) return cachedResolvedGeminiModel;
  const preferredCandidates = [
    sanitizeModelName(process.env.GEMINI_MODEL),
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash'
  ].filter(Boolean);
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await axios.get(listUrl, { timeout: 10000 });
    const models = Array.isArray(listRes?.data?.models) ? listRes.data.models : [];
    const supported = models
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => sanitizeModelName(m.name));
    const selected = preferredCandidates.find((c) => supported.includes(c))
      || supported.find((n) => n.includes('flash'))
      || supported[0]
      || DEFAULT_GEMINI_MODEL;
    cachedResolvedGeminiModel = selected;
    return selected;
  } catch (_) {
    cachedResolvedGeminiModel = DEFAULT_GEMINI_MODEL;
    return cachedResolvedGeminiModel;
  }
};

const summarizeWithGemini = async ({ postText, reactionCounts, comments }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      overallSentiment: 'Gemini key is not configured.',
      topTopics: 'N/A',
      recommendedAction: 'Set GEMINI_API_KEY in backend environment and retry.'
    };
  }
  const resolvedModel = await resolveGeminiModel(apiKey);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${apiKey}`;
  const prompt = [
    'You are an assistant for civic admin social analytics.',
    "Analyze citizens' reactions and comments for one post.",
    'Return only valid JSON with exactly these keys:',
    'overallSentiment (string), topTopics (string), recommendedAction (string).',
    'Do not include markdown or extra keys.',
    '',
    `Post text: ${postText || ''}`,
    `Reaction counts: ${JSON.stringify(reactionCounts || {})}`,
    `Citizen comments: ${JSON.stringify(comments || [])}`
  ].join('\n');
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 280 }
  };
  try {
    const response = await axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    const text = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = parseGeminiJson(text);
    return toSafeSummary(parsed);
  } catch (error) {
    const apiError = error?.response?.data?.error?.message || 'Gemini request failed';
    return {
      overallSentiment: 'Summary could not be generated from Gemini right now.',
      topTopics: 'Unavailable due to AI provider error',
      recommendedAction: `Check GEMINI_API_KEY/quota/model. Provider message: ${apiError}`
    };
  }
};

// ─── Shared enrichment helper ─────────────────────────────────────────────────

const enrichPosts = async (posts, userId) => {
  if (!posts.length) return [];
  const postIds = posts.map((p) => p.id);

  const [reactionsRes, commentsRes, savesRes] = await Promise.all([
    pool.query(
      `SELECT r.post_id, r.user_id, r.reaction, r.created_at, u.name AS user_name
       FROM social_post_reactions r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.post_id = ANY($1::uuid[])
       ORDER BY r.created_at DESC`,
      [postIds]
    ),
    pool.query(
      `SELECT c.id, c.post_id, c.user_id, c.comment_text, c.created_at, u.name AS user_name
       FROM social_post_comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ANY($1::uuid[])
       ORDER BY c.created_at DESC`,
      [postIds]
    ),
    pool.query(
      `SELECT s.post_id, s.user_id, s.created_at
       FROM social_post_saves s
       WHERE s.post_id = ANY($1::uuid[])
       ORDER BY s.created_at DESC`,
      [postIds]
    )
  ]);

  const reactionsByPost = {};
  reactionsRes.rows.forEach((row) => {
    if (!reactionsByPost[row.post_id]) reactionsByPost[row.post_id] = [];
    reactionsByPost[row.post_id].push({
      user_id: row.user_id,
      user_name: row.user_name || 'Citizen',
      reaction: row.reaction,
      created_at: row.created_at
    });
  });

  const commentsByPost = {};
  commentsRes.rows.forEach((row) => {
    if (!commentsByPost[row.post_id]) commentsByPost[row.post_id] = [];
    commentsByPost[row.post_id].push({
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name || 'Citizen',
      text: row.comment_text,
      created_at: row.created_at
    });
  });

  const savesByPost = {};
  savesRes.rows.forEach((row) => {
    if (!savesByPost[row.post_id]) savesByPost[row.post_id] = [];
    savesByPost[row.post_id].push({ user_id: row.user_id, created_at: row.created_at });
  });

  return posts.map((post) => {
    const postReactions = reactionsByPost[post.id] || [];
    const counts = { like: 0, love: 0, care: 0, wow: 0, concern: 0 };
    postReactions.forEach((rItem) => {
      if (counts[rItem.reaction] !== undefined) counts[rItem.reaction] += 1;
    });
    const myReaction = postReactions.find((rItem) => rItem.user_id === userId)?.reaction || null;
    const postComments = commentsByPost[post.id] || [];
    const postSaves = savesByPost[post.id] || [];
    const mySaved = postSaves.some((sItem) => sItem.user_id === userId);

    return {
      ...post,
      post_background: post.post_background || null,
      category: post.category || null,
      department: post.department || null,
      priority: post.priority || 'medium',
      is_pinned: !!post.is_pinned,
      is_archived: !!post.is_archived,
      view_count: Number(post.view_count || 0),
      reaction_counts: counts,
      reactions: postReactions,
      my_reaction: myReaction,
      comments: postComments,
      comments_count: postComments.length,
      saves_count: postSaves.length,
      my_saved: mySaved
    };
  });
};

// ─── Routes ──────────────────────────────────────────────────────────────────
const { ObjectId } = require('mongodb');
const { getGridBucket } = require('../db');

// GET /image/:id — serve image from GridFS
router.get('/image/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid image ID' });
  }

  const bucket = getGridBucket();
  if (!bucket) {
    return res.status(503).json({ error: 'Image storage unavailable' });
  }

  try {
    const objectId = new ObjectId(id);
    const files = await bucket.find({ _id: objectId }).toArray();
    
    if (!files.length) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.set('Content-Type', files[0].contentType || 'image/jpeg');
    const downloadStream = bucket.openDownloadStream(objectId);
    downloadStream.pipe(res);
    
    downloadStream.on('error', () => {
      res.status(500).end();
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// POST / — ingest a social post
router.post('/', auth, async (req, res) => {
  const {
    source, source_id, text, author, sentiment, sentiment_score,
    lat, lng, posted_at, image_url, post_background, postBackground,
    category, department, priority
  } = req.body;

  if (!text) return res.status(400).json({ error: 'Missing fields' });

  const resolvedPriority = ALLOWED_PRIORITIES.includes(priority) ? priority : 'medium';

  try {
    await ensureSocialSchema();
    const resolvedSource = source || 'civictwin';
    const resolvedAuthor = author || (req.user.role === 'admin' ? 'Admin' : 'Citizen');
    const resolvedPostedAt = posted_at || new Date().toISOString();

    const q = `INSERT INTO social_feed
      (id, source, source_id, text, author, sentiment, sentiment_score,
       location_geometry, posted_at, created_at, image_url, posted_by,
       post_background, category, department, priority, is_pinned, is_archived, view_count)
      VALUES
      (gen_random_uuid(), $1, $2, $3, $4, $5, $6,
       CASE WHEN $7::numeric IS NOT NULL AND $8::numeric IS NOT NULL
         THEN ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography
         ELSE NULL
       END,
       $9, now(), $10, $11, $12, $13, $14, $15, FALSE, FALSE, 0)
      RETURNING *`;

    const vals = [
      resolvedSource,
      source_id || null,
      text,
      resolvedAuthor,
      sentiment || null,
      sentiment_score || null,
      lng ?? null,
      lat ?? null,
      resolvedPostedAt,
      image_url || null,
      req.user.id || null,
      post_background || postBackground || null,
      category || null,
      department || null,
      resolvedPriority
    ];

    const r = await pool.query(q, vals);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET / — list posts (paginated, pin-sorted, archived filtered)
router.get('/', auth, async (req, res) => {
  try {
    await ensureSocialSchema();

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const offset = (page - 1) * limit;
    const paged = req.query.page != null || req.query.limit != null;
    const isAdmin = String(req.user?.role || '').toLowerCase() === 'admin';

    // Admins see all posts; citizens only see non-archived
    const whereClause = isAdmin ? '' : 'WHERE is_archived = FALSE';

    const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM social_feed ${whereClause}`);
    const total = totalRes.rows[0]?.total || 0;

    const r = await pool.query(
      `SELECT * FROM social_feed ${whereClause}
       ORDER BY is_pinned DESC, posted_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const posts = r.rows;

    if (!posts.length) {
      if (paged) return res.json({ data: [], page, limit, hasMore: false, total });
      return res.json([]);
    }

    const enriched = await enrichPosts(posts, req.user.id);

    if (paged) {
      return res.json({
        data: enriched,
        page,
        limit,
        hasMore: offset + enriched.length < total,
        total
      });
    }

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /:id/reactions — upsert or remove reaction
router.post('/:id/reactions', auth, async (req, res) => {
  const postId = req.params.id;
  const { reaction } = req.body;
  try {
    await ensureSocialSchema();
    if (!reaction) {
      await pool.query(
        'DELETE FROM social_post_reactions WHERE post_id=$1 AND user_id=$2',
        [postId, req.user.id]
      );
      return res.json({ ok: true, reaction: null });
    }
    if (!ALLOWED_REACTIONS.includes(reaction)) {
      return res.status(400).json({ error: 'Invalid reaction' });
    }
    await pool.query(
      `INSERT INTO social_post_reactions (post_id, user_id, reaction)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id)
       DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now()`,
      [postId, req.user.id, reaction]
    );
    res.json({ ok: true, reaction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /:id/comments — add a comment
router.post('/:id/comments', auth, async (req, res) => {
  const postId = req.params.id;
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text required' });
  }
  try {
    await ensureSocialSchema();
    const inserted = await pool.query(
      `INSERT INTO social_post_comments (post_id, user_id, comment_text)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, user_id, comment_text, created_at`,
      [postId, req.user.id, text.trim()]
    );
    const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const userName = userRes.rows[0]?.name || 'Citizen';
    const row = inserted.rows[0];
    res.status(201).json({
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      user_name: userName,
      text: row.comment_text,
      created_at: row.created_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /:id/save — toggle save
router.post('/:id/save', auth, async (req, res) => {
  const postId = req.params.id;
  const { saved } = req.body || {};
  try {
    await ensureSocialSchema();
    if (saved === false) {
      await pool.query(
        'DELETE FROM social_post_saves WHERE post_id=$1 AND user_id=$2',
        [postId, req.user.id]
      );
      return res.json({ ok: true, saved: false });
    }
    await pool.query(
      `INSERT INTO social_post_saves (post_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (post_id, user_id) DO NOTHING`,
      [postId, req.user.id]
    );
    res.json({ ok: true, saved: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /:id/view — increment view count
router.post('/:id/view', auth, async (req, res) => {
  const postId = req.params.id;
  try {
    await ensureSocialSchema();
    const r = await pool.query(
      `UPDATE social_feed SET view_count = COALESCE(view_count, 0) + 1
       WHERE id = $1
       RETURNING view_count`,
      [postId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json({ ok: true, view_count: Number(r.rows[0].view_count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// PATCH /:id/pin — toggle pin (admin only)
router.patch('/:id/pin', auth, async (req, res) => {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Only admins can pin posts' });
  }
  const postId = req.params.id;
  try {
    await ensureSocialSchema();
    const r = await pool.query(
      `UPDATE social_feed
       SET is_pinned = NOT COALESCE(is_pinned, FALSE)
       WHERE id = $1
       RETURNING id, is_pinned`,
      [postId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json({ ok: true, id: r.rows[0].id, is_pinned: r.rows[0].is_pinned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// PATCH /:id/archive — toggle archive (admin only)
router.patch('/:id/archive', auth, async (req, res) => {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Only admins can archive posts' });
  }
  const postId = req.params.id;
  try {
    await ensureSocialSchema();
    const r = await pool.query(
      `UPDATE social_feed
       SET is_archived = NOT COALESCE(is_archived, FALSE)
       WHERE id = $1
       RETURNING id, is_archived`,
      [postId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json({ ok: true, id: r.rows[0].id, is_archived: r.rows[0].is_archived });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// DELETE /:id — delete post (admin or owner)
router.delete('/:id', auth, async (req, res) => {
  const postId = req.params.id;
  try {
    await ensureSocialSchema();
    const postRes = await pool.query(
      'SELECT id, posted_by FROM social_feed WHERE id = $1',
      [postId]
    );
    if (!postRes.rows.length) return res.status(404).json({ error: 'Post not found' });
    const post = postRes.rows[0];
    const isAdmin = req.user?.role === 'admin';
    const isOwner = post.posted_by && req.user?.id && post.posted_by === req.user.id;
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Forbidden' });
    await pool.query('DELETE FROM social_feed WHERE id = $1', [postId]);
    return res.json({ ok: true, deleted: postId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /:id/ai-summary — Gemini engagement summary (admin only)
router.post('/:id/ai-summary', auth, async (req, res) => {
  const postId = req.params.id;
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Only admins can generate summary' });
  }
  try {
    await ensureSocialSchema();
    const postRes = await pool.query(
      'SELECT id, text FROM social_feed WHERE id = $1',
      [postId]
    );
    if (!postRes.rows.length) return res.status(404).json({ error: 'Post not found' });

    const reactionsRes = await pool.query(
      `SELECT reaction, COUNT(*)::int AS count
       FROM social_post_reactions
       WHERE post_id = $1
       GROUP BY reaction`,
      [postId]
    );
    const reactionCounts = { like: 0, love: 0, care: 0, wow: 0, concern: 0 };
    reactionsRes.rows.forEach((row) => {
      if (reactionCounts[row.reaction] !== undefined) {
        reactionCounts[row.reaction] = Number(row.count || 0);
      }
    });

    const commentsRes = await pool.query(
      `SELECT comment_text FROM social_post_comments
       WHERE post_id = $1 ORDER BY created_at DESC LIMIT 40`,
      [postId]
    );
    const comments = commentsRes.rows.map((row) => row.comment_text).filter(Boolean);

    const summary = await summarizeWithGemini({
      postText: postRes.rows[0].text,
      reactionCounts,
      comments
    });

    return res.json({ post_id: postId, summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Summary generation failed' });
  }
});

module.exports = router;