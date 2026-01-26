import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const AdminDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ padding: '2rem', backgroundColor: '#213555', minHeight: '100vh', color: '#F0F0F0', fontFamily: "'Playfair Display', serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className="btn" style={{ backgroundColor: '#E5D283', color: '#1F2937', fontWeight: 'bold' }}>
          Logout
        </button>
      </div>

      <div className="card" style={{ backgroundColor: '#4F709C', color: '#F0F0F0' }}>
        <h2>Welcome, {user?.name}!</h2>
        <p>Phone: {user?.phone}</p>
        <p>Role: {user?.role}</p>
        <p style={{ marginTop: '1rem', color: 'var(--secondary-color)' }}>
          ✅ Admin Access Granted
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem', color: '#213555' }}>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center', borderTop: '4px solid var(--primary-color)' }} onClick={() => navigate('/admin/complaints')}>
            <h3>Complaints</h3>
            <p>Manage citizen reports</p>
          </div>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center', borderTop: '4px solid var(--danger-color)' }} onClick={() => navigate('/admin/fraud')}>
            <h3>Fraud Detection</h3>
            <p>Analyze flags & clusters</p>
          </div>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center', borderTop: '4px solid var(--secondary-color)' }} onClick={() => navigate('/admin/sentiment')}>
            <h3>Sentiment</h3>
            <p>Social feed analysis</p>
          </div>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center', borderTop: '4px solid #10B981' }} onClick={() => navigate('/admin/map')}>
            <h3>Map View</h3>
            <p>Geospatial analysis</p>
          </div>
          <div className="card" style={{ cursor: 'pointer', textAlign: 'center', borderTop: '4px solid var(--primary-dark)' }} onClick={() => navigate('/simulation')}>
            <h3>Simulation</h3>
            <p>Run policy models</p>
          </div>
        </div>
      </div>


    </div >
  )
}

export default AdminDashboard
