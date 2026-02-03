import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import './Citizen.css';

const FileComplaint = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
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
            toast.loading('Getting location...');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    toast.dismiss();
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                    toast.success('Location fetched!');
                },
                (error) => {
                    toast.dismiss();
                    toast.error('Unable to retrieve location');
                    console.error(error);
                }
            );
        } else {
            toast.error('Geolocation not supported');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!location.lat || !location.lng) {
            toast.error('Location is required. Please use "Get My Location"');
            return;
        }

        setLoading(true);
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
            toast.success('Complaint filed successfully!');
            navigate('/citizen/my-complaints');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Failed to file complaint');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="complaint-form-container">
            <div className="complaint-form-card">
                <h2>📝 File a Complaint</h2>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Title</label>
                        <input
                            type="text"
                            name="title"
                            className="form-input"
                            value={formData.title}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            name="text"
                            className="form-input"
                            rows="4"
                            value={formData.text}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Location</label>
                        <div className="location-button-group">
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={getLocation}
                            >
                                📍 Get My Location
                            </button>
                            {location.lat && (
                                <span className="location-success">
                                    ✓ {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            name="address"
                            placeholder="Manual Address (Optional)"
                            className="form-input"
                            value={formData.address}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Attachment URL (Photo/Video)</label>
                        <input
                            type="url"
                            name="attachment_url"
                            className="form-input"
                            placeholder="https://example.com/image.jpg"
                            value={formData.attachment_url}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="consent-checkbox-group">
                        <input
                            type="checkbox"
                            name="consent_given"
                            id="consent"
                            checked={formData.consent_given}
                            onChange={handleChange}
                        />
                        <label htmlFor="consent">
                            I consent to share this data for analysis and agree to help improve civic services.
                        </label>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => navigate('/citizen/dashboard')}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
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
