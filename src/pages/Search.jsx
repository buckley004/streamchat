import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import Nav from '../components/Nav'
import HeartButton from '../components/HeartButton'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

const s = {
  page: { minHeight:'100vh', background:'#0F0F1A', color:'#FFF', paddingBottom:70 },
  header: { padding:'20px 20px 16px', display:'flex', alignItems:'center', gap:12 },
  back: { fontSize:22, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:4 },
  title: { fontSize:18, fontWeight:700 },
  searchWrap: { padding:'0 20px 12px' },
  input: { width:'100%', background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:12, padding:'14px 16px', color:'#FFF', fontSize:15, outline:'none', boxSizing:'border-box' },
  filterRow: { padding:'0 20px 12px', display:'flex', gap:6 },
  filterBtn: { background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:20, padding:'5px 14px', color:'#B0AECB', fontSize:12, cursor:'pointer' },
  filterActive: { background:'#534AB7', border:'1px solid #534AB7', color:'#FFF' },
  section: { padding:'0 20px' },
  sectionTitle: { fontSize:12, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 },
  card: { background:'#1A2340', borderRadius:12, padding:14, marginBottom:10, cursor:'pointer', border:'1px solid #3A3A5C', display:'flex', gap:12, alignItems:'flex-start' },
  poster: { width:52, height:78, borderRadius:8, objectFit:'cover', background:'#2C2C4A', flexShrink:0 },
  info: { flex:1, minWidth:0 },
  name: { fontSize:14, fontWeight:600, marginBottom:4, color:'#FFF' },
  meta: { fontSize:12, color:'#B0AECB', marginBottom:6 },
  synopsis: { fontSize:12, color:'#8888A0', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' },
  recentChip: { display:'inline-flex', alignItems:'center', gap:6, background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:20, padding:'7px 12px', marginRight:8, marginBottom:8, cursor:'pointer', fontSize:12, color:'#E8E6F8', whiteSpace:'nowrap' },
  recentWrap: { padding:'0 20px 16px', display:'flex', flexWrap:'wrap' },
  trendingCard: { background:'#1A2340', borderRadius:12, padding:12, marginBottom:8, cursor:'pointer', border:'1px solid #3A3A5C', display:'flex', gap:12, alignItems:'center' },
  badge: { background:'#1E1B4B', borderRadius:20, padding:'2px 8px', fontSize:11, color:'#C8C4F8', fontWeight:600, flexShrink:0 },
  posterSmall: { width:40, height:40, borderRadius:8, objectFit:'cover', background:'#2C2C4A', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 },
  loading: { textAlign:'center', padding:'40px', color:'#B0AECB' },
  empty: { textAlign:'center', padding:'60px 20px', color:'#8888A0' },
}

export default function Search({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [queryText, setQueryText] = useState(location.state?.query || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [mediaFilter, setMediaFilter] = useState('all')
  const [recentSearches, setRecentSearches] = useState([])
  const [trendingShows, setTrendingShows] = useState([])
  const timer = useRef(null)

  useEffect(() => {
    setRecentSearches(JSON.parse(localStorage.getItem('recentSearches') || '[]'))
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
      const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(queryText)}&language=fr-FR&search_type=ngram`)
      const d = await r.json()
      let filtered = (d.results || [])
        .filter(x => x.media_type === 'tv' || x.media_type === 'movie')
        .sort((a, b) => {
          const dateA = a.first_air_date || a.release_date || '0'
          const dateB = b.first_air_date || b.release_date || '0'
          return dateB.localeCompare(dateA)
        })
        .slice(0, 10)
      if (mediaFilter !== 'all') filtered = filtered.filter(x => x.media_type === mediaFilter)
      setResults(filtered)
      setLoading(false)
    }, 400)
  }, [queryText, mediaFilter])

  function saveRecentSearch(name) {
    const stored = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    const updated = [name, ...stored.filter(s => s !== name)].slice(0, 6)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
    setRecentSearches(updated)
  }

  function selectShow(show) {
    saveRecentSearch(show.name || show.title)
    if (show.media_type === 'tv') {
      navigate(`/show/${show.id}`, { state: { fromSearch: true, searchQuery: queryText } })
    } else {
      navigate(`/episode/${show.id}/0/0`, { state: { show } })
    }
  }

  async function selectTrending(item) {
    const r = await fetch(`https://api.themoviedb.org/3/tv/${item.showId}?api_key=${TMDB_KEY}&language=fr-FR`)
    const d = await r.json()
    saveRecentSearch(d.name)
    navigate(`/show/${item.showId}`, { state: { fromSearch: true, searchQuery: queryText } })
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate('/')}>‹</button>
        <span style={s.title}>Rechercher</span>
      </div>

      <div style={s.searchWrap}>
        <input style={s.input} placeholder="Breaking Bad, Stranger Things…"
          value={queryText} onChange={e => setQueryText(e.target.value)} autoFocus />
      </div>

      {queryText && (
        <div style={s.filterRow}>
          {[['all','Tout'], ['tv','Séries'], ['movie','Films']].map(([k, l]) => (
            <button key={k} style={{ ...s.filterBtn, ...(mediaFilter === k ? s.filterActive : {}) }} onClick={() => setMediaFilter(k)}>{l}</button>
          ))}
        </div>
      )}

      {queryText ? (
        <div style={s.section}>
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
              <HeartButton user={user} showId={String(show.id)} showName={show.name || show.title} showPoster={show.poster_path} isMovie={show.media_type === 'movie'} size={18} />
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
            <div style={s.section}>
              <div style={s.sectionTitle}>🔥 Les plus commentées</div>
              {trendingShows.map((item, i) => (
                <div key={i} style={s.trendingCard} onClick={() => selectTrending(item)}>
                  <div style={s.posterSmall}>
                    {item.showPoster ? <img src={`https://image.tmdb.org/t/p/w92${item.showPoster}`} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} alt="" /> : '📺'}
                  </div>
                  <div style={{ flex:1, fontSize:14, fontWeight:600 }}>{item.showName}</div>
                  <div style={s.badge}>{item.count} 💬</div>
                  <HeartButton user={user} showId={String(item.showId)} showName={item.showName} showPoster={item.showPoster} isMovie={false} size={16} />
                </div>
              ))}
            </div>
          )}
          {trendingShows.length === 0 && recentSearches.length === 0 && (
            <div style={s.empty}><div style={{ fontSize:40, marginBottom:12 }}>🔍</div>Tape le nom d'une série ou d'un film</div>
          )}
        </>
      )}

      <Nav />
    </div>
  )
}
