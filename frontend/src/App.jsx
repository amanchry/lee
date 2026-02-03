import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import ScriptView from './pages/ScriptView'

function App() {
  const [theme, setTheme] = useState('dark')
  const [user, setUser] = useState(() => {
    // Check localStorage for saved user
    const savedUser = localStorage.getItem('earthcode_user')
    return savedUser ? JSON.parse(savedUser) : null
  })

  // Set initial theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.body.setAttribute('data-theme', theme)
  }, [])

  // Update theme when it changes
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-theme', theme)
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  // Save user to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('earthcode_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('earthcode_user')
    }
  }, [user])

  const handleThemeToggle = () => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark'
      return newTheme
    })
  }

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    setUser(null)
  }

  // Protected Route Component
  const ProtectedRoute = ({ children }) => {
    return user ? children : <Navigate to="/login" replace />
  }

  // Public Route Component (redirect to dashboard if already logged in)
  const PublicRoute = ({ children }) => {
    return !user ? children : <Navigate to="/" replace />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login onLogin={handleLogin} />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Signup onLogin={handleLogin} />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard 
                user={user} 
                theme={theme} 
                onThemeToggle={handleThemeToggle}
                onLogout={handleLogout}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/script/:id"
          element={<ScriptView user={user} onLogin={handleLogin} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
