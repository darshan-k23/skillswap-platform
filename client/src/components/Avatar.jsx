// src/components/Avatar.jsx
// Reusable Avatar component with graceful fallback to initials on load/expiration error
import React, { useState, useEffect } from 'react'

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

const sizeConfig = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-10 h-10 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
}

const Avatar = ({
  src,
  name = '',
  size = 'md',
  rounded = 'rounded-full',
  className = '',
  children,
}) => {
  const [hasError, setHasError] = useState(false)

  // Reset error state if image source changes
  useEffect(() => {
    setHasError(false)
  }, [src])

  const sizeClass = sizeConfig[size] || sizeConfig.md

  return (
    <div
      className={`relative ${sizeClass} ${rounded} bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden shadow-sm ${className}`}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          onError={() => setHasError(true)}
          className={`w-full h-full ${rounded} object-cover`}
        />
      ) : (
        getInitials(name)
      )}
      {children}
    </div>
  )
}

export default Avatar
