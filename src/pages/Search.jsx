import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8' // clé publique TMDB (read-only)

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFFFFF', paddingBottom:80 },
  header: { padding:'20px 20px 16px', display:'flex', alignItems:'center', gap:12 },
  back: { fontSize:22, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:4 },
  title: { fontSize:18, fontWeight:700 },
  searchWrap: { padding:'0 20px 20px' },
  input: { width:'100%', background:'#16213E', border:'1px solid #2C2C2A', borderRadius:12, padding:'14px 16px', color:'#FFFFFF', fontSize:15, outline:'none' },
  results: { padding:'0 20px' },
  card: { background:'#16213E', borderRadius:12, padding:14, marginBottom:10, cursor:'pointer', border:'1px solid #2C2C2A', display:'flex', gap:14, alignItems:'center' },
  poster: { width:52, height:78, borderRadius:8, objectFit:'cover', background:'#2C2C2A', flexShrink:0 },
  info: { flex:1 },
  name: { fontSize:14, fontWeight:600, marginBottom:4 },
  meta: { fontSize:12, color:'#888780' },
  seasons: { marginTop:20 },
  seasonBtn: { background:'#16213E', border:'1px solid #2C2C2A', borderRadius:10, padding:'12px 16px', marginBottom:8, width:'100%', color:'#FFF', fontSize:14, cursor:'pointer', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center' },
  episodes: { padding:'0 0 0 12px' },
  epBtn: { background:'#0F0F1A', border:'none', borderRadius:8, padding:'10px 14px', marginBottom:6, width:'100%', color:'#FFF', fontSize:13, cursor:'pointer', textAlign:'left', display:'flex', gap:10, alignItems:'center' },
  epNum: { color:'#534AB7', fontWeight:700, minWidth:28, fontSize:12 },
  empty: { textAlign:'center', padding:'60px 20px', color:'#444441' },
  loading: { textAlign:'center', padding:'40px', color:'#888780' },
}

export default function Search({ user }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [openSeason, setOpenSeason] = useState(null)
  const [episodes, setEpisodes] = useState({})
  const timer = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setLoading(true)
      const r = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`)
      const d = await r.json()
      setResults((d.results || []).filter(x => x.media_type === 'tv' || x.media_type === 'movie').slice(0, 8))
      setLoading(false)
    }, 400)
  }, [query])

  async function selectShow(show) {
    setSelected(show)
    if (show.media_type === 'tv') {
      const r = await fetch(`https://api.themoviedb.org/3/tv/${show.id}?api_key=${TMDB_KEY}&language=fr-FR`)
      const d = await r.json()
      setSeasons((d.seasons || []).filter(s => s.season_number > 0))
    } else {
      navigate(`/episode/${show.id}/0/0`, { state: { show } })
    }
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

  if (selected) return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => { setSelected(null); setSeasons([]); setOpenSeason(null) }}>←</button>
        <span style={s.title}>{selected.name || selected.title}</span>
      </div>
      <div style={s.seasons}>
        <div style={{ padding:'0 20px 8px', fontSize:13, color:'#888780', textTransform:'uppercase', letterSpacing:'0.08em' }}>Choisir un épisode</div>
        {seasons.map(season => (
          <div key={season.season_number} style={{ padding:'0 20px' }}>
            <button style={s.seasonBtn} onClick={() => toggleSeason(season.season_number)}>
              <span>Saison {season.season_number}</span>
              <span style={{ color:'#888780', fontSize:12 }}>{season.episode_count} épisodes {openSeason === season.season_number ? '▲' : '▼'}</span>
            </button>
            {openSeason === season.season_number && (
              <div style={s.episodes}>
                {(episodes[season.season_number] || []).map(ep => (
                  <button key={ep.episode_number} style={s.epBtn}
                    onClick={() => navigate(`/episode/${selected.id}/${season.season_number}/${ep.episode_number}`, { state: { show: selected, episode: ep } })}>
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
        <button style={s.back} onClick={() => navigate('/')}>←</button>
        <span style={s.title}>Rechercher</span>
      </div>
      <div style={s.searchWrap}>
        <input style={s.input} placeholder="Breaking Bad, Stranger Things…" value={query}
          onChange={e => setQuery(e.target.value)} autoFocus />
      </div>
      <div style={s.results}>
        {loading && <div style={s.loading}>Recherche…</div>}
        {!loading && query && results.length === 0 && <div style={s.empty}><div style={{ fontSize:32, marginBottom:8 }}>🤷</div>Aucun résultat</div>}
        {results.map(show => (
          <div key={show.id} style={s.card} onClick={() => selectShow(show)}>
            {show.poster_path
              ? <img src={`https://image.tmdb.org/t/p/w92${show.poster_path}`} style={s.poster} alt="" />
              : <div style={{ ...s.poster, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>📺</div>}
            <div style={s.info}>
              <div style={s.name}>{show.name || show.title}</div>
              <div style={s.meta}>{show.media_type === 'tv' ? 'Série' : 'Film'} · {(show.first_air_date || show.release_date || '').slice(0,4)}</div>
            </div>
            <span style={{ fontSize:18 }}>›</span>
          </div>
        ))}
        {!query && (
          <div style={s.empty}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <div>Tape le nom d'une série ou d'un film</div>
          </div>
        )}
      </div>
    </div>
  )
}
