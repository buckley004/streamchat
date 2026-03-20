import React, { useState, useEffect } from 'react'
import Nav from '../components/Nav'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

const s = {
  page: { minHeight:'100vh', background:'#0F0F1A', color:'#FFF', paddingBottom:70 },
  banner: { width:'100%', height:160, objectFit:'cover', background:'#1A2340' },
  header: { padding:'12px 16px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #2C2C2A' },
  back: { fontSize:22, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:'4px 8px' },
  title: { fontSize:16, fontWeight:700, flex:1 },
  synopsis: { padding:'12px 16px', fontSize:13, color:'#B0AECB', lineHeight:1.6, borderBottom:'1px solid #2C2C2A' },
  section: { padding:'12px 16px 4px' },
  sectionTitle: { fontSize:11, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 },
  seasonBtn: { background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:10, padding:'11px 14px', marginBottom:8, width:'100%', color:'#FFF', fontSize:13, cursor:'pointer', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center', boxSizing:'border-box' },
  epBtn: { background:'#0F0F1A', border:'none', borderRadius:8, padding:'9px 12px', marginBottom:5, width:'100%', color:'#FFF', fontSize:12, cursor:'pointer', textAlign:'left', display:'flex', gap:10, alignItems:'center', boxSizing:'border-box' },
  epNum: { color:'#534AB7', fontWeight:700, minWidth:28, fontSize:11 },
  nav: { position:'fixed', bottom:0, left:0, right:0, background:'#0F0F1A', borderTop:'1px solid #2C2C2A', display:'flex', padding:'10px 0', zIndex:50 },
  navItem: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', padding:'3px 0' },
  navIcon: { fontSize:20 },
  navLabel: { fontSize:10, color:'#B0AECB' },
}


function Heart({ filled, size=20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#B0AECB" : "none"} stroke="#B0AECB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

export default function ShowDetail({ user }) {
  const { showId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [show, setShow] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [isFav, setIsFav] = useState(false)
  const [favCount, setFavCount] = useState(0)
  const [openSeason, setOpenSeason] = useState(null)
  const [episodes, setEpisodes] = useState({})

  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'favorites', `${user.uid}_${showId}`)).then(snap => setIsFav(snap.exists() && !snap.data()?.deleted))
      getDoc(doc(db, 'favoriteCounts', showId)).then(snap => setFavCount(snap.exists() ? snap.data().count||0 : 0))
    }
  }, [showId, user?.uid])

  useEffect(() => {
    fetch(`https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_KEY}&language=fr-FR`)
      .then(r=>r.json()).then(d => {
        setShow(d)
        setSeasons((d.seasons||[]).filter(s => s.season_number>0))
      })
  }, [showId])

  async function toggleSeason(num) {
    if (openSeason===num) { setOpenSeason(null); return }
    setOpenSeason(num)
    if (!episodes[num]) {
      const r = await fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${num}?api_key=${TMDB_KEY}&language=fr-FR`)
      const d = await r.json()
      setEpisodes(prev => ({ ...prev, [num]: d.episodes||[] }))
    }
  }

  async function toggleFav() {
    if (!user) return
    const favRef = doc(db, 'favorites', `${user.uid}_${showId}`)
    const countRef = doc(db, 'favoriteCounts', showId)
    if (isFav) {
      await setDoc(favRef, { deleted:true }, { merge:true })
      await setDoc(countRef, { count: Math.max(0, favCount-1) }, { merge:true })
      setFavCount(c => Math.max(0,c-1)); setIsFav(false)
    } else {
      await setDoc(favRef, { userId:user.uid, showId, showName:show?.name||'', showPoster:show?.poster_path||'', isMovie:false, createdAt:serverTimestamp() })
      await setDoc(countRef, { count: favCount+1 }, { merge:true })
      setFavCount(c => c+1); setIsFav(true)
    }
  }

  if (!show) return <div style={{ background:'#0F0F1A', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#B0AECB' }}>Chargement…</div>

  return (
    <div style={s.page}>
      {show.backdrop_path
        ? <img src={`https://image.tmdb.org/t/p/w780${show.backdrop_path}`} style={s.banner} alt="" />
        : <div style={{ ...s.banner, display:'flex', alignItems:'center', justifyContent:'center', fontSize:40 }}>📺</div>}

      <div style={s.header}>
        <button style={s.back} onClick={() => { if (location?.state?.fromSearch) navigate('/search', { state:{ query: location?.state?.searchQuery } }); else navigate('/') }}>←</button>
        <span style={s.title}>{show.name}</span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'#B0AECB' }}>{favCount} ❤️</span>
          <button style={{ background:'none', border:'none', cursor:'pointer', padding:4 }} onClick={toggleFav}>
            <Heart filled={isFav} size={22} />
          </button>
        </div>
      </div>

      {show.overview && <div style={s.synopsis}>{show.overview}</div>}

      <div style={s.section}>
        <div style={s.sectionTitle}>Saisons et épisodes</div>
        {seasons.map(season => (
          <div key={season.season_number}>
            <button style={s.seasonBtn} onClick={() => toggleSeason(season.season_number)}>
              <span>Saison {season.season_number}</span>
              <span style={{ color:'#B0AECB', fontSize:11 }}>{season.episode_count} épisodes {openSeason===season.season_number?'▲':'▼'}</span>
            </button>
            {openSeason===season.season_number && (
              <div style={{ paddingLeft:12 }}>
                {(episodes[season.season_number]||[]).map(ep => (
                  <button key={ep.episode_number} style={s.epBtn}
                    onClick={() => navigate(`/episode/${showId}/${season.season_number}/${ep.episode_number}`, { state:{ show, episode:ep, fromShow:true, searchQuery: location?.state?.searchQuery, fromSearch: location?.state?.fromSearch } })}>
                    <span style={s.epNum}>E{String(ep.episode_number).padStart(2,'0')}</span>
                    <span>{ep.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <nav style={s.nav}>
        <div style={s.navItem} onClick={() => navigate('/')}><span style={s.navIcon}>🏠</span><span style={s.navLabel}>Accueil</span></div>
        <div style={s.navItem} onClick={() => navigate('/search')}><span style={s.navIcon}>🔍</span><span style={s.navLabel}>Rechercher</span></div>
        <div style={s.navItem} onClick={() => navigate('/profile')}><span style={s.navIcon}>👤</span><span style={s.navLabel}>Profil</span></div>
      </nav>
    </div>
  )
}
