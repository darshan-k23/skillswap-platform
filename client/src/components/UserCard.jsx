// src/components/UserCard.jsx
// Displays a user summary card with their skills — used on Browse page
import React from 'react'
import { Link } from 'react-router-dom'

const UserCard = ({ user, onSendRequest }) => {
  const offerSkills = (user.skills || []).filter((s) => s.type === 'offer')
  const wantSkills  = (user.skills || []).filter((s) => s.type === 'want')

  const getInitials = (name = '') =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="card hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm">
            {user.avatar
              ? <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
              : getInitials(user.name)
            }
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 text-base truncate">{user.name}</h3>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {user.college && <span className="text-xs text-slate-500 truncate max-w-[140px]">{user.college}</span>}
              {user.year    && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{user.year}</span>}
            </div>
          </div>
        </div>
        <Link
          to={`/profile/${user._id}`}
          className="text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          View
        </Link>
      </div>

      {/* Bio */}
      {user.bio && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{user.bio}</p>
      )}

      {/* Skills */}
      <div className="space-y-2">
        {/* Offers */}
        {offerSkills.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
              <span>✅</span> Offers
            </p>
            <div className="flex flex-wrap gap-1.5">
              {offerSkills.slice(0, 4).map((s) => (
                <span
                  key={s._id}
                  className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full border border-green-200"
                >
                  {s.name}
                </span>
              ))}
              {offerSkills.length > 4 && (
                <span className="text-xs text-slate-400">+{offerSkills.length - 4} more</span>
              )}
            </div>
          </div>
        )}

        {/* Wants */}
        {wantSkills.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-violet-700 mb-1.5 flex items-center gap-1">
              <span>🙏</span> Looking for
            </p>
            <div className="flex flex-wrap gap-1.5">
              {wantSkills.slice(0, 4).map((s) => (
                <span
                  key={s._id}
                  className="text-xs bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full border border-violet-200"
                >
                  {s.name}
                </span>
              ))}
              {wantSkills.length > 4 && (
                <span className="text-xs text-slate-400">+{wantSkills.length - 4} more</span>
              )}
            </div>
          </div>
        )}

        {offerSkills.length === 0 && wantSkills.length === 0 && (
          <p className="text-xs text-slate-400 italic">No skills listed yet</p>
        )}
      </div>

      {/* Action button */}
      {onSendRequest && (
        <button
          onClick={() => onSendRequest(user)}
          className="btn-primary w-full text-sm py-2"
        >
          🤝 Request Exchange
        </button>
      )}
    </div>
  )
}

export default UserCard
