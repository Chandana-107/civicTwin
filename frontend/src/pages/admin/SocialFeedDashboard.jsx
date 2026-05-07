import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import './SocialFeedAdmin.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const getMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url}`;
};

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_ICONS = { low: '🟢', medium: '🔵', high: '🟠', urgent: '🔴' };
const CATEGORIES = ['General', 'Infrastructure', 'Health', 'Education', 'Safety', 'Environment', 'Welfare', 'Transport'];
const DEPARTMENTS = ['Public Works', 'Health Dept', 'Education', 'Police', 'Finance', 'Revenue', 'Water Board', 'Electricity'];

const getLuminance = (hex) => {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 128;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

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

const MetricsBar = ({ post }) => {
  const rc = post.reaction_counts || {};
  return (
    <div className="sfa-metrics-bar">
      <span className="sfa-metric-item">👁️ {Number(post.view_count || 0)}</span>
      <span className="sfa-metric-sep">•</span>
      <div className="sfa-reactions-breakdown">
        {Object.entries(rc).map(([k, v]) => v > 0 && (
          <span key={k} className="sfa-reaction-stat">
            {k === 'like' ? '👍' : k === 'love' ? '❤️' : k === 'care' ? '🤝' : k === 'wow' ? '😮' : '😟'} {v}
          </span>
        ))}
      </div>
      <span className="sfa-metric-sep">•</span>
      <span className="sfa-metric-item">💬 {post.comments_count || 0}</span>
      <span className="sfa-metric-sep">•</span>
      <span className="sfa-metric-item">🔖 {post.saves_count || 0}</span>
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
    } catch {
      toast.error('AI summary failed');
    } finally {
      setLoading(false);
    }
  };

  if (!summary) {
    return (
      <div style={{ marginTop: '0.75rem' }}>
        <button className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={fetchSummary} disabled={loading}>
          {loading ? '⏳ Generating...' : '✨ Generate AI Summary'}
        </button>
      </div>
    );
  }

  return (
    <div className="sfa-ai-panel">
      <div className="sfa-ai-panel-header">
        <h4>AI Engagement Summary</h4>
        <span className="sfa-ai-badge">Gemini</span>
        <button className="sfa-btn sfa-btn-ghost sfa-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSummary(null)}>✕</button>
      </div>
      <div className="sfa-ai-field">
        <div className="sfa-ai-field-label">Overall Sentiment</div>
        <div className="sfa-ai-field-value">{summary.overallSentiment}</div>
      </div>
      <div className="sfa-ai-field">
        <div className="sfa-ai-field-label">Top Topics</div>
        <div className="sfa-ai-field-value">{summary.topTopics}</div>
      </div>
      <div className="sfa-ai-field">
        <div className="sfa-ai-field-label">Recommended Action</div>
        <div className="sfa-ai-field-value">{summary.recommendedAction}</div>
      </div>
    </div>
  );
};

const CommentSection = ({ isOpen, comments, draft, onDraftChange, onSubmit }) => {
  if (!isOpen) return null;
  return (
    <div className="sfa-comments-wrap">
      <div className="sfa-comment-input-row">
        <input
          className="sfa-input sfa-comment-input"
          value={draft}
          placeholder="Add a comment..."
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
        />
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
      ) : (
        <p className="sfa-no-comments">No comments yet.</p>
      )}
    </div>
  );
};

const PostCard = ({ post, commentsOpen, commentDraft, onDraftChange, onToggleLike, onToggleComments, onToggleSave, onShare, onDelete, onPin, onArchive, onSubmitComment }) => {
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
            {post.category && <span className="sfa-tag sfa-tag-cat">📂 {post.category}</span>}
            {post.priority && <span className={`sfa-tag sfa-tag-priority-${post.priority}`}>{PRIORITY_ICONS[post.priority]} {post.priority}</span>}
            {post.sentiment && <span className={`sfa-tag sfa-tag-sentiment-${post.sentiment}`}>{post.sentiment}</span>}
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

      <div className="sfa-action-row">
        <button className={`sfa-btn sfa-btn-ghost sfa-btn-sm${post.my_reaction === 'like' ? ' sfa-heart-pop' : ''}`} onClick={onToggleLike}>
          {post.my_reaction === 'like' ? '❤️' : '🤍'}
        </button>
        <button className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={onToggleComments}>💬</button>
        <button className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={onShare}>📤</button>
        <button className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={onToggleSave}>{post.my_saved ? '🔖' : '📑'}</button>
        <button className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={onPin} title={post.is_pinned ? 'Unpin' : 'Pin'}>
          {post.is_pinned ? '📌 Unpin' : '📌 Pin'}
        </button>
        <button className="sfa-btn sfa-btn-ghost sfa-btn-sm" onClick={onArchive} title={post.is_archived ? 'Unarchive' : 'Archive'}>
          {post.is_archived ? '📂 Unarchive' : '🗃️ Archive'}
        </button>
        <button className="sfa-btn sfa-btn-danger sfa-btn-sm" onClick={onDelete}>🗑️</button>
      </div>

      <AiPanel postId={post.id} />

      <CommentSection
        isOpen={commentsOpen}
        comments={Array.isArray(post.comments) ? post.comments : []}
        draft={commentDraft}
        onDraftChange={onDraftChange}
        onSubmit={onSubmitComment}
      />
    </article>
  );
};

const SocialFeedDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const LIMIT = 8;

  const feedTopRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openCommentsByPost, setOpenCommentsByPost] = useState({});
  const [draftComments, setDraftComments] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [form, setForm] = useState({
    text: '', imageFile: null, imagePreview: null,
    bgColor: '#1E3150', category: '', department: '', priority: 'medium'
  });

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => { fetchPosts(1); }, []);

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

  const normalizePost = (row) => ({
    ...row,
    image_url: getMediaUrl(row.image_url),
    post_background: row.post_background || null,
    comments: Array.isArray(row.comments) ? row.comments : [],
    comments_count: typeof row.comments_count === 'number' ? row.comments_count : 0,
    reaction_counts: row.reaction_counts || { like: 0, love: 0, care: 0, wow: 0, concern: 0 },
    my_reaction: row.my_reaction || null,
    my_saved: !!row.my_saved,
    saves_count: Number(row.saves_count || 0),
    view_count: Number(row.view_count || 0),
    is_pinned: !!row.is_pinned,
    is_archived: !!row.is_archived,
    priority: row.priority || 'medium',
    category: row.category || null,
    department: row.department || null,
  });

  const fetchPosts = async (targetPage = 1) => {
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
  };

  const toggleLike = async (postId) => {
    const target = posts.find((p) => p.id === postId);
    const nextReaction = target?.my_reaction === 'like' ? null : 'like';
    try {
      await api.post(`/social/${postId}/reactions`, { reaction: nextReaction });
      setPosts((prev) => prev.map((p) => {
        if (p.id !== postId) return p;
        const counts = { ...(p.reaction_counts || {}) };
        if (p.my_reaction === 'like') counts.like = Math.max(0, (counts.like || 0) - 1);
        if (nextReaction === 'like') counts.like = (counts.like || 0) + 1;
        return { ...p, my_reaction: nextReaction, reaction_counts: counts };
      }));
    } catch { toast.error('Could not update like'); }
  };

  const toggleSave = async (postId) => {
    const target = posts.find((p) => p.id === postId);
    const nextSaved = !target?.my_saved;
    try {
      await api.post(`/social/${postId}/save`, { saved: nextSaved });
      setPosts((prev) => prev.map((p) => {
        if (p.id !== postId) return p;
        const nextCount = nextSaved ? (Number(p.saves_count || 0) + 1) : Math.max(0, Number(p.saves_count || 0) - 1);
        return { ...p, my_saved: nextSaved, saves_count: nextCount };
      }));
    } catch { toast.error('Could not update save'); }
  };

  const sharePost = async (postId) => {
    const url = `${window.location.origin}/citizen/social?post=${postId}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'CivicTwin Post', url }); return; }
      await navigator.clipboard.writeText(url);
      toast.success('Post link copied');
    } catch { toast.error('Share failed'); }
  };

  const submitComment = async (postId) => {
    const text = (draftComments[postId] || '').trim();
    if (!text) return;
    try {
      const res = await api.post(`/social/${postId}/comments`, { text });
      setPosts((prev) => prev.map((p) => {
        if (p.id !== postId) return p;
        return { ...p, comments: [res.data, ...(p.comments || [])], comments_count: Number(p.comments_count || 0) + 1 };
      }));
      setDraftComments((prev) => ({ ...prev, [postId]: '' }));
    } catch { toast.error('Comment failed'); }
  };

  const pinPost = async (postId) => {
    try {
      const res = await api.patch(`/social/${postId}/pin`);
      const { is_pinned } = res.data;
      setPosts((prev) => {
        const updated = prev.map((p) => p.id === postId ? { ...p, is_pinned } : p);
        return [...updated].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || new Date(b.posted_at) - new Date(a.posted_at));
      });
      toast.success(is_pinned ? 'Post pinned' : 'Post unpinned');
    } catch { toast.error('Pin failed'); }
  };

  const archivePost = async (postId) => {
    try {
      const res = await api.patch(`/social/${postId}/archive`);
      const { is_archived } = res.data;
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_archived } : p));
      toast.success(is_archived ? 'Post archived' : 'Post unarchived');
    } catch { toast.error('Archive failed'); }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api.delete(`/social/${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success('Post deleted');
    } catch { toast.error('Failed to delete post'); }
  };

  const handleImageSelection = (file) => {
    if (!file) return;
    setForm((prev) => ({ ...prev, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!form.text.trim()) { toast.error('Post text is required'); return; }
    setPublishing(true);
    const toastId = toast.loading('Publishing post...');
    try {
      let imageUrl = null;
      if (form.imageFile) {
        const fd = new FormData();
        fd.append('file', form.imageFile);
        const up = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        imageUrl = up.data?.url || null;
      }
      const res = await api.post('/social', {
        source: 'civictwin',
        text: form.text.trim(),
        author: user?.name || 'Admin',
        posted_at: new Date().toISOString(),
        image_url: imageUrl,
        post_background: form.bgColor,
        category: form.category || null,
        department: form.department || null,
        priority: form.priority,
      });
      const created = res?.data || {};
      setPosts((prev) => [normalizePost({ ...created, image_url: created.image_url || imageUrl, post_background: created.post_background || form.bgColor, comments: [], comments_count: 0, reaction_counts: { like: 0, love: 0, care: 0, wow: 0, concern: 0 }, my_reaction: null, my_saved: false, saves_count: 0, view_count: 0 }), ...prev]);
      toast.success('Post published', { id: toastId });
      if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
      setForm({ text: '', imageFile: null, imagePreview: null, bgColor: '#1E3150', category: '', department: '', priority: 'medium' });
      const fi = document.getElementById('sfa-image-input');
      if (fi) fi.value = '';
    } catch {
      toast.error('Failed to publish post', { id: toastId });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="sfa-page" ref={feedTopRef}>
      <div className="sfa-center">
        {/* Header */}
        <div className="sfa-topbar">
          <h2><span className="sfa-title-icon">📢</span> Social Feed Dashboard</h2>
          <div className="sfa-top-actions">
            <button className="sfa-btn sfa-btn-outline" onClick={() => fetchPosts(1)}>↻ Refresh</button>
            <button className="sfa-btn sfa-btn-ghost" onClick={() => navigate('/admin/dashboard')}>← Dashboard</button>
          </div>
        </div>

        {/* Composer */}
        <div className="sfa-composer">
          <h3>✍️ Create New Post</h3>
          <form onSubmit={handlePublish}>
            <div className="sfa-form-group" style={{ marginBottom: '0.85rem' }}>
              <label>Post Content</label>
              <textarea
                className="sfa-textarea"
                value={form.text}
                onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
                placeholder="Write your post caption..."
              />
            </div>

            <div className="sfa-composer-grid">
              <div className="sfa-form-group">
                <label>Category</label>
                <select className="sfa-select" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                  <option value="">— Select Category —</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="sfa-form-group">
                <label>Department</label>
                <select className="sfa-select" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}>
                  <option value="">— Select Department —</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="sfa-form-group" style={{ marginBottom: '0.85rem' }}>
              <label>Priority</label>
              <div className="sfa-priority-row">
                {PRIORITIES.map((p) => (
                  <button key={p} type="button"
                    className={`sfa-priority-chip ${p}${form.priority === p ? ' selected' : ''}`}
                    onClick={() => setForm((prev) => ({ ...prev, priority: p }))}>
                    {PRIORITY_ICONS[p]} {p}
                  </button>
                ))}
              </div>
            </div>


            {/* ── Post Extras: Emoji & Background Color ── */}
            <div className="sfa-form-group" style={{ marginBottom: '0.85rem' }}>
              <label>Post Extras</label>
              <div className="sfa-extras-row">
                {/* Emoji toggle */}
                <div className="sfa-extras-item">
                  <button
                    type="button"
                    className="sfa-btn sfa-btn-ghost"
                    onClick={() => setShowEmojiPicker((p) => !p)}
                  >
                    😀 Insert Emoji
                  </button>
                </div>

                {/* BG Color — enhanced preview card */}
                <div className="sfa-extras-item sfa-bg-picker-wrap">
                  <div
                    className="sfa-bg-preview-card"
                    onClick={() => document.getElementById('sfa-bg-color-input').click()}
                    title="Click to choose background color"
                  >
                    {/* Color strip */}
                    <div
                      className="sfa-bg-strip"
                      style={{ background: form.bgColor }}
                    />
                    {/* Info row */}
                    <div className="sfa-bg-info">
                      <span className="sfa-bg-label">🎨 Background Color</span>
                      <span className="sfa-bg-hex">{form.bgColor}</span>
                    </div>
                    {/* Quick presets */}
                    <div className="sfa-bg-presets">
                      {[
                        '#1E3150', '#5377A2', '#601A35',
                        '#059669', '#D97706', '#E5D38A',
                      ].map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`sfa-bg-preset-dot${form.bgColor === c ? ' active' : ''}`}
                          style={{ background: c }}
                          title={c}
                          onClick={(e) => { e.stopPropagation(); setForm((p) => ({ ...p, bgColor: c })); }}
                        />
                      ))}
                      <button
                        type="button"
                        className="sfa-bg-preset-custom"
                        title="Custom color…"
                        onClick={(e) => { e.stopPropagation(); document.getElementById('sfa-bg-color-input').click(); }}
                      >+</button>
                    </div>
                  </div>
                  <input
                    id="sfa-bg-color-input"
                    type="color"
                    value={form.bgColor}
                    onChange={(e) => setForm((p) => ({ ...p, bgColor: e.target.value }))}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  />
                </div>
              </div>
            </div>


            {showEmojiPicker && (
              <div style={{ marginBottom: '0.75rem', display: 'inline-block' }}>
                <EmojiPicker onEmojiClick={(d) => setForm((p) => ({ ...p, text: p.text + d.emoji }))} autoFocusSearch={false} width={310} height={350} />
              </div>
            )}

            <label htmlFor="sfa-image-input"
              className={`sfa-drop-zone${isDragging ? ' dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleImageSelection(f); }}>
              📎 Drag & drop image or click to upload
            </label>
            <input id="sfa-image-input" type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => handleImageSelection(e.target.files?.[0])} />

            {form.imagePreview && (
              <img src={form.imagePreview} alt="Preview" className="sfa-image-preview" />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="submit" className="sfa-btn sfa-btn-primary" disabled={publishing}>
                {publishing ? '⏳ Publishing...' : '🚀 Publish Post'}
              </button>
            </div>
          </form>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="sfa-feed">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : posts.length === 0 ? (
          <div className="sfa-empty-state">
            <div className="sfa-empty-icon">📭</div>
            <h3>No Posts Yet</h3>
            <p>Create the first post using the composer above to start engaging with citizens.</p>
          </div>
        ) : (
          <div className="sfa-feed">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                commentsOpen={!!openCommentsByPost[post.id]}
                commentDraft={draftComments[post.id] || ''}
                onDraftChange={(v) => setDraftComments((p) => ({ ...p, [post.id]: v }))}
                onToggleLike={() => toggleLike(post.id)}
                onToggleComments={() => setOpenCommentsByPost((p) => ({ ...p, [post.id]: !p[post.id] }))}
                onToggleSave={() => toggleSave(post.id)}
                onShare={() => sharePost(post.id)}
                onDelete={() => deletePost(post.id)}
                onPin={() => pinPost(post.id)}
                onArchive={() => archivePost(post.id)}
                onSubmitComment={() => submitComment(post.id)}
              />
            ))}
          </div>
        )}

        {/* Pagination bar */}
        {!loading && totalPages > 1 && (
          <div className="sfa-pagination">
            <button
              className="sfa-page-btn"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              ← Prev
            </button>

            <div className="sfa-page-numbers">
              {pageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`el-${i}`} className="sfa-page-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    className={`sfa-page-num${page === p ? ' active' : ''}`}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              className="sfa-page-btn"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialFeedDashboard;
