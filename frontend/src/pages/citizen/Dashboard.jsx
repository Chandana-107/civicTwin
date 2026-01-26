import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const CitizenDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Citizen Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-outline">
          Logout
        </button>
      </div>

      <div className="card">
        <p>Phone: {user?.phone}</p>
        <p>Role: {user?.role}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => navigate('/citizen/file-complaint')}>
          <h3 style={{ color: 'var(--primary-color)' }}>New Complaint</h3>
          <p>Report an issue in your area</p>
        </div>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => navigate('/citizen/my-complaints')}>
          <h3 style={{ color: 'var(--secondary-dark)' }}>My Complaints</h3>
          <p>Track status of your reports</p>
        </div>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => navigate('/citizen/social')}>
          <h3 style={{ color: '#8B5CF6' }}>Social Feed</h3>
          <p>See community sentiment</p>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>
          📌 More pages coming soon: File Complaint, My Complaints, Social Feed, and more!
        </p>
      </div>
    </div >
  )
}

export default CitizenDashboard
