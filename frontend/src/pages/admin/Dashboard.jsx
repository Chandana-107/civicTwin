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
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-outline">
          Logout
        </button>
      </div>

      <div className="card">
        <h2>Welcome, {user?.name}!</h2>
        <p>Phone: {user?.phone}</p>
        <p>Role: {user?.role}</p>
        <p style={{ marginTop: '1rem', color: 'var(--secondary-color)' }}>
          ✅ Admin Access Granted
        </p>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>
          📌 More pages coming soon: User Management, Complaints, Fraud Detection, and more!
        </p>
      </div>
    </div>
  )
}

export default AdminDashboard
