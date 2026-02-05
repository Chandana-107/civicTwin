import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import './Admin.css';

const ComplaintList = () => {
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: '',
        category: ''
    });

    useEffect(() => {
        fetchComplaints();
    }, [filters]);

    const fetchComplaints = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.status) params.status = filters.status;
            if (filters.category) params.category = filters.category;

            const response = await api.get('/complaints', { params });
            setComplaints(response.data.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load complaints');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        setFilters(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const getStatusColor = (status) => {
        if (!status) return '#E5D38A';
        switch (status.toLowerCase()) {
            case 'open': return '#601A35';
            case 'in_progress': return '#5377A2';
            case 'resolved': return '#28a745';
            default: return '#E5D38A';
        }
    };

    const getStatusTextColor = (status) => {
        if (!status) return '#1E3150';
        switch (status.toLowerCase()) {
            case 'open': return '#FFFFFF';
            case 'in_progress': return '#FFFFFF';
            case 'resolved': return '#FFFFFF';
            default: return '#1E3150';
        }
    };

    return (
        <div className="complaints-page">
            <div className="container">
                <div className="page-header">
                    <h2>📋 All Complaints</h2>
                    <button onClick={() => navigate('/admin/dashboard')} className="btn btn-secondary">← Back to Dashboard</button>
                </div>

                <div className="filter-card">
                    <div className="filter-grid">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Status</label>
                            <select name="status" className="form-input" value={filters.status} onChange={handleFilterChange}>
                                <option value="">All Statuses</option>
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Category</label>
                            <select name="category" className="form-input" value={filters.category} onChange={handleFilterChange}>
                                <option value="">All Categories</option>
                                <option value="roads">Roads</option>
                                <option value="water">Water</option>
                                <option value="garbage">Garbage</option>
                                <option value="electricity">Electricity</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : complaints.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                        <p style={{ fontSize: '1.2rem', color: '#5377A2' }}>No complaints found matching filters.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                        {complaints.map(complaint => (
                            <div key={complaint.id} className="admin-complaint-card">
                                <div className="complaint-header-row">
                                    <div className="complaint-header-content">
                                        <h3>{complaint.title}</h3>
                                        <span className="complaint-user-id">From User ID: {complaint.user_id}</span>
                                    </div>
                                    <span className="admin-status-badge" style={{
                                        backgroundColor: getStatusColor(complaint.status),
                                        color: getStatusTextColor(complaint.status)
                                    }}>
                                        {complaint.status.toUpperCase()}
                                    </span>
                                </div>
                                <p style={{ color: '#1E3150', lineHeight: '1.6' }}>{complaint.text}</p>
                                <div className="complaint-footer">
                                    {complaint.priority && (
                                        <span className="priority-badge">🔥 Priority: {Number(complaint.priority).toFixed(2)}</span>
                                    )}
                                    {complaint.category && (
                                        <span className="category-tag">{complaint.category}</span>
                                    )}
                                    <div style={{ flex: 1 }}></div>
                                    <button
                                        className="btn btn-outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/admin/complaints/${complaint.id}`);
                                        }}
                                    >
                                        View Details →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComplaintList;
