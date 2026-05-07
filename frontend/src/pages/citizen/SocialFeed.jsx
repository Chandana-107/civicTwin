import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import './Citizen.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const LAST_READ_KEY = 'social_last_read_ts';

const REACTIONS = [
  { key: 'like', emoji: '👍', label: 'Like' },
  { key: 'love', emoji: '❤️', label: 'Love' },
  { key: 'care', emoji: '🤝', label: 'Support' },
  { key: 'wow', emoji: '😮', label: 'Wow' },
  { key: 'concern', emoji: '😟', label: 'Concern' }
];

const PRIORITY_COLORS = {
  low: { bg: '#D1FAE5', color: '#065F46' },
  medium: { bg: '#E0E7FF', color: '#3730A3' },
  high: { bg: '#FEF3C7', color: '#92400E' },
  urgent: { bg: '#FEE2E2', color: '#991B1B' }
};

const SENTIMENT_STYLES = {
  positive: { bg: '#D1FAE5', color: '#065F46' },
  negative: { bg: '#FEE2E2', color: '#991B1B' },
  neutral:  { bg: '#E0E7FF', color: '#3730A3' }
};

const getMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (/^[a-f0-9]{24}$/i.test(url)) return `${API_BASE_URL}/social/image/${url}`;
  return `${API_BASE_URL}${url}`;
};

