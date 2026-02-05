import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import './Admin.css';

const ComplaintDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [complaint, setComplaint] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [note, setNote] = useState('');
    const [labels, setLabels] = useState([]);
    const [timeline, setTimeline] = useState([]);

    useEffect(() => {
        fetchComplaintDetails();
    }, [id]);

    const fetchComplaintDetails = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/complaints/${id}`);
            const data = response.data;
            setComplaint(data.complaint);
            setStatus(data.complaint.status?.toLowerCase() || 'open');
            setLabels(data.labels || []);
            setTimeline(data.notes || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load complaint details');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async () => {
        try {
            await api.patch(`/complaints/${id}`, { status });
            toast.success('Status updated successfully');
            fetchComplaintDetails();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Failed to update status');
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/complaints/${id}/notes`, {
                text: note,
                note_type: 'comment'
            });
            toast.success('Note added');
            setNote('');
            fetchComplaintDetails();
        } catch (error) {
            console.error(error);
            toast.error('Failed to add note');
        }
    };

    if (loading) return <div className="loading"><div className="spinner"></div></div>;
    if (!complaint) return <div className="container" style={{ padding: '2rem' }}>Complaint not found.</div>;

    return (
        <div className="detail-page">
            <div className="container">
                <button onClick={() => navigate('/admin/complaints')} className="btn btn-secondary" style={{ marginBottom: '1.5rem' }}>
                    ← Back to List
                </button>

                <div className="detail-grid">
                    {/* Left Column: Details */}
                    <div>
                        <div className="detail-main-card">
                            <div className="detail-header">
                                <h2 className="detail-title">{complaint?.title || 'No Title'}</h2>
                                <span className="admin-status-badge" style={{
                                    backgroundColor:
                                        (complaint?.status === 'resolved') ? '#28a745' :
                                            (complaint?.status === 'in_progress') ? '#5377A2' : '#601A35',
                                    color: '#FFFFFF'
                                }}>
                                    {(complaint?.status || 'Open').toUpperCase()}
                                </span>
                            </div>
                            <p className="detail-description">{complaint?.text || 'No description provided.'}</p>

                            <div className="detail-info-grid">
                                <div className="detail-info-item">
                                    <strong>Category</strong>
                                    {complaint?.category || 'N/A'}
                                </div>
                                <div className="detail-info-item">
                                    <strong>Priority</strong>
                                    {complaint?.priority ? Number(complaint.priority).toFixed(2) : '0.00'}
                                </div>
                                <div className="detail-info-item">
                                    <strong>Date</strong>
                                    {complaint?.created_at ? new Date(complaint.created_at).toLocaleString() : 'N/A'}
                                </div>
                                <div className="detail-info-item">
                                    <strong>Location</strong>
                                    {complaint?.location_address || ((complaint?.lat && complaint?.lng) ? `${complaint.lat}, ${complaint.lng}` : 'N/A')}
                                </div>
                            </div>

                            {complaint.attachment_url && (
                                <div style={{ marginTop: '1.5rem' }}>
                                    <strong style={{ color: '#1E3150', display: 'block', marginBottom: '0.75rem' }}>Attachment:</strong>
                                    <img src={complaint.attachment_url} alt="Attachment" style={{ maxWidth: '100%', borderRadius: '0.75rem' }} />
                                </div>
                            )}
                        </div>

                        <div className="timeline-card">
                            <h3>📋 Timeline & Notes</h3>
                            <div>
                                {timeline.map(item => (
                                    <div key={item.id} className="timeline-item">
                                        <div className="timeline-meta">
                                            <span>User ID: {item.user_id}</span>
                                            <span>{new Date(item.created_at).toLocaleString()}</span>
                                        </div>
                                        <p className="timeline-text">{item.text}</p>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleAddNote} style={{ marginTop: '1.5rem' }}>
                                <textarea
                                    className="form-input"
                                    placeholder="Add a note or update..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    required
                                    rows="3"
                                />
                                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>Add Note</button>
                            </form>
                        </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div>
                        <div className="actions-card">
                            <h3>🛠️ Admin Actions</h3>
                            <div className="form-group">
                                <label className="form-label">Update Status</label>
                                <div className="status-update-group">
                                    <select
                                        className="form-input"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                    >
                                        <option value="open">Open</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                    </select>
                                    <button onClick={handleStatusUpdate} className="btn btn-primary">Update</button>
                                </div>
                            </div>
                        </div>

                        <div className="ai-analysis-card">
                            <h3>🤖 AI Analysis</h3>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 className="ai-section-title">Predicted Labels</h4>
                                <div className="label-tags">
                                    <span className="label-tag">
                                        {complaint.category} ({(complaint.priority * 100).toFixed(0)}%)
                                    </span>
                                </div>
                            </div>
                            {labels.length > 0 && (
                                <div>
                                    <h4 className="ai-section-title">Human Labels</h4>
                                    {labels.map(l => (
                                        <div key={l.id} style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#5377A2' }}>
                                            • {l.category} - {new Date(l.created_at).toLocaleDateString()}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComplaintDetail;
