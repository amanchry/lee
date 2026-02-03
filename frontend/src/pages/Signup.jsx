import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, User, Globe, Loader2, Check, ArrowLeft, ArrowRight, Shield } from 'lucide-react'

export default function Signup({ onLogin }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Email, 2: OTP, 3: Name & Password
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [error, setError] = useState('')
  const [otpResendTimer, setOtpResendTimer] = useState(0)


  // OTP Resend Timer
  useEffect(() => {
    if (otpResendTimer > 0) {
      const timer = setTimeout(() => {
        setOtpResendTimer(otpResendTimer - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [otpResendTimer])

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    setError('')
  }

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setOtp(value)
    setError('')
  }

  const handleFormDataChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Please enter your email address')
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsSendingOtp(true)
    try {
      const response = await fetch('http://localhost:8000/djangoApi/webapp/send-otp/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to send OTP')
      }

      setOtpSent(true)
      setStep(2)
      setOtpResendTimer(60) // 60 seconds cooldown
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP')
      return
    }

    setIsVerifyingOtp(true)
    try {
      const response = await fetch('http://localhost:8000/djangoApi/webapp/verify-otp/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Invalid OTP')
      }

      setStep(3)
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  // Step 3: Create Account
  const validateFinalForm = () => {
    if (!formData.name || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields')
      return false
    }

    if (formData.name.length < 2) {
      setError('Name must be at least 2 characters')
      return false
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return false
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return false
    }



    return true
  }

  const handleResendOtp = async () => {
    if (otpResendTimer > 0) return
    
    setIsSendingOtp(true)
    setError('')
    try {
      const response = await fetch('http://localhost:8000/djangoApi/webapp/send-otp/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to resend OTP')
      }

      setOtpResendTimer(60)
      setOtp('')
    } catch (err) {
      setError(err.message || 'Failed to resend OTP. Please try again.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleCreateAccount = async (e) => {
    e.preventDefault()
    setError('')

    if (!validateFinalForm()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('http://localhost:8000/djangoApi/webapp/create-account/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name: formData.name,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create account')
      }

      // Account created successfully, login the user
      if (onLogin && data.data) {
        onLogin({
          name: data.data.name,
          email: data.data.email,
          username: data.data.username,  // Include username
          token: data.data.token,
        })
      }
      navigate('/')
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getPasswordStrength = (password) => {
    if (password.length === 0) return { strength: 0, label: '' }
    if (password.length < 6) return { strength: 1, label: 'Weak', color: 'bg-red-500' }
    if (password.length < 8) return { strength: 2, label: 'Fair', color: 'bg-yellow-500' }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return { strength: 3, label: 'Good', color: 'bg-blue-500' }
    }
    return { strength: 4, label: 'Strong', color: 'bg-green-500' }
  }

  const passwordStrength = getPasswordStrength(formData.password)

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'Enter Your Email'
      case 2:
        return 'Verify Your Email'
      case 3:
        return 'Create Your Account'
      default:
        return 'Create Account'
    }
  }

  const getStepDescription = () => {
    switch (step) {
      case 1:
        return 'We\'ll send you a verification code'
      case 2:
        return `Enter the code sent to ${email}`
      case 3:
        return 'Set up your account details'
      default:
        return 'Join EarthCode and start analyzing geospatial data'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ide-bg via-ide-panel to-ide-bg p-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-ide-accent to-ide-accent-hover mb-4 shadow-lg">
            <Globe className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ide-text mb-2">{getStepTitle()}</h1>
          <p className="text-ide-text-muted">{getStepDescription()}</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step >= s
                    ? 'bg-ide-accent text-white'
                    : 'bg-ide-border text-ide-text-muted'
                }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-0.5 mx-1 transition-all ${
                    step > s ? 'bg-ide-accent' : 'bg-ide-border'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Signup Card */}
        <div className="bg-ide-panel border border-ide-border rounded-xl shadow-2xl p-8 backdrop-blur-sm">
          {/* Step 1: Email */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-ide-text">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ide-text-muted" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-ide-bg border border-ide-border rounded-lg text-ide-text placeholder-ide-text-muted focus:outline-none focus:ring-2 focus:ring-ide-accent focus:border-transparent transition-all"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingOtp}
                className="w-full py-3 px-4 bg-gradient-to-r from-ide-accent to-ide-accent-hover text-white rounded-lg font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ide-accent focus:ring-offset-2 focus:ring-offset-ide-panel transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSendingOtp ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="otp" className="block text-sm font-medium text-ide-text">
                  Verification Code
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ide-text-muted" />
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    value={otp}
                    onChange={handleOtpChange}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full pl-10 pr-4 py-3 bg-ide-bg border border-ide-border rounded-lg text-ide-text placeholder-ide-text-muted focus:outline-none focus:ring-2 focus:ring-ide-accent focus:border-transparent transition-all text-center text-2xl tracking-widest font-mono"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-xs text-ide-text-muted text-center">
                  Enter the 6-digit code sent to <span className="font-medium">{email}</span>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1)
                    setOtp('')
                    setError('')
                  }}
                  className="flex-1 py-3 px-4 bg-ide-bg border border-ide-border text-ide-text rounded-lg font-medium hover:bg-ide-border transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingOtp || otp.length !== 6}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-ide-accent to-ide-accent-hover text-white rounded-lg font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ide-accent focus:ring-offset-2 focus:ring-offset-ide-panel transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isVerifyingOtp ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpResendTimer > 0 || isSendingOtp}
                  className="text-sm text-ide-accent hover:text-ide-accent-hover disabled:text-ide-text-muted disabled:cursor-not-allowed transition-colors"
                >
                  {otpResendTimer > 0
                    ? `Resend code in ${otpResendTimer}s`
                    : 'Resend verification code'}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Name & Password */}
          {step === 3 && (
            <form onSubmit={handleCreateAccount} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-ide-text">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ide-text-muted" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleFormDataChange}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-3 bg-ide-bg border border-ide-border rounded-lg text-ide-text placeholder-ide-text-muted focus:outline-none focus:ring-2 focus:ring-ide-accent focus:border-transparent transition-all"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-ide-text">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ide-text-muted" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleFormDataChange}
                    placeholder="Create a password"
                    className="w-full pl-10 pr-12 py-3 bg-ide-bg border border-ide-border rounded-lg text-ide-text placeholder-ide-text-muted focus:outline-none focus:ring-2 focus:ring-ide-accent focus:border-transparent transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ide-text-muted hover:text-ide-text transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formData.password && (
                  <div className="space-y-1">
                    <div className="flex gap-1 h-1.5">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`flex-1 rounded-full ${
                            level <= passwordStrength.strength
                              ? passwordStrength.color
                              : 'bg-ide-border'
                          }`}
                        />
                      ))}
                    </div>
                    {passwordStrength.label && (
                      <p className="text-xs text-ide-text-muted">
                        Password strength: <span className="font-medium">{passwordStrength.label}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-ide-text">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ide-text-muted" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleFormDataChange}
                    placeholder="Confirm your password"
                    className="w-full pl-10 pr-12 py-3 bg-ide-bg border border-ide-border rounded-lg text-ide-text placeholder-ide-text-muted focus:outline-none focus:ring-2 focus:ring-ide-accent focus:border-transparent transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ide-text-muted hover:text-ide-text transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formData.confirmPassword && (
                  <div className="flex items-center gap-2 text-xs">
                    {formData.password === formData.confirmPassword ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Passwords match
                      </span>
                    ) : (
                      <span className="text-red-400">Passwords do not match</span>
                    )}
                  </div>
                )}
              </div>

            

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2)
                    setError('')
                  }}
                  className="flex-1 py-3 px-4 bg-ide-bg border border-ide-border text-ide-text rounded-lg font-medium hover:bg-ide-border transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-ide-accent to-ide-accent-hover text-white rounded-lg font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ide-accent focus:ring-offset-2 focus:ring-offset-ide-panel transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Divider */}
          {step === 1 && (
            <>
              <div className="mt-6 mb-6 flex items-center gap-4">
                <div className="flex-1 h-px bg-ide-border"></div>
                <span className="text-sm text-ide-text-muted">OR</span>
                <div className="flex-1 h-px bg-ide-border"></div>
              </div>

              {/* Sign In Link */}
              <div className="text-center">
                <p className="text-sm text-ide-text-muted">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="text-ide-accent hover:text-ide-accent-hover font-medium transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-ide-text-muted">
          Secure authentication powered by EarthCode
        </p>
      </div>
    </div>
  )
}
