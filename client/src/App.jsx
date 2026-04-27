// src/App.jsx
// Root component — defines all routes with ProtectedRoute
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Layout
import Navbar from './components/Navbar'

// Pages
import Home     from './pages/Home'
import Login    from './pages/Login'
import Register from './pages/Register'
import Browse   from './pages/Browse'
import Profile  from './pages/Profile'
import Requests from './pages/Requests'

// ── ProtectedRoute: redirects to /login if not authenticated ─────────────────
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

// ── PublicOnlyRoute: redirects to / if already authenticated ─────────────────
const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return !isAuthenticated ? children : <Navigate to="/" replace />
}

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="pt-16">
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<Home />} />

          {/* Public routes */}
          <Route path="/login"    element={<PublicOnlyRoute><Login    /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />

          {/* Protected routes */}
          <Route path="/browse"    element={<ProtectedRoute><Browse   /></ProtectedRoute>} />
          <Route path="/requests"  element={<ProtectedRoute><Requests /></ProtectedRoute>} />
          <Route path="/profile"   element={<ProtectedRoute><Profile  /></ProtectedRoute>} />
          <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
