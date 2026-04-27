// src/components/RequestCard.jsx
// Displays a single exchange request with accept/decline actions
import React from 'react'
import { useAuth } from '../context/AuthContext'

const statusConfig = {
  pending:  { label: 'Pending',  cls: 'badge-pending',  icon: '⏳' },
  accepted: { label: 'Accepted', cls: 'badge-accepted', icon: '✅' },
  declined: { label: 'Declined', cls: 'badge-declined', icon: '❌' },
}

const RequestCard = ({ request, onAccept, onDecline, onDelete }) => {
  const { user } = useAuth()
  const isSender   = request.senderId?._id === user?._id
  const isReceiver = request.receiverId?._id === user?._id
  const status     = statusConfig[request.status] || statusConfig.pending

  const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getInitials = (name = '') =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  // The other person in this exchange
  const otherPerson = isSender ? request.receiverId : request.senderId

  return (
    <div className="card border-l-4 hover:shadow-md transition-all duration-200
      border-l-slate-300
      data-[status=accepted]:border-l-green-400
      data-[status=declined]:border-l-red-400
      data-[status=pending]:border-l-amber-400"
      data-status={request.status}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {/* Other person's avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {otherPerson?.avatar
              ? <img src={otherPerson.avatar} alt={otherPerson.name} className="w-10 h-10 rounded-full object-cover" />
              : getInitials(otherPerson?.name || '?')
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{otherPerson?.name || 'Unknown'}</p>
            <p className="text-xs text-slate-500">
              {isSender ? 'You sent this request' : 'Sent you a request'}
              {' · '}
              {formatDate(request.createdAt)}
            </p>
          </div>
        </div>
        {/* Status badge */}
        <span className={`${status.cls} flex-shrink-0`}>
          {status.icon} {status.label}
        </span>
      </div>

      {/* Skill exchange details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Offered skill */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-green-700 mb-1">
            {isSender ? '✅ You offer' : '✅ They offer'}
          </p>
          <p className="text-sm font-medium text-slate-800">
            {request.offeredSkillId?.name || 'Unknown skill'}
          </p>
          {request.offeredSkillId?.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {request.offeredSkillId.description}
            </p>
          )}
        </div>

        {/* Wanted skill */}
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-violet-700 mb-1">
            {isSender ? '🙏 In exchange for' : '🙏 In exchange for'}
          </p>
          <p className="text-sm font-medium text-slate-800">
            {request.wantedSkillId?.name || 'Unknown skill'}
          </p>
          {request.wantedSkillId?.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {request.wantedSkillId.description}
            </p>
          )}
        </div>
      </div>

      {/* Message */}
      {request.message && (
        <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-200">
          <p className="text-xs text-slate-500 italic">"{request.message}"</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Receiver can accept/decline pending requests */}
        {isReceiver && request.status === 'pending' && (
          <>
            <button
              onClick={() => onAccept(request._id)}
              className="btn-primary text-sm py-2 px-5"
            >
              ✅ Accept
            </button>
            <button
              onClick={() => onDecline(request._id)}
              className="btn-danger text-sm py-2 px-5"
            >
              ❌ Decline
            </button>
          </>
        )}

        {/* Sender can delete pending requests */}
        {isSender && request.status === 'pending' && onDelete && (
          <button
            onClick={() => onDelete(request._id)}
            className="text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 px-4 py-2 rounded-lg transition-colors"
          >
            🗑️ Cancel
          </button>
        )}

        {/* Accepted status message */}
        {request.status === 'accepted' && (
          <span className="text-sm text-green-700 font-medium flex items-center gap-1">
            🎉 Exchange agreed! Connect with {otherPerson?.name?.split(' ')[0]} to get started.
          </span>
        )}
      </div>
    </div>
  )
}

export default RequestCard
