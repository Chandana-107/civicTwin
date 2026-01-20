import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Auth Pages
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import VerifyOTP from './pages/auth/VerifyOTP'
import ForgotPassword from './pages/auth/ForgotPassword'

// Citizen Pages
import CitizenDashboard from './pages/citizen/Dashboard'

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Citizen Routes */}
          <Route
            path="/citizen/dashboard"
            element={
              <ProtectedRoute allowedRoles={['citizen', 'admin']}>
                <CitizenDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Default Route */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
