import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import './Admin.css';

const SentimentDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [topics, setTopics] = useState([]);
    const [alertData, setAlertData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Maxwell: Run alerts check
            const alertRes = await api.get('/alerts/sentiment_spike');
            setAlertData(alertRes.data);

            // Fetch topics for today (or recent)
            // Ideally we run extraction first, but for demo we just get existing
            const today = new Date().toISOString().split('T')[0];
            const topicRes = await api.get(`/topics_analytics?date=${today}`);
            setTopics(topicRes.data || []);

            // Fetch social feed
            const socialRes = await api.get('/social');
            setPosts(socialRes.data || []);

        } catch (error) {
            console.error(error);
            // toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const runDailyAnalysis = async () => {
        const toastId = toast.loading('Running daily topic extraction...');
        try {
            const today = new Date().toISOString().split('T')[0];
            await api.post('/topics_analytics/extract_and_store', { date: today });
            toast.success('Analysis complete', { id: toastId });
            fetchAllData();
        } catch (error) {
            console.error(error);
            toast.error('Analysis failed', { id: toastId });
        }
    };

    const getSentimentColor = (sentiment) => {
        if (!sentiment) return 'var(--text-secondary)';
        const s = sentiment.toLowerCase();
        if (s === 'positive') return 'var(--success-color)';
        if (s === 'negative') return 'var(--danger-color)';
        return 'var(--warning-color)';
    };

    return (
        <div className="sentiment-page">
            <div className="container">
                <div className="page-header">
                    <h2>📊 Citizen Mood Monitoring</h2>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={runDailyAnalysis} className="btn btn-secondary">Run Daily Analysis</button>
                        <button
                            onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/citizen/dashboard')}
                            className="btn"
                            style={{ backgroundColor: '#E5D283', color: '#1F2937', fontWeight: 'bold' }}
                        >
                            Back
                        </button>
                    </div>
                </div>

                {/* ALERT SECTION */}
                {alertData && alertData.spike && (
                    <div style={{
                        background: '#fff1f2',
                        border: '1px solid #fda4af',
                        color: '#9f1239',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        marginBottom: '2rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                    }}>
                        <div style={{ fontSize: '2rem' }}>⚠️</div>
                        <div>
                            <h4 style={{ margin: 0 }}>High Negativity Detected</h4>
                            <p style={{ margin: 0 }}>
                                Negative sentiment is currently <strong>{(alertData.todayNegPercent * 100).toFixed(1)}%</strong>,
                                which is unusually high (Threshold: {(alertData.threshold * 100).toFixed(1)}%).
                            </p>
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>

                    {/* LEFT: SOCIAL FEED */}
                    <div>
                        <h3 style={{ marginBottom: '1.5rem', borderBottom: '2px solid #1E3150', paddingBottom: '0.75rem', color: '#1E3150', fontFamily: "'Playfair Display', serif" }}>Live Feed & Sentiment</h3>
                        {loading ? (
                            <div className="loading"><div className="spinner"></div></div>
                        ) : posts.length === 0 ? (
                            <div className="card" style={{ color: 'var(--text-primary)' }}><p>No data available.</p></div>
                        ) : (
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {posts.map(post => (
                                    <div key={post.id} className="card" style={{ padding: '1rem', borderLeft: `4px solid ${getSentimentColor(post.sentiment)}`, color: 'var(--text-primary)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--primary-dark)' }}>{post.source || 'Social Media'}</span>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {new Date(post.posted_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <p style={{ margin: '0 0 0.5rem 0' }}>"{post.text}"</p>
                                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                                            <span style={{ color: getSentimentColor(post.sentiment), fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                {post.sentiment || 'NEUTRAL'}
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                Score: {post.sentiment_score ? Number(post.sentiment_score).toFixed(2) : '0.00'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: TOPICS & STATS */}
                    <div>
                        <div className="card" style={{ marginBottom: '2rem', color: 'var(--text-primary)' }}>
                            <h3>Top Keywords (24h)</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Extracted from complaints and social feed.
                            </p>
                            {topics.length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)' }}>No topics extracted for today. Click "Run Daily Analysis".</p>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {topics.map((t, idx) => (
                                        <span key={idx} style={{
                                            background: 'var(--light-bg)',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '999px',
                                            fontSize: `${Math.max(0.8, Math.min(1.2, 0.8 + (t.score * 5)))}rem`,
                                            border: '1px solid var(--border-color)'
                                        }}>
                                            {t.topic}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="card" style={{ color: 'var(--text-primary)' }}>
                            <h3>Sentiment Stats</h3>
                            {/* Simple stat distribution */}
                            {(() => {
                                const total = posts.length;
                                if (total === 0) return <p>No data</p>;
                                const pos = posts.filter(p => p.sentiment === 'positive').length;
                                const neg = posts.filter(p => p.sentiment === 'negative').length;
                                const neu = posts.filter(p => p.sentiment === 'neutral').length;

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ width: '80px' }}>Positive</span>
                                            <div style={{ flex: 1, height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${(pos / total) * 100}%`, height: '100%', background: 'var(--success-color)' }}></div>
                                            </div>
                                            <span style={{ width: '40px', textAlign: 'right' }}>{pos}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ width: '80px' }}>Neutral</span>
                                            <div style={{ flex: 1, height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${(neu / total) * 100}%`, height: '100%', background: 'var(--warning-color)' }}></div>
                                            </div>
                                            <span style={{ width: '40px', textAlign: 'right' }}>{neu}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span style={{ width: '80px' }}>Negative</span>
                                            <div style={{ flex: 1, height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${(neg / total) * 100}%`, height: '100%', background: 'var(--danger-color)' }}></div>
                                            </div>
                                            <span style={{ width: '40px', textAlign: 'right' }}>{neg}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SentimentDashboard;
