// src/context/AuthContext.jsx
// Global auth state — stores user object and JWT token
// Provides: user, token, login(), register(), logout(), updateUser()
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../api/auth'

const AuthContext = createContext(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null)
  const [token, setToken]         = useState(() => localStorage.getItem('token') || null)
  const [loading, setLoading]     = useState(true)  // true until we verify the stored token

  // ── On mount: verify stored token by calling GET /api/auth/me ───────────
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) { setLoading(false); return }
      try {
        const { data } = await authAPI.getMe()
        setUser(data.user)
      } catch {
        // Token invalid or expired — clear it
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    verifyToken()
  }, []) // Run once on mount

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login({ email, password })
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data
  }, [])

  // ── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(async (formData) => {
    const { data } = await authAPI.register(formData)
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  // ── Update user in context after profile edit ─────────────────────────────
  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser)
  }, [])

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
