import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Nav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const s = {
    nav: { position:'fixed', bottom:0, left:0, right:0, background:'#0F0F1A', borderTop:'1px solid #2C2C2A', display:'flex', padding:'10px 0', zIndex:50 },
    item: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', padding:'3px 0' },
    icon: { fontSize:22 },
    label: { fontSize:10, color:'#888780' },
    active: { color:'#534AB7' },
  }

  const isHome = pathname === '/'
  const isProfile = pathname === '/profile'

  return (
    <nav style={s.nav}>
      <div style={s.item} onClick={() => navigate('/')}>
        <span style={s.icon}>🏠</span>
        <span style={{ ...s.label, ...(isHome ? s.active : {}) }}>Accueil</span>
      </div>
      <div style={s.item} onClick={() => navigate('/profile')}>
        <span style={s.icon}>👤</span>
        <span style={{ ...s.label, ...(isProfile ? s.active : {}) }}>Profil</span>
      </div>
    </nav>
  )
}
