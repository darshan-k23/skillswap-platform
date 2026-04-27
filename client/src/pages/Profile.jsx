// src/pages/Profile.jsx
// My profile (or any user's profile) — view/edit info, manage skills
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usersAPI } from '../api/users'
import { skillsAPI } from '../api/skills'
import SkillCard from '../components/SkillCard'
import SkillForm from '../components/SkillForm'
import SendRequestModal from '../components/SendRequestModal'
import toast from 'react-hot-toast'

const YEAR_OPTIONS = ['', 'FE', 'SE', 'TE', 'BE']

const Profile = () => {
  const { id } = useParams()                     // undefined = own profile
  const { user: me, updateUser } = useAuth()
  const isOwnProfile = !id || id === me?._id
  const navigate = useNavigate()

  const [profileUser, setProfileUser] = useState(null)
  const [skills,      setSkills]      = useState([])
  const [loading,     setLoading]     = useState(true)

  // Edit mode state
  const [editing,  setEditing]  = useState(false)
  const [editForm, setEditForm] = useState({ name: '', bio: '', college: '', year: '' })
  const [saving,   setSaving]   = useState(false)

  // Add skill form toggle
  const [showAddSkill, setShowAddSkill] = useState(false)

  // Send request modal
  const [showRequest, setShowRequest] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)
      try {
        const targetId = id || me?._id
        const [userRes, skillsRes] = await Promise.all([
          usersAPI.getById(targetId),
          skillsAPI.getAll({ userId: targetId }),
        ])
        setProfileUser(userRes.data.user)
        setSkills(skillsRes.data.skills || [])
      } catch {
        toast.error('Failed to load profile')
        navigate('/')
      } finally {
        setLoading(false)
      }
    }
    if (me) loadProfile()
  }, [id, me?._id])

  const startEdit = () => {
    setEditForm({
      name:    profileUser?.name    || '',
      bio:     profileUser?.bio     || '',
      college: profileUser?.college || '',
      year:    profileUser?.year    || '',
    })
    setEditing(true)
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) { toast.error('Name cannot be empty'); return }
    setSaving(true)
    try {
      const { data } = await usersAPI.update(me._id, editForm)
      setProfileUser(data.user)
      updateUser(data.user)   // Sync with AuthContext
      setEditing(false)
      toast.success('Profile updated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSkillAdded = (newSkill) => {
    setSkills((prev) => [newSkill, ...prev])
    setShowAddSkill(false)
  }

  const handleDeleteSkill = async (skillId) => {
    if (!window.confirm('Delete this skill?')) return
    try {
      await skillsAPI.remove(skillId)
      setSkills((prev) => prev.filter((s) => s._id !== skillId))
      toast.success('Skill deleted')
    } catch {
      toast.error('Failed to delete skill')
    }
  }

  const getInitials = (name = '') =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const offerSkills = skills.filter((s) => s.type === 'offer')
  const wantSkills  = skills.filter((s) => s.type === 'want')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* ── Profile Header Card ───────────────────────────────────────────── */}
      <div className="card">
        {editing ? (
          /* ── Edit Form ──────────────────────────────────────────────── */
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <h2 className="section-title">Edit Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="input"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">College</label>
                <input
                  type="text"
                  value={editForm.college}
                  onChange={(e) => setEditForm((p) => ({ ...p, college: e.target.value }))}
                  className="input"
                  placeholder="e.g. VESIT"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Year</label>
                <select
                  value={editForm.year}
                  onChange={(e) => setEditForm((p) => ({ ...p, year: e.target.value }))}
                  className="input"
                >
                  {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y || 'Select'}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Bio</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                rows={3}
                maxLength={300}
                className="input resize-none"
                placeholder="Tell others about yourself..."
              />
              <p className="text-xs text-slate-400 mt-1">{editForm.bio.length}/300</p>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          /* ── View Mode ──────────────────────────────────────────────── */
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {profileUser?.avatar
                  ? <img src={profileUser.avatar} alt={profileUser.name} className="w-24 h-24 rounded-2xl object-cover" />
                  : getInitials(profileUser?.name)
                }
              </div>
              {isOwnProfile && (
                <button onClick={startEdit} className="text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors">
                  ✏️ Edit Profile
                </button>
              )}
              {!isOwnProfile && (
                <button onClick={() => setShowRequest(true)} className="btn-primary text-sm py-2 px-4">
                  🤝 Exchange
                </button>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{profileUser?.name}</h1>
                  <p className="text-slate-500 text-sm">{profileUser?.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {profileUser?.college && (
                    <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-medium">
                      🏫 {profileUser.college}
                    </span>
                  )}
                  {profileUser?.year && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-3 py-1.5 rounded-full font-medium">
                      📅 {profileUser.year}
                    </span>
                  )}
                </div>
              </div>
              {profileUser?.bio ? (
                <p className="mt-3 text-slate-600 text-sm leading-relaxed">{profileUser.bio}</p>
              ) : isOwnProfile ? (
                <p className="mt-3 text-slate-400 text-sm italic">
                  No bio yet. <button onClick={startEdit} className="text-primary-600 underline">Add one!</button>
                </p>
              ) : null}

              {/* Skill count summary */}
              <div className="flex gap-4 mt-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">✅</span>
                  <span className="text-sm font-semibold text-slate-700">{offerSkills.length}</span>
                  <span className="text-xs text-slate-500">offering</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">🙏</span>
                  <span className="text-sm font-semibold text-slate-700">{wantSkills.length}</span>
                  <span className="text-xs text-slate-500">looking for</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Skills Section ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Skills</h2>
          {isOwnProfile && !showAddSkill && (
            <button onClick={() => setShowAddSkill(true)} className="btn-primary text-sm py-2">
              + Add Skill
            </button>
          )}
        </div>

        {/* Add Skill Form */}
        {showAddSkill && (
          <div className="card mb-5">
            <SkillForm onSuccess={handleSkillAdded} onCancel={() => setShowAddSkill(false)} />
          </div>
        )}

        {/* Offer skills */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>✅</span> Offers ({offerSkills.length})
          </h3>
          {offerSkills.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
              <p className="text-slate-400 text-sm">
                {isOwnProfile ? 'No skills listed yet. Add what you can teach!' : 'No skills offered yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {offerSkills.map((skill) => (
                <SkillCard
                  key={skill._id}
                  skill={skill}
                  onDelete={isOwnProfile ? handleDeleteSkill : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Want skills */}
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>🙏</span> Wants to Learn ({wantSkills.length})
          </h3>
          {wantSkills.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
              <p className="text-slate-400 text-sm">
                {isOwnProfile ? 'Add skills you want to learn!' : 'No learning interests listed.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {wantSkills.map((skill) => (
                <SkillCard
                  key={skill._id}
                  skill={skill}
                  onDelete={isOwnProfile ? handleDeleteSkill : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Send Request Modal */}
      {showRequest && profileUser && (
        <SendRequestModal
          targetUser={profileUser}
          onClose={() => setShowRequest(false)}
        />
      )}
    </div>
  )
}

export default Profile
