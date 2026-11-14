// src/pages/Profile.jsx
// My profile (or any user's profile) — view/edit info, manage skills, and S3 avatar upload
import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usersAPI } from '../api/users'
import { skillsAPI } from '../api/skills'
import SkillCard from '../components/SkillCard'
import SkillForm from '../components/SkillForm'
import SendRequestModal from '../components/SendRequestModal'
import Avatar from '../components/Avatar'
import toast from 'react-hot-toast'

const YEAR_OPTIONS = ['', 'FE', 'SE', 'TE', 'BE']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB

const Profile = () => {
  const { id } = useParams() // undefined = own profile
  const { user: me, updateUser } = useAuth()
  const isOwnProfile = !id || id === me?._id
  const navigate = useNavigate()

  const [profileUser, setProfileUser] = useState(null)
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)

  // Edit mode state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', bio: '', college: '', year: '' })
  const [saving, setSaving] = useState(false)

  // Avatar upload state
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [removingAvatar, setRemovingAvatar] = useState(false)

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

  // Cleanup object preview URL when unmounting or changing preview
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const startEdit = () => {
    setEditForm({
      name: profileUser?.name || '',
      bio: profileUser?.bio || '',
      college: profileUser?.college || '',
      year: profileUser?.year || '',
    })
    setEditing(true)
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    setSaving(true)
    try {
      const { data } = await usersAPI.update(me._id, editForm)
      setProfileUser(data.user)
      updateUser(data.user) // Sync with AuthContext
      setEditing(false)
      toast.success('Profile updated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  // ── S3 Avatar Handlers ───────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, or WebP image.')
      e.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Image size must be less than 5 MB.')
      e.target.value = ''
      return
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleCancelFile = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadAvatar = async () => {
    if (!selectedFile || !me?._id) return

    setUploading(true)
    setUploadProgress(0)

    try {
      // Step 2 & 3: Request upload authorization from Express backend
      const { data: authData } = await usersAPI.requestAvatarUpload(me._id, {
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
      })

      // Step 5: Upload directly to S3 via presigned POST with progress tracking
      await usersAPI.uploadToS3(
        authData.uploadUrl,
        authData.fields,
        selectedFile,
        (percent) => setUploadProgress(percent)
      )

      // Step 6 & 7 & 8: Call completion endpoint to verify with HeadObject & save to DB
      const { data: confirmData } = await usersAPI.confirmAvatarUpload(me._id, {
        key: authData.key,
      })

      setProfileUser(confirmData.user)
      updateUser(confirmData.user) // Sync globally to AuthContext (refreshes Navbar instantly)

      handleCancelFile()
      toast.success('Profile photo updated successfully!')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload profile photo'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Remove profile photo and revert to initials?')) return

    setRemovingAvatar(true)
    try {
      const { data } = await usersAPI.deleteAvatar(me._id)
      setProfileUser(data.user)
      updateUser(data.user) // Sync with AuthContext
      handleCancelFile()
      toast.success('Profile photo removed')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove profile photo')
    } finally {
      setRemovingAvatar(false)
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
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const offerSkills = skills.filter((s) => s.type === 'offer')
  const wantSkills = skills.filter((s) => s.type === 'want')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Profile Header Card ───────────────────────────────────────────── */}
      <div className="card">
        {editing ? (
          /* ── Edit Form ──────────────────────────────────────────────── */
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <h2 className="section-title">Edit Profile</h2>

            {/* Avatar section inside edit form */}
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <Avatar
                src={previewUrl || profileUser?.avatar}
                name={profileUser?.name}
                size="lg"
                rounded="rounded-xl"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700">Profile Photo</p>
                <p className="text-xs text-slate-500">JPG, PNG, or WebP up to 5 MB</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selectedFile ? (
                    <>
                      <button
                        type="button"
                        onClick={handleUploadAvatar}
                        disabled={uploading}
                        className="btn-primary text-xs py-1 px-3"
                      >
                        {uploading ? `Uploading (${uploadProgress}%)` : '☁️ Save Photo'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelFile}
                        disabled={uploading}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg"
                      >
                        📷 Choose Image
                      </button>
                      {profileUser?.avatar && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          disabled={removingAvatar}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          {removingAvatar ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

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
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y || 'Select'}
                    </option>
                  ))}
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
              <button type="submit" disabled={saving || uploading} className="btn-primary">
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
            {/* Avatar & Controls */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3">
              <Avatar
                src={previewUrl || profileUser?.avatar}
                name={profileUser?.name}
                size="xl"
                rounded="rounded-2xl"
              >
                {/* Uploading progress overlay */}
                {uploading && (
                  <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-center text-white p-2">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-1" />
                    <span className="text-[10px] font-semibold">{uploadProgress}%</span>
                  </div>
                )}
              </Avatar>

              {/* Hidden file input */}
              {isOwnProfile && (
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
              )}

              {/* File selected actions */}
              {isOwnProfile && selectedFile && (
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={handleUploadAvatar}
                    disabled={uploading}
                    className="w-full text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1"
                  >
                    {uploading ? `Uploading (${uploadProgress}%)` : '☁️ Save Photo'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelFile}
                    disabled={uploading}
                    className="text-xs text-slate-500 hover:text-slate-700 underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Standard buttons when no file is chosen */}
              {isOwnProfile && !selectedFile && (
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || removingAvatar}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors w-full text-center"
                  >
                    📷 Change Photo
                  </button>
                  {profileUser?.avatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={uploading || removingAvatar}
                      className="text-[11px] text-red-500 hover:text-red-700 transition-colors"
                    >
                      {removingAvatar ? 'Removing...' : '🗑️ Remove'}
                    </button>
                  )}
                  <button
                    onClick={startEdit}
                    className="text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors w-full text-center"
                  >
                    ✏️ Edit Profile
                  </button>
                </div>
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
                  No bio yet.{' '}
                  <button onClick={startEdit} className="text-primary-600 underline">
                    Add one!
                  </button>
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
        <SendRequestModal targetUser={profileUser} onClose={() => setShowRequest(false)} />
      )}
    </div>
  )
}

export default Profile
