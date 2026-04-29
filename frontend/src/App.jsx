import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import VerifyOTP from './pages/auth/VerifyOTP'
import ForgotPassword from './pages/auth/ForgotPassword'

import CitizenDashboard from './pages/citizen/Dashboard'
import FileComplaint from './pages/citizen/FileComplaint'
import MyComplaints from './pages/citizen/MyComplaints'
import SocialFeed from './pages/citizen/SocialFeed'

import AdminDashboard from './pages/admin/Dashboard'
import ComplaintList from './pages/admin/ComplaintList'
import ComplaintMap from './pages/admin/ComplaintMap'
import ComplaintDetail from './pages/admin/ComplaintDetail'
import FraudModule from './pages/admin/fraud/FraudModule'
import FraudOverviewPage from './pages/admin/fraud/FraudOverviewPage'
import FraudFindingsPage from './pages/admin/fraud/FraudFindingsPage'
import FraudNetworkPage from './pages/admin/fraud/FraudNetworkPage'
import FraudRunsPage from './pages/admin/fraud/FraudRunsPage'
import FraudAnalyticsPage from './pages/admin/fraud/FraudAnalyticsPage'
import SentimentDashboard from './pages/admin/SentimentDashboard'
import SocialFeedDashboard from './pages/admin/SocialFeedDashboard'
import Simulation from './pages/simulation/Simulation'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position='top-right' />
        <Routes>
          <Route path='/login' element={<Login />} />
          <Route path='/signup' element={<Signup />} />
          <Route path='/verify-otp' element={<VerifyOTP />} />
          <Route path='/forgot-password' element={<ForgotPassword />} />

          <Route path='/citizen/dashboard' element={<ProtectedRoute allowedRoles={['citizen', 'admin']}><CitizenDashboard /></ProtectedRoute>} />
          <Route path='/citizen/file-complaint' element={<ProtectedRoute allowedRoles={['citizen']}><FileComplaint /></ProtectedRoute>} />
          <Route path='/citizen/my-complaints' element={<ProtectedRoute allowedRoles={['citizen']}><MyComplaints /></ProtectedRoute>} />
          <Route path='/citizen/social' element={<ProtectedRoute allowedRoles={['citizen']}><SocialFeed /></ProtectedRoute>} />

          <Route path='/admin/dashboard' element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path='/admin/complaints' element={<ProtectedRoute allowedRoles={['admin']}><ComplaintList /></ProtectedRoute>} />
          <Route path='/admin/complaints/:id' element={<ProtectedRoute allowedRoles={['admin']}><ComplaintDetail /></ProtectedRoute>} />
          <Route path='/admin/map' element={<ProtectedRoute allowedRoles={['admin']}><ComplaintMap /></ProtectedRoute>} />

          <Route path='/admin/fraud' element={<ProtectedRoute allowedRoles={['admin']}><FraudModule /></ProtectedRoute>}>
            <Route index element={<FraudOverviewPage />} />
            <Route path='findings' element={<FraudFindingsPage />} />
            <Route path='network' element={<FraudNetworkPage />} />
            <Route path='runs' element={<FraudRunsPage />} />
            <Route path='analytics' element={<FraudAnalyticsPage />} />
          </Route>

          <Route path='/admin/sentiment' element={<ProtectedRoute allowedRoles={['admin']}><SentimentDashboard /></ProtectedRoute>} />
          <Route path='/admin/social-feed' element={<ProtectedRoute allowedRoles={['admin']}><SocialFeedDashboard /></ProtectedRoute>} />
          <Route path='/simulation' element={<ProtectedRoute allowedRoles={['admin']}><Simulation /></ProtectedRoute>} />

          <Route path='/' element={<Navigate to='/login' replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
