import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import './Auth.css'

const ForgotPassword = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: phone, 2: otp, 3: new password
  const [formData, setFormData] = useState({
    phone: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleRequestOTP = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await api.post('/api/auth/forgot-password', { phone: formData.phone })
      toast.success('OTP sent to your phone')
      setStep(2)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await api.post('/api/auth/verify-reset-otp', {
        phone: formData.phone,
        otp: formData.otp
      })
      toast.success('OTP verified')
      setStep(3)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid OTP')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (formData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    try {
      await api.post('/api/auth/reset-password', {
        phone: formData.phone,
        otp: formData.otp,
        newPassword: formData.newPassword
      })
      toast.success('Password reset successful!')
      navigate('/login')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>CivicTwin</h1>
          <p>AI Powered Governance Platform</p>
        </div>

        <h2 className="auth-title">Reset Password</h2>
        <p className="auth-subtitle">
          {step === 1 && 'Enter your phone number'}
          {step === 2 && 'Verify OTP'}
          {step === 3 && 'Set new password'}
        </p>

        {step === 1 && (
          <form onSubmit={handleRequestOTP} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="phone">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                className="form-input"
                placeholder="Enter your phone number"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="otp">
                OTP Code
              </label>
              <input
                type="text"
                id="otp"
                name="otp"
                className="form-input"
                placeholder="Enter 6-digit OTP"
                value={formData.otp}
                onChange={handleChange}
                maxLength="6"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="newPassword">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                className="form-input"
                placeholder="At least 6 characters"
                value={formData.newPassword}
                onChange={handleChange}
                required
                minLength="6"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className="form-input"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={isLoading}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            Remember your password?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
