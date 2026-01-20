import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import './Auth.css'

const VerifyOTP = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { verifyOTP, requestOTP } = useAuth()
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [canResend, setCanResend] = useState(false)
  const [countdown, setCountdown] = useState(60)
  
  const aadhaar = location.state?.aadhaar

  useEffect(() => {
    if (!aadhaar) {
      navigate('/login')
      return
    }

    // Countdown timer for resend OTP
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

    return () => clearInterval(timer)
  }, [aadhaar, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }

    setIsLoading(true)

    try {
      await verifyOTP(aadhaar, otp)
      toast.success('Aadhaar verified successfully!')
      navigate('/login')
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Invalid OTP')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    try {
      await requestOTP(phone)
      toast.success('OTP sent successfully!')
      setCanResend(false)
      setCountdown(60)
      
      // Restart countdown
      const timer = setaadhaarval(() => {
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
      toast.error('Failed to resend OTP')
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>CivicTwin</h1>
          <p>AI Powered Governance Platform</p>
        </div>

        <h2 className="auth-title">Verify OTP</h2>
        <p className="auth-subtitle">
          Enter the 6-digit code sent to {phone}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="otp">
              OTP Codeyour registered mobile
            </label>
            <input
              type="text"
              id="otp"
              name="otp"
              className="form-input otp-input"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              maxLength="6"
              required
              autoFocus
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

        <div className="otp-resend">
          {canResend ? (
            <button
              onClick={handleResendOTP}
              className="auth-link-button"
            >
              Resend OTP
            </button>
          ) : (
            <p className="countdown-text">
              Resend OTP in {countdown}s
            </p>
          )}
        </div>

        <div className="auth-footer">
          <p>
            <Link to="/login" className="auth-link">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default VerifyOTP
