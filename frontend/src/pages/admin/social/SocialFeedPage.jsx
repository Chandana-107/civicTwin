import React, { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../../../utils/api';

const PRIORITY_ICONS = { low: '🟢', medium: '🔵', high: '🟠', urgent: '🔴' };

const getLuminance = (hex) => {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 128;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/* ── Sub-components ──────────────────────────────────────────── */
const MetricsBar = ({ post }) => {
  const rc = post.reaction_counts || {};
  const totalReactions = Object.values(rc).reduce((s, v) => s + Number(v || 0), 0);
  return (
    <div className="sfa-metrics-bar">
      <div className="sfa-metric-chip">
        <span className="sfa-metric-icon">👁️</span>
        <span className="sfa-metric-val">{Number(post.view_count || 0)}</span>
        <span className="sfa-metric-lbl">Views</span>
      </div>
      <div className="sfa-metric-chip">
        <span className="sfa-metric-icon">❤️</span>
        <span className="sfa-metric-val">{totalReactions}</span>
        <span className="sfa-metric-lbl">Reactions</span>
      </div>
      <div className="sfa-metric-chip">
        <span className="sfa-metric-icon">💬</span>
        <span className="sfa-metric-val">{post.comments_count || 0}</span>
        <span className="sfa-metric-lbl">Comments</span>
      </div>
      <div className="sfa-metric-chip">
        <span className="sfa-metric-icon">🔖</span>
        <span className="sfa-metric-val">{post.saves_count || 0}</span>
        <span className="sfa-metric-lbl">Saves</span>
      </div>
    </div>
  );
};

const AiPanel = ({ postId }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/social/${postId}/ai-summary`);
      setSummary(res.data?.summary);
    } catch { toast.error('AI summary failed'); }
    finally { setLoading(false); }
  };
  if (!summary) return (
    <div style={{ marginTop: '0.75rem' }}>
      <button className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={fetchSummary} disabled={loading}>
        {loading ? '⏳ Generating…' : '✨ Generate AI Summary'}
      </button>
    </div>
  );
  return (
    <div className="sfa-ai-panel">
      <div className="sfa-ai-panel-header">
        <h4>AI Engagement Summary</h4>
        <span className="sfa-ai-badge">Gemini</span>
        <button className="sfa-btn sfa-btn-ghost sfa-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSummary(null)}>✕</button>
      </div>
      <div className="sfa-ai-field"><div className="sfa-ai-field-label">Overall Sentiment</div><div className="sfa-ai-field-value">{summary.overallSentiment}</div></div>
      <div className="sfa-ai-field"><div className="sfa-ai-field-label">Top Topics</div><div className="sfa-ai-field-value">{summary.topTopics}</div></div>
      <div className="sfa-ai-field"><div className="sfa-ai-field-label">Recommended Action</div><div className="sfa-ai-field-value">{summary.recommendedAction}</div></div>
    </div>
  );
};

const CommentSection = ({ isOpen, comments, draft, onDraftChange, onSubmit }) => {
  if (!isOpen) return null;
  return (
    <div className="sfa-comments-wrap">
      <div className="sfa-comment-input-row">
        <input className="sfa-input sfa-comment-input" value={draft} placeholder="Add a comment…"
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }} />
        <button className="sfa-btn sfa-btn-primary sfa-btn-sm" onClick={onSubmit}>Post</button>
      </div>
      {comments.length > 0 ? (
        <div className="sfa-comments-list">
          {comments.map((c) => (
            <div key={c.id} className="sfa-comment-item">
              <p>{c.text}</p>
              <p className="sfa-comment-time">{c.user_name || 'Citizen'} • {new Date(c.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      ) : <p className="sfa-no-comments">No comments yet.</p>}
    </div>
  );
};

const PostCard = ({ post, onDelete, onPin, onArchive }) => {
  const textColor = getLuminance(post.post_background || '') < 140 ? '#fff' : '#111827';
  return (
    <article className={`sfa-card${post.is_pinned ? ' pinned' : ''}${post.is_archived ? ' archived' : ''}`}>
      {post.is_pinned && <span className="sfa-pin-ribbon">📌 Pinned</span>}
      <div className="sfa-post-header">
        <div className="sfa-avatar">{(post.author || 'A').slice(0, 1).toUpperCase()}</div>
        <div className="sfa-post-meta">
          <p className="sfa-author-name">{post.author || 'Admin'}</p>
          <p className="sfa-post-time">{post.posted_at ? new Date(post.posted_at).toLocaleString() : 'Unknown time'}</p>
          <div className="sfa-tags-row">
            {post.department && <span className="sfa-tag sfa-tag-dept">🏛️ {post.department}</span>}
            {post.category   && <span className="sfa-tag sfa-tag-cat">📂 {post.category}</span>}
            {post.priority   && <span className={`sfa-tag sfa-tag-priority-${post.priority}`}>{PRIORITY_ICONS[post.priority]} {post.priority}</span>}
            {post.sentiment  && <span className={`sfa-tag sfa-tag-sentiment-${post.sentiment}`}>{post.sentiment}</span>}
            {post.is_archived && <span className="sfa-tag" style={{ background: '#F3F4F6', color: '#6B7280' }}>🗃️ Archived</span>}
          </div>
        </div>
      </div>
      {post.image_url ? (
        <img loading="lazy" src={post.image_url} alt="Post" className="sfa-post-media" />
      ) : (
        <div className="sfa-post-bg-panel" style={{ background: post.post_background || 'linear-gradient(135deg,#1E3150,#5377A2)' }}>
          <p style={{ color: textColor }}>{post.text}</p>
        </div>
      )}
      {post.image_url && <p className="sfa-post-text">{post.text}</p>}
      <MetricsBar post={post} />

      {/* ── Admin controls ─────────────────────────────────── */}
      <div className="sfa-admin-controls">
        <button
          className={`sfa-admin-btn${post.is_pinned ? ' sfa-admin-btn--active' : ''}`}
          onClick={onPin}
        >
          📌 {post.is_pinned ? 'Unpin' : 'Pin'}
        </button>
        <button
          className={`sfa-admin-btn${post.is_archived ? ' sfa-admin-btn--active' : ''}`}
          onClick={onArchive}
        >
          🗃️ {post.is_archived ? 'Unarchive' : 'Archive'}
        </button>
        <button className="sfa-admin-btn sfa-admin-btn--danger" onClick={onDelete}>
          🗑️ Delete
        </button>
      </div>

      <AiPanel postId={post.id} />
    </article>
  );
};

/* ── Skeleton ────────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="sfa-skeleton-card">
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.85rem' }}>
      <div className="sfa-skeleton-avatar" />
      <div style={{ flex: 1 }}>
        <div className="sfa-skeleton-line" style={{ height: '14px', width: '40%', marginBottom: '0.4rem' }} />
        <div className="sfa-skeleton-line" style={{ height: '11px', width: '25%' }} />
      </div>
    </div>
    <div className="sfa-skeleton-media" />
    <div className="sfa-skeleton-line" style={{ height: '12px', width: '90%', marginBottom: '0.4rem' }} />
    <div className="sfa-skeleton-line" style={{ height: '12px', width: '65%' }} />
  </div>
);

/* ── Main feed page ──────────────────────────────────────────── */
const SocialFeedPage = () => {
  const { posts, loading, page, totalPages, fetchPosts, deletePost, pinPost, archivePost } = useOutletContext();

  const feedTopRef = useRef(null);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    fetchPosts(p);
    feedTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
    <div ref={feedTopRef}>
      {loading ? (
        <div className="sfa-feed">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : posts.length === 0 ? (
        <div className="sfa-empty-state">
          <div className="sfa-empty-icon">📭</div>
          <h3>No Posts Yet</h3>
          <p>Go to the Compose tab to create your first post.</p>
        </div>
      ) : (
        <div className="sfa-feed">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={() => deletePost(post.id)}
              onPin={() => pinPost(post.id)}
              onArchive={() => archivePost(post.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="sfa-pagination">
          <button className="sfa-page-btn" onClick={() => goToPage(page - 1)} disabled={page <= 1}>← Prev</button>
          <div className="sfa-page-numbers">
            {pageNumbers().map((p, i) =>
              p === '...' ? (
                <span key={`el-${i}`} className="sfa-page-ellipsis">…</span>
              ) : (
                <button key={p} className={`sfa-page-num${page === p ? ' active' : ''}`} onClick={() => goToPage(p)}>{p}</button>
              )
            )}
          </div>
          <button className="sfa-page-btn" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>Next →</button>
        </div>
      )}
    </div>
  );
};

export default SocialFeedPage;
