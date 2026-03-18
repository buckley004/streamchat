import React, { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore'
import { db } from '../firebase'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'
const EMOJIS = ['❤️','😂','😮','😢','🔥']

function formatTime(secs) {
  if (!secs && secs !== 0) return ''
  return `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`
}
function timeAgo(ts) {
  if (!ts) return ''
  const diff = Math.floor((Date.now()-ts.toMillis())/1000)
  if (diff<60) return 'À l\'instant'
  if (diff<3600) return `${Math.floor(diff/60)}min`
  if (diff<86400) return `${Math.floor(diff/3600)}h`
  return `${Math.floor(diff/86400)}j`
}

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFFFFF', display:'flex', flexDirection:'column' },
  banner: { width:'100%', height:160, objectFit:'cover', background:'#16213E', display:'block', flexShrink:0 },
  bannerPlaceholder: { width:'100%', height:100, background:'#16213E', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:40 },
  header: { padding:'12px 20px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid #2C2C2A', flexShrink:0 },
  back: { fontSize:22, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:4, flexShrink:0 },
  headerInfo: { flex:1, minWidth:0 },
  showName: { fontSize:12, color:'#888780', marginBottom:2 },
  epName: { fontSize:14, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  sync: { padding:'10px 20px', background:'#16213E', borderBottom:'1px solid #2C2C2A', flexShrink:0 },
  syncRow: { display:'flex', alignItems:'center', gap:10 },
  syncBtn: { background:'#534AB7', border:'none', borderRadius:10, padding:'8px 14px', color:'#FFF', fontSize:13, fontWeight:600, cursor:'pointer', flexShrink:0 },
  syncBtnStop: { background:'#2C2C2A', border:'none', borderRadius:10, padding:'8px 14px', color:'#E24B4A', fontSize:13, fontWeight:600, cursor:'pointer', flexShrink:0 },
  timer: { fontSize:20, fontWeight:700, color:'#534AB7', fontVariantNumeric:'tabular-nums' },
  timerLabel: { fontSize:10, color:'#888780' },
  filter: { padding:'8px 20px', display:'flex', gap:8, overflowX:'auto', flexShrink:0, borderBottom:'1px solid #2C2C2A' },
  filterBtn: { background:'#16213E', border:'1px solid #2C2C2A', borderRadius:20, padding:'5px 12px', color:'#888780', fontSize:11, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
  filterActive: { background:'#534AB7', border:'1px solid #534AB7', color:'#FFF' },
  comments: { flex:1, overflowY:'auto', padding:'12px 20px' },
  comment: { display:'flex', gap:10, marginBottom:14, alignItems:'flex-start' },
  avatar: { width:30, height:30, borderRadius:'50%', flexShrink:0, background:'#2C2C2A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, overflow:'hidden' },
  bubble: { flex:1, background:'#16213E', borderRadius:'4px 12px 12px 12px', padding:'8px 12px', border:'1px solid #2C2C2A' },
  bubbleOwn: { background:'#1E1B4B', border:'1px solid #534AB7' },
  bubbleTop: { display:'flex', alignItems:'center', gap:6, marginBottom:5, flexWrap:'wrap' },
  username: { fontSize:12, fontWeight:600 },
  tsBadge: { fontSize:10, color:'#534AB7', background:'#1A1A2E', borderRadius:6, padding:'1px 5px', fontWeight:600 },
  replyBadge: { fontSize:10, color:'#888780' },
  timeago: { fontSize:10, color:'#444441', marginLeft:'auto' },
  text: { fontSize:13, lineHeight:1.5, color:'#D3D1C7', marginBottom:6 },
  reactions: { display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' },
  reactionBtn: { background:'#0F0F1A', border:'1px solid #2C2C2A', borderRadius:20, padding:'2px 7px', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:3 },
  reactionActive: { background:'#1E1B4B', border:'1px solid #534AB7' },
  reactionCount: { fontSize:11, color:'#9F9BE8' },
  addReaction: { background:'none', border:'1px solid #2C2C2A', borderRadius:20, padding:'2px 7px', fontSize:11, cursor:'pointer', color:'#888780' },
  replyBtn: { background:'none', border:'none', color:'#888780', fontSize:11, cursor:'pointer', padding:'0 4px' },
  shareBtn: { background:'none', border:'none', color:'#888780', fontSize:11, cursor:'pointer', padding:'0 4px' },
  emojiPicker: { display:'flex', gap:6, padding:'6px 0', flexWrap:'wrap' },
  emojiBtn: { fontSize:18, cursor:'pointer', background:'none', border:'none', padding:'2px' },
  replyingTo: { background:'#16213E', borderLeft:'2px solid #534AB7', padding:'6px 12px', margin:'0 20px 8px', borderRadius:'0 8px 8px 0', fontSize:12, color:'#9F9BE8', display:'flex', justifyContent:'space-between', alignItems:'center' },
  input: { padding:'10px 20px 14px', borderTop:'1px solid #2C2C2A', background:'#0F0F1A', flexShrink:0 },
  inputRow: { display:'flex', gap:8, alignItems:'flex-end' },
  textarea: { flex:1, background:'#16213E', border:'1px solid #2C2C2A', borderRadius:12, padding:'10px 12px', color:'#FFF', fontSize:13, resize:'none', outline:'none', minHeight:40, maxHeight:100, fontFamily:'inherit', lineHeight:1.4 },
  sendBtn: { background:'#534AB7', border:'none', borderRadius:10, width:40, height:40, color:'#FFF', fontSize:16, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' },
  empty: { textAlign:'center', padding:'30px 20px', color:'#444441' },
  offlineBanner: { background:'#412402', padding:'6px 20px', fontSize:12, color:'#FAC775', textAlign:'center', flexShrink:0 },
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
  const [replyTo, setReplyTo] = useState(null)
  const [showEmojiFor, setShowEmojiFor] = useState(null)
  const [pendingComments, setPendingComments] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const timerRef = useRef(null)
  const startRef = useRef(null)
  const bottomRef = useRef(null)

  const isMovie = seasonNum === '0' && episodeNum === '0'

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

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

  useEffect(() => {
    if (!episode && parseInt(seasonNum) > 0) {
      fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNum}/episode/${episodeNum}?api_key=${TMDB_KEY}&language=fr-FR`)
        .then(r => r.json()).then(setEpisode)
    }
    if (!show) {
      const endpoint = isMovie
        ? `https://api.themoviedb.org/3/movie/${showId}?api_key=${TMDB_KEY}&language=fr-FR`
        : `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_KEY}&language=fr-FR`
      fetch(endpoint).then(r => r.json()).then(setShow)
    }
  }, [])

  useEffect(() => {
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const q = query(collection(db, 'comments', colId, 'messages'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [showId, seasonNum, episodeNum])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [comments])

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now()-startRef.current)/1000)), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [running])

  async function sendComment() {
    if (!text.trim()) return
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const commentData = {
      text: text.trim(),
      userId: user.uid,
      userName: user.displayName || 'Anonyme',
      userPhoto: user.photoURL || '',
      timestamp: running ? elapsed : null,
      showId, showName: show?.name || show?.title || '',
      showPoster: show?.poster_path || show?.backdrop_path || '',
      seasonNum: parseInt(seasonNum), episodeNum: parseInt(episodeNum),
      episodeName: episode?.name || show?.title || '',
      replyTo: replyTo ? { id: replyTo.id, userName: replyTo.userName, text: replyTo.text?.slice(0,60) } : null,
      reactions: {},
      createdAt: serverTimestamp()
    }
    if (!isOnline) {
      setPendingComments(p => [...p, commentData])
    } else {
      await addDoc(collection(db, 'comments', colId, 'messages'), commentData)
      await addDoc(collection(db, 'userComments'), commentData)
    }
    setText('')
    setReplyTo(null)
  }

  async function addReaction(commentId, emoji) {
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const ref = doc(db, 'comments', colId, 'messages', commentId)
    await updateDoc(ref, { [`reactions.${emoji}`]: increment(1) })
    setShowEmojiFor(null)
  }

  function handleShare(c) {
    const ts = c.timestamp !== null ? ` à ${formatTime(c.timestamp)}` : ''
    const msg = `"${c.text}"${ts} — sur ${c.showName || 'StreamChat'}\nstreamchat-orpin.vercel.app`
    if (navigator.share) {
      navigator.share({ text: msg })
    } else {
      navigator.clipboard.writeText(msg)
      alert('Commentaire copié !')
    }
  }

  function goBack() {
    if (state?.fromSearch) navigate('/search', { state: { query: state.searchQuery } })
    else navigate(-1)
  }

  const filtered = filter === 'all' ? comments
    : filter === 'ts' ? comments.filter(c => c.timestamp !== null)
    : comments.filter(c => c.userId === user.uid)

  const backdrop = show?.backdrop_path
  const title = show?.name || show?.title || 'Série'
  const epLabel = isMovie
    ? (show?.release_date?.slice(0,4) || '')
    : `S${String(seasonNum).padStart(2,'0')}E${String(episodeNum).padStart(2,'0')} · ${episode?.name || 'Épisode'}`

  return (
    <div style={s.page}>
      {backdrop
        ? <img src={`https://image.tmdb.org/t/p/w780${backdrop}`} style={s.banner} alt="" />
        : <div style={s.bannerPlaceholder}>🎬</div>}

      <div style={s.header}>
        <button style={s.back} onClick={goBack}>←</button>
        <div style={s.headerInfo}>
          <div style={s.showName}>{title}</div>
          <div style={s.epName}>{epLabel}</div>
        </div>
        <span style={{ fontSize:12, color:'#888780' }}>{comments.length} 💬</span>
      </div>

      {!isOnline && (
        <div style={s.offlineBanner}>⚠️ Hors-ligne — tes commentaires seront envoyés quand tu te reconnectes</div>
      )}

      <div style={s.sync}>
        <div style={s.syncRow}>
          {!running
            ? <button style={s.syncBtn} onClick={() => setRunning(true)}>▶ Je regarde maintenant</button>
            : <button style={s.syncBtnStop} onClick={() => setRunning(false)}>⏸ Pause</button>}
          {(running || elapsed > 0) && (
            <div>
              <div style={{ ...s.timer, color: running ? '#534AB7' : '#888780' }}>{formatTime(elapsed)}</div>
              <div style={s.timerLabel}>{running ? 'en cours' : 'en pause'}</div>
            </div>
          )}
        </div>
      </div>

      <div style={s.filter}>
        {[['all','Tous'], ['ts','Horodatés'], ['mine','Les miens']].map(([k,l]) => (
          <button key={k} style={{ ...s.filterBtn, ...(filter===k ? s.filterActive : {}) }} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div style={s.comments}>
        {filtered.length === 0 && (
          <div style={s.empty}>
            <div style={{ fontSize:32, marginBottom:8 }}>🎬</div>
            <div>Lance l'épisode et sois le premier !</div>
          </div>
        )}
        {filtered.map(c => (
          <div key={c.id} style={s.comment}>
            <div style={s.avatar}>
              {c.userPhoto ? <img src={c.userPhoto} style={{ width:'100%', height:'100%' }} alt="" /> : c.userName?.[0]?.toUpperCase()}
            </div>
            <div style={{ ...s.bubble, ...(c.userId===user.uid ? s.bubbleOwn : {}) }}>
              <div style={s.bubbleTop}>
                <span style={s.username}>{c.userId===user.uid ? 'Moi' : c.userName}</span>
                {c.timestamp !== null && c.timestamp !== undefined && <span style={s.tsBadge}>⏱ {formatTime(c.timestamp)}</span>}
                {c.replyTo && <span style={s.replyBadge}>↩ @{c.replyTo.userName}</span>}
                <span style={s.timeago}>{timeAgo(c.createdAt)}</span>
              </div>
              {c.replyTo && <div style={{ fontSize:11, color:'#888780', marginBottom:4, fontStyle:'italic', borderLeft:'2px solid #2C2C2A', paddingLeft:6 }}>"{c.replyTo.text}"</div>}
              <div style={s.text}>{c.text}</div>
              <div style={s.reactions}>
                {EMOJIS.map(emoji => {
                  const count = c.reactions?.[emoji] || 0
                  if (count === 0) return null
                  return (
                    <button key={emoji} style={s.reactionBtn} onClick={() => addReaction(c.id, emoji)}>
                      <span style={{ fontSize:12 }}>{emoji}</span>
                      <span style={s.reactionCount}>{count}</span>
                    </button>
                  )
                })}
                {showEmojiFor === c.id ? (
                  <div style={s.emojiPicker}>
                    {EMOJIS.map(e => <button key={e} style={s.emojiBtn} onClick={() => addReaction(c.id, e)}>{e}</button>)}
                  </div>
                ) : (
                  <button style={s.addReaction} onClick={() => setShowEmojiFor(c.id)}>+</button>
                )}
                <button style={s.replyBtn} onClick={() => setReplyTo(c)}>↩ Répondre</button>
                <button style={s.shareBtn} onClick={() => handleShare(c)}>↗ Partager</button>
              </div>
            </div>
          </div>
        ))}
        {pendingComments.length > 0 && (
          <div style={{ textAlign:'center', fontSize:11, color:'#888780', padding:'8px 0' }}>
            {pendingComments.length} commentaire(s) en attente de connexion
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div style={s.replyingTo}>
          <span>↩ Répondre à @{replyTo.userName} : "{replyTo.text?.slice(0,40)}"</span>
          <button style={{ background:'none', border:'none', color:'#888780', cursor:'pointer', fontSize:16 }} onClick={() => setReplyTo(null)}>×</button>
        </div>
      )}

      <div style={s.input}>
        {running && <div style={{ fontSize:11, color:'#534AB7', marginBottom:6 }}>⏱ Sera horodaté à {formatTime(elapsed)}</div>}
        <div style={s.inputRow}>
          <textarea style={s.textarea}
            placeholder={replyTo ? `Répondre à @${replyTo.userName}…` : 'Écris ton commentaire…'}
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
            rows={1} />
          <button style={{ ...s.sendBtn, ...(text.trim() ? {} : { background:'#2C2C2A', cursor:'not-allowed' }) }}
            onClick={sendComment} disabled={!text.trim()}>➤</button>
        </div>
      </div>
    </div>
  )
}
