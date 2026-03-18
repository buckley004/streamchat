import React, { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

function formatTime(secs) {
  if (!secs && secs !== 0) return ''
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2,'0')}`
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Math.floor((Date.now() - ts.toMillis()) / 1000)
  if (diff < 60) return 'À l\'instant'
  if (diff < 3600) return `${Math.floor(diff/60)}min`
  if (diff < 86400) return `${Math.floor(diff/3600)}h`
  return `${Math.floor(diff/86400)}j`
}

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFFFFF', display:'flex', flexDirection:'column' },
  header: { padding:'16px 20px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid #2C2C2A', flexShrink:0 },
  back: { fontSize:22, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:4 },
  headerInfo: { flex:1, minWidth:0 },
  showName: { fontSize:13, color:'#888780', marginBottom:2 },
  epName: { fontSize:15, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  sync: { padding:'12px 20px', background:'#16213E', borderBottom:'1px solid #2C2C2A', flexShrink:0 },
  syncRow: { display:'flex', alignItems:'center', gap:10 },
  syncBtn: { background:'#534AB7', border:'none', borderRadius:10, padding:'10px 16px', color:'#FFF', fontSize:13, fontWeight:600, cursor:'pointer', flexShrink:0 },
  syncBtnStop: { background:'#2C2C2A', border:'none', borderRadius:10, padding:'10px 16px', color:'#E24B4A', fontSize:13, fontWeight:600, cursor:'pointer', flexShrink:0 },
  timer: { fontSize:22, fontWeight:700, color:'#534AB7', fontVariantNumeric:'tabular-nums', minWidth:60 },
  timerLabel: { fontSize:11, color:'#888780' },
  filter: { padding:'10px 20px', display:'flex', gap:8, overflowX:'auto', flexShrink:0, borderBottom:'1px solid #2C2C2A' },
  filterBtn: { background:'#16213E', border:'1px solid #2C2C2A', borderRadius:20, padding:'6px 14px', color:'#888780', fontSize:12, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
  filterActive: { background:'#534AB7', border:'1px solid #534AB7', color:'#FFF' },
  comments: { flex:1, overflowY:'auto', padding:'12px 20px' },
  comment: { display:'flex', gap:10, marginBottom:16, alignItems:'flex-start' },
  avatar: { width:32, height:32, borderRadius:'50%', flexShrink:0, background:'#2C2C2A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, overflow:'hidden' },
  bubble: { flex:1, background:'#16213E', borderRadius:'4px 12px 12px 12px', padding:'10px 12px', border:'1px solid #2C2C2A' },
  bubbleTop: { display:'flex', alignItems:'center', gap:8, marginBottom:6 },
  username: { fontSize:12, fontWeight:600, color:'#FFFFFF' },
  timestamp: { fontSize:11, color:'#534AB7', background:'#1A1A2E', borderRadius:6, padding:'2px 6px', fontWeight:600 },
  timeago: { fontSize:11, color:'#444441', marginLeft:'auto' },
  text: { fontSize:14, lineHeight:1.5, color:'#D3D1C7' },
  ownComment: { background:'#1E1B4B', border:'1px solid #534AB7' },
  input: { padding:'12px 20px', borderTop:'1px solid #2C2C2A', background:'#0F0F1A', flexShrink:0 },
  inputRow: { display:'flex', gap:10, alignItems:'flex-end' },
  textarea: { flex:1, background:'#16213E', border:'1px solid #2C2C2A', borderRadius:12, padding:'12px 14px', color:'#FFFFFF', fontSize:14, resize:'none', outline:'none', minHeight:44, maxHeight:120, fontFamily:'inherit', lineHeight:1.4 },
  sendBtn: { background:'#534AB7', border:'none', borderRadius:10, width:44, height:44, color:'#FFF', fontSize:18, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' },
  sendBtnDisabled: { background:'#2C2C2A', cursor:'not-allowed' },
  empty: { textAlign:'center', padding:'40px 20px', color:'#444441' },
  currentMarker: { background:'#534AB71A', border:'1px dashed #534AB7', borderRadius:8, padding:'6px 10px', marginBottom:12, fontSize:12, color:'#534AB7', textAlign:'center' },
}

export default function Episode({ user }) {
  const { showId, seasonNum, episodeNum } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [episode, setEpisode] = useState(state?.episode || null)
  const [show, setShow] = useState(state?.show || null)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [filter, setFilter] = useState('all')
  const timerRef = useRef(null)
  const startRef = useRef(null)
  const bottomRef = useRef(null)
  const commentsRef = useRef(null)

  // Charger les infos épisode si pas dans state
  useEffect(() => {
    if (!episode && seasonNum > 0) {
      fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNum}/episode/${episodeNum}?api_key=${TMDB_KEY}&language=fr-FR`)
        .then(r => r.json()).then(setEpisode)
    }
    if (!show) {
      fetch(`https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_KEY}&language=fr-FR`)
        .then(r => r.json()).then(setShow)
    }
  }, [])

  // Écouter les commentaires en temps réel
  useEffect(() => {
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const q = query(collection(db, 'comments', colId, 'messages'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [showId, seasonNum, episodeNum])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  // Timer
  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [running])

  async function sendComment() {
    if (!text.trim()) return
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    await addDoc(collection(db, 'comments', colId, 'messages'), {
      text: text.trim(),
      userId: user.uid,
      userName: user.displayName || 'Anonyme',
      userPhoto: user.photoURL || '',
      timestamp: running ? elapsed : null,
      showId, showName: show?.name || show?.title || '',
      showPoster: show?.poster_path || '',
      seasonNum: parseInt(seasonNum), episodeNum: parseInt(episodeNum),
      episodeName: episode?.name || '',
      createdAt: serverTimestamp()
    })
    setText('')
  }

  const filtered = filter === 'all' ? comments
    : filter === 'timestamped' ? comments.filter(c => c.timestamp !== null)
    : comments.filter(c => c.userId === user.uid)

  const nearby = running ? comments.filter(c => c.timestamp !== null && Math.abs(c.timestamp - elapsed) <= 30) : []

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        <div style={s.headerInfo}>
          <div style={s.showName}>{show?.name || show?.title || 'Série'}</div>
          <div style={s.epName}>S{String(seasonNum).padStart(2,'0')}E{String(episodeNum).padStart(2,'0')} · {episode?.name || 'Épisode'}</div>
        </div>
        <span style={{ fontSize:13, color:'#888780' }}>{comments.length} 💬</span>
      </div>

      {/* Timer de synchro */}
      <div style={s.sync}>
        <div style={s.syncRow}>
          {!running
            ? <button style={s.syncBtn} onClick={() => setRunning(true)}>▶ Je regarde maintenant</button>
            : <button style={s.syncBtnStop} onClick={() => setRunning(false)}>⏸ Pause</button>}
          {running && (
            <div>
              <div style={s.timer}>{formatTime(elapsed)}</div>
              <div style={s.timerLabel}>en cours</div>
            </div>
          )}
          {!running && elapsed > 0 && (
            <div>
              <div style={{ ...s.timer, color:'#888780' }}>{formatTime(elapsed)}</div>
              <div style={s.timerLabel}>en pause</div>
            </div>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div style={s.filter}>
        {[['all','Tous'], ['timestamped','Horodatés'], ['mine','Mes commentaires']].map(([k,l]) => (
          <button key={k} style={{ ...s.filterBtn, ...(filter===k ? s.filterActive : {}) }} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {/* Commentaires */}
      <div style={s.comments} ref={commentsRef}>
        {running && nearby.length > 0 && (
          <div style={s.currentMarker}>💡 {nearby.length} commentaire{nearby.length > 1 ? 's' : ''} sur cette scène</div>
        )}
        {filtered.length === 0 && (
          <div style={s.empty}>
            <div style={{ fontSize:36, marginBottom:10 }}>🎬</div>
            <div>Aucun commentaire pour l'instant</div>
            <div style={{ fontSize:12, marginTop:6 }}>Lance l'épisode et sois le premier !</div>
          </div>
        )}
        {filtered.map(c => (
          <div key={c.id} style={s.comment}>
            <div style={s.avatar}>
              {c.userPhoto ? <img src={c.userPhoto} style={{ width:'100%', height:'100%' }} alt="" /> : c.userName?.[0]?.toUpperCase()}
            </div>
            <div style={{ ...s.bubble, ...(c.userId === user.uid ? s.ownComment : {}) }}>
              <div style={s.bubbleTop}>
                <span style={s.username}>{c.userId === user.uid ? 'Moi' : c.userName}</span>
                {c.timestamp !== null && c.timestamp !== undefined && (
                  <span style={s.timestamp}>⏱ {formatTime(c.timestamp)}</span>
                )}
                <span style={s.timeago}>{timeAgo(c.createdAt)}</span>
              </div>
              <div style={s.text}>{c.text}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <div style={s.input}>
        {running && <div style={{ fontSize:11, color:'#534AB7', marginBottom:8 }}>⏱ Ton commentaire sera horodaté à {formatTime(elapsed)}</div>}
        <div style={s.inputRow}>
          <textarea style={s.textarea} placeholder="Écris ton commentaire…" value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
            rows={1} />
          <button style={{ ...s.sendBtn, ...(text.trim() ? {} : s.sendBtnDisabled) }}
            onClick={sendComment} disabled={!text.trim()}>➤</button>
        </div>
      </div>
    </div>
  )
}
