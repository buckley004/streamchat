import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFFFFF', paddingBottom:80 },
  header: { padding:'20px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between' },
  logo: { fontSize:18, fontWeight:700, color:'#FFFFFF' },
  avatar: { width:34, height:34, borderRadius:'50%', cursor:'pointer', border:'2px solid #534AB7', objectFit:'cover' },
  avatarPlaceholder: { width:34, height:34, borderRadius:'50%', cursor:'pointer', border:'2px solid #534AB7', background:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#fff', fontWeight:700 },
  searchBtn: { margin:'16px 20px 8px', background:'#16213E', border:'1px solid #2C2C2A', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' },
  searchTxt: { color:'#888780', fontSize:15, flex:1 },
  section: { padding:'16px 20px 8px' },
  sectionTitle: { fontSize:12, fontWeight:600, color:'#888780', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 },
  card: { background:'#16213E', borderRadius:12, padding:14, marginBottom:10, cursor:'pointer', border:'1px solid #2C2C2A', display:'flex', alignItems:'center', gap:12 },
  cardImg: { width:48, height:48, borderRadius:8, objectFit:'cover', background:'#2C2C2A', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, overflow:'hidden' },
  cardInfo: { flex:1, minWidth:0 },
  cardTitle: { fontSize:14, fontWeight:600, marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  cardMeta: { fontSize:12, color:'#888780' },
  badge: { background:'#1E1B4B', borderRadius:20, padding:'2px 8px', fontSize:11, color:'#9F9BE8', fontWeight:600, flexShrink:0 },
  trendingRow: { display:'flex', gap:10, overflowX:'auto', padding:'0 20px 4px', scrollbarWidth:'none' },
  trendingCard: { flexShrink:0, width:110, background:'#16213E', borderRadius:12, overflow:'hidden', border:'1px solid #2C2C2A', cursor:'pointer' },
  trendingImg: { width:'100%', height:64, objectFit:'cover', background:'#2C2C2A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 },
  trendingTitle: { padding:'8px', fontSize:11, fontWeight:600, color:'#FFF', lineHeight:1.3 },
  nav: { position:'fixed', bottom:0, left:0, right:0, background:'#0F0F1A', borderTop:'1px solid #2C2C2A', display:'flex', padding:'10px 0' },
  navItem: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', padding:'4px 0' },
  navIcon: { fontSize:20 },
  navLabel: { fontSize:10, color:'#888780' },
}

export default function Home({ user }) {
  const navigate = useNavigate()
  const [recent, setRecent] = useState([])
  const [newReleases, setNewReleases] = useState([])
  const [inProgress, setInProgress] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'), limit(30))
    return onSnapshot(q, snap => {
      const grouped = {}
      snap.docs.forEach(doc => {
        const d = doc.data()
        const key = `${d.showId}-${d.seasonNum}-${d.episodeNum}`
        if (!grouped[key]) grouped[key] = { ...d, count: 0 }
        grouped[key].count++
      })
      setRecent(Object.values(grouped).slice(0, 5))
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'userComments'), orderBy('createdAt', 'desc'), limit(20))
    return onSnapshot(q, snap => {
      if (!user) return
      const mine = snap.docs.filter(d => d.data().userId === user.uid).map(d => d.data())
      const grouped = {}
      mine.forEach(d => {
        const key = d.showId
        if (!grouped[key]) grouped[key] = d
      })
      setInProgress(Object.values(grouped).slice(0, 4))
    })
  }, [user])

  useEffect(() => {
    fetch(`https://api.themoviedb.org/3/tv/on_the_air?api_key=${TMDB_KEY}&language=fr-FR&page=1`)
      .then(r => r.json())
      .then(d => setNewReleases((d.results || []).slice(0, 8)))
  }, [])

  const name = user?.displayName?.split(' ')[0] || 'toi'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.logo}>🎬 StreamChat</span>
        <div onClick={() => navigate('/profile')} style={{ cursor:'pointer' }}>
          {user?.photoURL
            ? <img src={user.photoURL} style={s.avatar} alt="avatar" onError={e => e.target.style.display='none'} />
            : <div style={s.avatarPlaceholder}>{name[0]?.toUpperCase()}</div>}
        </div>
      </div>

      <div style={{ padding:'16px 20px 4px' }}>
        <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>{greeting}, {name} 👋</div>
        <div style={{ fontSize:13, color:'#888780' }}>Qu'est-ce que tu regardes ce soir ?</div>
      </div>

      <div style={s.searchBtn} onClick={() => navigate('/search')}>
        <span style={{ fontSize:16 }}>🔍</span>
        <span style={s.searchTxt}>Rechercher une série ou un film…</span>
      </div>

      {inProgress.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Reprendre</div>
          {inProgress.map((item, i) => (
            <div key={i} style={s.card} onClick={() => navigate(`/episode/${item.showId}/${item.seasonNum}/${item.episodeNum}`)}>
              <div style={s.cardImg}>
                {item.showPoster ? <img src={`https://image.tmdb.org/t/p/w92${item.showPoster}`} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} alt="" /> : '📺'}
              </div>
              <div style={s.cardInfo}>
                <div style={s.cardTitle}>{item.showName}</div>
                <div style={s.cardMeta}>S{String(item.seasonNum||0).padStart(2,'0')}E{String(item.episodeNum||0).padStart(2,'0')}</div>
              </div>
              <span style={{ fontSize:16, color:'#888780' }}>›</span>
            </div>
          ))}
        </div>
      )}

      <div style={s.section}>
        <div style={s.sectionTitle}>En ce moment sur StreamChat</div>
        {recent.length === 0
          ? <div style={{ textAlign:'center', padding:'24px', color:'#444441', fontSize:13 }}>Sois le premier à commenter !</div>
          : recent.map((r, i) => (
            <div key={i} style={s.card} onClick={() => navigate(`/episode/${r.showId}/${r.seasonNum}/${r.episodeNum}`)}>
              <div style={s.cardImg}>
                {r.showPoster ? <img src={`https://image.tmdb.org/t/p/w92${r.showPoster}`} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} alt="" /> : '📺'}
              </div>
              <div style={s.cardInfo}>
                <div style={s.cardTitle}>{r.showName || 'Série'}</div>
                <div style={s.cardMeta}>S{String(r.seasonNum).padStart(2,'0')}E{String(r.episodeNum).padStart(2,'0')} · {r.episodeName || ''}</div>
              </div>
              <div style={s.badge}>{r.count} 💬</div>
            </div>
          ))}
      </div>

      {newReleases.length > 0 && (
        <div>
          <div style={{ ...s.sectionTitle, padding:'8px 20px 12px' }}>Sorties de la semaine</div>
          <div style={s.trendingRow}>
            {newReleases.map(show => (
              <div key={show.id} style={s.trendingCard} onClick={() => navigate('/search', { state: { autoSelect: show } })}>
                <div style={s.trendingImg}>
                  {show.backdrop_path
                    ? <img src={`https://image.tmdb.org/t/p/w300${show.backdrop_path}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
                    : '📺'}
                </div>
                <div style={s.trendingTitle}>{show.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <nav style={s.nav}>
        <div style={s.navItem}>
          <span style={s.navIcon}>🏠</span>
          <span style={{ ...s.navLabel, color:'#534AB7' }}>Accueil</span>
        </div>
        <div style={s.navItem} onClick={() => navigate('/search')}>
          <span style={s.navIcon}>🔍</span>
          <span style={s.navLabel}>Rechercher</span>
        </div>
        <div style={s.navItem} onClick={() => navigate('/profile')}>
          <span style={s.navIcon}>👤</span>
          <span style={s.navLabel}>Profil</span>
        </div>
      </nav>
    </div>
  )
}
