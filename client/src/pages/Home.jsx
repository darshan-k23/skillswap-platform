// src/pages/Home.jsx
// Home page — public landing experience with an authenticated dashboard section
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { skillsAPI } from '../api/skills'
import { requestsAPI } from '../api/requests'

const LANDING_CARDS = [
  {
    icon: '🎯',
    title: 'Teach what you already know',
    text: 'Share practical skills, class notes, or creative know-how with students who actually need it.',
  },
  {
    icon: '🔍',
    title: 'Find the right person fast',
    text: 'Browse profiles by year, college, and interests so the exchange feels targeted instead of random.',
  },
  {
    icon: '🤝',
    title: 'Swap without money',
    text: 'Set up fair skill-for-skill exchanges and keep learning moving without paying for every answer.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Create your profile',
    text: 'Add your college, year, bio, and the skills you can offer or want to learn.',
  },
  {
    step: '02',
    title: 'Browse smart matches',
    text: 'Search for students with the exact skill set you need and filter by your campus.',
  },
  {
    step: '03',
    title: 'Start the exchange',
    text: 'Send a request, agree on the swap, and get learning with someone real.',
  },
]

const POPULAR_SKILLS = [
  { name: 'Web Development', note: 'React, HTML, CSS, and JavaScript help' },
  { name: 'Design Basics', note: 'UI critique, Figma, and presentation polish' },
  { name: 'Coding Support', note: 'Problem solving, DSA, and debugging' },
  { name: 'Academic Notes', note: 'Summaries, exam prep, and study groups' },
  { name: 'Content Creation', note: 'Editing, thumbnails, and social media' },
  { name: 'Communication', note: 'Public speaking, interviews, and language practice' },
]

const StatCard = ({ label, value, icon, color }) => (
  <div className={`card flex items-center gap-4 ${color}`}>
    <div className="text-3xl">{icon}</div>
    <div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  </div>
)

