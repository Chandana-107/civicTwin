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
import FileComplaint from './pages/citizen/FileComplaint'
import MyComplaints from './pages/citizen/MyComplaints'

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard'
import ComplaintList from './pages/admin/ComplaintList'
import ComplaintMap from './pages/admin/ComplaintMap'
import ComplaintDetail from './pages/admin/ComplaintDetail'
import FraudDashboard from './pages/admin/FraudDashboard'
import SentimentDashboard from './pages/admin/SentimentDashboard'
import Simulation from './pages/simulation/Simulation'

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
          <Route
            path="/citizen/file-complaint"
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <FileComplaint />
              </ProtectedRoute>
            }
          />
          <Route
            path="/citizen/my-complaints"
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <MyComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/citizen/social"
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <SentimentDashboard />
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
          <Route
            path="/admin/complaints"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ComplaintList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/complaints/:id"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ComplaintDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/map"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ComplaintMap />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/fraud"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <FraudDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sentiment"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <SentimentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/simulation"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Simulation />
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