// Returns 0–1 luminance per the spec (0.299R + 0.587G + 0.114B on 0–1 scaled channels)
const getLuminance = (hex) => {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

// Returns '#FFFFFF' for dark backgrounds, '#1E3150' for light ones
const getTextColor   = (hex) => getLuminance(hex) < 0.5 ? '#FFFFFF' : '#1E3150';
const getSubtleColor = (hex) => getLuminance(hex) < 0.5 ? 'rgba(255,255,255,0.75)' : '#5377A2';
const getBorderColor = (hex) => getLuminance(hex) < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(229,211,138,0.35)';

// Curated civic-themed gradient palette for posts with no admin-set background.
// Each entry is { bg: CSS background string, dark: bool (true = white text) }.
const CIVIC_PALETTE = [
  { bg: 'linear-gradient(135deg, #1E3150 0%, #5377A2 100%)', dark: true  }, // navy → blue
  { bg: 'linear-gradient(135deg, #5377A2 0%, #1E3150 100%)', dark: true  }, // blue → navy
  { bg: 'linear-gradient(135deg, #1E3150 0%, #601A35 100%)', dark: true  }, // navy → burgundy
  { bg: 'linear-gradient(135deg, #601A35 0%, #1E3150 100%)', dark: true  }, // burgundy → navy
  { bg: 'linear-gradient(135deg, #059669 0%, #1E3150 100%)', dark: true  }, // emerald → navy
  { bg: 'linear-gradient(135deg, #1E3150 0%, #D97706 100%)', dark: true  }, // navy → amber
  { bg: 'linear-gradient(135deg, #EFF6FF 0%, #BFDBFE 100%)', dark: false }, // sky blue light
  { bg: 'linear-gradient(135deg, #F1F5F9 0%, #E5D38A 100%)', dark: false }, // slate → gold
];

// Deterministically pick a palette entry from a post's UUID so the same post
// always gets the same gradient across reloads.
const getFallbackEntry = (post) => {
  const id = String(post.id || '');
  const seed = (id.charCodeAt(0) || 0) + (id.charCodeAt(4) || 0) + (id.charCodeAt(8) || 0);
  return CIVIC_PALETTE[seed % CIVIC_PALETTE.length];
};

const getDisplayDate = (postedAt) => {
  if (!postedAt) return 'Unknown time';
  const d = new Date(postedAt);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
};

const SkeletonCard = () => (
  <article className="social-post-card">
    <div className="citizen-skeleton-header">
      <div className="citizen-skeleton-avatar" />
      <div style={{ flex: 1 }}>
        <div className="citizen-skeleton-line" style={{ width: '45%', height: '13px', marginBottom: '0.4rem' }} />
        <div className="citizen-skeleton-line" style={{ width: '30%', height: '11px' }} />
      </div>
    </div>
    <div className="citizen-skeleton-media" />
    <div className="citizen-skeleton-line" style={{ width: '90%', height: '12px', marginBottom: '0.4rem' }} />
    <div className="citizen-skeleton-line" style={{ width: '65%', height: '12px' }} />
  </article>
);

const SocialFeed = () => {
  const navigate = useNavigate();
  const LIMIT = 8;

  const feedTopRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [draftComments, setDraftComments] = useState({});
  const [openCommentsByPost, setOpenCommentsByPost] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [lastReadTs] = useState(() => {
    try { return localStorage.getItem(LAST_READ_KEY) || ''; } catch { return ''; }
  });

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const normalizePost = useCallback((row) => ({
    ...row,
    image_url: getMediaUrl(row.image_url),
    post_background: row.post_background || null,
    my_reaction: row.my_reaction || null,
    comments: Array.isArray(row.comments) ? row.comments : [],
    comments_count: typeof row.comments_count === 'number' ? row.comments_count : (Array.isArray(row.comments) ? row.comments.length : 0),
    reaction_counts: row.reaction_counts || { like: 0, love: 0, care: 0, wow: 0, concern: 0 },
    saves_count: Number(row.saves_count || 0),
    my_saved: !!row.my_saved,
    view_count: Number(row.view_count || 0),
    priority: row.priority || 'medium',
    department: row.department || null,
    category: row.category || null,
    sentiment: row.sentiment || null,
  }), []);

  const fetchPosts = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/social', { params: { page: targetPage, limit: LIMIT } });
      const payload = res.data;
      const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      setPosts(rows.map(normalizePost));
      setTotal(typeof payload?.total === 'number' ? payload.total : rows.length);
      setPage(targetPage);
    } catch {
      toast.error('Failed to load social feed');
    } finally {
      setLoading(false);
    }
  }, [normalizePost]);

  const goToPage = useCallback((p) => {
    if (p < 1 || p > totalPages) return;
    fetchPosts(p);
    // Scroll feed top into view smoothly
    feedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [fetchPosts, totalPages]);

  useEffect(() => {
    fetchPosts(1);
    return () => {
      try { localStorage.setItem(LAST_READ_KEY, new Date().toISOString()); } catch {}
    };
  }, [fetchPosts]);

  // Reset to page 1 whenever search or dept filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, deptFilter]);

  // Track view on mount per-post (fire-and-forget)
  const trackView = useCallback((postId) => {
    api.post(`/social/${postId}/view`).catch(() => {});
  }, []);

  const setReaction = async (postId, reaction) => {
    const current = posts.find((p) => p.id === postId);
    const nextReaction = current?.my_reaction === reaction ? null : reaction;
    try {
      await api.post(`/social/${postId}/reactions`, { reaction: nextReaction });
      setPosts((prev) => prev.map((post) => {
        if (post.id !== postId) return post;
        const counts = { ...(post.reaction_counts || {}) };
        if (post.my_reaction && counts[post.my_reaction] != null) counts[post.my_reaction] = Math.max(0, counts[post.my_reaction] - 1);
        if (nextReaction) counts[nextReaction] = (counts[nextReaction] || 0) + 1;
        return { ...post, my_reaction: nextReaction, reaction_counts: counts };
      }));
    } catch {
      toast.error('Failed to save reaction');
    }
  };

  const addComment = async (postId) => {
    const text = (draftComments[postId] || '').trim();
    if (!text) return;
    try {
      const res = await api.post(`/social/${postId}/comments`, { text });
      setPosts((prev) => prev.map((post) => {
        if (post.id !== postId) return post;
        return { ...post, comments: [res.data, ...(Array.isArray(post.comments) ? post.comments : [])], comments_count: (post.comments_count || 0) + 1 };
      }));
      setDraftComments((prev) => ({ ...prev, [postId]: '' }));
    } catch {
      toast.error('Failed to add comment');
    }
  };

  const sharePost = async (postId) => {
    const url = `${window.location.origin}/citizen/social?post=${postId}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'CivicTwin Social Feed Post', url }); return; }
      await navigator.clipboard.writeText(url);
      toast.success('Post link copied');
    } catch {
      toast.error('Could not share post');
    }
  };

  // Derived: apply search + dept filter (client-side on current page)
  const visiblePosts = posts.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || (p.text || '').toLowerCase().includes(q) || (p.author || '').toLowerCase().includes(q);
    const matchDept = !deptFilter || p.department === deptFilter;
    return matchSearch && matchDept;
  });

  // Collect departments from all loaded posts for filter dropdown
  const allDepts = [...new Set(posts.map((p) => p.department).filter(Boolean))];

  const isNew = (post) => lastReadTs && post.posted_at && new Date(post.posted_at) > new Date(lastReadTs);

  // Build page number list with ellipsis
  const pageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="complaints-container social-feed-page" ref={feedTopRef}>
      {/* Header */}
      <div className="complaints-header social-feed-header">
        <h2>📢 Social Feed</h2>
        <div className="complaints-actions">
          <button className="btn btn-outline" onClick={() => fetchPosts(1, false)}>↻ Refresh</button>
          <button className="btn btn-secondary" onClick={() => navigate('/citizen/dashboard')}>← Dashboard</button>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="citizen-feed-filter-bar">
        <input
          className="form-input citizen-feed-search"
          placeholder="🔍 Search posts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {allDepts.length > 0 && (
          <select
            className="form-input citizen-feed-dept-select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {allDepts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="social-feed-list">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="citizen-feed-empty">
          <div className="citizen-feed-empty-icon">📭</div>
          <h3>{posts.length === 0 ? 'No Posts Yet' : 'No Results'}</h3>
          <p>{posts.length === 0 ? 'Check back later for updates from your civic administration.' : 'Try a different search term or clear the department filter.'}</p>
          {posts.length > 0 && (
            <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => { setSearchQuery(''); setDeptFilter(''); }}>Clear Filters</button>
          )}
        </div>
      ) : (
        <div className="social-feed-list">
          {visiblePosts.map((post) => {
            // Resolve effective background: admin-set hex OR deterministic palette gradient
            const rawBg = post.post_background || null;
            const fallback = getFallbackEntry(post);
            const effectiveBg = rawBg || fallback.bg;

            // Text colours: hex colours use luminance; gradients use pre-flagged dark flag
            const isDark      = rawBg ? getLuminance(rawBg) < 0.5 : fallback.dark;
            const textColor   = isDark ? '#FFFFFF' : '#1E3150';
            const subtleColor = isDark ? 'rgba(255,255,255,0.75)' : '#5377A2';
            const borderColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(229,211,138,0.35)';

            const priorityStyle  = PRIORITY_COLORS[post.priority] || PRIORITY_COLORS.medium;
            const sentimentStyle = post.sentiment ? (SENTIMENT_STYLES[post.sentiment] || SENTIMENT_STYLES.neutral) : null;

            return (
              <article
                key={post.id}
                className="social-post-card"
                style={{ background: effectiveBg, border: `1px solid ${borderColor}` }}
                ref={(el) => { if (el) trackView(post.id); }}
              >
                {/* NEW badge */}
                {isNew(post) && <span className="citizen-new-badge">NEW</span>}

                <header className="social-post-header">
                  <div className="social-user-meta">
                    <div className="social-avatar-chip" style={{ flexShrink: 0 }}>
                      {(post.author || 'C').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="social-username" style={{ color: textColor }}>
                        {post.author || 'CivicTwin'}
                      </h3>
                      <p className="social-subline" style={{ color: subtleColor }}>
                        {post.source || 'CivicTwin'} • {getDisplayDate(post.posted_at)}
                      </p>
                    </div>
                  </div>
                  <button className="social-menu-btn" aria-label="More options"
                    style={{ color: subtleColor }}>⋮</button>
                </header>

                {/* Tags row — chips have their own backgrounds, always legible */}
                <div className="citizen-tags-row">
                  {post.department && (
                    <span className="citizen-dept-badge">🏛️ {post.department}</span>
                  )}
                  {post.priority && post.priority !== 'medium' && (
                    <span className="citizen-priority-chip" style={{ background: priorityStyle.bg, color: priorityStyle.color }}>
                      {post.priority === 'urgent' ? '🔴' : post.priority === 'high' ? '🟠' : '🟢'} {post.priority}
                    </span>
                  )}
                  {sentimentStyle && (
                    <span className="citizen-sentiment-tag" style={{ background: sentimentStyle.bg, color: sentimentStyle.color }}>
                      {post.sentiment}
                    </span>
                  )}
                </div>

                {/* Image (if any) */}
                {post.image_url && (
                  <img src={post.image_url} alt="Social post" className="social-post-image" />
                )}

                {/* Post text — colour always derived from background */}
                {post.text && (
                  <p className="citizen-post-text" style={{ color: textColor }}>
                    {post.text}
                  </p>
                )}

                {/* Reaction stats */}
                <div className="citizen-reaction-stats"
                  style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '0.5rem', marginTop: '0.3rem' }}>
                  {Object.entries(post.reaction_counts || {}).map(([k, v]) => v > 0 && (
                    <span key={k} className="citizen-reaction-count" style={{ color: subtleColor }}>
                      {k === 'like' ? '👍' : k === 'love' ? '❤️' : k === 'care' ? '🤝' : k === 'wow' ? '😮' : '😟'} {v}
                    </span>
                  ))}
                  {post.view_count > 0 && (
                    <span className="citizen-reaction-count" style={{ marginLeft: 'auto', color: subtleColor }}>
                      👁️ {post.view_count}
                    </span>
                  )}
                </div>

                {/* Action row */}
                <div className="social-action-row"
                  style={{ borderTop: `1px solid ${borderColor}`, marginTop: '0.4rem', paddingTop: '0.4rem' }}>
                  <div className="social-action-left">
                    {REACTIONS.map((r) => (
                      <button
                        key={r.key}
                        className={`social-icon-btn${post.my_reaction === r.key ? ' active' : ''}`}
                        title={r.label}
                        onClick={() => setReaction(post.id, r.key)}
                        style={post.my_reaction !== r.key
                          ? { background: 'rgba(255,255,255,0.15)', borderColor, color: textColor }
                          : undefined}
                      >
                        {r.emoji}
                      </button>
                    ))}
                  </div>
                  <button className="social-icon-btn" title="Comments"
                    onClick={() => setOpenCommentsByPost((p) => ({ ...p, [post.id]: !p[post.id] }))}
                    style={{ background: 'rgba(255,255,255,0.15)', borderColor, color: textColor }}>
                    💬 {post.comments_count}
                  </button>
                  <button className="social-icon-btn" onClick={() => sharePost(post.id)}
                    style={{ background: 'rgba(255,255,255,0.15)', borderColor, color: textColor }}>
                    🔗 Share
                  </button>
                </div>

                {/* Comments */}
                {openCommentsByPost[post.id] && (
                  <div className="social-comments-wrap">
                    <div className="social-comment-input-row">
                      <input
                        className="form-input social-comment-input"
                        value={draftComments[post.id] || ''}
                        placeholder="Add a comment..."
                        onChange={(e) => setDraftComments((p) => ({ ...p, [post.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') addComment(post.id); }}
                      />
                      <button className="btn btn-primary" onClick={() => addComment(post.id)}>Post</button>
                    </div>
                    {post.comments.length > 0 ? (
                      <div className="social-comments-list">
                        {post.comments.map((c) => (
                          <div key={c.id} className="social-comment-item">
                            <p>{c.text}</p>
                            <p className="social-comment-time">{c.user_name || 'Citizen'} • {new Date(c.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="social-no-comments">No comments yet.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination bar */}
      {!loading && totalPages > 1 && (
        <div className="citizen-pagination">
          <button
            className="citizen-page-btn citizen-page-prev"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
          >
            ← Prev
          </button>

          <div className="citizen-page-numbers">
            {pageNumbers().map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="citizen-page-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  className={`citizen-page-num${page === p ? ' active' : ''}`}
                  onClick={() => goToPage(p)}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            className="citizen-page-btn citizen-page-next"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default SocialFeed;