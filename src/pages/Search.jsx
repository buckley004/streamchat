import React, { useState, useEffect, useRef } from 'react'
import Nav from '../components/Nav'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc, getDoc, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

const s = {
  page: { minHeight:'100vh', background:'#0F0F1A', color:'#FFFFFF', paddingBottom:80 },
  header: { padding:'20px 20px 16px', display:'flex', alignItems:'center', gap:12 },
  back: { fontSize:22, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:4 },
  title: { fontSize:18, fontWeight:700 },
  searchWrap: { padding:'0 20px 16px' },
  input: { width:'100%', background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:12, padding:'14px 16px', color:'#FFFFFF', fontSize:15, outline:'none', boxSizing:'border-box' },
  card: { background:'#1A2340', borderRadius:12, padding:14, marginBottom:10, cursor:'pointer', border:'1px solid #3A3A5C', display:'flex', gap:12, alignItems:'flex-start' },
  poster: { width:52, height:78, borderRadius:8, objectFit:'cover', background:'#2C2C2A', flexShrink:0 },
  info: { flex:1, minWidth:0 },
  name: { fontSize:14, fontWeight:600, marginBottom:4 },
  meta: { fontSize:12, color:'#B0AECB', marginBottom:6 },
  synopsis: { fontSize:12, color:'#B4B2A9', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' },
  recentChip: { display:'inline-flex', alignItems:'center', gap:6, background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:20, padding:'7px 12px', marginRight:8, marginBottom:8, cursor:'pointer', fontSize:12, color:'#E8E6F8', whiteSpace:'nowrap' },
  recentWrap: { padding:'0 20px 16px', display:'flex', flexWrap:'wrap' },
  sectionTitle: { fontSize:12, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 },
  trendingCard: { background:'#1A2340', borderRadius:12, padding:12, marginBottom:8, cursor:'pointer', border:'1px solid #3A3A5C', display:'flex', gap:12, alignItems:'center' },
  badge: { background:'#1E1B4B', borderRadius:20, padding:'2px 8px', fontSize:11, color:'#9F9BE8', fontWeight:600, flexShrink:0 },
  posterSmall: { width:40, height:40, borderRadius:8, objectFit:'cover', background:'#2C2C2A', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 },
  seasonBtn: { background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:10, padding:'12px 16px', marginBottom:8, width:'100%', color:'#FFF', fontSize:14, cursor:'pointer', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center', boxSizing:'border-box' },
  epBtn: { background:'#0F0F1A', border:'none', borderRadius:8, padding:'10px 14px', marginBottom:6, width:'100%', color:'#FFF', fontSize:13, cursor:'pointer', textAlign:'left', display:'flex', gap:10, alignItems:'center', boxSizing:'border-box' },
  epNum: { color:'#534AB7', fontWeight:700, minWidth:28, fontSize:12 },
  loading: { textAlign:'center', padding:'40px', color:'#B0AECB' },
  empty: { textAlign:'center', padding:'60px 20px', color:'#8888A0' },
}


function Heart({ filled, size=16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#B0AECB" : "none"} stroke="#B0AECB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

export default function Search({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [queryText, setQueryText] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [openSeason, setOpenSeason] = useState(null)
  const [episodes, setEpisodes] = useState({})
  const [recentSearches, setRecentSearches] = useState([])
  const [trendingShows, setTrendingShows] = useState([])
  const [favorites, setFavorites] = useState({})
  const timer = useRef(null)

  useEffect(() => {
    setRecentSearches(JSON.parse(localStorage.getItem('recentSearches') || '[]'))
  }, [])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'favorites'), where('userId','==',user?.uid))
    return onSnapshot(q, snap => {
      const favMap = {}
      snap.docs.forEach(d => { if (!d.data().deleted) favMap[d.data().showId] = true })
      setFavorites(favMap)
    })
  }, [user])

  useEffect(() => {
    if (location.state?.autoSelect) selectShow(location.state.autoSelect)
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'), limit(50))
    return onSnapshot(q, snap => {
      const counts = {}
      snap.docs.forEach(doc => {
        const d = doc.data()
        if (!d.showId) return
        if (!counts[d.showId]) counts[d.showId] = { showId: d.showId, showName: d.showName, showPoster: d.showPoster, count: 0 }
        counts[d.showId].count++
      })
      setTrendingShows(Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 6))
    })
  }, [])

  useEffect(() => {
    if (!queryText.trim()) { setResults([]); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(queryText)}&language=fr-FR`)
      const d = await r.json()
      const filtered = (d.results || [])
        .filter(x => x.media_type === 'tv' || x.media_type === 'movie')
        .sort((a, b) => {
          const dateA = a.first_air_date || a.release_date || '0'
          const dateB = b.first_air_date || b.release_date || '0'
          return dateB.localeCompare(dateA)
        })
        .slice(0, 10)
      setResults(filtered)
      setLoading(false)
    }, 400)
  }, [queryText])

  async function toggleFav(e, show) {
    e.stopPropagation()
    const showId = String(show.id)
    const isMovie = show.media_type === 'movie'
    const isFav = favorites[showId]
    const favRef = doc(db, 'favorites', `${user.uid}_${showId}`)
    const countRef = doc(db, 'favoriteCounts', showId)
    const countSnap = await getDoc(countRef)
    const currentCount = countSnap.exists() ? (countSnap.data().count||0) : 0
    if (isFav) {
      await setDoc(favRef, { deleted:true }, { merge:true })
      await setDoc(countRef, { count: Math.max(0, currentCount-1) }, { merge:true })
    } else {
      await setDoc(favRef, { userId:user.uid, showId, showName:show.name||show.title||'', showPoster:show.poster_path||'', isMovie, createdAt:serverTimestamp() })
      await setDoc(countRef, { count: currentCount+1 }, { merge:true })
    }
  }

  function saveRecentSearch(name) {
    const stored = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    const updated = [name, ...stored.filter(s => s !== name)].slice(0, 6)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
    setRecentSearches(updated)
  }

  async function selectShow(show) {
    saveRecentSearch(show.name || show.title)
    setSelected(show)
    setSeasons([])
    setOpenSeason(null)
    setEpisodes({})
    if (show.media_type === 'tv') {
      navigate(`/show/${show.id}`, { state: { fromSearch: true, searchQuery: queryText } })
    } else {
      navigate(`/episode/${show.id}/0/0`, { state: { show } })
    }
  }

  async function selectTrending(item) {
    const r = await fetch(`https://api.themoviedb.org/3/tv/${item.showId}?api_key=${TMDB_KEY}&language=fr-FR`)
    const d = await r.json()
    selectShow({ ...d, media_type: 'tv' })
  }

  async function toggleSeason(seasonNum) {
    if (openSeason === seasonNum) { setOpenSeason(null); return }
    setOpenSeason(seasonNum)
    if (!episodes[seasonNum]) {
      const r = await fetch(`https://api.themoviedb.org/3/tv/${selected.id}/season/${seasonNum}?api_key=${TMDB_KEY}&language=fr-FR`)
      const d = await r.json()
      setEpisodes(prev => ({ ...prev, [seasonNum]: d.episodes || [] }))
    }
  }

  if (selected && selected.media_type === 'tv') return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => { setSelected(null); setSeasons([]); setOpenSeason(null) }}>‹</button>
        <span style={s.title}>{selected.name || selected.title}</span>
      </div>
      <div style={{ padding:'0 20px' }}>
        <div style={{ paddingBottom:8, fontSize:12, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em' }}>Choisir un épisode</div>
        {seasons.map(season => (
          <div key={season.season_number}>
            <button style={s.seasonBtn} onClick={() => toggleSeason(season.season_number)}>
              <span>Saison {season.season_number}</span>
              <span style={{ color:'#B0AECB', fontSize:12 }}>{season.episode_count} épisodes {openSeason === season.season_number ? '▲' : '▼'}</span>
            </button>
            {openSeason === season.season_number && (
              <div style={{ paddingLeft:12 }}>
                {(episodes[season.season_number] || []).map(ep => (
                  <button key={ep.episode_number} style={s.epBtn}
                    onClick={() => navigate(`/episode/${selected.id}/${season.season_number}/${ep.episode_number}`, { state: { show: selected, episode: ep, fromSearch: true, searchQuery: queryText } })}>
                    <span style={s.epNum}>E{String(ep.episode_number).padStart(2,'0')}</span>
                    <span>{ep.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate('/')}>‹</button>
        <span style={s.title}>Rechercher</span>
      </div>
      <div style={s.searchWrap}>
        <input style={s.input} placeholder="Breaking Bad, Stranger Things…" value={queryText}
          onChange={e => setQueryText(e.target.value)} autoFocus />
      </div>

      {queryText ? (
        <div style={{ padding:'0 20px' }}>
          {loading && <div style={s.loading}>Recherche…</div>}
          {!loading && results.length === 0 && <div style={s.empty}><div style={{ fontSize:32, marginBottom:8 }}>🤷</div>Aucun résultat</div>}
          {results.map(show => (
            <div key={show.id} style={s.card} onClick={() => selectShow(show)}>
              {show.poster_path
                ? <img src={`https://image.tmdb.org/t/p/w92${show.poster_path}`} style={s.poster} alt="" />
                : <div style={{ ...s.poster, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>📺</div>}
              <div style={s.info}>
                <div style={s.name}>{show.name || show.title}</div>
                <div style={s.meta}>{show.media_type === 'tv' ? 'Série' : 'Film'} · {(show.first_air_date || show.release_date || '').slice(0, 4)}</div>
                {show.overview && <div style={s.synopsis}>{show.overview}</div>}
              </div>
              <button style={{ background:'none', border:'none', cursor:'pointer', padding:4, flexShrink:0 }} onClick={e => toggleFav(e, show)}>
                <Heart filled={!!favorites[String(show.id)]} size={18} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <>
          {recentSearches.length > 0 && (
            <>
              <div style={{ ...s.sectionTitle, padding:'0 20px 10px' }}>Recherches récentes</div>
              <div style={s.recentWrap}>
                {recentSearches.map((name, i) => (
                  <div key={i} style={s.recentChip} onClick={() => setQueryText(name)}>🕐 {name}</div>
                ))}
              </div>
            </>
          )}
          {trendingShows.length > 0 && (
            <div style={{ padding:'0 20px' }}>
              <div style={s.sectionTitle}>🔥 Les plus commentées</div>
              {trendingShows.map((item, i) => (
                <div key={i} style={s.trendingCard} onClick={() => selectTrending(item)}>
                  <div style={s.posterSmall}>
                    {item.showPoster ? <img src={`https://image.tmdb.org/t/p/w92${item.showPoster}`} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} alt="" /> : '📺'}
                  </div>
                  <div style={{ flex:1, fontSize:14, fontWeight:600 }}>{item.showName}</div>
                  <div style={s.badge}>{item.count} 💬</div>
                </div>
              ))}
            </div>
          )}
          {trendingShows.length === 0 && recentSearches.length === 0 && (
            <div style={s.empty}><div style={{ fontSize:40, marginBottom:12 }}>🔍</div><div>Tape le nom d'une série ou d'un film</div></div>
          )}
        </>
      )}
    </div>
  )
}
