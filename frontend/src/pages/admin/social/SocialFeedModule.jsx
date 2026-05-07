import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../../../utils/api';
import { useAuth } from '../../../contexts/AuthContext';
import '../SocialFeedAdmin.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const LIMIT = 8;

const getMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url}`;
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

const SocialFeedModule = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  /* ── data fetching ─────────────────────────────────────────── */
  const fetchPosts = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const res     = await api.get('/social', { params: { page: targetPage, limit: LIMIT } });
      const payload = res.data;
      const rows    = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      setPosts(rows.map(normalizePost));
      setTotal(typeof payload?.total === 'number' ? payload.total : rows.length);
      setPage(targetPage);
    } catch {
      toast.error('Failed to load social feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(1); }, [fetchPosts]);

  /* ── publish ───────────────────────────────────────────────── */
  const publishPost = useCallback(async (form, resetForm) => {
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
      setPosts((prev) => [
        normalizePost({ ...created, image_url: created.image_url || imageUrl, post_background: created.post_background || form.bgColor, comments: [], comments_count: 0, reaction_counts: { like: 0, love: 0, care: 0, wow: 0, concern: 0 }, my_reaction: null, my_saved: false, saves_count: 0, view_count: 0 }),
        ...prev,
      ]);
      setTotal((t) => t + 1);
      toast.success('Post published! 🚀', { id: toastId });
      resetForm();
    } catch {
      toast.error('Failed to publish post', { id: toastId });
    } finally {
      setPublishing(false);
    }
  }, [user]);

  /* ── post mutations ────────────────────────────────────────── */
  const pinPost = useCallback(async (postId) => {
    try {
      const res = await api.patch(`/social/${postId}/pin`);
      const { is_pinned } = res.data;
      setPosts((prev) => {
        const updated = prev.map((p) => p.id === postId ? { ...p, is_pinned } : p);
        return [...updated].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || new Date(b.posted_at) - new Date(a.posted_at));
      });
      toast.success(is_pinned ? 'Post pinned' : 'Post unpinned');
    } catch { toast.error('Pin failed'); }
  }, []);

  const archivePost = useCallback(async (postId) => {
    try {
      const res = await api.patch(`/social/${postId}/archive`);
      const { is_archived } = res.data;
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_archived } : p));
      toast.success(is_archived ? 'Post archived' : 'Post unarchived');
    } catch { toast.error('Archive failed'); }
  }, []);

  const deletePost = useCallback(async (postId) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api.delete(`/social/${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setTotal((t) => Math.max(0, t - 1));
      toast.success('Post deleted');
    } catch { toast.error('Failed to delete post'); }
  }, []);

  const toggleLike = useCallback(async (postId) => {
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
  }, [posts]);

  const toggleSave = useCallback(async (postId) => {
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
  }, [posts]);

  const sharePost = useCallback(async (postId) => {
    const url = `${window.location.origin}/citizen/social?post=${postId}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'CivicTwin Post', url }); return; }
      await navigator.clipboard.writeText(url);
      toast.success('Post link copied');
    } catch { toast.error('Share failed'); }
  }, []);

  const submitComment = useCallback(async (postId, text) => {
    if (!text?.trim()) return;
    try {
      const res = await api.post(`/social/${postId}/comments`, { text: text.trim() });
      setPosts((prev) => prev.map((p) => {
        if (p.id !== postId) return p;
        return { ...p, comments: [res.data, ...(p.comments || [])], comments_count: Number(p.comments_count || 0) + 1 };
      }));
    } catch { toast.error('Comment failed'); }
  }, []);

  const tabCls = ({ isActive }) => `sfa-tab-btn${isActive ? ' active' : ''}`;

  /* ── shared context passed via Outlet ──────────────────────── */
  const ctx = {
    posts, loading, publishing, page, total, totalPages,
    fetchPosts, publishPost, pinPost, archivePost, deletePost,
    toggleLike, toggleSave, sharePost, submitComment,
    setPosts,
  };

  return (
    <div className="sfa-page">
      <div className="sfa-center">

        {/* Header */}
        <div className="sfa-module-header">
          <div>
            <h2 className="sfa-module-title">📢 Social Feed Dashboard</h2>
            <p className="sfa-module-subtitle">
              Publish, manage and analyse civic communications in real time.
            </p>
          </div>
          <div className="sfa-module-actions">
            <button className="sfa-btn sfa-btn-outline" onClick={() => fetchPosts(page)}>↻ Refresh</button>
            <button className="sfa-btn sfa-btn-ghost"  onClick={() => navigate('/admin/dashboard')}>← Dashboard</button>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="sfa-tab-nav">
          <NavLink to="/admin/social-feed"         end className={tabCls}>📊 Overview</NavLink>
          <NavLink to="/admin/social-feed/compose"     className={tabCls}>✍️ Compose</NavLink>
          <NavLink to="/admin/social-feed/feed"        className={tabCls}>📋 Feed</NavLink>
        </nav>

        {/* Page content via outlet */}
        <Outlet context={ctx} />

      </div>
    </div>
  );
};

export default SocialFeedModule;
