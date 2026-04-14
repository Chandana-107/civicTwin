import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
const BG_OVERRIDES_KEY = 'social_post_bg_overrides';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url}`;
};

const reactionLabel = {
    like: '👍',
    love: '❤️',
    care: '🤝',
    wow: '😮',
    concern: '😟'
};

const DEFAULT_BG_COLOR = '#833ab4';

const ui = {
    page: (dark) => ({
        minHeight: '100vh',
        padding: '1.2rem',
        background: dark
            ? 'linear-gradient(180deg, #0b1220 0%, #111827 100%)'
            : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)'
    }),
    center: { maxWidth: '760px', margin: '0 auto' },
    topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' },
    title: (dark) => ({ margin: 0, color: dark ? '#f9fafb' : '#111827', fontFamily: 'Playfair Display, serif' }),
    topActions: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
    pillBtn: (dark) => ({ border: `1px solid ${dark ? '#334155' : '#cbd5e1'}`, borderRadius: '999px', background: dark ? '#1e293b' : '#fff', color: dark ? '#f8fafc' : '#1f2937', padding: '0.38rem 0.65rem', cursor: 'pointer' }),
    badge: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' },
    card: (dark) => ({
        background: dark ? '#0f172a' : '#fff',
        border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
        borderRadius: '14px',
        boxShadow: dark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 24px rgba(15,23,42,0.08)'
    })
};

const CommentSection = ({ isOpen, comments, draft, onDraftChange, onSubmit, darkMode }) => {
    if (!isOpen) return null;
    return (
        <div style={{ borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, marginTop: '0.65rem', paddingTop: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <input
                    value={draft}
                    placeholder="Add a comment..."
                    onChange={(e) => onDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onSubmit();
                    }}
                    style={{ flex: 1, minWidth: '220px', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '10px', padding: '0.52rem 0.65rem', background: darkMode ? '#0b1220' : '#fff', color: darkMode ? '#f8fafc' : '#111827' }}
                />
                <button onClick={onSubmit} style={{ ...ui.pillBtn(darkMode), borderRadius: '10px' }}>Post</button>
            </div>
            {comments.length ? (
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                    {comments.map((c) => (
                        <div key={c.id} style={{ border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: '10px', padding: '0.5rem 0.6rem', background: darkMode ? '#0b1220' : '#f8fafc' }}>
                            <p style={{ margin: 0, color: darkMode ? '#e2e8f0' : '#111827' }}>{c.text}</p>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.72rem', color: darkMode ? '#94a3b8' : '#64748b' }}>{c.user_name || 'Citizen'} • {new Date(c.created_at).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p style={{ margin: 0, fontSize: '0.84rem', color: darkMode ? '#94a3b8' : '#64748b' }}>No comments yet.</p>
            )}
        </div>
    );
};

const PostCard = ({ post, darkMode, commentsOpen, commentDraft, onCommentDraftChange, onToggleLike, onToggleComments, onToggleSave, onShare, onDelete, onSubmitComment }) => {
    const likeCount = Number(post?.reaction_counts?.like || 0);
    return (
        <article style={{ ...ui.card(darkMode), padding: '0.85rem', transition: 'transform 0.25s ease, box-shadow 0.25s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '999px', background: 'linear-gradient(135deg, #1d4ed8, #06b6d4)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>{(post.author || 'A').slice(0, 1).toUpperCase()}</div>
                    <div>
                        <p style={{ margin: 0, fontWeight: 700, color: darkMode ? '#f8fafc' : '#111827', fontSize: '0.86rem' }}>{post.author || 'Admin'}</p>
                        <p style={{ margin: 0, color: darkMode ? '#94a3b8' : '#64748b', fontSize: '0.72rem' }}>{post.posted_at ? new Date(post.posted_at).toLocaleString() : 'Unknown time'}</p>
                    </div>
                </div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: darkMode ? '#cbd5e1' : '#475569' }}>{post.sentiment || 'neutral'}</span>
            </div>

            {post.image_url ? (
                <img loading="lazy" src={post.image_url} alt="Post" style={{ width: '100%', borderRadius: '12px', maxHeight: '430px', objectFit: 'cover', marginBottom: '0.6rem' }} />
            ) : (
                <div style={{ width: '100%', minHeight: '210px', borderRadius: '12px', marginBottom: '0.6rem', background: post.post_background || 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)', color: '#fff', display: 'grid', placeItems: 'center', padding: '1rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{post.text}</p>
                </div>
            )}

            <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
                <button onClick={onToggleLike} className={post.my_reaction === 'like' ? 'heart-pop-active' : ''} style={{ ...ui.pillBtn(darkMode), borderRadius: '999px' }}>
                    {post.my_reaction === 'like' ? '❤️' : '🤍'}
                </button>
                <button onClick={onToggleComments} style={{ ...ui.pillBtn(darkMode), borderRadius: '999px' }}>💬</button>
                <button onClick={onShare} style={{ ...ui.pillBtn(darkMode), borderRadius: '999px' }}>📤</button>
                <button onClick={onToggleSave} style={{ ...ui.pillBtn(darkMode), borderRadius: '999px' }}>{post.my_saved ? '🔖' : '📑'}</button>
                <button onClick={onDelete} style={{ ...ui.pillBtn(darkMode), borderRadius: '999px', color: '#dc2626', borderColor: '#fca5a5' }}>🗑️</button>
            </div>

            <div style={{ ...ui.badge, color: darkMode ? '#cbd5e1' : '#334155', marginBottom: '0.35rem' }}>
                <span>{likeCount} reactions</span>
                <span>•</span>
                <span>{post.comments_count || 0} comments</span>
                <span>•</span>
                <span>{post.saves_count || 0} saves</span>
            </div>

            <p style={{ margin: 0, color: darkMode ? '#e2e8f0' : '#111827', lineHeight: '1.45' }}><strong>{post.author || 'Admin'}</strong> {post.text}</p>

            <CommentSection
                isOpen={commentsOpen}
                comments={Array.isArray(post.comments) ? post.comments : []}
                draft={commentDraft}
                onDraftChange={onCommentDraftChange}
                onSubmit={onSubmitComment}
                darkMode={darkMode}
            />
        </article>
    );
};

const SocialFeedDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [darkMode, setDarkMode] = useState(localStorage.getItem('social_dark_mode') === '1');
    const [openCommentsByPost, setOpenCommentsByPost] = useState({});
    const [draftComments, setDraftComments] = useState({});
    const [isDragging, setIsDragging] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [bgOverrides, setBgOverrides] = useState(() => {
        try {
            const raw = localStorage.getItem(BG_OVERRIDES_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            return {};
        }
    });
    const [form, setForm] = useState({
        text: '',
        imageFile: null,
        imagePreview: null,
        bgColor: DEFAULT_BG_COLOR
    });

    const sentinelRef = useRef(null);

    useEffect(() => {
        fetchPosts(1, false);
    }, []);

    useEffect(() => {
        localStorage.setItem('social_dark_mode', darkMode ? '1' : '0');
    }, [darkMode]);

    useEffect(() => {
        localStorage.setItem(BG_OVERRIDES_KEY, JSON.stringify(bgOverrides));
    }, [bgOverrides]);

    useEffect(() => {
        const target = sentinelRef.current;
        if (!target) return;

        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
                fetchPosts(page + 1, true);
            }
        }, { threshold: 0.2 });

        observer.observe(target);
        return () => observer.disconnect();
    }, [page, hasMore, loadingMore, loading]);

    const fetchPosts = async (targetPage = 1, append = false) => {
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        try {
            const response = await api.get('/social', { params: { page: targetPage, limit: 8 } });
            const payload = response.data;

            const rows = Array.isArray(payload)
                ? payload
                : (Array.isArray(payload?.data) ? payload.data : []);

            const normalized = rows.map((row) => ({
                ...row,
                image_url: getMediaUrl(row.image_url),
                post_background: row.post_background || row.postBackground || row.postbackground || bgOverrides[row.id] || DEFAULT_BG_COLOR,
                comments: Array.isArray(row.comments) ? row.comments : [],
                comments_count: typeof row.comments_count === 'number' ? row.comments_count : 0,
                reaction_counts: row.reaction_counts || { like: 0, love: 0, care: 0, wow: 0, concern: 0 },
                my_reaction: row.my_reaction || null,
                my_saved: !!row.my_saved,
                saves_count: Number(row.saves_count || 0)
            }));

            setPosts((prev) => {
                if (!append) return normalized;
                const merged = [...prev];
                normalized.forEach((item) => {
                    if (!merged.some((m) => m.id === item.id)) merged.push(item);
                });
                return merged;
            });

            const nextHasMore = Array.isArray(payload) ? false : !!payload?.hasMore;
            setHasMore(nextHasMore);
            setPage(targetPage);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load social feed dashboard');
        } finally {
            if (append) {
                setLoadingMore(false);
            } else {
                setLoading(false);
            }
        }
    };

    const appendEmoji = (emoji) => {
        setForm((prev) => ({ ...prev, text: `${prev.text}${emoji}` }));
    };

    const onEmojiSelect = (emojiData) => {
        appendEmoji(emojiData.emoji);
    };

    const handleImageSelection = (file) => {
        if (!file) return;
        const preview = URL.createObjectURL(file);
        setForm((prev) => ({ ...prev, imageFile: file, imagePreview: preview }));
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleImageSelection(file);
    };

    const toggleComments = (postId) => {
        setOpenCommentsByPost((prev) => ({ ...prev, [postId]: !prev[postId] }));
    };

    const toggleLike = async (postId) => {
        const target = posts.find((p) => p.id === postId);
        const nextReaction = target?.my_reaction === 'like' ? null : 'like';

        try {
            await api.post(`/social/${postId}/reactions`, { reaction: nextReaction });
            setPosts((prev) => prev.map((post) => {
                if (post.id !== postId) return post;
                const counts = { ...(post.reaction_counts || {}) };
                if (post.my_reaction === 'like') counts.like = Math.max(0, (counts.like || 0) - 1);
                if (nextReaction === 'like') counts.like = (counts.like || 0) + 1;
                return { ...post, my_reaction: nextReaction, reaction_counts: counts };
            }));
        } catch (error) {
            console.error(error);
            toast.error('Could not update like');
        }
    };

    const toggleSave = async (postId) => {
        const target = posts.find((p) => p.id === postId);
        const nextSaved = !target?.my_saved;
        try {
            await api.post(`/social/${postId}/save`, { saved: nextSaved });
            setPosts((prev) => prev.map((post) => {
                if (post.id !== postId) return post;
                const nextCount = nextSaved
                    ? (Number(post.saves_count || 0) + 1)
                    : Math.max(0, Number(post.saves_count || 0) - 1);
                return { ...post, my_saved: nextSaved, saves_count: nextCount };
            }));
        } catch (error) {
            console.error(error);
            toast.error('Could not update save state');
        }
    };

    const sharePost = async (postId) => {
        const url = `${window.location.origin}/citizen/social?post=${postId}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'CivicTwin Post', url });
                return;
            }
            await navigator.clipboard.writeText(url);
            toast.success('Post link copied');
        } catch (error) {
            toast.error('Share failed');
        }
    };

    const submitComment = async (postId) => {
        const text = (draftComments[postId] || '').trim();
        if (!text) return;
        try {
            const response = await api.post(`/social/${postId}/comments`, { text });
            const newComment = response.data;
            setPosts((prev) => prev.map((post) => {
                if (post.id !== postId) return post;
                return {
                    ...post,
                    comments: [newComment, ...(post.comments || [])],
                    comments_count: Number(post.comments_count || 0) + 1
                };
            }));
            setDraftComments((prev) => ({ ...prev, [postId]: '' }));
        } catch (error) {
            console.error(error);
            toast.error('Comment failed');
        }
    };

    const deletePost = async (postId) => {
        const confirmed = window.confirm('Delete this post? This cannot be undone.');
        if (!confirmed) return;

        try {
            await api.delete(`/social/${postId}`);
            setPosts((prev) => prev.filter((post) => post.id !== postId));
            setBgOverrides((prev) => {
                const next = { ...prev };
                delete next[postId];
                return next;
            });
            toast.success('Post deleted');
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete post');
        }
    };

    const handlePublish = async (e) => {
        e.preventDefault();
        if (!form.text.trim()) {
            toast.error('Post text is required');
            return;
        }

        setPublishing(true);
        const toastId = toast.loading('Publishing post...');

        try {
            let imageUrl = null;
            if (form.imageFile) {
                const uploadData = new FormData();
                uploadData.append('file', form.imageFile);
                const uploadRes = await api.post('/upload', uploadData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                imageUrl = uploadRes.data?.url || null;
            }

            const createRes = await api.post('/social', {
                source: 'civictwin',
                text: form.text.trim(),
                author: user?.name || 'Admin',
                posted_at: new Date().toISOString(),
                image_url: imageUrl,
                post_background: form.bgColor,
                postBackground: form.bgColor
            });

            const created = createRes?.data || {};
            const createdId = created.id;
            if (createdId) {
                setBgOverrides((prev) => ({ ...prev, [createdId]: form.bgColor }));
            }

            setPosts((prev) => [{
                ...created,
                image_url: getMediaUrl(created.image_url || imageUrl),
                post_background: created.post_background || created.postBackground || created.postbackground || form.bgColor,
                comments: [],
                comments_count: 0,
                reaction_counts: { like: 0, love: 0, care: 0, wow: 0, concern: 0 },
                my_reaction: null,
                my_saved: false,
                saves_count: 0
            }, ...prev]);

            toast.success('Post published', { id: toastId });
            if (form.imagePreview) {
                URL.revokeObjectURL(form.imagePreview);
            }
            setForm({
                text: '',
                imageFile: null,
                imagePreview: null,
                bgColor: DEFAULT_BG_COLOR
            });
            const fileInput = document.getElementById('social-image-input');
            if (fileInput) fileInput.value = '';
        } catch (error) {
            console.error(error);
            toast.error('Failed to publish post', { id: toastId });
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div style={ui.page(darkMode)}>
            <style>{`
              .heart-pop-active { animation: heartPop 280ms ease; }
              @keyframes heartPop { 0% { transform: scale(0.9); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
            `}</style>

            <div style={ui.center}>
                <div style={ui.topbar}>
                    <h2 style={ui.title(darkMode)}>Social Feed Dashboard</h2>
                    <div style={ui.topActions}>
                        <button onClick={() => setDarkMode((prev) => !prev)} style={ui.pillBtn(darkMode)}>{darkMode ? '☀️ Light' : '🌙 Dark'}</button>
                        <button onClick={() => fetchPosts(1, false)} style={ui.pillBtn(darkMode)}>Refresh</button>
                        <button onClick={() => navigate('/admin/dashboard')} style={ui.pillBtn(darkMode)}>Back to Dashboard</button>
                    </div>
                </div>

                <div style={{ ...ui.card(darkMode), padding: '0.9rem', marginBottom: '1rem' }}>
                    <h3 style={{ marginTop: 0, color: darkMode ? '#f9fafb' : '#111827' }}>Create New Post</h3>
                    <form onSubmit={handlePublish}>
                        <textarea
                            value={form.text}
                            onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
                            placeholder="Write your caption..."
                            style={{ width: '100%', border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`, borderRadius: '10px', minHeight: '95px', padding: '0.72rem', resize: 'vertical', background: darkMode ? '#0b1220' : '#fff', color: darkMode ? '#f8fafc' : '#111827' }}
                        />

                        <div style={{ margin: '0.45rem 0 0.55rem 0' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                                    style={{ ...ui.pillBtn(darkMode), borderRadius: '10px', fontSize: '1.1rem', lineHeight: 1 }}
                                >
                                    😀
                                </button>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: darkMode ? '#cbd5e1' : '#334155', fontSize: '0.82rem' }}>
                                    Color
                                    <input
                                        type="color"
                                        value={form.bgColor}
                                        onChange={(e) => setForm((prev) => ({ ...prev, bgColor: e.target.value }))}
                                        style={{
                                            width: '44px',
                                            height: '44px',
                                            border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                                            borderRadius: '8px',
                                            padding: '0',
                                            background: 'transparent',
                                            cursor: 'pointer'
                                        }}
                                    />
                                </label>
                            </div>
                            {showEmojiPicker && (
                                <div style={{ marginTop: '0.55rem', display: 'inline-block' }}>
                                    <EmojiPicker
                                        onEmojiClick={onEmojiSelect}
                                        theme={darkMode ? 'dark' : 'light'}
                                        autoFocusSearch={false}
                                        width={320}
                                        height={380}
                                    />
                                </div>
                            )}
                        </div>

                        <label
                            htmlFor="social-image-input"
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            style={{
                                display: 'block',
                                border: `2px dashed ${isDragging ? '#3b82f6' : (darkMode ? '#334155' : '#cbd5e1')}`,
                                borderRadius: '12px',
                                padding: '0.85rem',
                                textAlign: 'center',
                                marginBottom: '0.6rem',
                                cursor: 'pointer',
                                background: isDragging ? (darkMode ? '#1e293b' : '#eff6ff') : 'transparent',
                                color: darkMode ? '#cbd5e1' : '#475569'
                            }}
                        >
                            Drag and drop image here, or click to upload
                        </label>

                        <input
                            id="social-image-input"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageSelection(e.target.files?.[0])}
                            style={{ display: 'none' }}
                        />

                        {form.imagePreview && (
                            <img src={form.imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '12px', marginBottom: '0.65rem' }} />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" disabled={publishing} style={{ ...ui.pillBtn(darkMode), borderRadius: '10px' }}>
                                {publishing ? 'Publishing...' : 'Publish Post'}
                            </button>
                        </div>
                    </form>
                </div>

                {loading ? (
                    <div style={{ ...ui.card(darkMode), textAlign: 'center', padding: '1rem', color: darkMode ? '#cbd5e1' : '#475569' }}>Loading posts...</div>
                ) : posts.length === 0 ? (
                    <div style={{ ...ui.card(darkMode), textAlign: 'center', padding: '1rem', color: darkMode ? '#cbd5e1' : '#475569' }}>No posts available.</div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {posts.map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                darkMode={darkMode}
                                commentsOpen={!!openCommentsByPost[post.id]}
                                commentDraft={draftComments[post.id] || ''}
                                onCommentDraftChange={(value) => setDraftComments((prev) => ({ ...prev, [post.id]: value }))}
                                onToggleLike={() => toggleLike(post.id)}
                                onToggleComments={() => toggleComments(post.id)}
                                onToggleSave={() => toggleSave(post.id)}
                                onShare={() => sharePost(post.id)}
                                onDelete={() => deletePost(post.id)}
                                onSubmitComment={() => submitComment(post.id)}
                            />
                        ))}
                    </div>
                )}

                <div ref={sentinelRef} style={{ textAlign: 'center', color: darkMode ? '#94a3b8' : '#64748b', padding: '0.65rem' }}>
                    {loadingMore ? 'Loading more posts...' : hasMore ? 'Scroll for more' : 'No more posts'}
                </div>
            </div>
        </div>
    );
};

export default SocialFeedDashboard;
