import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ForceGraph2D from 'react-force-graph-2d';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

const FraudDashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('flags');
    const [flags, setFlags] = useState([]);
    const [clusters, setClusters] = useState([]);
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [flagsRes, clustersRes] = await Promise.all([
                api.get('/fraud/flags'),
                api.get('/fraud/clusters')
            ]);
            setFlags(flagsRes.data || []);
            setClusters(clustersRes.data || []);

            // Synthesize Graph Data from Clusters
            const nodes = new Set();
            const links = [];
            (clustersRes.data || []).forEach(cluster => {
                const members = JSON.parse(cluster.cluster_nodes || '[]');
                members.forEach(m => nodes.add(m));
                // Create links between all members
                for (let i = 0; i < members.length; i++) {
                    for (let j = i + 1; j < members.length; j++) {
                        links.push({ source: members[i], target: members[j] });
                    }
                }
            });
            setGraphData({
                nodes: Array.from(nodes).map(id => ({ id, group: 1 })),
                links
            });

        } catch (error) {
            console.error(error);
            toast.error('Failed to load fraud data');
        } finally {
            setLoading(false);
        }
    };

    const runDetection = async () => {
        if (!window.confirm("Run fraud detection algorithms? This may take a moment.")) return;
        setProcessing(true);
        try {
            const res = await api.post('/fraud/run');
            toast.success(`Detection complete! Created ${res.data.clusters_created} new clusters.`);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Detection failed');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div style={{ backgroundColor: '#4F709C', minHeight: '100vh', width: '100%' }}>
            <div className="container" style={{ padding: '2rem', color: '#F0F0F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ color: '#F0F0F0', fontFamily: "'Playfair Display', serif", fontSize: '2.5rem' }}>Fraud Detection Dashboard</h2>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => navigate('/admin/dashboard')} className="btn" style={{ backgroundColor: '#E5D283', color: '#1F2937', fontWeight: 'bold' }}>Back</button>
                        <button onClick={runDetection} className="btn btn-danger" disabled={processing}>
                            {processing ? 'Running...' : '⚡ Run Detection'}
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #F0F0F0' }}>
                    <button
                        onClick={() => setActiveTab('flags')}
                        style={{
                            padding: '1rem',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            borderBottom: activeTab === 'flags' ? '3px solid #E5D283' : 'none',
                            color: activeTab === 'flags' ? '#E5D283' : '#F0F0F0',
                            fontSize: '1.1rem'
                        }}
                    >
                        Suspicious Flags ({flags.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('clusters')}
                        style={{
                            padding: '1rem',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            borderBottom: activeTab === 'clusters' ? '3px solid #E5D283' : 'none',
                            color: activeTab === 'clusters' ? '#E5D283' : '#F0F0F0',
                            fontSize: '1.1rem'
                        }}
                    >
                        Collusion Clusters ({clusters.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('graph')}
                        style={{
                            padding: '1rem',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            borderBottom: activeTab === 'graph' ? '3px solid #E5D283' : 'none',
                            color: activeTab === 'graph' ? '#E5D283' : '#F0F0F0',
                            fontSize: '1.1rem'
                        }}
                    >
                        Graph View
                    </button>
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : (
                    <>
                        {activeTab === 'clusters' && clusters.length > 0 && (
                            <div className="card" style={{ marginBottom: '2rem', height: '300px', color: 'var(--text-primary)' }}>
                                <h3 style={{ marginBottom: '1rem' }}>Cluster Suspiciousness Overview</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={clusters.map(c => ({
                                            name: `Cluster ${c.id.substring(0, 4)}`,
                                            score: Number(c.suspiciousness_score),
                                            amount: Number(c.total_amount)
                                        }))}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                                        <Tooltip />
                                        <Legend />
                                        <Bar yAxisId="left" dataKey="score" fill="var(--danger-color)" name="Suspiciousness Score" />
                                        <Bar yAxisId="right" dataKey="amount" fill="var(--primary-color)" name="Total Amount (₹)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {activeTab === 'flags' && (
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {flags.length === 0 ? <p>No flags found.</p> : flags.map(flag => (
                                    <div key={flag.id} className="card" style={{ color: 'var(--text-primary)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <h4 style={{ color: 'var(--danger-color)', margin: 0 }}>{flag.rule.toUpperCase()}</h4>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Score: {Number(flag.score).toFixed(2)}</span>
                                        </div>
                                        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>Tender ID: {flag.tender_id}</p>
                                        <pre style={{ background: 'var(--light-bg)', padding: '0.5rem', fontSize: '0.8rem', overflowX: 'auto' }}>
                                            {JSON.stringify(flag.evidence, null, 2)}
                                        </pre>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'clusters' && (
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {clusters.length === 0 ? <p>No clusters found.</p> : clusters.map(cluster => (
                                    <div key={cluster.id} className="card" style={{ borderLeft: '4px solid var(--warning-color)', color: 'var(--text-primary)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <h4 style={{ margin: 0 }}>Cluster (Score: {Number(cluster.suspiciousness_score).toFixed(2)})</h4>
                                            <span style={{ fontWeight: 'bold' }}>Total Amount: ₹{cluster.total_amount}</span>
                                        </div>
                                        <p>Nodes: {JSON.parse(cluster.cluster_nodes || '[]').join(', ')}</p>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            Reason: {cluster.evidence?.reason || 'Unknown'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'graph' && (
                            <div className="card" style={{ height: '600px', cursor: 'move', color: 'var(--text-primary)' }}>
                                <ForceGraph2D
                                    graphData={graphData}
                                    nodeLabel="id"
                                    nodeAutoColorBy="group"
                                    linkDirectionalParticles={2}
                                    linkDirectionalParticleSpeed={d => 0.005}
                                    nodeCanvasObject={(node, ctx, globalScale) => {
                                        const label = node.id;
                                        const fontSize = 12 / globalScale;
                                        ctx.font = `${fontSize}px Sans-Serif`;
                                        const textWidth = ctx.measureText(label).width;
                                        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

                                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                                        ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);

                                        ctx.textAlign = 'center';
                                        ctx.textBaseline = 'middle';
                                        ctx.fillStyle = node.color || '#3b82f6';
                                        ctx.fillText(label, node.x, node.y);

                                        node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
                                    }}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default FraudDashboard;
