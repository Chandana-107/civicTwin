import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import './Citizen.css';

const REACTIONS = [
    { key: 'like', emoji: '👍', label: 'Like' },
    { key: 'love', emoji: '❤️', label: 'Love' },
    { key: 'care', emoji: '🤝', label: 'Support' },
    { key: 'wow', emoji: '😮', label: 'Wow' },
    { key: 'concern', emoji: '😟', label: 'Concern' }
];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const BG_OVERRIDES_KEY = 'social_post_bg_overrides';

const SocialFeed = () => {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [draftComments, setDraftComments] = useState({});
    const [openCommentsByPost, setOpenCommentsByPost] = useState({});
    const [bgOverrides, setBgOverrides] = useState({});

    useEffect(() => {
        fetchPosts();
    }, []);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(BG_OVERRIDES_KEY);
            setBgOverrides(raw ? JSON.parse(raw) : {});
        } catch (error) {
            setBgOverrides({});
        }
    }, []);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const response = await api.get('/social');
            setPosts(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load social feed');
        } finally {
            setLoading(false);
        }
    };

    const feedPosts = useMemo(() => posts.map((post) => ({
        ...post,
        post_background: '#000000',
        my_reaction: post.my_reaction || null,
        comments: Array.isArray(post.comments) ? post.comments : [],
        comments_count: typeof post.comments_count === 'number'
            ? post.comments_count
            : (Array.isArray(post.comments) ? post.comments.length : 0)
    })), [posts]);

    const setReaction = async (postId, reaction) => {
        const currentPost = feedPosts.find((p) => p.id === postId);
        const nextReaction = currentPost?.my_reaction === reaction ? null : reaction;

        try {
            await api.post(`/social/${postId}/reactions`, { reaction: nextReaction });
            setPosts((prev) => prev.map((post) => {
                if (post.id !== postId) return post;

                const previousReaction = post.my_reaction;
                const counts = { ...(post.reaction_counts || {}) };
                if (previousReaction && counts[previousReaction] != null) {
                    counts[previousReaction] = Math.max(0, counts[previousReaction] - 1);
                }
                if (nextReaction) {
                    counts[nextReaction] = (counts[nextReaction] || 0) + 1;
                }

                return {
                    ...post,
                    my_reaction: nextReaction,
                    reaction_counts: counts
                };
            }));
        } catch (error) {
            console.error(error);
            toast.error('Failed to save reaction');
        }
    };

    const sharePostByLink = async (postId) => {
        const shareUrl = `${window.location.origin}/citizen/social?post=${postId}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'CivicTwin Social Feed Post',
                    text: 'Check this update on CivicTwin.',
                    url: shareUrl
                });
                toast.success('Post shared');
                return;
            }

            await navigator.clipboard.writeText(shareUrl);
            toast.success('Post link copied');
        } catch (error) {
            console.error(error);
            toast.error('Could not share post');
        }
    };

    const addComment = async (postId) => {
        const text = (draftComments[postId] || '').trim();
        if (!text) return;

        try {
            const response = await api.post(`/social/${postId}/comments`, { text });
            const newComment = response.data;

            setPosts((prev) => prev.map((post) => {
                if (post.id !== postId) return post;
                const existingComments = Array.isArray(post.comments) ? post.comments : [];
                return {
                    ...post,
                    comments: [newComment, ...existingComments],
                    comments_count: (post.comments_count || 0) + 1
                };
            }));

            setDraftComments((prev) => ({ ...prev, [postId]: '' }));
        } catch (error) {
            console.error(error);
            toast.error('Failed to add comment');
        }
    };

    const toggleComments = (postId) => {
        setOpenCommentsByPost((prev) => ({
            ...prev,
            [postId]: !prev[postId]
        }));
    };

    const getDisplayDate = (postedAt) => {
        if (!postedAt) return 'Unknown time';
        return new Date(postedAt).toLocaleString();
    };

    const getMediaUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `${API_BASE_URL}${url}`;
    };

    const getReadableTextColor = (backgroundColor) => {
        if (!backgroundColor || !backgroundColor.startsWith('#') || backgroundColor.length !== 7) return '#111827';
        const r = parseInt(backgroundColor.slice(1, 3), 16);
        const g = parseInt(backgroundColor.slice(3, 5), 16);
        const b = parseInt(backgroundColor.slice(5, 7), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
        return luminance < 140 ? '#ffffff' : '#111827';
    };

    return (
        <div className="complaints-container social-feed-page">
            <div className="complaints-header social-feed-header">
                <h2>Social Feed</h2>
                <div className="complaints-actions">
                    <button className="btn btn-outline" onClick={fetchPosts}>Refresh</button>
                    <button className="btn btn-secondary" onClick={() => navigate('/citizen/dashboard')}>Back to Dashboard</button>
                </div>
            </div>

            {loading ? (
                <div className="loading"><div className="spinner"></div></div>
            ) : feedPosts.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p>No feed posts available.</p>
                </div>
            ) : (
                <div className="social-feed-list">
                    {feedPosts.map((post) => (
                        <article
                            key={post.id}
                            className="social-post-card"
                            style={{
                                backgroundColor: '#000000',
                                background: '#000000',
                                color: '#ffffff'
                            }}
                        >
                            <header className="social-post-header">
                                <div className="social-user-meta">
                                    <div>
                                        <h3 className="social-username" style={{ color: '#ffffff' }}>{post.author || 'citizen_user'}</h3>
                                        <p className="social-subline" style={{ color: '#ffffff' }}>
                                            {post.source || 'CivicTwin'} • {getDisplayDate(post.posted_at)}
                                        </p>
                                    </div>
                                </div>
                                <button className="social-menu-btn" aria-label="More options" style={{ color: '#ffffff' }}>⋮</button>
                            </header>

                            {post.image_url ? (
                                <img src={getMediaUrl(post.image_url)} alt="Social post" className="social-post-image" />
                            ) : null}

                            <p style={{ margin: '0.85rem 0 0.85rem 0', color: '#ffffff', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                {post.text}
                            </p>

                            <div className="social-action-row">
                                <div className="social-action-left">
                                    {REACTIONS.map((reaction) => (
                                        <button
                                            key={reaction.key}
                                            className={`social-icon-btn ${post.my_reaction === reaction.key ? 'active' : ''}`}
                                            title={reaction.label}
                                            onClick={() => setReaction(post.id, reaction.key)}
                                        >
                                            {reaction.emoji}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    className="social-icon-btn"
                                    title="Comments"
                                    onClick={() => toggleComments(post.id)}
                                >
                                    💬 {post.comments_count}
                                </button>
                                <button
                                    className="social-icon-btn"
                                    onClick={() => sharePostByLink(post.id)}
                                >
                                    🔗 Share
                                </button>
                            </div>

                            {openCommentsByPost[post.id] && (
                                <div className="social-comments-wrap">
                                    <div className="social-comment-input-row">
                                        <input
                                            className="form-input social-comment-input"
                                            value={draftComments[post.id] || ''}
                                            placeholder="Add a comment..."
                                            onChange={(e) => setDraftComments((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') addComment(post.id);
                                            }}
                                        />
                                        <button className="btn btn-primary" onClick={() => addComment(post.id)}>Post</button>
                                    </div>

                                    {post.comments.length > 0 ? (
                                        <div className="social-comments-list">
                                            {post.comments.map((comment) => (
                                                <div key={comment.id} className="social-comment-item">
                                                    <p>{comment.text}</p>
                                                    <p className="social-comment-time">
                                                        {comment.user_name || 'Citizen'} • {new Date(comment.created_at).toLocaleString()}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="social-no-comments">No comments yet.</p>
                                    )}
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SocialFeed;