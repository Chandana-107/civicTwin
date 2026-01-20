import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import './Auth.css'

const Login = () => {
  const navigate = useNavigate()
  const { login, requestOTP, verifyOTP } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    aadhaar: '',
    password: '',
    otp: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(true) // Set to true for testing (mock verified)
  const [canResend, setCanResend] = useState(false)
  const [countdown, setCountdown] = useState(60)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })

    // Reset OTP state if Aadhaar is changed after OTP was sent
    if (name === 'aadhaar' && otpSent) {
      setOtpSent(false)
      setOtpVerified(false)
      setFormData(prev => ({ ...prev, otp: '' }))
    }
  }

  const handleRequestOTP = async () => {
    if (formData.aadhaar.length !== 12) {
      toast.error('Please enter a valid 12-digit Aadhaar number')
      return
    }

    setIsLoading(true)
    try {
      await requestOTP(formData.aadhaar)
      toast.success('OTP sent to your registered mobile number')
      setOtpSent(true)
      setCanResend(false)
      setCountdown(60)

      // Start countdown timer
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true)
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send OTP')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (formData.otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }

    setIsLoading(true)
    try {
      await verifyOTP(formData.aadhaar, formData.otp)
      toast.success('Aadhaar verified successfully!')
      setOtpVerified(true)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid OTP')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Mock mode - skip OTP verification check for testing
    // if (!otpVerified) {
    //   toast.error('Please verify your Aadhaar with OTP first')
    //   return
    // }

    setIsLoading(true)

    try {
      const user = await login(formData.email, formData.password, formData.aadhaar)
      toast.success('Login successful!')
      
      // Redirect based on user role
      if (user.role === 'admin') {
        navigate('/admin/dashboard')
      } else {
        navigate('/citizen/dashboard')
      }
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Login failed')
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

        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-subtitle">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="aadhaar">
              Aadhaar Number
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                id="aadhaar"
                name="aadhaar"
                className="form-input"
                placeholder="12-digit Aadhaar number"
                value={formData.aadhaar}
                onChange={handleChange}
                required
                pattern="[0-9]{12}"
                maxLength="12"
                style={{ flex: 1 }}
              />
              {!otpVerified && (
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  className="btn btn-secondary"
                  disabled={isLoading || formData.aadhaar.length !== 12 || otpSent}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {otpSent ? 'OTP Sent' : 'Send OTP'}
                </button>
              )}
              {otpVerified && (
                <span style={{ color: 'var(--secondary-color)', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                  ✓ Verified
                </span>
              )}
            </div>
          </div>

          {otpSent && !otpVerified && (
            <div className="form-group">
              <label className="form-label" htmlFor="otp">
                Enter OTP
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  id="otp"
                  name="otp"
                  className="form-input"
                  placeholder="6-digit OTP"
                  value={formData.otp}
                  onChange={handleChange}
                  maxLength="6"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleVerifyOTP}
                  className="btn btn-primary"
                  disabled={isLoading || formData.otp.length !== 6}
                >
                  Verify
                </button>
              </div>
              {canResend ? (
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  className="auth-link-button"
                  style={{ marginTop: '0.5rem' }}
                >
                  Resend OTP
                </button>
              ) : (
                <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Resend OTP in {countdown}s
                </p>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-input"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="auth-options">
            <Link to="/forgot-password" className="auth-link">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
