import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import './Admin.css';

// Fix for default marker icon in Leaflet with Webpack/Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const ComplaintMap = () => {
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchComplaints = async () => {
            try {
                const response = await api.get('/complaints');
                // Filter complaints that have location data
                const validComplaints = (response.data.data || []).filter(c => c.lat && c.lng);
                setComplaints(validComplaints);
            } catch (error) {
                console.error('Error fetching complaints for map:', error);
                toast.error('Failed to load map data');
            } finally {
                setLoading(false);
            }
        };

        fetchComplaints();
    }, []);

    // Default center (can be adjusted or dynamic based on data)
    const position = [12.9716, 77.5946]; // Bangalore coords as default

    return (
        <div className="map-page">
            <div className="container">
                <div className="page-header">
                    <h2>🗺️ Complaint Map</h2>
                    <button onClick={() => navigate('/admin/dashboard')} className="btn btn-secondary">← Back</button>
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : (
                    <div className="map-container-card">
                        <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {complaints.map(complaint => (
                                <Marker key={complaint.id} position={[complaint.lat, complaint.lng]}>
                                    <Popup>
                                        <div style={{ minWidth: '200px', color: 'var(--text-primary)' }}>
                                            <h4 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>{complaint.title}</h4>
                                            <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem' }}>{complaint.category}</p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{
                                                    fontSize: '0.8rem',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: 'var(--light-bg)',
                                                    border: '1px solid var(--border-color)'
                                                }}>
                                                    {complaint.status}
                                                </span>
                                                <button
                                                    onClick={() => navigate(`/admin/complaints/${complaint.id}`)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'var(--primary-color)',
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline',
                                                        fontSize: '0.9rem'
                                                    }}
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComplaintMap;
