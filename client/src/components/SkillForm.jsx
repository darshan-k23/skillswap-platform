// src/components/SkillForm.jsx
// Modal/inline form for adding a new skill
import React, { useState } from 'react'
import { skillsAPI } from '../api/skills'
import toast from 'react-hot-toast'

const CATEGORIES = ['Programming', 'Design', 'Music', 'Sports', 'Language', 'Math', 'Science', 'Art', 'Writing', 'General', 'Other']

const SkillForm = ({ onSuccess, onCancel }) => {
  const [form, setForm] = useState({
    name:        '',
    type:        'offer',
    description: '',
    category:    'General',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Skill name is required'); return }

    setLoading(true)
    try {
      const { data } = await skillsAPI.create(form)
      toast.success(`Skill "${data.skill.name}" added!`)
      onSuccess(data.skill)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to add skill'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="section-title">Add a Skill</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Skill Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="e.g. React Development, Guitar, French..."
          className="input"
          maxLength={60}
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
        <div className="grid grid-cols-2 gap-3">
          {['offer', 'want'].map((t) => (
            <label
              key={t}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200
                ${form.type === t
                  ? t === 'offer'
                    ? 'border-green-500 bg-green-50'
                    : 'border-violet-500 bg-violet-50'
                  : 'border-slate-200 hover:border-slate-300'
                }`}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={form.type === t}
                onChange={handleChange}
                className="sr-only"
              />
              <span className="text-lg">{t === 'offer' ? '✅' : '🙏'}</span>
              <div>
                <p className="text-sm font-semibold capitalize">{t}</p>
                <p className="text-xs text-slate-500">
                  {t === 'offer' ? 'I can teach this' : 'I want to learn this'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
        <select name="category" value={form.category} onChange={handleChange} className="input">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Description <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Briefly describe your skill level or what you're looking for..."
          rows={2}
          maxLength={200}
          className="input resize-none"
        />
        <p className="text-xs text-slate-400 mt-1">{form.description.length}/200</p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Adding...
            </span>
          ) : 'Add Skill'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default SkillForm
