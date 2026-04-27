// src/pages/Browse.jsx
// Browse all users and their skills — with search + filter; send exchange requests
import React, { useEffect, useState, useCallback } from 'react'
import { usersAPI } from '../api/users'
import { useAuth } from '../context/AuthContext'
import UserCard from '../components/UserCard'
import SendRequestModal from '../components/SendRequestModal'

const YEAR_OPTIONS = ['', 'FE', 'SE', 'TE', 'BE']

const Browse = () => {
  const { user } = useAuth()
  const [users,         setUsers]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [filterYear,    setFilterYear]    = useState('')
  const [filterCollege, setFilterCollege] = useState('')
  const [selectedUser,  setSelectedUser]  = useState(null)  // user for SendRequestModal

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search)        params.search  = search
      if (filterYear)    params.year    = filterYear
      if (filterCollege) params.college = filterCollege

      const { data } = await usersAPI.getAll(params)
      // Exclude current user from the list
      setUsers((data.users || []).filter((u) => u._id !== user._id))
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [search, filterYear, filterCollege, user._id])

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 400) // Debounce search
    return () => clearTimeout(timer)
  }, [fetchUsers])

  const handleSendRequest = (targetUser) => {
    setSelectedUser(targetUser)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="page-title mb-1">Browse Students</h1>
        <p className="text-slate-500">Find classmates to exchange skills with</p>
      </div>

      {/* Filters */}
      <div className="card mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or bio..."
              className="input pl-10"
            />
          </div>
          {/* College filter */}
          <input
            type="text"
            value={filterCollege}
            onChange={(e) => setFilterCollege(e.target.value)}
            placeholder="Filter by college..."
            className="input sm:w-48"
          />
          {/* Year filter */}
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="input sm:w-36"
          >
            <option value="">All years</option>
            {YEAR_OPTIONS.filter(Boolean).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {/* Clear */}
          {(search || filterYear || filterCollege) && (
            <button
              onClick={() => { setSearch(''); setFilterYear(''); setFilterCollege('') }}
              className="btn-secondary text-sm px-4 whitespace-nowrap"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-sm text-slate-500 mb-4">
          Showing <strong className="text-slate-700">{users.length}</strong> student{users.length !== 1 ? 's' : ''}
          {search && ` matching "${search}"`}
        </p>
      )}

      {/* User grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-slate-200" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-slate-200 rounded mb-2" />
              <div className="h-3 bg-slate-200 rounded w-4/5 mb-4" />
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-slate-200 rounded-full" />
                <div className="h-6 w-20 bg-slate-200 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-5xl mb-4">🔍</p>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No students found</h3>
          <p className="text-slate-400 text-sm">
            {search || filterYear || filterCollege
              ? 'Try adjusting your filters'
              : 'No other students have registered yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {users.map((u) => (
            <UserCard key={u._id} user={u} onSendRequest={handleSendRequest} />
          ))}
        </div>
      )}

      {/* SendRequestModal */}
      {selectedUser && (
        <SendRequestModal
          targetUser={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSuccess={() => setSelectedUser(null)}
        />
      )}
    </div>
  )
}

export default Browse
