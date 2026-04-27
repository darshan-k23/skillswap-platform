// src/pages/Requests.jsx
// Manage incoming and outgoing exchange requests
import React, { useEffect, useState, useCallback } from 'react'
import { requestsAPI } from '../api/requests'
import { useAuth } from '../context/AuthContext'
import RequestCard from '../components/RequestCard'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'all',      label: 'All',      icon: '📋' },
  { id: 'received', label: 'Received', icon: '📥' },
  { id: 'sent',     label: 'Sent',     icon: '📤' },
]

const STATUS_FILTERS = [
  { value: '',         label: 'All Status' },
  { value: 'pending',  label: '⏳ Pending' },
  { value: 'accepted', label: '✅ Accepted' },
  { value: 'declined', label: '❌ Declined' },
]

const Requests = () => {
  const { user } = useAuth()
  const [requests,     setRequests]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState('all')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (activeTab !== 'all') params.direction = activeTab
      if (statusFilter)        params.status    = statusFilter

      const { data } = await requestsAPI.getAll(params)
      setRequests(data.requests || [])
    } catch {
      toast.error('Failed to load requests')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, statusFilter])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const handleAccept = async (id) => {
    try {
      await requestsAPI.update(id, { status: 'accepted' })
      toast.success('Request accepted! 🎉')
      setRequests((prev) =>
        prev.map((r) => r._id === id ? { ...r, status: 'accepted' } : r)
      )
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept request')
    }
  }

  const handleDecline = async (id) => {
    try {
      await requestsAPI.update(id, { status: 'declined' })
      toast.success('Request declined')
      setRequests((prev) =>
        prev.map((r) => r._id === id ? { ...r, status: 'declined' } : r)
      )
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to decline request')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Cancel this request?')) return
    try {
      await requestsAPI.remove(id)
      toast.success('Request cancelled')
      setRequests((prev) => prev.filter((r) => r._id !== id))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete request')
    }
  }

  // Count per tab
  const allCount      = requests.length
  const pendingCount  = requests.filter((r) => r.status === 'pending' && r.receiverId?._id === user?._id).length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title mb-1">Exchange Requests</h1>
          <p className="text-slate-500 text-sm">Manage your skill exchange requests</p>
        </div>
        {pendingCount > 0 && (
          <div className="bg-amber-100 text-amber-800 text-sm font-semibold px-4 py-2 rounded-xl border border-amber-200">
            ⏳ {pendingCount} new request{pendingCount !== 1 ? 's' : ''} waiting
          </div>
        )}
      </div>

      {/* Tabs + Filter row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tab buttons */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
                }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input sm:w-44"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Requests list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-200" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-16 bg-slate-200 rounded-xl" />
                <div className="h-16 bg-slate-200 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-5xl mb-4">
            {activeTab === 'received' ? '📭' : activeTab === 'sent' ? '📪' : '🤝'}
          </p>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            {activeTab === 'received' ? 'No requests received yet'
              : activeTab === 'sent'   ? 'You haven\'t sent any requests'
              : 'No requests yet'}
          </h3>
          <p className="text-slate-400 text-sm">
            {activeTab !== 'received'
              ? 'Browse students to find someone to exchange skills with!'
              : 'Once someone sends you a request, it will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <RequestCard
              key={req._id}
              request={req}
              onAccept={handleAccept}
              onDecline={handleDecline}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Requests