const Home = () => {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [stats, setStats] = useState({ mySkills: 0, pending: 0, accepted: 0 })
  const [recentRequests, setRecentRequests] = useState([])
  const [latestSkills, setLatestSkills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetchDashboardData = async () => {
      if (!isAuthenticated || !user?._id) {
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const [skillsRes, reqRes] = await Promise.all([
          skillsAPI.getAll({ userId: user._id }),
          requestsAPI.getAll(),
        ])

        const allRequests = reqRes.data.requests || []
        const nextStats = {
          mySkills: skillsRes.data.skills?.length || 0,
          pending: allRequests.filter((r) => r.status === 'pending').length,
          accepted: allRequests.filter((r) => r.status === 'accepted').length,
        }

        const communityRes = await skillsAPI.getAll({ type: 'offer' })
        const nextSkills = (communityRes.data.skills || [])
          .filter((s) => s.userId?._id !== user._id)
          .slice(0, 6)

        if (!cancelled) {
          setStats(nextStats)
          setRecentRequests(allRequests.slice(0, 3))
          setLatestSkills(nextSkills)
        }
      } catch {
        // Silently fail — backend might not be running.
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (authLoading) return undefined

    fetchDashboardData()
    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, user?._id])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading SkillSwap...</p>
        </div>
      </div>
    )
  }

  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_42%),radial-gradient(circle_at_20%_20%,_rgba(34,197,94,0.14),_transparent_28%),linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(248,250,252,0.72))] pointer-events-none" />
      <div className="absolute top-24 left-[-6rem] h-64 w-64 rounded-full bg-primary-200/30 blur-3xl pointer-events-none" />
      <div className="absolute top-72 right-[-5rem] h-72 w-72 rounded-full bg-accent-200/30 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-16">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white/80 px-4 py-2 text-sm font-medium text-primary-700 shadow-sm backdrop-blur">
              <span>Campus-first skill exchange</span>
              <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
              <span>Built for students</span>
            </div>

            <div className="space-y-4 max-w-3xl">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-950 leading-[1.03]">
                Swap skills with people who can teach what you actually need.
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
                SkillSwap helps students trade knowledge, find study partners, and build real connections without paying for every lesson.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link to={isAuthenticated ? '/browse' : '/register'} className="btn-primary text-center text-base px-6 py-3">
                {isAuthenticated ? 'Find a Match' : 'Get Started'}
              </Link>
              <Link to={isAuthenticated ? '/profile' : '/login'} className="btn-secondary text-center text-base px-6 py-3">
                {isAuthenticated ? 'Manage Profile' : 'Log In'}
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { value: 'Skills', label: 'offered and wanted in one profile' },
                { value: 'Match', label: 'by year, college, and interests' },
                { value: 'Request', label: 'an exchange in a few clicks' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                  <p className="text-2xl font-black text-slate-900">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-500 leading-snug">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary-500/10 via-white to-accent-500/10 blur-xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Popular swaps</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">What students are trading</h2>
                </div>
                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-lg">
                  <p className="text-xs text-slate-300">Live energy</p>
                  <p className="text-lg font-bold">Campus mode</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {POPULAR_SKILLS.slice(0, 4).map((skill, index) => (
                  <div key={skill.name} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 text-white font-bold shadow-sm">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{skill.name}</p>
                      <p className="text-sm text-slate-500 truncate">{skill.note}</p>
                    </div>
                    <span className="badge-offer shrink-0">Popular</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3" id="why-it-works">
          {LANDING_CARDS.map((card) => (
            <div key={card.title} className="card group border-slate-200/70 bg-white/90 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-xl text-white shadow-lg transition-transform duration-200 group-hover:scale-105">
                {card.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.text}</p>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="space-y-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-600">How it works</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black text-slate-950">A simple flow that feels like a real campus exchange</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="card relative overflow-hidden border-slate-200/70 bg-white/90 shadow-sm">
                <div className="absolute right-4 top-4 text-5xl font-black text-slate-100">{item.step}</div>
                <p className="text-sm font-bold tracking-[0.24em] text-primary-600">STEP {item.step}</p>
                <h3 className="mt-3 text-xl font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-600">What you can swap</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950">The page should feel alive, not like a form.</h2>
            <p className="text-slate-600 leading-relaxed">
              The homepage now sells the idea first: useful exchanges, clear value, and a path into the app only when the user is ready.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {POPULAR_SKILLS.map((skill) => (
              <div key={skill.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-primary-300 hover:shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900">{skill.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{skill.note}</p>
                  </div>
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">Swap</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-600">Community snapshot</p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black text-slate-950">
                {isAuthenticated ? `Good ${getGreeting().split(' ')[1].toLowerCase()}, ${firstName}` : 'Build your own swap board'}
              </h2>
            </div>
            <p className="max-w-xl text-sm sm:text-base text-slate-600 leading-relaxed">
              {isAuthenticated
                ? 'Your personalized dashboard is below. Keep the top of the page welcoming, then jump into the actual work when you are ready.'
                : 'Once you sign up, this area becomes your dashboard with skills, requests, and the people you can learn from.'}
            </p>
          </div>

          {isAuthenticated ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="My Skills Listed" value={stats.mySkills} icon="🎯" color="hover:shadow-md transition-shadow" />
                <StatCard label="Pending Requests" value={stats.pending} icon="⏳" color="hover:shadow-md transition-shadow" />
                <StatCard label="Exchanges Accepted" value={stats.accepted} icon="🤝" color="hover:shadow-md transition-shadow" />
              </div>

              {recentRequests.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="section-title">Recent Requests</h3>
                    <Link to="/requests" className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
                      View all →
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {recentRequests.map((req) => {
                      const isReceiver = req.receiverId?._id === user?._id
                      const other = isReceiver ? req.senderId : req.receiverId
                      const statusColors = {
                        pending: 'border-amber-300 bg-amber-50',
                        accepted: 'border-green-300 bg-green-50',
                        declined: 'border-red-300 bg-red-50',
                      }

                      return (
                        <div key={req._id} className={`flex items-center gap-4 p-4 rounded-xl border ${statusColors[req.status] || ''}`}>
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {(other?.name || '?')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {isReceiver ? `${other?.name} wants to exchange` : `You sent to ${other?.name}`}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {req.offeredSkillId?.name} ⇄ {req.wantedSkillId?.name}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0
                              ${req.status === 'pending' ? 'bg-amber-100 text-amber-700' : ''}
                              ${req.status === 'accepted' ? 'bg-green-100 text-green-700' : ''}
                              ${req.status === 'declined' ? 'bg-red-100 text-red-700' : ''}
                            `}
                          >
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="section-title">Skills in the Community</h3>
                  <Link to="/browse" className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
                    Browse all →
                  </Link>
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[...Array(6)].map((_, index) => (
                      <div key={index} className="rounded-xl border border-slate-200 bg-white p-3 animate-pulse">
                        <div className="h-3 w-3/4 rounded bg-slate-200" />
                        <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
                        <div className="mt-3 h-5 w-16 rounded-full bg-slate-200" />
                      </div>
                    ))}
                  </div>
                ) : latestSkills.length === 0 ? (
                  <div className="card text-center py-10">
                    <p className="text-4xl mb-3">🌱</p>
                    <p className="text-slate-600 font-medium">No community skills yet</p>
                    <p className="text-slate-400 text-sm mt-1">Be the first to add your skills!</p>
                    <Link to="/profile" className="btn-primary inline-block mt-4 text-sm">
                      Add Your Skills
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {latestSkills.map((skill) => (
                      <div
                        key={skill._id}
                        className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-md hover:border-primary-300 transition-all duration-200 cursor-default"
                      >
                        <p className="text-xs font-semibold text-slate-800 truncate">{skill.name}</p>
                        <p className="text-xs text-slate-400 mt-1 truncate">by {skill.userId?.name?.split(' ')[0]}</p>
                        <span className="badge-offer text-xs mt-2 inline-block">{skill.category}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
              <div className="card border-slate-200/70 bg-white/90 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900">Why this landing page works</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  It frames the product as a skill-exchange platform first, then routes users to login or signup only when they want to act on it.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {['Real profiles', 'Fast matching', 'Campus-first', 'No money needed'].map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card border-slate-200/70 bg-slate-950 text-white shadow-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Ready to start?</p>
                <h3 className="mt-2 text-2xl font-black">Create your profile and start swapping skills today.</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Build a profile, list your abilities, and discover who can teach you the next thing you want to learn.
                </p>
                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <Link to="/register" className="btn-primary text-center text-base px-5 py-3">
                    Sign Up
                  </Link>
                  <Link to="/login" className="btn-secondary text-center text-base px-5 py-3">
                    Log In
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[2rem] bg-slate-950 px-6 py-10 text-white shadow-2xl sm:px-10 sm:py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Next step</p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-black">Bring your own skills to the platform.</h2>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-300">
                The homepage now feels like an actual product landing page, while the authenticated section still keeps your requests and community activity close by.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to={isAuthenticated ? '/profile' : '/register'} className="btn-primary text-center text-base px-6 py-3">
                {isAuthenticated ? 'Edit Profile' : 'Create Account'}
              </Link>
              <Link to={isAuthenticated ? '/requests' : '/login'} className="btn-secondary text-center text-base px-6 py-3">
                {isAuthenticated ? 'View Requests' : 'Log In'}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Home