import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Nav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const items = [
    { path: '/', icon: '🏠', label: 'Accueil' },
    { path: '/profile', icon: '👤', label: 'Profil' },
  ]

  return (
    <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:'#0A0A14', borderTop:'1px solid #3A3A5C', display:'flex', padding:'10px 0', zIndex:50 }}>
      {items.map(item => (
        <div key={item.path}
          style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', padding:'3px 0' }}
          onClick={() => navigate(item.path)}>
          <span style={{ fontSize:22 }}>{item.icon}</span>
          <span style={{ fontSize:10, color: pathname === item.path ? '#534AB7' : '#B0AECB' }}>{item.label}</span>
        </div>
      ))}
    </nav>
  )
}
