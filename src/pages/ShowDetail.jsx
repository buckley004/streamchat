import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import Nav from '../components/Nav'
import HeartButton from '../components/HeartButton'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

function Heart({ filled, size=22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? "#B0AECB" : "none"} stroke="#B0AECB"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

export default function ShowDetail({ user }) {
  const { showId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [show, setShow] = useState(location?.state?.show || null)
  const [seasons, setSeasons] = useState([])
  const [openSeason, setOpenSeason] = useState(null)
  const [episodes, setEpisodes] = useState({})

  useEffect(() => {
    // Toujours charger depuis TMDB pour avoir les saisons complètes
    fetch(`https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_KEY}&language=fr-FR`)
      .then(r => r.json())
      .then(d => {
        if (d && d.id) {
          setShow(d)
          setSeasons((d.seasons || []).filter(s => s.season_number > 0))
        }
      })
      .catch(() => {})
  }, [showId])



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

  // show peut être null pendant le chargement - on affiche quand même la structure

  return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', color:'#FFF', paddingBottom:70 }}>

      {/* Bannière avec bouton retour */}
      <div style={{ position:'relative' }}>
        {show.backdrop_path
          ? <img src={`https://image.tmdb.org/t/p/w780${show?.backdrop_path}`} style={{ width:'100%', height:200, objectFit:'cover', display:'block' }} alt="" />
          : <div style={{ width:'100%', height:160, background:'#16213E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48 }}>📺</div>}
        <button
          style={{ position:'absolute', top:16, left:16, background:'rgba(0,0,0,0.6)', border:'none', borderRadius:20, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#FFF', fontSize:20 }}
          onClick={goBack}>‹</button>
      </div>

      {/* Titre + favori + synopsis */}
      <div style={{ padding:'16px 16px 14px', borderBottom:'1px solid #3A3A5C' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:10 }}>
          <div style={{ fontSize:20, fontWeight:700, flex:1, lineHeight:1.3 }}>{show?.name || 'Chargement…'}</div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <button
              style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}
              onClick={toggleFav} disabled={favLoading}>
              <Heart filled={isFav} size={24} />
            </button>
            {favCount > 0 && <span style={{ fontSize:11, color:'#B0AECB' }}>{favCount}</span>}
          </div>
        </div>
        {show?.overview && (
          <div style={{ fontSize:13, color:'#B0AECB', lineHeight:1.6 }}>{show.overview}</div>
        )}
      </div>

      {/* Saisons */}
      <div style={{ padding:'14px 16px 4px' }}>
        <div style={{ fontSize:11, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
          Saisons et épisodes
        </div>
        {seasons.map(season => (
          <div key={season.season_number}>
            <button
              style={{ background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:10, padding:'12px 14px', marginBottom:8, width:'100%', color:'#FFF', fontSize:13, cursor:'pointer', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center', boxSizing:'border-box' }}
              onClick={() => toggleSeason(season.season_number)}>
              <span>Saison {season.season_number}</span>
              <span style={{ color:'#B0AECB', fontSize:11 }}>
                {season.episode_count} épisodes {openSeason === season.season_number ? '▲' : '▼'}
              </span>
            </button>
            {openSeason === season.season_number && (
              <div style={{ paddingLeft:12 }}>
                {(episodes[season.season_number] || []).map(ep => (
                  <button
                    key={ep.episode_number}
                    style={{ background:'#0F0F1A', border:'none', borderRadius:8, padding:'10px 12px', marginBottom:6, width:'100%', color:'#FFF', fontSize:12, cursor:'pointer', textAlign:'left', display:'flex', gap:10, alignItems:'center', boxSizing:'border-box' }}
                    onClick={() => navigate(`/episode/${showId}/${season.season_number}/${ep.episode_number}`, {
                      state: { show, episode: ep, fromShow: true, fromSearch: location?.state?.fromSearch, searchQuery: location?.state?.searchQuery }
                    })}>
                    <span style={{ color:'#534AB7', fontWeight:700, minWidth:28, fontSize:11 }}>
                      E{String(ep.episode_number).padStart(2, '0')}
                    </span>
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
