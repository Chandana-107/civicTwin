import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Admin.css'

const AdminDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>🏛️ Admin Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-secondary">
          Logout
        </button>
      </div>

      <div className="admin-welcome-card">
        <h2>Welcome, {user?.name}!</h2>
        <p>📱 Phone: {user?.phone}</p>
        <p>👤 Role: {user?.role}</p>
        <p style={{ marginTop: '1rem', color: '#E5D38A', fontWeight: '600' }}>
          ✅ Admin Access Granted
        </p>
      </div>

      <div className="admin-card-grid">
        <div className="admin-action-card complaints" onClick={() => navigate('/admin/complaints')}>
          <h3>📋 Complaints</h3>
          <p>Manage citizen reports</p>
        </div>
        <div className="admin-action-card fraud" onClick={() => navigate('/admin/fraud')}>
          <h3>🚨 Fraud Detection</h3>
          <p>Analyze flags & clusters</p>
        </div>
        <div className="admin-action-card sentiment" onClick={() => navigate('/admin/sentiment')}>
          <h3>📊 Sentiment</h3>
          <p>Social feed analysis</p>
        </div>
        <div className="admin-action-card map" onClick={() => navigate('/admin/map')}>
          <h3>🗺️ Map View</h3>
          <p>Geospatial analysis</p>
        </div>
        <div className="admin-action-card simulation" onClick={() => navigate('/simulation')}>
          <h3>🔬 Simulation</h3>
          <p>Run policy models</p>
        </div>
      </div>
    </div >
  )
}

export default AdminDashboard
