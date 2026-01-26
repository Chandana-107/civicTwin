import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';

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
        <div style={{ backgroundColor: '#4F709C', minHeight: '100vh', width: '100%' }}>
            <div className="container" style={{ padding: '2rem', color: '#F0F0F0' }}>
                <button onClick={() => navigate('/admin/complaints')} className="btn" style={{ marginBottom: '1rem', backgroundColor: '#E5D283', color: '#1F2937', fontWeight: 'bold' }}>
                    &larr; Back to List
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                    {/* Left Column: Details */}
                    <div>
                        <div className="card" style={{ marginBottom: '2rem', color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <h2 style={{ color: 'var(--primary-color)', marginTop: 0, fontFamily: "'Playfair Display', serif" }}>{complaint?.title || 'No Title'}</h2>
                                <span style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '999px',
                                    backgroundColor:
                                        (complaint?.status === 'resolved') ? 'var(--success-color)' :
                                            (complaint?.status === 'rejected') ? 'var(--danger-color)' : 'var(--warning-color)',
                                    color: 'white',
                                    fontWeight: 'bold'
                                }}>
                                    {(complaint?.status || 'Open').toUpperCase()}
                                </span>
                            </div>
                            <p style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>{complaint?.text || 'No description provided.'}</p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', color: 'var(--text-secondary)' }}>
                                <div>
                                    <strong>Category:</strong> {complaint?.category || 'N/A'}
                                </div>
                                <div>
                                    <strong>Priority:</strong> {complaint?.priority ? Number(complaint.priority).toFixed(2) : '0.00'}
                                </div>
                                <div>
                                    <strong>Date:</strong> {complaint?.created_at ? new Date(complaint.created_at).toLocaleString() : 'N/A'}
                                </div>
                                <div>
                                    <strong>Location:</strong> {complaint?.location_address || ((complaint?.lat && complaint?.lng) ? `${complaint.lat}, ${complaint.lng}` : 'N/A')}
                                </div>
                            </div>

                            {complaint.attachment_url && (
                                <div style={{ marginTop: '1rem' }}>
                                    <strong>Attachment:</strong><br />
                                    <img src={complaint.attachment_url} alt="Attachment" style={{ maxWidth: '100%', borderRadius: '0.5rem', marginTop: '0.5rem' }} />
                                </div>
                            )}


                        </div>

                        <div className="card" style={{ color: 'var(--text-primary)' }}>
                            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Timeline & Notes</h3>
                            <div style={{ marginTop: '1rem' }}>
                                {timeline.map(item => (
                                    <div key={item.id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px dashed var(--border-color)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            <span>User ID: {item.user_id}</span>
                                            <span>{new Date(item.created_at).toLocaleString()}</span>
                                        </div>
                                        <p style={{ margin: '0.5rem 0 0 0' }}>{item.text}</p>
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleAddNote} style={{ marginTop: '1rem' }}>
                                <textarea
                                    className="form-input"
                                    placeholder="Add a note or update..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    required
                                />
                                <button type="submit" className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>Add Note</button>
                            </form>
                        </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div>
                        <div className="card" style={{ marginBottom: '2rem', color: 'var(--text-primary)' }}>
                            <h3>Admin Actions</h3>
                            <div className="form-group">
                                <label className="form-label">Update Status</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select
                                        className="form-input"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                    >
                                        <option value="open">Open</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                    <button onClick={handleStatusUpdate} className="btn btn-primary">Update</button>
                                </div>
                            </div>
                        </div>

                        <div className="card" style={{ color: 'var(--text-primary)' }}>
                            <h3>AI Analysis</h3>
                            <div style={{ marginBottom: '1rem' }}>
                                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Predicted Labels</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <span style={{ background: 'var(--light-bg)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                                        {complaint.category} ({(complaint.priority * 100).toFixed(0)}%)
                                    </span>
                                </div>
                            </div>
                            {labels.length > 0 && (
                                <div>
                                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Human Labels</h4>
                                    {labels.map(l => (
                                        <div key={l.id} style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                            {l.category} - {new Date(l.created_at).toLocaleDateString()}
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
