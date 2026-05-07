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

const getTextColor   = (hex) => getLuminance(hex) < 0.5 ? '#FFFFFF' : '#1E3150';
const getSubtleColor = (hex) => getLuminance(hex) < 0.5 ? 'rgba(255,255,255,0.75)' : '#5377A2';
const getBorderColor = (hex) => getLuminance(hex) < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(229,211,138,0.35)';

const CIVIC_PALETTE = [
  { bg: 'linear-gradient(135deg, #1E3150 0%, #5377A2 100%)', dark: true  },
  { bg: 'linear-gradient(135deg, #5377A2 0%, #1E3150 100%)', dark: true  },
  { bg: 'linear-gradient(135deg, #1E3150 0%, #601A35 100%)', dark: true  },
  { bg: 'linear-gradient(135deg, #601A35 0%, #1E3150 100%)', dark: true  },
  { bg: 'linear-gradient(135deg, #059669 0%, #1E3150 100%)', dark: true  },
  { bg: 'linear-gradient(135deg, #1E3150 0%, #D97706 100%)', dark: true  },
  { bg: 'linear-gradient(135deg, #EFF6FF 0%, #BFDBFE 100%)', dark: false },
  { bg: 'linear-gradient(135deg, #F1F5F9 0%, #E5D38A 100%)', dark: false },
];

const getFallbackEntry = (post) => {
  const id = String(post.id || '');
  const seed = (id.charCodeAt(0) || 0) + (id.charCodeAt(4) || 0) + (id.charCodeAt(8) || 0);
  return CIVIC_PALETTE[seed % CIVIC_PALETTE.length];
};

/* ── Sub-components ──────────────────────────────────────────── */
const MetricsBar = ({ post, textColor }) => {
  const rc = post.reaction_counts || {};
  const totalReactions = Object.values(rc).reduce((s, v) => s + Number(v || 0), 0);
  const bg = textColor === '#FFFFFF' ? 'rgba(255,255,255,0.1)' : '#F8FAFC';
  const border = textColor === '#FFFFFF' ? 'rgba(255,255,255,0.2)' : '#E2E8F0';
  
  return (
    <div className="sfa-metrics-bar">
      <div className="sfa-metric-chip" style={{ background: bg, borderColor: border, color: textColor }}>
        <span className="sfa-metric-icon">👁️</span>
        <span className="sfa-metric-val">{Number(post.view_count || 0)}</span>
        <span className="sfa-metric-lbl" style={{ color: textColor, opacity: 0.8 }}>Views</span>
      </div>
      <div className="sfa-metric-chip" style={{ background: bg, borderColor: border, color: textColor }}>
        <span className="sfa-metric-icon">❤️</span>
        <span className="sfa-metric-val">{totalReactions}</span>
        <span className="sfa-metric-lbl" style={{ color: textColor, opacity: 0.8 }}>Reactions</span>
      </div>
      <div className="sfa-metric-chip" style={{ background: bg, borderColor: border, color: textColor }}>
        <span className="sfa-metric-icon">💬</span>
        <span className="sfa-metric-val">{post.comments_count || 0}</span>
        <span className="sfa-metric-lbl" style={{ color: textColor, opacity: 0.8 }}>Comments</span>
      </div>
      <div className="sfa-metric-chip" style={{ background: bg, borderColor: border, color: textColor }}>
        <span className="sfa-metric-icon">🔖</span>
        <span className="sfa-metric-val">{post.saves_count || 0}</span>
        <span className="sfa-metric-lbl" style={{ color: textColor, opacity: 0.8 }}>Saves</span>
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
      <button className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={fetchSummary} disabled={loading} style={{ background: 'rgba(255,255,255,0.2)', color: 'inherit', borderColor: 'currentColor' }}>
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

const PostCard = ({ post, onDelete, onPin, onArchive, onImageClick }) => {
  const rawBg = post.post_background || null;
  const fallback = getFallbackEntry(post);
  const effectiveBg = rawBg || fallback.bg;

  const isDark      = rawBg ? getLuminance(rawBg) < 0.5 : fallback.dark;
  const textColor   = isDark ? '#FFFFFF' : '#1E3150';
  const subtleColor = isDark ? 'rgba(255,255,255,0.75)' : '#5377A2';
  const borderColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(229,211,138,0.35)';

  return (
    <article 
      className={`sfa-card${post.is_pinned ? ' pinned' : ''}${post.is_archived ? ' archived' : ''}`}
      style={{ background: effectiveBg, borderColor, color: textColor }}
    >
      {post.is_pinned && <span className="sfa-pin-ribbon">📌 Pinned</span>}
      <div className="sfa-post-header">
        <div className="sfa-avatar">{(post.author || 'A').slice(0, 1).toUpperCase()}</div>
        <div className="sfa-post-meta">
          <p className="sfa-author-name" style={{ color: textColor }}>{post.author || 'Admin'}</p>
          <p className="sfa-post-time" style={{ color: subtleColor }}>{post.posted_at ? new Date(post.posted_at).toLocaleString() : 'Unknown time'}</p>
          <div className="sfa-tags-row">
            {post.department && <span className="sfa-tag sfa-tag-dept">🏛️ {post.department}</span>}
            {post.category   && <span className="sfa-tag sfa-tag-cat">📂 {post.category}</span>}
            {post.priority   && <span className={`sfa-tag sfa-tag-priority-${post.priority}`}>{PRIORITY_ICONS[post.priority]} {post.priority}</span>}
            {post.sentiment  && <span className={`sfa-tag sfa-tag-sentiment-${post.sentiment}`}>{post.sentiment}</span>}
            {post.is_archived && <span className="sfa-tag" style={{ background: '#F3F4F6', color: '#6B7280' }}>🗃️ Archived</span>}
          </div>
        </div>
      </div>
      
      {post.image_url && (
        <img loading="lazy" src={post.image_url} alt="Post" className="sfa-post-media" onClick={() => onImageClick && onImageClick(post.image_url)} style={{ cursor: 'pointer' }} />
      )}
      
      {post.text && (
        <p className="sfa-post-text" style={{ color: textColor, padding: post.image_url ? '0' : '1rem 0', fontSize: '1.05rem' }}>
          {post.text}
        </p>
      )}
      
      <MetricsBar post={post} textColor={textColor} />

      {/* ── Admin controls ─────────────────────────────────── */}
      <div className="sfa-admin-controls" style={{ borderTop: `1px solid ${borderColor}`, paddingTop: '0.85rem', marginTop: '0.5rem' }}>
        <button
          className={`sfa-admin-btn${post.is_pinned ? ' sfa-admin-btn--active' : ''}`}
          onClick={onPin}
          style={{ borderColor, color: textColor, background: 'transparent' }}
        >
          📌 {post.is_pinned ? 'Unpin' : 'Pin'}
        </button>
        <button
          className={`sfa-admin-btn${post.is_archived ? ' sfa-admin-btn--active' : ''}`}
          onClick={onArchive}
          style={{ borderColor, color: textColor, background: 'transparent' }}
        >
          🗃️ {post.is_archived ? 'Unarchive' : 'Archive'}
        </button>
        <button className="sfa-admin-btn sfa-admin-btn--danger" onClick={onDelete} style={{ background: 'transparent' }}>
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
  const [lightboxImage, setLightboxImage] = useState(null);

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
              onImageClick={(url) => setLightboxImage(url)}
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

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'zoom-out' }}
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage} alt="Full screen view" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
          <button 
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default SocialFeedPage;
