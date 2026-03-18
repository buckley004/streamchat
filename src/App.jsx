import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import Home from './pages/Home'
import Search from './pages/Search'
import Episode from './pages/Episode'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Onboarding from './pages/Onboarding'

export default function App() {
  const [user, setUser] = useState(undefined)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u || null)
      if (u && !localStorage.getItem('onboarding_done')) {
        setShowOnboarding(true)
      }
    })
  }, [])

  function doneOnboarding() {
    localStorage.setItem('onboarding_done', '1')
    setShowOnboarding(false)
  }

  if (user === undefined) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#1A1A2E' }}>
      <div style={{ width:32, height:32, border:'3px solid #534AB7', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (user && showOnboarding) return <Onboarding onDone={doneOnboarding} />

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={user ? <Home user={user} /> : <Navigate to="/login" />} />
      <Route path="/search" element={user ? <Search user={user} /> : <Navigate to="/login" />} />
      <Route path="/episode/:showId/:seasonNum/:episodeNum" element={user ? <Episode user={user} /> : <Navigate to="/login" />} />
      <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/login" />} />
    </Routes>
  )
}
