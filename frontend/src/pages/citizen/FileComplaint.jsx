import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import './Citizen.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const getComplaintMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (/^[a-f0-9]{24}$/i.test(url)) return `${API_BASE_URL}/complaints/image/${url}`;
    return `${API_BASE_URL}${url}`;
};

const FileComplaint = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        title: '',
        text: '',
        address: '',
        attachment_url: '',
        consent_given: false
    });
    const [location, setLocation] = useState({ lat: null, lng: null });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const getLocation = () => {
        if (navigator.geolocation) {
            toast.loading('Getting location...', { id: 'loc' });
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    toast.success('Location fetched!', { id: 'loc' });
                },
                (error) => {
                    toast.error('Unable to retrieve location. Please check your browser permissions.', { id: 'loc' });
                    console.error(error);
                }
            );
        } else {
            toast.error('Geolocation not supported by your browser.');
        }
    };

    const handleFile = async (file) => {
        if (!file) return;
        setUploadingImage(true);
        const toastId = toast.loading('Uploading image...');
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await api.post('/complaints/image/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setFormData(prev => ({ ...prev, attachment_url: res.data.url }));
            toast.success('Image attached successfully!', { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to upload image', { id: toastId });
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (e) => {
        e.stopPropagation();
        setFormData(prev => ({ ...prev, attachment_url: '' }));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!location.lat || !location.lng) {
            toast.error('Location is required. Please use "Get My Location"');
            return;
        }
        if (!formData.consent_given) {
            toast.error('You must consent to sharing data to file a complaint.');
            return;
        }

        setLoading(true);
        const toastId = toast.loading('Submitting complaint...');
        try {
            const payload = {
                title: formData.title,
                text: formData.text,
                lat: location.lat,
                lng: location.lng,
                location_address: formData.address,
                attachment_url: formData.attachment_url,
                consent_given: formData.consent_given
            };

            await api.post('/complaints', payload);
            toast.success('Complaint filed successfully!', { id: toastId });
            navigate('/citizen/my-complaints');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Failed to file complaint', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fc-container">
            <div className="fc-card">
                
                <div className="fc-header">
                    <h2>📝 File a Complaint</h2>
                    <p>Report civic issues directly to your local administration.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="fc-body">
                        
                        {/* ── Details Section ── */}
                        <div className="fc-section">
                            <h3 className="fc-section-title">✍️ Complaint Details</h3>
                            
                            <div className="fc-group">
                                <label className="fc-label">Title</label>
                                <input
                                    type="text"
                                    name="title"
                                    className="fc-input"
                                    placeholder="Briefly summarize the issue (e.g., Pothole on Main St)"
                                    value={formData.title}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="fc-group">
                                <label className="fc-label">Description</label>
                                <textarea
                                    name="text"
                                    className="fc-textarea"
                                    placeholder="Provide detailed information to help authorities resolve the issue quickly..."
                                    value={formData.text}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* ── Location Section ── */}
                        <div className="fc-section">
                            <h3 className="fc-section-title">📍 Location Information</h3>
                            
                            <div className="fc-location-row">
                                <button
                                    type="button"
                                    className="fc-btn-location"
                                    onClick={getLocation}
                                >
                                    🎯 Get My Location
                                </button>
                                
                                {location.lat && (
                                    <div className="fc-location-badge">
                                        ✓ {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                                    </div>
                                )}
                            </div>

                            <div className="fc-group">
                                <input
                                    type="text"
                                    name="address"
                                    placeholder="Additional landmark or address notes (Optional)"
                                    className="fc-input"
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* ── Media Attachment ── */}
                        <div className="fc-section">
                            <h3 className="fc-section-title">📸 Media Attachment</h3>
                            
                            {!formData.attachment_url ? (
                                <div 
                                    className={`fc-dropzone ${isDragging ? 'dragging' : ''}`}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={(e) => { 
                                        e.preventDefault(); 
                                        setIsDragging(false); 
                                        handleFile(e.dataTransfer.files?.[0]); 
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        accept="image/*" 
                                        style={{ display: 'none' }} 
                                        onChange={(e) => handleFile(e.target.files?.[0])}
                                    />
                                    <div className="fc-dropzone-content">
                                        {uploadingImage ? (
                                            <>
                                                <span className="fc-dropzone-icon">⏳</span>
                                                <span style={{ fontWeight: 600 }}>Uploading image...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="fc-dropzone-icon">📎</span>
                                                <span style={{ fontWeight: 600 }}>Click or drag to upload an image</span>
                                                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Visual evidence helps resolve issues faster.</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="fc-preview-wrap">
                                    <img src={getComplaintMediaUrl(formData.attachment_url)} alt="Attachment preview" className="fc-preview-img" />
                                    <button type="button" className="fc-btn-remove-img" onClick={removeImage} title="Remove image">
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Consent Box ── */}
                        <label className="fc-consent-box">
                            <input
                                type="checkbox"
                                name="consent_given"
                                className="fc-consent-checkbox"
                                checked={formData.consent_given}
                                onChange={handleChange}
                            />
                            <span className="fc-consent-text">
                                <strong>Data Sharing Consent:</strong> I agree to submit this information, including my location and media, to the civic administration to facilitate issue resolution and improve public services.
                            </span>
                        </label>

                    </div>

                    <div className="fc-actions">
                        <button
                            type="button"
                            className="fc-btn fc-btn-cancel"
                            onClick={() => navigate('/citizen/dashboard')}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="fc-btn fc-btn-submit"
                            disabled={loading || uploadingImage || !formData.consent_given}
                        >
                            {loading ? 'Submitting...' : 'Submit Complaint'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default FileComplaint;
