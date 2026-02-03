import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Citizen.css'

const CitizenDashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="citizen-dashboard">
      <div className="dashboard-header">
        <h1>Citizen Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-outline">
          Logout
        </button>
      </div>

      <div className="user-info-card">
        <p>Welcome, {user?.name || 'Citizen'}!</p>
        <p>📱 Phone: {user?.phone}</p>
        <p>👤 Role: {user?.role}</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card primary" onClick={() => navigate('/citizen/file-complaint')}>
          <h3>📝 New Complaint</h3>
          <p>Report an issue in your area</p>
        </div>
        <div className="dashboard-card secondary" onClick={() => navigate('/citizen/my-complaints')}>
          <h3>📋 My Complaints</h3>
          <p>Track status of your reports</p>
        </div>
        <div className="dashboard-card accent" onClick={() => navigate('/citizen/social')}>
          <h3>💬 Social Feed</h3>
          <p>See community sentiment</p>
        </div>
      </div>

      <div className="dashboard-footer">
        <p>
          🎯 Your civic engagement matters! Report issues, track progress, and stay informed.
        </p>
      </div>
    </div >
  )
}

export default CitizenDashboard
