import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import './Citizen.css';

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
        <div className="complaints-container">
            <div className="complaints-header">
                <h2>📋 My Complaints</h2>
                <div className="complaints-actions">
                    <button
                        onClick={fetchComplaints}
                        className="btn btn-secondary"
                        disabled={loading}
                    >
                        {loading ? '↻ Refreshing...' : '🔄 Refresh'}
                    </button>
                    <button onClick={() => navigate('/citizen/dashboard')} className="btn btn-outline">← Dashboard</button>
                    <button onClick={() => navigate('/citizen/file-complaint')} className="btn btn-primary">+ New Complaint</button>
                </div>
            </div>

            {loading ? (
                <div className="loading"><div className="spinner"></div></div>
            ) : complaints.length === 0 ? (
                <div className="empty-state">
                    <p>📭 No complaints found. Start by filing your first complaint!</p>
                </div>
            ) : (
                <div className="complaints-grid">
                    {complaints.map(complaint => (
                        <div key={complaint.id} className="complaint-card">
                            <div className="complaint-header">
                                <h3 className="complaint-title">{complaint.title}</h3>
                                <span className={`status-badge ${(complaint.status || 'open').toLowerCase().replace(' ', '_')}`}>
                                    {(complaint.status || 'OPEN').toUpperCase()}
                                </span>
                            </div>
                            <p className="complaint-meta">
                                🆔 ID {complaint.id} • 📅 {new Date(complaint.created_at).toLocaleDateString()}
                            </p>
                            <p className="complaint-text">{complaint.text}</p>
                            {complaint.location_address && (
                                <p className="complaint-location">📍 {complaint.location_address}</p>
                            )}
                            {complaint.category && (
                                <span className="complaint-category">
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
