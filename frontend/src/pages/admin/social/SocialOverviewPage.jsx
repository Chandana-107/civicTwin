import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';

const PRIORITY_ICONS = { low: '🟢', medium: '🔵', high: '🟠', urgent: '🔴' };

const StatCard = ({ icon, label, value, sub, accent }) => (
  <div className="sfa-stat-card" style={accent ? { borderTopColor: accent } : undefined}>
    <div className="sfa-stat-icon">{icon}</div>
    <div className="sfa-stat-value">{value}</div>
    <div className="sfa-stat-label">{label}</div>
    {sub && <div className="sfa-stat-sub">{sub}</div>}
  </div>
);

const SocialOverviewPage = () => {
  const { posts, loading, total, fetchPosts, page } = useOutletContext();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="sfa-overview-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="sfa-stat-card">
            <div className="sfa-skeleton-line" style={{ height: '36px', width: '60%', marginBottom: '0.5rem' }} />
            <div className="sfa-skeleton-line" style={{ height: '14px', width: '80%' }} />
          </div>
        ))}
      </div>
    );
  }

  const pinned   = posts.filter((p) => p.is_pinned).length;
  const archived = posts.filter((p) => p.is_archived).length;
  const urgent   = posts.filter((p) => p.priority === 'urgent' || p.priority === 'high').length;
  const totalViews = posts.reduce((s, p) => s + Number(p.view_count || 0), 0);
  const totalReactions = posts.reduce((s, p) => {
    const rc = p.reaction_counts || {};
    return s + Object.values(rc).reduce((a, b) => a + Number(b || 0), 0);
  }, 0);
  const totalComments = posts.reduce((s, p) => s + Number(p.comments_count || 0), 0);

  /* top 3 posts by engagement */
  const topPosts = [...posts]
    .sort((a, b) => {
      const ea = Number(a.view_count || 0) + Object.values(a.reaction_counts || {}).reduce((x, y) => x + Number(y || 0), 0);
      const eb = Number(b.view_count || 0) + Object.values(b.reaction_counts || {}).reduce((x, y) => x + Number(y || 0), 0);
      return eb - ea;
    })
    .slice(0, 3);

  /* priority breakdown */
  const priorityBreakdown = ['urgent', 'high', 'medium', 'low'].map((p) => ({
    label: p, count: posts.filter((x) => x.priority === p).length,
  }));

  return (
    <div>
      {/* Stats grid */}
      <div className="sfa-overview-grid">
        <StatCard icon="📝" label="Total Posts"    value={total}         accent="#1E3150" />
        <StatCard icon="📌" label="Pinned"         value={pinned}        accent="#E5D38A" />
        <StatCard icon="👁️" label="Total Views"   value={totalViews}    accent="#5377A2" />
        <StatCard icon="❤️" label="Reactions"      value={totalReactions} accent="#601A35" />
        <StatCard icon="💬" label="Comments"       value={totalComments}  accent="#059669" />
        <StatCard icon="🗃️" label="Archived"       value={archived}      accent="#D1D5DB" />
        <StatCard icon="🚨" label="High Priority"  value={urgent}        accent="#DC2626"
          sub={urgent > 0 ? 'Needs attention' : 'All clear'} />
        <StatCard icon="📄" label="This Page"      value={posts.length}  accent="#5377A2"
          sub={`Page content`} />
      </div>

      {/* Priority breakdown */}
      <div className="sfa-overview-card">
        <h3 className="sfa-overview-card-title">Priority Breakdown</h3>
        {priorityBreakdown.map(({ label, count }) => {
          const pct = total > 0 ? Math.round((count / Math.max(posts.length, 1)) * 100) : 0;
          return (
            <div key={label} className="sfa-breakdown-row">
              <span className="sfa-breakdown-label">{PRIORITY_ICONS[label]} {label}</span>
              <div className="sfa-breakdown-track">
                <div className="sfa-breakdown-fill" style={{ width: `${pct}%`, opacity: label === 'urgent' ? 1 : label === 'high' ? 0.85 : label === 'medium' ? 0.65 : 0.45 }} />
              </div>
              <span className="sfa-breakdown-count">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Top engaging posts */}
      <div className="sfa-overview-card">
        <h3 className="sfa-overview-card-title">Top Engaging Posts</h3>
        {topPosts.length === 0 ? (
          <p style={{ color: '#5377A2', fontSize: '0.9rem' }}>No posts yet. Create one in the Compose tab.</p>
        ) : (
          <div className="sfa-top-posts-list">
            {topPosts.map((post, i) => {
              const totalEng = Number(post.view_count || 0) + Object.values(post.reaction_counts || {}).reduce((a, b) => a + Number(b || 0), 0);
              return (
                <div key={post.id} className="sfa-top-post-row">
                  <span className="sfa-top-post-rank">#{i + 1}</span>
                  <div className="sfa-top-post-info">
                    <p className="sfa-top-post-text">{(post.text || '').slice(0, 80)}{post.text?.length > 80 ? '…' : ''}</p>
                    <p className="sfa-top-post-meta">
                      {post.department && <span>🏛️ {post.department}</span>}
                      <span>👁️ {post.view_count || 0}</span>
                      <span>❤️ {Object.values(post.reaction_counts || {}).reduce((a, b) => a + Number(b || 0), 0)}</span>
                      <span>💬 {post.comments_count || 0}</span>
                    </p>
                  </div>
                  <span className="sfa-top-post-score">{totalEng} pts</span>
                </div>
              );
            })}
          </div>
        )}
        <button
          className="sfa-btn sfa-btn-outline"
          style={{ marginTop: '1rem' }}
          onClick={() => navigate('/admin/social-feed/feed')}
        >
          View All Posts →
        </button>
      </div>
    </div>
  );
};

export default SocialOverviewPage;
