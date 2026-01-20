import { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in on mount
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const login = async (email, password, aadhaar) => {
    const response = await api.post('/api/auth/login', { email, password, aadhaar })
    const { token } = response.data
    
    // Fetch user details
    const userResponse = await api.get('/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userResponse.data))
    setUser(userResponse.data)
    
    return userResponse.data
  }

  const signup = async (userData) => {
    const response = await api.post('/api/auth/register', userData)
    return response.data
  }

  const verifyOTP = async (aadhaar, otp) => {
    const response = await api.post('/api/auth/aadhaar/verify-otp', { aadhaar, otp })
    return response.data
  }

  const requestOTP = async (aadhaar) => {
    const response = await api.post('/api/auth/aadhaar/request-otp', { aadhaar })
    return response.data
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const value = {
    user,
    loading,
    login,
    signup,
    verifyOTP,
    requestOTP,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
