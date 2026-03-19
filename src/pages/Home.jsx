import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore'
import { db } from '../firebase'
import Nav from '../components/Nav'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

// Genres à exclure (talk shows, late shows, reality, news, documentaires)
const EXCLUDED_GENRE_IDS = [10767, 10763, 10764, 99]

function formatTime(secs) {
  if (!secs && secs !== 0) return ''
  return `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`
}

// Cœur SVG minimaliste
function Heart({ filled, size=20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#E24B4A" : "none"} stroke={filled ? "#E24B4A" : "#B0AECB"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

const s = {
  page: { minHeight:'100vh', background:'#0F0F1A', color:'#FFFFFF', paddingBottom:70 },
  header: { padding:'20px 20px 0', display:'flex', alignItems:'center', justifyContent:'space-between' },
  logo: { fontSize:18, fontWeight:700 },
  avatar: { width:34, height:34, borderRadius:'50%', cursor:'pointer', border:'2px solid #534AB7', objectFit:'cover' },
  avatarFallback: { width:34, height:34, borderRadius:'50%', cursor:'pointer', border:'2px solid #534AB7', background:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#fff', fontWeight:700 },
  searchBtn: { margin:'14px 20px 8px', background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' },
  searchTxt: { color:'#B0AECB', fontSize:14, flex:1 },
  section: { padding:'14px 20px 4px' },
  sectionTitle: { fontSize:11, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 },
  card: { background:'#1A2340', borderRadius:12, padding:12, marginBottom:8, cursor:'pointer', border:'1px solid #3A3A5C', display:'flex', alignItems:'center', gap:12 },
  cardImg: { width:46, height:46, borderRadius:8, objectFit:'cover', background:'#2C2C4A', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 },
  cardInfo: { flex:1, minWidth:0 },
  cardTitle: { fontSize:13, fontWeight:600, marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'#FFFFFF' },
  cardMeta: { fontSize:11, color:'#B0AECB' },
  badge: { background:'#1E1B4B', borderRadius:20, padding:'2px 7px', fontSize:10, color:'#C8C4F8', fontWeight:600, flexShrink:0 },
  buzzCard: { background:'#1A2340', borderRadius:12, padding:12, marginBottom:8, cursor:'pointer', border:'1px solid #3A3A5C', display:'flex', alignItems:'center', justifyContent:'space-between' },
  buzzLeft: { flex:1, minWidth:0 },
  buzzTitle: { fontSize:13, fontWeight:600, color:'#FFFFFF', marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  buzzMeta: { fontSize:11, color:'#B0AECB' },
  buzzBadge: { background:'#1E1B4B', borderRadius:20, padding:'3px 10px', fontSize:11, color:'#C8C4F8', fontWeight:600, flexShrink:0, marginLeft:8 },
  scrollRow: { display:'flex', gap:10, overflowX:'auto', padding:'0 20px 8px', scrollbarWidth:'none' },
  releaseCard: { flexShrink:0, width:120, background:'#1A2340', borderRadius:12, overflow:'hidden', border:'1px solid #3A3A5C', cursor:'pointer' },
  releaseImg: { width:'100%', height:68, objectFit:'cover', background:'#2C2C4A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 },
  releaseInfo: { padding:'8px' },
  releaseTitle: { fontSize:11, fontWeight:600, color:'#FFFFFF', lineHeight:1.3, marginBottom:2 },
  releaseMeta: { fontSize:10, color:'#B0AECB' },
  sectionHeader: { display:'flex', alignItems:'center', padding:'14px 20px 0' },
  sectionHeaderTitle: { fontSize:11, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em' },
}

export default function Home({ user }) {
  const navigate = useNavigate()
  const [buzzScenes, setBuzzScenes] = useState([])
  const [inProgress, setInProgress] = useState([])
  const [newSeries, setNewSeries] = useState([])
  const [showSeries, setShowSeries] = useState([])
  const [streamingMovies, setStreamingMovies] = useState([])
  const [userLang, setUserLang] = useState('fr-FR')

  // Scènes qui buzzent — lit depuis userComments (collection plate)
  useEffect(() => {
    const q = query(collection(db, 'userComments'), orderBy('createdAt','desc'), limit(200))
    return onSnapshot(q, snap => {
      const buckets = {}
      snap.docs.forEach(doc => {
        const d = doc.data()
        if (!d.showId) return
        // Grouper par épisode + fenêtre de 60s si timestamp dispo, sinon juste par épisode
        const tBucket = d.timestamp != null ? Math.floor(d.timestamp/60) : 'notimed'
        const key = `${d.showId}_${d.seasonNum}_${d.episodeNum}_${tBucket}`
        if (!buckets[key]) buckets[key] = {
          showId: d.showId, showName: d.showName,
          seasonNum: d.seasonNum, episodeNum: d.episodeNum,
          timestamp: d.timestamp, count: 0,
          isMovie: !d.seasonNum || d.seasonNum === 0
        }
        buckets[key].count++
        buckets[key].count += Object.values(d.reactions||{}).reduce((a,b)=>a+b,0)
      })
      const sorted = Object.values(buckets)
        .filter(b => b.count > 0)
        .sort((a,b) => b.count - a.count)
        .slice(0, 5)
      setBuzzScenes(sorted)
    })
  }, [])

  // Mes séries en cours
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

  // Sorties séries + shows + films streaming
  useEffect(() => {
    Promise.all([
      fetch(`https://api.themoviedb.org/3/tv/on_the_air?api_key=${TMDB_KEY}&language=fr-FR`).then(r=>r.json()),
      fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=fr-FR`).then(r=>r.json()),
    ]).then(([tv, movies]) => {
      const allTV = tv.results || []
      // Séparer séries scripted et shows
      const scripted = allTV.filter(s => !s.genre_ids?.some(g => EXCLUDED_GENRE_IDS.includes(g))).slice(0,8)
      const shows = allTV.filter(s => s.genre_ids?.some(g => EXCLUDED_GENRE_IDS.includes(g))).slice(0,8)
      setNewSeries(scripted)
      setShowSeries(shows)
      setStreamingMovies((movies.results||[]).slice(0,8))
    })
  }, [])

  const name = user?.displayName?.split(' ')[0] || 'toi'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const photoURL = user?.photoURL || ''

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
        <div style={{ fontSize:13, color:'#B0AECB' }}>Qu'est-ce que tu regardes ce soir ?</div>
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
                <div style={s.cardMeta}>{(!item.seasonNum||item.seasonNum===0) ? 'Film' : `S${String(item.seasonNum).padStart(2,'0')}E${String(item.episodeNum).padStart(2,'0')}`}</div>
              </div>
              <span style={{ fontSize:15, color:'#B0AECB' }}>›</span>
            </div>
          ))}
        </div>
      )}

      {buzzScenes.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>🔥 Scènes qui buzzent</div>
          {buzzScenes.map((scene, i) => (
            <div key={i} style={s.buzzCard} onClick={() => navigate(`/episode/${scene.showId}/${scene.seasonNum}/${scene.episodeNum}`)}>
              <div style={s.buzzLeft}>
                <div style={s.buzzTitle}>{scene.showName}</div>
                <div style={s.buzzMeta}>
                  {scene.isMovie ? 'Film' : `S${String(scene.seasonNum).padStart(2,'0')}E${String(scene.episodeNum).padStart(2,'0')}`}
                  {scene.timestamp !== undefined && ` · ${formatTime(scene.timestamp)}`}
                </div>
              </div>
              <div style={s.buzzBadge}>🔥 {scene.count} réactions</div>
            </div>
          ))}
        </div>
      )}

      {newSeries.length > 0 && (
        <>
          <div style={s.sectionHeader}><div style={s.sectionHeaderTitle}>📺 Séries — cette semaine</div></div>
          <div style={{ ...s.scrollRow, marginTop:10 }}>
            {newSeries.map(show => (
              <div key={show.id} style={s.releaseCard} onClick={() => navigate('/search', { state:{ autoSelect:{ ...show, media_type:'tv' } } })}>
                <div style={s.releaseImg}>
                  {show.backdrop_path ? <img src={`https://image.tmdb.org/t/p/w300${show.backdrop_path}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : '📺'}
                </div>
                <div style={s.releaseInfo}><div style={s.releaseTitle}>{show.name}</div></div>
              </div>
            ))}
          </div>
        </>
      )}

      {showSeries.length > 0 && (
        <>
          <div style={s.sectionHeader}><div style={s.sectionHeaderTitle}>🎤 Shows & Divertissement</div></div>
          <div style={{ ...s.scrollRow, marginTop:10 }}>
            {showSeries.map(show => (
              <div key={show.id} style={s.releaseCard} onClick={() => navigate('/search', { state:{ autoSelect:{ ...show, media_type:'tv' } } })}>
                <div style={s.releaseImg}>
                  {show.backdrop_path ? <img src={`https://image.tmdb.org/t/p/w300${show.backdrop_path}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : '🎤'}
                </div>
                <div style={s.releaseInfo}><div style={s.releaseTitle}>{show.name}</div></div>
              </div>
            ))}
          </div>
        </>
      )}

      {streamingMovies.length > 0 && (
        <>
          <div style={s.sectionHeader}><div style={s.sectionHeaderTitle}>🎬 Films populaires en streaming</div></div>
          <div style={{ ...s.scrollRow, marginTop:10 }}>
            {streamingMovies.map(movie => (
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

      <Nav />
    </div>
  )
}
