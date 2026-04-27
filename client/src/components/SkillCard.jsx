// src/components/SkillCard.jsx
// Displays a single skill badge — used in Browse and Profile pages
import React from 'react'

const categoryEmoji = {
  Programming: '💻',
  Design:      '🎨',
  Music:       '🎵',
  Sports:      '⚽',
  Language:    '🌍',
  Math:        '📐',
  Science:     '🔬',
  Art:         '🖼️',
  Writing:     '✍️',
  General:     '🌟',
  Other:       '📦',
}

const SkillCard = ({ skill, onDelete, showOwner = false }) => {
  return (
    <div
      className={`group relative flex flex-col gap-2 p-4 rounded-xl border transition-all duration-200 hover:shadow-md
        ${skill.type === 'offer'
          ? 'border-green-200 bg-green-50 hover:border-green-300'
          : 'border-violet-200 bg-violet-50 hover:border-violet-300'
        }`}
    >
      {/* Top row: badge + delete btn */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={skill.type === 'offer' ? 'badge-offer' : 'badge-want'}>
            {skill.type === 'offer' ? '✅ Offers' : '🙏 Wants'}
          </span>
          {skill.category && skill.category !== 'General' && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <span>{categoryEmoji[skill.category] || '📦'}</span>
              <span>{skill.category}</span>
            </span>
          )}
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(skill._id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all duration-200"
            title="Delete skill"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Skill name */}
      <h3 className="font-semibold text-slate-800 text-sm leading-snug">{skill.name}</h3>

      {/* Description */}
      {skill.description && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{skill.description}</p>
      )}

      {/* Owner info (shown on Browse page) */}
      {showOwner && skill.userId && (
        <div className="mt-1 pt-2 border-t border-white/60 flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-bold">
            {(skill.userId.name || '?')[0].toUpperCase()}
          </div>
          <span className="text-xs text-slate-600 font-medium truncate">{skill.userId.name}</span>
          {skill.userId.year && (
            <span className="text-xs text-slate-400">{skill.userId.year}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default SkillCard
