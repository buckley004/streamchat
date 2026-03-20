import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp, collection, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import Nav from '../components/Nav'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

function Heart({ filled, size=22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? "#B0AECB" : "none"}
      stroke="#B0AECB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

const s = {
  page: { minHeight:'100vh', background:'#0F0F1A', color:'#FFF', paddingBottom:70 },
  banner: { width:'100%', height:200, objectFit:'cover', background:'#16213E', display:'block' },
  bannerPlaceholder: { width:'100%', height:160, background:'#16213E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48 },
  header: { padding:'12px 16px', display:'flex', alignItems:'center', gap:10, position:'absolute', top:0, left:0, right:0 },
  backBtn: { background:'rgba(0,0,0,0.5)', border:'none', borderRadius:20, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#FFF', fontSize:18, flexShrink:0 },
  infoBox: { padding:'16px 16px 12px', borderBottom:'1px solid #3A3A5C' },
  titleRow: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:8 },
  title: { fontSize:20, fontWeight:700, flex:1, lineHeight:1.3 },
  favBtn: { background:'none', border:'none', cursor:'pointer', padding:4, flexShrink:0, display:'flex', alignItems:'center', gap:6 },
  favCount: { fontSize:12, color:'#B0AECB' },
  synopsis: { fontSize:13, color:'#B0AECB', lineHeight:1.6 },
  section: { padding:'14px 16px 4px' },
  sectionTitle: { fontSize:11, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 },
  seasonBtn: { background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:10, padding:'12px 14px', marginBottom:8, width:'100%', color:'#FFF', fontSize:13, cursor:'pointer', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center', boxSizing:'border-box' },
  epBtn: { background:'#0F0F1A', border:'none', borderRadius:8, padding:'10px 12px', marginBottom:6, width:'100%', color:'#FFF', fontSize:12, cursor:'pointer', textAlign:'left', display:'flex', gap:10, alignItems:'center', boxSizing:'border-box' },
  epNum: { color:'#534AB7', fontWeight:700, minWidth:28, fontSize:11 },
}

export default function ShowDetail({ user }) {
  const { showId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [show, setShow] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [openSeason, setOpenSeason] = useState(null)
  const [episodes, setEpisodes] = useState({})
  const [isFav, setIsFav] = useState(false)
  const [favCount, setFavCount] = useState(0)
  const [favLoading, setFavLoading] = useState(false)

  useEffect(() => {
    fetch(`https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_KEY}&language=fr-FR`)
      .then(r => r.json())
      .then(d => {
        setShow(d)
        setSeasons((d.seasons || []).filter(s => s.season_number > 0))
      })
  }, [showId])

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'favorites', `${user.uid}_${showId}`))
      .then(snap => setIsFav(snap.exists() && !snap.data()?.deleted))
    getDoc(doc(db, 'favoriteCounts', showId))
      .then(snap => setFavCount(snap.exists() ? snap.data().count || 0 : 0))
  }, [showId, user?.uid])

  async function toggleFav() {
    if (favLoading) return
    setFavLoading(true)
    try {
      const favRef = doc(db, 'favorites', `${user.uid}_${showId}`)
      const countRef = doc(db, 'favoriteCounts', showId)
      const snap = await getDoc(favRef)
      const currentlyFav = snap.exists() && !snap.data()?.deleted
      if (currentlyFav) {
        await setDoc(favRef, { deleted: true, updatedAt: serverTimestamp() }, { merge: true })
        await setDoc(countRef, { count: Math.max(0, favCount - 1) }, { merge: true })
        setFavCount(c => Math.max(0, c - 1))
        setIsFav(false)
      } else {
        await setDoc(favRef, {
          userId: user.uid, showId,
          showName: show?.name || '',
          showPoster: show?.poster_path || '',
          isMovie: false,
          deleted: false,
          createdAt: serverTimestamp()
        })
        await setDoc(countRef, { count: favCount + 1 }, { merge: true })
        setFavCount(c => c + 1)
        setIsFav(true)
      }
    } finally {
      setFavLoading(false)
    }
  }

  async function toggleSeason(num) {
    if (openSeason === num) { setOpenSeason(null); return }
    setOpenSeason(num)
    if (!episodes[num]) {
      const r = await fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${num}?api_key=${TMDB_KEY}&language=fr-FR`)
      const d = await r.json()
      setEpisodes(prev => ({ ...prev, [num]: d.episodes || [] }))
    }
  }

  function goBack() {
    if (location?.state?.fromSearch) {
      navigate('/search', { state: { query: location?.state?.searchQuery } })
    } else {
      navigate('/')
    }
  }

  if (!show) return (
    <div style={{ background:'#0F0F1A', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#B0AECB' }}>
      Chargement…
    </div>
  )

  return (
    <div style={s.page}>
      {/* Bannière avec bouton retour par-dessus */}
      <div style={{ position:'relative' }}>
        {show.backdrop_path
          ? <img src={`https://image.tmdb.org/t/p/w780${show.backdrop_path}`} style={s.banner} alt="" />
          : <div style={s.bannerPlaceholder}>📺</div>}
        <div style={s.header}>
          <button style={s.backBtn} onClick={goBack}>‹</button>
        </div>
      </div>

      {/* Infos série */}
      <div style={s.infoBox}>
        <div style={s.titleRow}>
          <div style={s.title}>{show.name}</div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <button style={s.favBtn} onClick={toggleFav} disabled={favLoading}>
              <Heart filled={isFav} size={24} />
            </button>
            {favCount > 0 && <span style={s.favCount}>{favCount}</span>}
          </div>
        </div>
        {show.overview && <div style={s.synopsis}>{show.overview}</div>}
      </div>

      {/* Saisons */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Saisons et épisodes</div>
        {seasons.map(season => (
          <div key={season.season_number}>
            <button style={s.seasonBtn} onClick={() => toggleSeason(season.season_number)}>
              <span>Saison {season.season_number}</span>
              <span style={{ color:'#B0AECB', fontSize:11 }}>
                {season.episode_count} épisodes {openSeason === season.season_number ? '▲' : '▼'}
              </span>
            </button>
            {openSeason === season.season_number && (
              <div style={{ paddingLeft:12 }}>
                {(episodes[season.season_number] || []).map(ep => (
                  <button key={ep.episode_number} style={s.epBtn}
                    onClick={() => navigate(`/episode/${showId}/${season.season_number}/${ep.episode_number}`, {
                      state: { show, episode: ep, fromShow: true, fromSearch: location?.state?.fromSearch, searchQuery: location?.state?.searchQuery }
                    })}>
                    <span style={s.epNum}>E{String(ep.episode_number).padStart(2, '0')}</span>
                    <span>{ep.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Nav />
    </div>
  )
}
