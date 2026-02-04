import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ForceGraph2D from 'react-force-graph-2d';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import './Admin.css';

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
            const nodes = new Map(); // Use Map to store node details
            const links = [];
            (clustersRes.data || []).forEach(cluster => {
                try {
                    const members = typeof cluster.cluster_nodes === 'string' 
                        ? JSON.parse(cluster.cluster_nodes) 
                        : (cluster.cluster_nodes || []);
                    
                    // Get node details from evidence if available
                    let evidence = {};
                    if (typeof cluster.evidence === 'string') {
                        evidence = JSON.parse(cluster.evidence);
                    } else if (cluster.evidence && typeof cluster.evidence === 'object') {
                        evidence = cluster.evidence;
                    }
                    const nodeDetails = evidence.node_details || {};
                    
                    members.forEach(m => {
                        if (!nodes.has(m)) {
                            nodes.set(m, {
                                id: m,
                                name: nodeDetails[m]?.name || m.substring(0, 8), // Use name or first 8 chars of ID
                                type: nodeDetails[m]?.type || 'contractor'
                            });
                        }
                    });
                    
                    // Create links between all members
                    for (let i = 0; i < members.length; i++) {
                        for (let j = i + 1; j < members.length; j++) {
                            links.push({ source: members[i], target: members[j] });
                        }
                    }
                } catch (err) {
                    console.error('Error parsing cluster for graph:', err, cluster);
                }
            });
            setGraphData({
                nodes: Array.from(nodes.values()).map(node => ({ ...node, group: 1 })),
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
        <div className="fraud-page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h2>🚨 AI-Powered Fraud Detection Dashboard</h2>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: '#5377A2', maxWidth: '800px' }}>
                            AI connects the dots between suppliers, officials, and contractors to detect collusion networks and corruption. 
                            Visualizes suspicious connections like a crime map.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => navigate('/admin/dashboard')} className="btn btn-secondary">← Back</button>
                        <button onClick={runDetection} className="btn btn-danger" disabled={processing}>
                            {processing ? 'Running...' : '🤖 Run AI Detection'}
                        </button>
                    </div>
                </div>

                <div className="tab-navigation">
                    <button
                        onClick={() => setActiveTab('flags')}
                        className={`tab-button ${activeTab === 'flags' ? 'active' : ''}`}
                    >
                        🚩 Fraud Alerts ({flags.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('clusters')}
                        className={`tab-button ${activeTab === 'clusters' ? 'active' : ''}`}
                    >
                        🕸️ Collusion Networks ({clusters.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('graph')}
                        className={`tab-button ${activeTab === 'graph' ? 'active' : ''}`}
                    >
                        🗺️ Crime Map
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
                            <div style={{ display: 'grid', gap: '1.25rem' }}>
                                {flags.length === 0 ? <p style={{ color: '#5377A2' }}>No suspicious activity detected.</p> : flags.map(flag => {
                                    let evidence = {};
                                    try {
                                        // Handle both string and object types from PostgreSQL JSONB
                                        if (typeof flag.evidence === 'string') {
                                            evidence = JSON.parse(flag.evidence);
                                        } else if (flag.evidence && typeof flag.evidence === 'object') {
                                            evidence = flag.evidence;
                                        } else {
                                            evidence = {};
                                        }
                                    } catch (err) {
                                        console.error('Error parsing flag evidence:', err, flag);
                                        evidence = {};
                                    }
                                    
                                    // Render evidence based on rule type
                                    let evidenceDisplay = null;
                                    if (flag.rule === 'repeat_winner') {
                                        evidenceDisplay = (
                                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#FFF3F3', borderRadius: '0.5rem', borderLeft: '3px solid #601A35' }}>
                                                <p style={{ margin: 0, marginBottom: '0.5rem', fontWeight: '700', color: '#601A35', fontSize: '0.95rem' }}>
                                                    🚨 Repeat Winner Detected
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1E3150' }}>
                                                    <strong>{evidence.contractor}</strong> has won <strong>{evidence.wins} tenders</strong> in the last year - significantly above normal patterns.
                                                </p>
                                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#5377A2' }}>
                                                    💡 This may indicate monopolistic behavior or preferential treatment.
                                                </p>
                                            </div>
                                        );
                                    } else if (flag.rule === 'price_outlier') {
                                        evidenceDisplay = (
                                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#FFF3F3', borderRadius: '0.5rem', borderLeft: '3px solid #601A35' }}>
                                                <p style={{ margin: 0, marginBottom: '0.5rem', fontWeight: '700', color: '#601A35', fontSize: '0.95rem' }}>
                                                    💰 Price Anomaly Detected
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1E3150' }}>
                                                    Tender amount: <strong>₹{Number(evidence.amount).toLocaleString('en-IN')}</strong> in category <strong>{evidence.category}</strong>
                                                </p>
                                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#1E3150' }}>
                                                    Expected range: ₹{Number(evidence.mean - evidence.std).toLocaleString('en-IN')} - ₹{Number(evidence.cutoff).toLocaleString('en-IN')}
                                                </p>
                                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#5377A2' }}>
                                                    💡 Price is {((evidence.amount - evidence.mean) / evidence.std).toFixed(1)}x standard deviations above average - possible inflated pricing.
                                                </p>
                                            </div>
                                        );
                                    } else if (flag.rule === 'duplicate_beneficiary') {
                                        evidenceDisplay = (
                                            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#FFF3F3', borderRadius: '0.5rem', borderLeft: '3px solid #601A35' }}>
                                                <p style={{ margin: 0, marginBottom: '0.5rem', fontWeight: '700', color: '#601A35', fontSize: '0.95rem' }}>
                                                    🔄 Duplicate Beneficiary
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1E3150' }}>
                                                    Beneficiary ID <strong>{evidence.beneficiary_id}</strong> appears in <strong>{evidence.count} different tenders</strong>
                                                </p>
                                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#5377A2' }}>
                                                    💡 Same beneficiary receiving multiple contracts may indicate shell companies or kickback schemes.
                                                </p>
                                            </div>
                                        );
                                    }
                                    
                                    return (
                                        <div key={flag.id} className="fraud-card severity-high">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                <h4 style={{ color: '#601A35', margin: 0, fontFamily: "'Playfair Display', serif" }}>🚩 Fraud Alert</h4>
                                                <span style={{ 
                                                    padding: '0.35rem 0.85rem', 
                                                    background: Number(flag.score) > 0.7 ? '#601A35' : Number(flag.score) > 0.4 ? '#D97730' : '#5377A2',
                                                    color: 'white',
                                                    borderRadius: '12px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    Risk: {Number(flag.score) > 0.7 ? 'HIGH' : Number(flag.score) > 0.4 ? 'MEDIUM' : 'LOW'} ({(Number(flag.score) * 100).toFixed(0)}%)
                                                </span>
                                            </div>
                                            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#5377A2' }}>
                                                Tender: {flag.tender_id}
                                            </p>
                                            {evidenceDisplay}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {activeTab === 'clusters' && (
                            <div style={{ display: 'grid', gap: '1.25rem' }}>
                                {clusters.length === 0 ? <p style={{ color: '#5377A2' }}>No collusion networks detected.</p> : clusters.map(cluster => {
                                    let nodes = [];
                                    let evidence = {};
                                    let score = 0;
                                    let isMLDetected = false;
                                    
                                    try {
                                        // Handle both string and object types from PostgreSQL JSONB
                                        if (typeof cluster.cluster_nodes === 'string') {
                                            nodes = JSON.parse(cluster.cluster_nodes);
                                        } else if (Array.isArray(cluster.cluster_nodes)) {
                                            nodes = cluster.cluster_nodes;
                                        } else {
                                            nodes = [];
                                        }
                                        
                                        if (typeof cluster.evidence === 'string') {
                                            evidence = JSON.parse(cluster.evidence);
                                        } else if (cluster.evidence && typeof cluster.evidence === 'object') {
                                            evidence = cluster.evidence;
                                        } else {
                                            evidence = {};
                                        }
                                        
                                        score = Number(cluster.suspiciousness_score) || 0;
                                        isMLDetected = evidence?.method === 'greedy_modularity';
                                    } catch (err) {
                                        console.error('Error parsing cluster data:', err, cluster);
                                        nodes = [];
                                        evidence = {};
                                    }
                                    
                                    if (nodes.length === 0) return null; // Skip invalid clusters
                                    
                                    return (
                                        <div key={cluster.id} className="fraud-card severity-medium">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                                <div>
                                                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1E3150', fontFamily: "'Playfair Display', serif" }}>
                                                        🕸️ Collusion Network Detected
                                                        {isMLDetected && (
                                                            <span style={{ 
                                                                fontSize: '0.65rem', 
                                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                color: 'white',
                                                                padding: '0.2rem 0.6rem',
                                                                borderRadius: '10px',
                                                                fontWeight: 'bold',
                                                                fontFamily: 'system-ui'
                                                            }}>
                                                                🤖 AI DETECTED
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#5377A2' }}>
                                                        {nodes.length} entities working together
                                                    </p>
                                                </div>
                                                <span style={{ 
                                                    padding: '0.5rem 1rem', 
                                                    background: score > 0.7 ? '#601A35' : score > 0.4 ? '#D97730' : '#5377A2',
                                                    color: 'white',
                                                    borderRadius: '10px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 'bold',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    Risk: {(score * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            
                                            <div style={{ padding: '0.75rem', background: '#FFF8F0', borderRadius: '0.5rem', marginBottom: '0.75rem', borderLeft: '3px solid #D97730' }}>
                                                <p style={{ margin: 0, marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.9rem', color: '#1E3150' }}>
                                                    💰 Financial Impact
                                                </p>
                                                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: '#601A35' }}>
                                                    ₹{Number(cluster.total_amount).toLocaleString('en-IN')}
                                                </p>
                                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#5377A2' }}>
                                                    Total value of connected tenders
                                                </p>
                                            </div>
                                            
                                            <div style={{ padding: '0.75rem', background: '#F0F4FF', borderRadius: '0.5rem', marginBottom: '0.75rem', borderLeft: '3px solid #5377A2' }}>
                                                <p style={{ margin: 0, marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.9rem', color: '#1E3150' }}>
                                                    🔗 Network Connections
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#1E3150' }}>
                                                    <strong>Connected Entities:</strong> {(() => {
                                                        const nodeDetails = evidence?.node_details || {};
                                                        return nodes.map(nodeId => {
                                                            return nodeDetails[nodeId]?.name || nodeId.substring(0, 8) + '...';
                                                        }).join(', ');
                                                    })()}
                                                </p>
                                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#5377A2' }}>
                                                    {evidence?.reason === 'shared phone/address/beneficiary' 
                                                        ? '⚠️ These contractors share phone numbers, addresses, or beneficiaries - indicating possible coordination or shell companies.'
                                                        : evidence?.reason || 'Connected through suspicious patterns'}
                                                </p>
                                            </div>
                                            
                                            {isMLDetected && (
                                                <div style={{ padding: '0.75rem', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)', borderRadius: '0.5rem', border: '1px solid rgba(102, 126, 234, 0.3)' }}>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#1E3150', lineHeight: '1.5' }}>
                                                        🤖 <strong>AI Analysis:</strong> This collusion network was automatically detected using advanced graph community detection algorithms (Greedy Modularity). The AI analyzed relationships between hundreds of entities to identify this suspicious cluster that would be nearly impossible to spot manually.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {activeTab === 'graph' && (
                            <>
                                <div style={{ marginBottom: '1rem', padding: '1rem', background: 'linear-gradient(135deg, #F0F4FF 0%, #FFF8F0 100%)', borderRadius: '0.5rem', border: '1px solid #5377A2' }}>
                                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#1E3150', fontSize: '1.1rem', fontFamily: "'Playfair Display', serif" }}>
                                        🗺️ Corruption Network Visualization
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#5377A2', lineHeight: '1.5' }}>
                                        This "crime map" shows how contractors and companies are connected through shared contacts, addresses, and beneficiaries. 
                                        Connected nodes (dots) indicate potential collusion. Lines show relationships between entities. 
                                        <strong> Drag to explore the network.</strong>
                                    </p>
                                </div>
                                <div className="card" style={{ height: '600px', cursor: 'move', color: 'var(--text-primary)' }}>
                                    <ForceGraph2D
                                        graphData={graphData}
                                        nodeLabel={node => node.name || node.id}
                                        nodeAutoColorBy="group"
                                        linkDirectionalParticles={2}
                                        linkDirectionalParticleSpeed={d => 0.005}
                                        nodeCanvasObject={(node, ctx, globalScale) => {
                                            const label = node.name || node.id; // Use name if available
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
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default FraudDashboard;
