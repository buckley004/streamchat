import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { ToastContainer, useToast } from '../components/Toast'
import Nav from '../components/Nav'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'
const EMOJIS = ['❤️','😂','😮','😢','🔥']
const BADGES = [
  { id:'first', emoji:'🎬', label:'Premier pas', threshold:1 },
  { id:'fire', emoji:'🔥', label:'En feu', threshold:10 },
  { id:'night', emoji:'🌙', label:'Noctambule', threshold:25 },
  { id:'star', emoji:'⭐', label:'Top voix', threshold:50 },
  { id:'legend', emoji:'👑', label:'Légende', threshold:200 },
]

function formatTime(secs) {
  if (!secs && secs !== 0) return ''
  return `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`
}

function timeAgo(ts) {
  if (!ts) return ''
  const d = Math.floor((Date.now()-ts.toMillis())/1000)
  if (d<60) return 'À l\'instant'
  if (d<3600) return `${Math.floor(d/60)}min`
  if (d<86400) return `${Math.floor(d/3600)}h`
  return `${Math.floor(d/86400)}j`
}

function getTopBadge(count) {
  const earned = BADGES.filter(b => count >= b.threshold)
  return earned.length ? earned[earned.length-1] : null
}

export default function Episode({ user }) {
  const { showId, seasonNum, episodeNum } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { toasts, showToast } = useToast()

  // Données
  const [comments, setComments] = useState([])
  const [show, setShow] = useState(state?.show || null)
  const [episode, setEpisode] = useState(state?.episode || null)

  // Timer
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)
  const startRef = useRef(null)

  // UI
  const [text, setText] = useState('')
  const [filter, setFilter] = useState('all')
  const [replyTo, setReplyTo] = useState(null)
  const [showEmojiFor, setShowEmojiFor] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [sliderTime, setSliderTime] = useState(null)
  const [maxTime, setMaxTime] = useState(120)

  // GIF
  const [showGif, setShowGif] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifs, setGifs] = useState([])

  // Réseau
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingComments, setPendingComments] = useState([])

  // User stats
  const [userCommentCount, setUserCommentCount] = useState(0)

  const bottomRef = useRef(null)
  const isMovie = seasonNum === '0' && episodeNum === '0'

  // Online/offline
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Charger show et épisode
  useEffect(() => {
    if (!show) {
      const url = isMovie
        ? `https://api.themoviedb.org/3/movie/${showId}?api_key=${TMDB_KEY}&language=fr-FR`
        : `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_KEY}&language=fr-FR`
      fetch(url).then(r => r.json()).then(d => {
        setShow(d)
        if (d.runtime) setMaxTime(d.runtime * 60)
      })
    }
    if (!episode && parseInt(seasonNum) > 0) {
      fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNum}/episode/${episodeNum}?api_key=${TMDB_KEY}&language=fr-FR`)
        .then(r => r.json()).then(d => {
          setEpisode(d)
          if (d.runtime) setMaxTime(d.runtime * 60)
        })
    }
  }, [])

  // Commentaires temps réel
  useEffect(() => {
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const q = query(collection(db, 'comments', colId, 'messages'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setComments(all)
      const ts = all.filter(c => c.timestamp != null).map(c => c.timestamp)
      if (ts.length) setMaxTime(m => Math.max(m, Math.max(...ts) + 60))
    })
  }, [showId, seasonNum, episodeNum])

  // Stats user
  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setUserCommentCount(snap.data().commentCount || 0)
    })
  }, [user.uid])

  // Timer
  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [running])

  // Scroll auto
  useEffect(() => {
    if (running) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  // Sync commentaires hors-ligne
  useEffect(() => {
    if (isOnline && pendingComments.length > 0) {
      const colId = `${showId}_s${seasonNum}_e${episodeNum}`
      pendingComments.forEach(async c => {
        await addDoc(collection(db, 'comments', colId, 'messages'), c)
        await addDoc(collection(db, 'userComments'), c)
      })
      setPendingComments([])
    }
  }, [isOnline])

  // Heatmap
  const heatmap = useMemo(() => {
    const buckets = 40
    const data = new Array(buckets).fill(0)
    comments.forEach(c => {
      if (c.timestamp != null) {
        const idx = Math.min(Math.floor((c.timestamp / maxTime) * buckets), buckets - 1)
        data[idx]++
      }
    })
    const max = Math.max(...data, 1)
    return data.map(v => v / max)
  }, [comments, maxTime])

  // Filtrage commentaires
  const filtered = useMemo(() => {
    let list = filter === 'all' ? comments
      : filter === 'ts' ? comments.filter(c => c.timestamp !== null)
      : comments.filter(c => c.userId === user.uid)
    if (sliderTime !== null) {
      list = list.filter(c => c.timestamp === null || Math.abs(c.timestamp - sliderTime) <= 60)
    }
    return list
  }, [comments, filter, sliderTime, user.uid])

  // Envoyer commentaire
  async function sendComment() {
    if (!text.trim()) return
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const newCount = userCommentCount + 1
    const topBadge = getTopBadge(newCount)
    const commentData = {
      text: text.trim(),
      userId: user.uid,
      userName: user.displayName || 'Anonyme',
      userPhoto: user.photoURL || '',
      userBadge: topBadge ? `${topBadge.emoji} ${topBadge.label}` : null,
      timestamp: running ? elapsed : null,
      showId,
      showName: show?.name || show?.title || '',
      showPoster: show?.poster_path || '',
      seasonNum: parseInt(seasonNum),
      episodeNum: parseInt(episodeNum),
      episodeName: episode?.name || show?.title || '',
      replyTo: replyTo ? { id: replyTo.id, userName: replyTo.userName, text: replyTo.text?.slice(0, 60) } : null,
      reactions: {},
      createdAt: serverTimestamp()
    }
    if (!isOnline) {
      setPendingComments(p => [...p, commentData])
    } else {
      await addDoc(collection(db, 'comments', colId, 'messages'), commentData)
      await addDoc(collection(db, 'userComments'), commentData)
      await setDoc(doc(db, 'users', user.uid), { commentCount: newCount }, { merge: true })
      setUserCommentCount(newCount)
      if (newCount === 1) showToast('Premier commentaire posté !', '🎬')
      const prevBadges = BADGES.filter(b => (newCount - 1) >= b.threshold)
      const newBadges = BADGES.filter(b => newCount >= b.threshold)
      if (newBadges.length > prevBadges.length) {
        const badge = newBadges[newBadges.length - 1]
        showToast(`Badge débloqué : ${badge.label}`, badge.emoji)
      }
    }
    setText('')
    setReplyTo(null)
  }

  // Réactions
  async function addReaction(commentId, emoji) {
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    await updateDoc(doc(db, 'comments', colId, 'messages', commentId), {
      [`reactions.${emoji}`]: increment(1)
    })
    setShowEmojiFor(null)
  }

  // Partage
  function handleShare(c) {
    const ts = c.timestamp !== null ? ` à ${formatTime(c.timestamp)}` : ''
    const url = `${window.location.origin}/episode/${showId}/${seasonNum}/${episodeNum}`
    const textPart = c.text ? `"${c.text}"` : ''
    const gifPart = c.gifUrl ? `\n🎬 ${c.gifUrl}` : ''
    const msg = `${textPart}${ts}${gifPart} — sur ${c.showName || 'StreamChat'}\n👉 ${url}`
    if (!localStorage.getItem('first_share_done')) {
      localStorage.setItem('first_share_done', '1')
      showToast('Premier partage !', '↗️')
    }
    if (navigator.share) navigator.share({ text: msg })
    else { navigator.clipboard.writeText(msg); showToast('Lien copié !', '📋') }
  }

  // GIF
  async function searchGifs(q) {
    if (!q.trim()) { setGifs([]); return }
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh&q=${encodeURIComponent(q)}&limit=12&rating=g`)
    const d = await r.json()
    setGifs(d.data || [])
  }

  async function sendGif(gifUrl) {
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const commentData = {
      text: '', gifUrl,
      userId: user.uid,
      userName: user.displayName || 'Anonyme',
      userPhoto: user.photoURL || '',
      userBadge: getTopBadge(userCommentCount) ? `${getTopBadge(userCommentCount).emoji} ${getTopBadge(userCommentCount).label}` : null,
      timestamp: running ? elapsed : null,
      showId, showName: show?.name || show?.title || '',
      showPoster: show?.poster_path || '',
      seasonNum: parseInt(seasonNum), episodeNum: parseInt(episodeNum),
      episodeName: episode?.name || show?.title || '',
      replyTo: null, reactions: {}, createdAt: serverTimestamp()
    }
    await addDoc(collection(db, 'comments', colId, 'messages'), commentData)
    await addDoc(collection(db, 'userComments'), commentData)
    setShowGif(false); setGifs([]); setGifQuery('')
  }

  // Navigation retour
  function goBack() {
    if (isMovie) navigate(-1)
    else navigate(`/show/${showId}`, { state: { fromSearch: state?.fromSearch, searchQuery: state?.searchQuery } })
  }

  const backdrop = show?.backdrop_path
  const title = show?.name || show?.title || 'Série'
  const epLabel = isMovie
    ? (show?.release_date?.slice(0, 4) || 'Film')
    : `S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')} · ${episode?.name || 'Épisode'}`
  const synopsis = show?.overview || episode?.overview || ''

  return (
    <div style={{ height:'100dvh', maxWidth:'100vw', background:'#0F0F1A', color:'#FFF', display:'flex', flexDirection:'column', overflow:'hidden', paddingBottom:60 }}>
      <ToastContainer toasts={toasts} />

      {/* Modal GIF plein écran */}
      {showGif && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.97)', zIndex:300, display:'flex', flexDirection:'column', padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <button style={{ background:'none', border:'none', color:'#FFF', fontSize:22, cursor:'pointer' }} onClick={() => setShowGif(false)}>←</button>
            <span style={{ fontSize:15, fontWeight:700 }}>Choisir un GIF</span>
          </div>
          <input
            style={{ width:'100%', background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:10, padding:'10px 14px', color:'#FFF', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:12 }}
            placeholder="Rechercher un GIF…"
            value={gifQuery}
            autoFocus
            onChange={e => { setGifQuery(e.target.value); searchGifs(e.target.value) }}
          />
          <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, overflowY:'auto' }}>
            {gifs.map(g => (
              <img key={g.id} src={g.images.fixed_height_small.url}
                style={{ width:'100%', borderRadius:8, cursor:'pointer', objectFit:'cover', height:90 }}
                onClick={() => sendGif(g.images.original.url)} alt="" />
            ))}
            {gifs.length === 0 && <div style={{ gridColumn:'1/-1', textAlign:'center', color:'#8888A0', padding:40, fontSize:13 }}>
              {gifQuery ? 'Aucun résultat' : 'Tape un mot pour rechercher'}
            </div>}
          </div>
        </div>
      )}

      {/* Bannière */}
      {backdrop
        ? <img src={`https://image.tmdb.org/t/p/w780${backdrop}`} style={{ width:'100%', height:headerCollapsed?0:110, objectFit:'cover', background:'#16213E', flexShrink:0, transition:'height 0.2s' }} alt="" />
        : <div style={{ width:'100%', height:headerCollapsed?0:70, background:'#16213E', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, overflow:'hidden', transition:'height 0.2s' }}>🎬</div>}

      {/* Header */}
      <div style={{ padding:'8px 14px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #3A3A5C', flexShrink:0, background:'#0F0F1A' }}>
        <button style={{ fontSize:20, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:'4px 6px', flexShrink:0 }} onClick={goBack}>←</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, color:'#B0AECB', marginBottom:1 }}>{title}</div>
          <div style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{epLabel}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <span style={{ fontSize:11, color:'#B0AECB' }}>{comments.length} 💬</span>
          {!isMovie && (
            <button style={{ background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:8, padding:'3px 8px', fontSize:10, color:'#C8C4F8', cursor:'pointer' }}
              onClick={() => navigate(`/show/${showId}`, { state: { fromSearch: state?.fromSearch, searchQuery: state?.searchQuery } })}>
              Épisodes
            </button>
          )}
          <button style={{ background:'none', border:'none', color:'#B0AECB', fontSize:11, cursor:'pointer', padding:'2px 6px', border:'1px solid #3A3A5C', borderRadius:6 }}
            onClick={() => setHeaderCollapsed(h => !h)}>
            {headerCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Contenu collapsible */}
      {!headerCollapsed && (
        <>
          {synopsis && (
            <div style={{ padding:'7px 14px', fontSize:11, color:'#B0AECB', lineHeight:1.5, borderBottom:'1px solid #3A3A5C', flexShrink:0 }}>
              {synopsis.slice(0, 140)}{synopsis.length > 140 ? '…' : ''}
            </div>
          )}
          {!isOnline && (
            <div style={{ background:'#412402', padding:'4px 14px', fontSize:10, color:'#FAC775', textAlign:'center', flexShrink:0 }}>
              ⚠️ Hors-ligne — commentaires en attente
            </div>
          )}
          <div style={{ padding:'7px 14px', background:'#16213E', borderBottom:'1px solid #3A3A5C', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {!running
                ? <button style={{ background:'#534AB7', border:'none', borderRadius:8, padding:'6px 12px', color:'#FFF', fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0 }} onClick={() => setRunning(true)}>▶ Je regarde maintenant</button>
                : <button style={{ background:'#2C2C4A', border:'none', borderRadius:8, padding:'6px 12px', color:'#E24B4A', fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0 }} onClick={() => setRunning(false)}>⏸ Pause</button>}
              {(running || elapsed > 0) && (
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color: running ? '#534AB7' : '#888780', fontVariantNumeric:'tabular-nums' }}>{formatTime(elapsed)}</div>
                  <div style={{ fontSize:9, color:'#B0AECB' }}>{running ? 'en cours' : 'en pause'}</div>
                </div>
              )}
            </div>
          </div>

          {/* Heatmap */}
          <div style={{ padding:'6px 14px', flexShrink:0, borderBottom:'1px solid #3A3A5C' }}>
            <div style={{ fontSize:10, color:'#B0AECB', marginBottom:4 }}>
              🔥 Intensité des réactions {sliderTime !== null ? `— ${formatTime(sliderTime)} ±1min` : ''}
            </div>
            <svg width="100%" height="36" style={{ display:'block', marginBottom:4 }}>
              <defs>
                <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#534AB7" stopOpacity="0.5"/>
                  <stop offset="100%" stopColor="#534AB7" stopOpacity="0.05"/>
                </linearGradient>
              </defs>
              {(() => {
                const W = 320, H = 36, n = heatmap.length
                const pts = heatmap.map((v, i) => [i / (n - 1) * W, H - Math.max(2, v * H * 0.9)])
                const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
                const area = line + ` L${W},${H} L0,${H} Z`
                const sliderX = sliderTime !== null ? (sliderTime / maxTime) * W : null
                return (
                  <>
                    <path d={area} fill="url(#curveGrad)" />
                    <path d={line} fill="none" stroke="#534AB7" strokeWidth="1.5" strokeLinejoin="round" />
                    {sliderX !== null && <line x1={sliderX} y1={0} x2={sliderX} y2={H} stroke="#9F9BE8" strokeWidth="1" strokeDasharray="3 2" />}
                  </>
                )
              })()}
            </svg>
            <input type="range" min={0} max={maxTime} step={1} value={sliderTime ?? 0}
              style={{ width:'100%', accentColor:'#534AB7', margin:0 }}
              onChange={e => setSliderTime(parseInt(e.target.value) === 0 && sliderTime === null ? null : parseInt(e.target.value))}
              onDoubleClick={() => setSliderTime(null)} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#8888A0', marginTop:2 }}>
              <span>0:00</span>
              {sliderTime !== null && <span style={{ color:'#534AB7', fontWeight:600 }}>{formatTime(sliderTime)} (double-clic pour reset)</span>}
              <span>{formatTime(maxTime)}</span>
            </div>
          </div>
        </>
      )}

      {/* Bannière révéler — toujours visible */}
      <div style={{ background:'#16213E', borderBottom:'1px solid #3A3A5C', padding:'6px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <span style={{ fontSize:11, color:'#B0AECB' }}>💬 {comments.length} commentaires</span>
        <button style={{ background:'#534AB7', border:'none', borderRadius:8, padding:'5px 14px', color:'#FFF', fontSize:11, fontWeight:600, cursor:'pointer' }}
          onClick={() => setRevealed(r => !r)}>
          {revealed ? 'Reflouter' : 'Révéler'}
        </button>
      </div>

      {/* Filtres */}
      <div style={{ padding:'5px 14px', display:'flex', gap:5, overflowX:'auto', flexShrink:0, borderBottom:'1px solid #3A3A5C' }}>
        {[['all', 'Tous'], ['ts', 'Horodatés'], ['mine', 'Les miens']].map(([k, l]) => (
          <button key={k}
            style={{ background: filter===k ? '#534AB7' : '#1A2340', border: filter===k ? '1px solid #534AB7' : '1px solid #3A3A5C', borderRadius:20, padding:'3px 9px', color: filter===k ? '#FFF' : '#B0AECB', fontSize:10, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
            onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {/* Zone commentaires — scrollable indépendamment */}
      <div style={{ flex:1, overflowY:'auto', padding:'8px 14px 8px', minHeight:0 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'20px', color:'#8888A0', fontSize:12 }}>
            <div style={{ fontSize:26, marginBottom:6 }}>🎬</div>
            Lance l'épisode et sois le premier !
          </div>
        )}
        {filtered.map(c => (
          <div key={c.id} style={{ display:'flex', gap:8, marginBottom:10, alignItems:'flex-start' }}>
            <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, background:'#2C2C4A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, overflow:'hidden', cursor:'pointer' }}
              onClick={() => navigate(`/user/${c.userId}`)}>
              {c.userPhoto ? <img src={c.userPhoto} style={{ width:'100%', height:'100%' }} alt="" /> : c.userName?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex:1, background: c.userId===user.uid ? '#1E1B4B' : '#1A2340', borderRadius:'4px 10px 10px 10px', padding:'7px 10px', border: c.userId===user.uid ? '1px solid #534AB7' : '1px solid #3A3A5C', ...(!revealed ? { filter:'blur(8px)', userSelect:'none', pointerEvents:'none', opacity:0.7 } : {}) }}>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:3, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, fontWeight:600, cursor:'pointer' }} onClick={() => navigate(`/user/${c.userId}`)}>
                  {c.userId === user.uid ? 'Moi' : c.userName}
                </span>
                {c.userBadge && <span style={{ fontSize:9, background:'#1E1B4B', borderRadius:8, padding:'1px 4px', color:'#C8C4F8' }}>{c.userBadge}</span>}
                {c.timestamp != null && <span style={{ fontSize:9, color:'#534AB7', background:'#0F0F1A', borderRadius:4, padding:'1px 4px', fontWeight:600 }}>⏱ {formatTime(c.timestamp)}</span>}
                {c.replyTo && <span style={{ fontSize:9, background:'#1E1B4B', borderRadius:8, padding:'1px 4px', color:'#C8C4F8' }}>↩ @{c.replyTo.userName}</span>}
                <span style={{ fontSize:9, color:'#8888A0', marginLeft:'auto' }}>{timeAgo(c.createdAt)}</span>
              </div>
              {c.replyTo && <div style={{ fontSize:10, color:'#B0AECB', fontStyle:'italic', borderLeft:'2px solid #3A3A5C', paddingLeft:5, marginBottom:3 }}>"{c.replyTo.text}"</div>}
              {c.gifUrl && <img src={c.gifUrl} alt="gif" style={{ maxWidth:'100%', borderRadius:8, marginBottom:4 }} />}
              {c.text && <div style={{ fontSize:12, lineHeight:1.5, color:'#E8E6F8', marginBottom:4 }}>{c.text}</div>}
              <div style={{ display:'flex', gap:3, flexWrap:'wrap', alignItems:'center' }}>
                {EMOJIS.map(emoji => {
                  const cnt = c.reactions?.[emoji] || 0
                  if (cnt === 0) return null
                  return (
                    <button key={emoji} style={{ background:'#0F0F1A', border:'1px solid #3A3A5C', borderRadius:20, padding:'1px 5px', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', gap:2 }}
                      onClick={() => addReaction(c.id, emoji)}>
                      <span style={{ fontSize:10 }}>{emoji}</span>
                      <span style={{ fontSize:10, color:'#C8C4F8' }}>{cnt}</span>
                    </button>
                  )
                })}
                {showEmojiFor === c.id
                  ? <div style={{ display:'flex', gap:4 }}>{EMOJIS.map(e => <button key={e} style={{ fontSize:14, cursor:'pointer', background:'none', border:'none', padding:1 }} onClick={() => addReaction(c.id, e)}>{e}</button>)}</div>
                  : <button style={{ background:'none', border:'1px solid #3A3A5C', borderRadius:20, padding:'1px 5px', fontSize:10, cursor:'pointer', color:'#B0AECB' }} onClick={() => setShowEmojiFor(c.id)}>+</button>}
                <button style={{ background:'none', border:'none', color:'#B0AECB', fontSize:10, cursor:'pointer', padding:'0 3px' }} onClick={() => setReplyTo(c)}>↩</button>
                <button style={{ background:'none', border:'none', color:'#B0AECB', fontSize:10, cursor:'pointer', padding:'0 3px' }} onClick={() => handleShare(c)}>↗</button>
              </div>
            </div>
          </div>
        ))}
        {pendingComments.length > 0 && (
          <div style={{ textAlign:'center', fontSize:10, color:'#B0AECB', padding:4 }}>
            {pendingComments.length} commentaire(s) en attente de connexion
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Barre répondre */}
      {replyTo && (
        <div style={{ background:'#1A2340', borderLeft:'2px solid #534AB7', padding:'4px 10px', margin:'0 14px 4px', borderRadius:'0 8px 8px 0', fontSize:10, color:'#C8C4F8', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <span>↩ @{replyTo.userName} : "{replyTo.text?.slice(0, 40)}"</span>
          <button style={{ background:'none', border:'none', color:'#B0AECB', cursor:'pointer', fontSize:14 }} onClick={() => setReplyTo(null)}>×</button>
        </div>
      )}

      {/* Zone de saisie — toujours visible */}
      <div style={{ padding:'7px 14px 10px', borderTop:'1px solid #3A3A5C', background:'#0F0F1A', flexShrink:0 }}>
        {running && <div style={{ fontSize:10, color:'#534AB7', marginBottom:4 }}>⏱ Sera horodaté à {formatTime(elapsed)}</div>}
        <div style={{ display:'flex', gap:7, alignItems:'flex-end' }}>
          <textarea
            style={{ flex:1, background:'#1A2340', border:'1px solid #3A3A5C', borderRadius:10, padding:'8px 11px', color:'#FFF', fontSize:13, resize:'none', outline:'none', minHeight:36, maxHeight:80, fontFamily:'inherit', lineHeight:1.4 }}
            placeholder={replyTo ? `Répondre à @${replyTo.userName}…` : 'Écris ton commentaire…'}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
            rows={1}
          />
          <button
            style={{ background:'none', border:'1px solid #3A3A5C', borderRadius:9, width:36, height:36, color:'#B0AECB', fontSize:12, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600 }}
            onClick={() => setShowGif(g => !g)}>
            GIF
          </button>
          <button
            style={{ background: text.trim() ? '#534AB7' : '#2C2C4A', border:'none', borderRadius:9, width:36, height:36, color:'#FFF', fontSize:14, cursor: text.trim() ? 'pointer' : 'not-allowed', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={sendComment}
            disabled={!text.trim()}>
            ➤
          </button>
        </div>
      </div>

      <Nav />
    </div>
  )
}
