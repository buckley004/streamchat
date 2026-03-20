import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import Nav from '../components/Nav'
import HeartButton from '../components/HeartButton'
import FavButton from '../components/FavButton'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

function isLatinTitle(t) {
  return /^[\x00-\x7F\u00C0-\u024F\s\d\-\:\!\?\.\,\'\"]+$/.test(t?.name || t?.title || '')
}

const s = {
  page: { minHeight:'100vh', background:'#0F0F1A', color:'#FFFFFF', paddingBottom:70 },
  header: { padding:'20px 20px 16px', display:'flex', alignItems:'center', gap:12 },
  back: { fontSize:22, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:4 },
  title: { fontSize:18, fontWeight:700 },
  searchWrap: { padding:'0 20px 16px' },
  input: { width:'100%', background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:12, padding:'14px 16px', color:'#FFFFFF', fontSize:15, outline:'none', boxSizing:'border-box' },
  filterRow: { display:'flex', gap:8, padding:'0 20px 12px', overflowX:'auto' },
  filterBtn: { background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:20, padding:'6px 14px', color:'#B0AECB', fontSize:12, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
  filterActive: { background:'#534AB7', border:'1px solid #534AB7', color:'#FFF' },
  card: { background:'#1A2340', borderRadius:12, padding:14, marginBottom:10, cursor:'pointer', border:'1px solid #3A3A5C', display:'flex', gap:12, alignItems:'center' },
  poster: { width:52, height:78, borderRadius:8, objectFit:'cover', background:'#2C2C4A', flexShrink:0 },
  info: { flex:1, minWidth:0 },
  name: { fontSize:14, fontWeight:600, marginBottom:4, color:'#FFFFFF' },
  meta: { fontSize:12, color:'#B0AECB', marginBottom:6 },
  synopsis: { fontSize:12, color:'#B0AECB', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' },
  recentChip: { display:'inline-flex', alignItems:'center', gap:6, background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:20, padding:'7px 12px', marginRight:8, marginBottom:8, cursor:'pointer', fontSize:12, color:'#E8E6F8', whiteSpace:'nowrap' },
  recentWrap: { padding:'0 20px 16px', display:'flex', flexWrap:'wrap' },
  sectionTitle: { fontSize:12, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 },
  trendingCard: { background:'#1A2340', borderRadius:12, padding:12, marginBottom:8, cursor:'pointer', border:'1px solid #3A3A5C', display:'flex', gap:12, alignItems:'center' },
  badge: { background:'#1E1B4B', borderRadius:20, padding:'2px 8px', fontSize:11, color:'#C8C4F8', fontWeight:600, flexShrink:0 },
  posterSmall: { width:40, height:40, borderRadius:8, objectFit:'cover', background:'#2C2C4A', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 },
  loading: { textAlign:'center', padding:'40px', color:'#B0AECB' },
  empty: { textAlign:'center', padding:'60px 20px', color:'#8888A0' },
}

const TYPE_FILTERS = [
  { id:'all', label:'Tout' },
  { id:'tv', label:'Séries' },
  { id:'movie', label:'Films' },
  { id:'show', label:'Shows' },
]

export default function Search({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [queryText, setQueryText] = useState(location?.state?.query || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState([])
  const [trendingShows, setTrendingShows] = useState([])
  const [mediaFilter, setMediaFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const timer = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setRecentSearches(JSON.parse(localStorage.getItem('recentSearches') || '[]'))
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'userComments'), orderBy('createdAt', 'desc'), limit(50))
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
    timer.current = setTimeout(async () => {  // 200ms pour suggestions rapides
      setLoading(true)
      // Recherche avec ngram pour tolérer les fautes de frappe
      const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(queryText)}&language=fr-FR&search_type=ngram`)
      const d = await r.json()
      const filtered = (d.results || [])
        .filter(x => (x.media_type === 'tv' || x.media_type === 'movie') && isLatinTitle(x))
        .sort((a, b) => {
          const dateA = a.first_air_date || a.release_date || '0'
          const dateB = b.first_air_date || b.release_date || '0'
          return dateB.localeCompare(dateA)
        })
        .slice(0, 12)
      const withFilter = mediaFilter === 'all' ? filtered
        : mediaFilter === 'tv' ? filtered.filter(x => x.media_type === 'tv')
        : filtered.filter(x => x.media_type === 'movie')
      setResults(withFilter)
      setLoading(false)
    }, 300)
  }, [queryText])

  // Auto-search si on arrive avec une query dans le state
  useEffect(() => {
    if (location?.state?.query) {
      setQueryText(location.state.query)
    }
  }, [])

  function saveRecentSearch(name) {
    const stored = JSON.parse(localStorage.getItem('recentSearches') || '[]')
    const updated = [name, ...stored.filter(s => s !== name)].slice(0, 6)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
    setRecentSearches(updated)
  }

  function goToShow(show) {
    saveRecentSearch(show.name || show.title)
    navigate(`/show/${show.id}`, { state: { fromSearch: true, searchQuery: queryText } })
  }

  function goToMovie(movie) {
    saveRecentSearch(movie.title)
    navigate(`/episode/${movie.id}/0/0`, { state: { show: { ...movie, media_type: 'movie' } } })
  }

  async function goToTrending(item) {
    navigate(`/show/${item.showId}`, { state: { fromSearch: true, searchQuery: queryText } })
  }

  function handleSelect(show) {
    if (show.media_type === 'tv') goToShow(show)
    else goToMovie(show)
  }

  const filteredResults = results.filter(show => {
    if (typeFilter === 'all') return true
    if (typeFilter === 'movie') return show.media_type === 'movie'
    if (typeFilter === 'tv') return show.media_type === 'tv' && !show.genre_ids?.some(g => [10767,10763,10764,99].includes(g))
    if (typeFilter === 'show') return show.media_type === 'tv' && show.genre_ids?.some(g => [10767,10763,10764,99].includes(g))
    return true
  })

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate('/')}>‹</button>
        <span style={s.title}>Rechercher</span>
      </div>

      <div style={s.searchWrap}>
        <input ref={inputRef} style={s.input} placeholder="Breaking Bad, Stranger Things…"
          value={queryText} onChange={e => setQueryText(e.target.value)} autoFocus />
      </div>

      {/* Filtres par type */}
      <div style={s.filterRow}>
        {TYPE_FILTERS.map(f => (
          <button key={f.id}
            style={{ ...s.filterBtn, ...(typeFilter === f.id ? s.filterActive : {}) }}
            onClick={() => setTypeFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {queryText && (
        <div style={{ padding:'0 20px 8px', display:'flex', gap:6 }}>
          {[['all','Tout'],['tv','Séries'],['movie','Films']].map(([k,l]) => (
            <button key={k}
              style={{ background:mediaFilter===k?'#534AB7':'#1A2340', border:mediaFilter===k?'1px solid #534AB7':'1px solid #3A3A5C', borderRadius:20, padding:'5px 14px', color:mediaFilter===k?'#FFF':'#B0AECB', fontSize:12, cursor:'pointer' }}
              onClick={() => setMediaFilter(k)}>{l}</button>
          ))}
        </div>
      )}
      {queryText ? (
        <div style={{ padding:'0 20px' }}>
          {loading && <div style={s.loading}>Recherche…</div>}
          {!loading && filteredResults.length === 0 && (
            <div style={s.empty}><div style={{ fontSize:32, marginBottom:8 }}>🤷</div>Aucun résultat</div>
          )}
          {filteredResults.map(show => (
            <div key={show.id} style={s.card} onClick={() => handleSelect(show)}>
              {show.poster_path
                ? <img src={`https://image.tmdb.org/t/p/w92${show.poster_path}`} style={s.poster} alt="" />
                : <div style={{ ...s.poster, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>📺</div>}
              <div style={s.info}>
                <div style={s.name}>{show.name || show.title}</div>
                <div style={s.meta}>{show.media_type === 'tv' ? 'Série' : 'Film'} · {(show.first_air_date || show.release_date || '').slice(0, 4)}</div>
                {show.overview && <div style={s.synopsis}>{show.overview}</div>}
              </div>
              <FavButton user={user} showId={String(show.id)} showName={show.name||show.title} showPoster={show.poster_path||''} isMovie={show.media_type==='movie'} size={18} />
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
                <div key={i} style={s.trendingCard} onClick={() => goToTrending(item)}>
                  <div style={s.posterSmall}>
                    {item.showPoster ? <img src={`https://image.tmdb.org/t/p/w92${item.showPoster}`} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} alt="" /> : '📺'}
                  </div>
                  <div style={{ flex:1, fontSize:14, fontWeight:600 }}>{item.showName}</div>
                  <div style={s.badge}>{item.count} 💬</div>
                  <FavButton user={user} showId={String(item.showId)} showName={item.showName} showPoster={item.showPoster||''} isMovie={false} size={16} />
                </div>
              ))}
            </div>
          )}
          {trendingShows.length === 0 && recentSearches.length === 0 && (
            <div style={s.empty}><div style={{ fontSize:40, marginBottom:12 }}>🔍</div><div>Tape le nom d'une série ou d'un film</div></div>
          )}
        </>
      )}

      <Nav />
    </div>
  )
}
