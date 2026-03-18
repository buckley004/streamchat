import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase'

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFFFFF', paddingBottom:80 },
  header: { padding:'20px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between' },
  logo: { fontSize:20, fontWeight:700, color:'#FFFFFF' },
  avatar: { width:36, height:36, borderRadius:'50%', cursor:'pointer', border:'2px solid #534AB7' },
  hero: { padding:'32px 20px 24px' },
  greeting: { fontSize:22, fontWeight:700, marginBottom:6 },
  sub: { fontSize:14, color:'#888780' },
  searchBtn: { margin:'0 20px 24px', background:'#16213E', border:'1px solid #2C2C2A', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', width:'calc(100% - 40px)' },
  searchTxt: { color:'#888780', fontSize:15 },
  section: { padding:'0 20px 8px' },
  sectionTitle: { fontSize:13, fontWeight:600, color:'#888780', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14 },
  card: { background:'#16213E', borderRadius:12, padding:16, marginBottom:10, cursor:'pointer', border:'1px solid #2C2C2A', display:'flex', alignItems:'center', gap:14 },
  cardImg: { width:52, height:52, borderRadius:8, objectFit:'cover', background:'#2C2C2A', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 },
  cardInfo: { flex:1, minWidth:0 },
  cardTitle: { fontSize:14, fontWeight:600, marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  cardMeta: { fontSize:12, color:'#888780' },
  commentCount: { fontSize:12, color:'#534AB7', fontWeight:600, flexShrink:0 },
  nav: { position:'fixed', bottom:0, left:0, right:0, background:'#0F0F1A', borderTop:'1px solid #2C2C2A', display:'flex', padding:'10px 0' },
  navItem: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', padding:'4px 0' },
  navIcon: { fontSize:20 },
  navLabel: { fontSize:10, color:'#888780' },
  empty: { textAlign:'center', padding:'40px 20px', color:'#444441' },
}

export default function Home({ user }) {
  const navigate = useNavigate()
  const [recent, setRecent] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'), limit(20))
    return onSnapshot(q, snap => {
      const grouped = {}
      snap.docs.forEach(doc => {
        const d = doc.data()
        const key = `${d.showId}-${d.seasonNum}-${d.episodeNum}`
        if (!grouped[key]) grouped[key] = { ...d, count: 0 }
        grouped[key].count++
      })
      setRecent(Object.values(grouped).slice(0, 6))
    })
  }, [])

  const name = user.displayName?.split(' ')[0] || 'toi'

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.logo}>🎬 StreamChat</span>
        <img src={user.photoURL || ''} style={s.avatar} onClick={() => signOut(auth)}
          onError={e => e.target.style.display='none'} alt="avatar" />
      </div>

      <div style={s.hero}>
        <div style={s.greeting}>Bonsoir, {name} 👋</div>
        <div style={s.sub}>Qu'est-ce que tu regardes ce soir ?</div>
      </div>

      <div style={s.searchBtn} onClick={() => navigate('/search')}>
        <span style={{ fontSize:18 }}>🔍</span>
        <span style={s.searchTxt}>Rechercher une série ou un film…</span>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Actif en ce moment</div>
        {recent.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
            <div>Sois le premier à commenter !</div>
            <div style={{ fontSize:12, marginTop:4 }}>Recherche une série pour commencer</div>
          </div>
        ) : recent.map((r, i) => (
          <div key={i} style={s.card}
            onClick={() => navigate(`/episode/${r.showId}/${r.seasonNum}/${r.episodeNum}`)}>
            <div style={s.cardImg}>{r.showPoster ? <img src={`https://image.tmdb.org/t/p/w92${r.showPoster}`} style={{ width:'100%', height:'100%', borderRadius:8, objectFit:'cover' }} alt="" /> : '📺'}</div>
            <div style={s.cardInfo}>
              <div style={s.cardTitle}>{r.showName || 'Série inconnue'}</div>
              <div style={s.cardMeta}>S{String(r.seasonNum).padStart(2,'0')}E{String(r.episodeNum).padStart(2,'0')} · {r.episodeName || ''}</div>
            </div>
            <div style={s.commentCount}>{r.count} 💬</div>
          </div>
        ))}
      </div>

      <nav style={s.nav}>
        <div style={s.navItem}>
          <span style={s.navIcon}>🏠</span>
          <span style={{ ...s.navLabel, color:'#534AB7' }}>Accueil</span>
        </div>
        <div style={s.navItem} onClick={() => navigate('/search')}>
          <span style={s.navIcon}>🔍</span>
          <span style={s.navLabel}>Rechercher</span>
        </div>
        <div style={s.navItem}>
          <span style={s.navIcon}>👤</span>
          <span style={s.navLabel}>Profil</span>
        </div>
      </nav>
    </div>
  )
}
