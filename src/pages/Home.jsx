import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore'
import { db } from '../firebase'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFFFFF', paddingBottom:70 },
  header: { padding:'20px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between' },
  logo: { fontSize:18, fontWeight:700, color:'#FFFFFF' },
  avatar: { width:34, height:34, borderRadius:'50%', cursor:'pointer', border:'2px solid #534AB7', objectFit:'cover' },
  avatarFallback: { width:34, height:34, borderRadius:'50%', cursor:'pointer', border:'2px solid #534AB7', background:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#fff', fontWeight:700 },
  searchBtn: { margin:'14px 20px 8px', background:'#16213E', border:'1px solid #2C2C2A', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' },
  searchTxt: { color:'#888780', fontSize:14, flex:1 },
  section: { padding:'14px 20px 4px' },
  sectionTitle: { fontSize:11, fontWeight:600, color:'#888780', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 },
  card: { background:'#16213E', borderRadius:12, padding:12, marginBottom:8, cursor:'pointer', border:'1px solid #2C2C2A', display:'flex', alignItems:'center', gap:12 },
  cardImg: { width:46, height:46, borderRadius:8, objectFit:'cover', background:'#2C2C2A', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 },
  cardInfo: { flex:1, minWidth:0 },
  cardTitle: { fontSize:13, fontWeight:600, marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  cardMeta: { fontSize:11, color:'#888780' },
  badge: { background:'#1E1B4B', borderRadius:20, padding:'2px 7px', fontSize:10, color:'#9F9BE8', fontWeight:600, flexShrink:0 },
  scrollRow: { display:'flex', gap:10, overflowX:'auto', padding:'0 20px 8px', scrollbarWidth:'none' },
  releaseCard: { flexShrink:0, width:120, background:'#16213E', borderRadius:12, overflow:'hidden', border:'1px solid #2C2C2A', cursor:'pointer' },
  releaseImg: { width:'100%', height:68, objectFit:'cover', background:'#2C2C2A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 },
  releaseInfo: { padding:'8px' },
  releaseTitle: { fontSize:11, fontWeight:600, color:'#FFF', lineHeight:1.3, marginBottom:2 },
  releaseMeta: { fontSize:10, color:'#888780' },
  sectionHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, padding:'14px 20px 0' },
  sectionHeaderTitle: { fontSize:11, fontWeight:600, color:'#888780', textTransform:'uppercase', letterSpacing:'0.08em' },
  nav: { position:'fixed', bottom:0, left:0, right:0, background:'#0F0F1A', borderTop:'1px solid #2C2C2A', display:'flex', padding:'10px 0', zIndex:50 },
  navItem: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', padding:'3px 0' },
  navIcon: { fontSize:20 },
  navLabel: { fontSize:10, color:'#888780' },
}

export default function Home({ user }) {
  const navigate = useNavigate()
  const [recent, setRecent] = useState([])
  const [inProgress, setInProgress] = useState([])
  const [newSeries, setNewSeries] = useState([])
  const [newMovies, setNewMovies] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'comments'), orderBy('createdAt','desc'), limit(30))
    return onSnapshot(q, snap => {
      const grouped = {}
      snap.docs.forEach(doc => {
        const d = doc.data()
        const key = `${d.showId}-${d.seasonNum}-${d.episodeNum}`
        if (!grouped[key]) grouped[key] = { ...d, count:0 }
        grouped[key].count++
      })
      setRecent(Object.values(grouped).slice(0,5))
    })
  }, [])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'userComments'), where('userId','==',user.uid), orderBy('createdAt','desc'), limit(20))
    return onSnapshot(q, snap => {
      const grouped = {}
      snap.docs.forEach(doc => {
        const d = doc.data()
        if (!grouped[d.showId]) grouped[d.showId] = d
      })
      setInProgress(Object.values(grouped).slice(0,4))
    })
  }, [user])

  useEffect(() => {
    Promise.all([
      fetch(`https://api.themoviedb.org/3/tv/on_the_air?api_key=${TMDB_KEY}&language=fr-FR`).then(r=>r.json()),
      fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&language=fr-FR`).then(r=>r.json()),
    ]).then(([tv, movies]) => {
      setNewSeries((tv.results||[]).slice(0,8))
      setNewMovies((movies.results||[]).slice(0,8))
    })
  }, [])

  const name = user?.displayName?.split(' ')[0] || 'toi'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const photoURL = user?.photoURL || ''

  function isMovie(item) { return !item.seasonNum || item.seasonNum === 0 }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.logo}>🎬 StreamChat</span>
        <div onClick={() => navigate('/profile')} style={{ cursor:'pointer' }}>
          {photoURL
            ? <img src={photoURL} style={s.avatar} alt="avatar" onError={e => e.target.style.display='none'} />
            : <div style={s.avatarFallback}>{name[0]?.toUpperCase()}</div>}
        </div>
      </div>

      <div style={{ padding:'14px 20px 4px' }}>
        <div style={{ fontSize:19, fontWeight:700, marginBottom:3 }}>{greeting}, {name} 👋</div>
        <div style={{ fontSize:13, color:'#888780' }}>Qu'est-ce que tu regardes ce soir ?</div>
      </div>

      <div style={s.searchBtn} onClick={() => navigate('/search')}>
        <span style={{ fontSize:15 }}>🔍</span>
        <span style={s.searchTxt}>Rechercher une série ou un film…</span>
      </div>

      {inProgress.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Reprendre</div>
          {inProgress.map((item, i) => (
            <div key={i} style={s.card} onClick={() => navigate(`/episode/${item.showId}/${item.seasonNum}/${item.episodeNum}`)}>
              <div style={s.cardImg}>
                {item.showPoster ? <img src={`https://image.tmdb.org/t/p/w92${item.showPoster}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : '📺'}
              </div>
              <div style={s.cardInfo}>
                <div style={s.cardTitle}>{item.showName}</div>
                <div style={s.cardMeta}>
                  {isMovie(item) ? (item.showYear || 'Film') : `S${String(item.seasonNum||0).padStart(2,'0')}E${String(item.episodeNum||0).padStart(2,'0')}`}
                </div>
              </div>
              <span style={{ fontSize:15, color:'#888780' }}>›</span>
            </div>
          ))}
        </div>
      )}

      <div style={s.section}>
        <div style={s.sectionTitle}>En ce moment sur StreamChat</div>
        {recent.length === 0
          ? <div style={{ textAlign:'center', padding:'20px', color:'#444441', fontSize:12 }}>Sois le premier à commenter !</div>
          : recent.map((r,i) => (
            <div key={i} style={s.card} onClick={() => navigate(`/episode/${r.showId}/${r.seasonNum}/${r.episodeNum}`)}>
              <div style={s.cardImg}>
                {r.showPoster ? <img src={`https://image.tmdb.org/t/p/w92${r.showPoster}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : '📺'}
              </div>
              <div style={s.cardInfo}>
                <div style={s.cardTitle}>{r.showName||'Série'}</div>
                <div style={s.cardMeta}>
                  {(!r.seasonNum || r.seasonNum===0) ? '' : `S${String(r.seasonNum).padStart(2,'0')}E${String(r.episodeNum).padStart(2,'0')} · `}{r.episodeName||''}
                </div>
              </div>
              <div style={s.badge}>{r.count} 💬</div>
            </div>
          ))}
      </div>

      {newSeries.length > 0 && (
        <>
          <div style={s.sectionHeader}>
            <div style={s.sectionHeaderTitle}>📺 Séries — sorties de la semaine</div>
          </div>
          <div style={s.scrollRow}>
            {newSeries.map(show => (
              <div key={show.id} style={s.releaseCard} onClick={() => navigate('/search', { state:{ autoSelect:{ ...show, media_type:'tv' } } })}>
                <div style={s.releaseImg}>
                  {show.backdrop_path ? <img src={`https://image.tmdb.org/t/p/w300${show.backdrop_path}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : '📺'}
                </div>
                <div style={s.releaseInfo}>
                  <div style={s.releaseTitle}>{show.name}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {newMovies.length > 0 && (
        <>
          <div style={s.sectionHeader}>
            <div style={s.sectionHeaderTitle}>🎬 Films — en ce moment au ciné</div>
          </div>
          <div style={s.scrollRow}>
            {newMovies.map(movie => (
              <div key={movie.id} style={s.releaseCard} onClick={() => navigate(`/episode/${movie.id}/0/0`, { state:{ show:{ ...movie, media_type:'movie' } } })}>
                <div style={s.releaseImg}>
                  {movie.backdrop_path ? <img src={`https://image.tmdb.org/t/p/w300${movie.backdrop_path}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : '🎬'}
                </div>
                <div style={s.releaseInfo}>
                  <div style={s.releaseTitle}>{movie.title}</div>
                  <div style={s.releaseMeta}>{movie.release_date?.slice(0,4)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
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
