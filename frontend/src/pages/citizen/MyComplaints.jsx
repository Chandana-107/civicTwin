import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

const MyComplaints = () => {
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            // Check if backend filters by user_id automatically. 
            // Usually auth middleware attaches user, and GET / should ideally filter by user for "My Complaints"
            // But if GET / returns all (admin view), we might see everyone's.
            // Let's assume for now we see what the API gives us.
            const response = await api.get(`/complaints?t=${Date.now()}`);
            setComplaints(response.data.data || []);
            toast.success('Complaints updated');
        } catch (error) {
            console.error(error);
            toast.error('Failed to load complaints');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        if (!status) return 'var(--text-secondary)';
        switch (status.toLowerCase()) {
            case 'open': return 'var(--primary-color)';
            case 'in_progress': return 'var(--info-color)';
            case 'resolved': return 'var(--success-color)';
            case 'closed': return 'var(--text-secondary)';
            default: return 'var(--text-secondary)';
        }
    };

    return (
        <div className="container" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ color: 'var(--primary-color)' }}>My Complaints</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={fetchComplaints}
                        className="btn btn-outline"
                        disabled={loading}
                    >
                        {loading ? '↻ Refreshing...' : '🔄 Refresh'}
                    </button>
                    <button onClick={() => navigate('/citizen/dashboard')} className="btn btn-outline">Back to Dashboard</button>
                    <button onClick={() => navigate('/citizen/file-complaint')} className="btn btn-primary">+ New Complaint</button>
                </div>
            </div>

            {loading ? (
                <div className="loading"><div className="spinner"></div></div>
            ) : complaints.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>No complaints found.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {complaints.map(complaint => (
                        <div key={complaint.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <h3 style={{ margin: 0, color: 'var(--primary-dark)' }}>{complaint.title}</h3>
                                <span style={{
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '999px',
                                    backgroundColor: getStatusColor(complaint.status),
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold'
                                }}>
                                    {(complaint.status || 'OPEN').toUpperCase()}
                                </span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Warning: ID {complaint.id} • {new Date(complaint.created_at).toLocaleDateString()}
                            </p>
                            <p>{complaint.text}</p>
                            {complaint.location_address && (
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>📍 {complaint.location_address}</p>
                            )}
                            {complaint.category && (
                                <span style={{
                                    alignSelf: 'flex-start',
                                    background: 'var(--light-bg)',
                                    color: 'var(--text-secondary)',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {complaint.category}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyComplaints;
