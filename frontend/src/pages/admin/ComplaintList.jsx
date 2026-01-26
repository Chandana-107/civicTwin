import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

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
        <div style={{ backgroundColor: '#4F709C', minHeight: '100vh', width: '100%' }}>
            <div className="container" style={{ padding: '2rem', color: '#F0F0F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ color: '#F0F0F0', fontFamily: "'Playfair Display', serif", fontSize: '2.5rem' }}>All Complaints</h2>
                    <button onClick={() => navigate('/admin/dashboard')} className="btn" style={{ backgroundColor: '#E5D283', color: '#1F2937', fontWeight: 'bold' }}>Back to Dashboard</button>
                </div>

                <div className="card" style={{ marginBottom: '2rem', color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                            <label className="form-label">Status</label>
                            <select name="status" className="form-input" value={filters.status} onChange={handleFilterChange}>
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="resolved">Resolved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
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
                    <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-primary)' }}>
                        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>No complaints found matching filters.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {complaints.map(complaint => (
                            <div key={complaint.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-primary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: 'var(--primary-dark)' }}>{complaint.title}</h3>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>From User ID: {complaint.user_id}</span>
                                    </div>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '999px',
                                        backgroundColor: getStatusColor(complaint.status),
                                        color: 'white',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold'
                                    }}>
                                        {complaint.status.toUpperCase()}
                                    </span>
                                </div>
                                <p>{complaint.text}</p>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                                    {complaint.priority && (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--danger-color)' }}>Priority: {Number(complaint.priority).toFixed(2)}</span>
                                    )}
                                    {complaint.category && (
                                        <span style={{ fontSize: '0.8rem', background: 'var(--light-bg)', padding: '2px 6px', border: '1px solid var(--border-color)' }}>{complaint.category}</span>
                                    )}
                                    <div style={{ flex: 1 }}></div>
                                    <button
                                        className="btn btn-sm btn-outline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/admin/complaints/${complaint.id}`);
                                        }}
                                    >
                                        View Details & Update &rarr;
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
