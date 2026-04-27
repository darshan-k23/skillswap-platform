// src/components/SendRequestModal.jsx
// Modal dialog to send a skill exchange request to another user
import React, { useState, useEffect } from 'react'
import { skillsAPI } from '../api/skills'
import { requestsAPI } from '../api/requests'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const SendRequestModal = ({ targetUser, onClose, onSuccess }) => {
  const { user } = useAuth()
  const [mySkills,   setMySkills]   = useState([])
  const [theirSkills, setTheirSkills] = useState([])
  const [form, setForm] = useState({
    offeredSkillId: '',
    wantedSkillId:  '',
    message:        '',
  })
  const [loading,    setLoading]    = useState(false)
  const [fetching,   setFetching]   = useState(true)
  const [error,      setError]      = useState('')

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const [myRes, theirRes] = await Promise.all([
          skillsAPI.getAll({ userId: user._id, type: 'offer' }),
          skillsAPI.getAll({ userId: targetUser._id }),
        ])
        setMySkills(myRes.data.skills)
        setTheirSkills(theirRes.data.skills.filter((s) => s.type === 'offer'))
      } catch {
        toast.error('Failed to load skills')
      } finally {
        setFetching(false)
      }
    }
    fetchSkills()
  }, [user._id, targetUser._id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.offeredSkillId || !form.wantedSkillId) {
      setError('Please select both skills')
      return
    }

    setLoading(true)
    try {
      await requestsAPI.create({
        receiverId:     targetUser._id,
        offeredSkillId: form.offeredSkillId,
        wantedSkillId:  form.wantedSkillId,
        message:        form.message,
      })
      toast.success(`Request sent to ${targetUser.name}!`)
      onSuccess?.()
      onClose()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send request'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-[fadeIn_0.2s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Request Exchange</h2>
            <p className="text-sm text-slate-500">with {targetUser.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* My skill to offer */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                ✅ Skill you offer <span className="text-red-500">*</span>
              </label>
              {mySkills.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-xl border border-amber-200">
                  You have no skills listed as "offer". Add some from your profile first.
                </p>
              ) : (
                <select
                  value={form.offeredSkillId}
                  onChange={(e) => setForm((p) => ({ ...p, offeredSkillId: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">Select a skill you offer...</option>
                  {mySkills.map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              )}
            </div>

            {/* Their skill you want */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                🙏 Skill you want from {targetUser.name} <span className="text-red-500">*</span>
              </label>
              {theirSkills.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
                  {targetUser.name} hasn't listed any skills to offer yet.
                </p>
              ) : (
                <select
                  value={form.wantedSkillId}
                  onChange={(e) => setForm((p) => ({ ...p, wantedSkillId: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">Select a skill they offer...</option>
                  {theirSkills.map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              )}
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Message <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Introduce yourself or explain what you'd like to learn..."
                rows={3}
                maxLength={300}
                className="input resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={loading || mySkills.length === 0 || theirSkills.length === 0}
                className="btn-primary flex-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : '🤝 Send Request'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default SendRequestModal
