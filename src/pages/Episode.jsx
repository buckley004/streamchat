import React, { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { ToastContainer, useToast } from '../components/Toast'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'
const EMOJIS = ['❤️','😂','😮','😢','🔥']
const TAGS = ['spoiler','humour','analyse','question','émotion']
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
  const diff = Math.floor((Date.now()-ts.toMillis())/1000)
  if (diff<60) return 'À l\'instant'
  if (diff<3600) return `${Math.floor(diff/60)}min`
  if (diff<86400) return `${Math.floor(diff/3600)}h`
  return `${Math.floor(diff/86400)}j`
}
function getTopBadge(count) {
  const earned = BADGES.filter(b => count >= b.threshold)
  return earned.length ? earned[earned.length-1] : null
}

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFFFFF', display:'flex', flexDirection:'column', paddingBottom:0 },
  banner: { width:'100%', height:140, objectFit:'cover', background:'#16213E', display:'block', flexShrink:0 },
  bannerPlaceholder: { width:'100%', height:80, background:'#16213E', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 },
  header: { padding:'10px 16px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #2C2C2A', flexShrink:0 },
  back: { fontSize:22, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:'4px 8px', flexShrink:0 },
  headerInfo: { flex:1, minWidth:0 },
  showName: { fontSize:11, color:'#888780', marginBottom:1 },
  epName: { fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  headerRight: { display:'flex', alignItems:'center', gap:8, flexShrink:0 },
  favBtn: { background:'none', border:'none', fontSize:20, cursor:'pointer', padding:2 },
  episodesBtn: { background:'#16213E', border:'1px solid #2C2C2A', borderRadius:8, padding:'4px 10px', fontSize:11, color:'#9F9BE8', cursor:'pointer' },
  synopsis: { padding:'10px 16px', fontSize:12, color:'#888780', lineHeight:1.5, borderBottom:'1px solid #2C2C2A', flexShrink:0 },
  sync: { padding:'8px 16px', background:'#16213E', borderBottom:'1px solid #2C2C2A', flexShrink:0 },
  syncRow: { display:'flex', alignItems:'center', gap:10 },
  syncBtn: { background:'#534AB7', border:'none', borderRadius:10, padding:'7px 14px', color:'#FFF', fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0 },
  syncBtnStop: { background:'#2C2C2A', border:'none', borderRadius:10, padding:'7px 14px', color:'#E24B4A', fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0 },
  timer: { fontSize:18, fontWeight:700, color:'#534AB7', fontVariantNumeric:'tabular-nums' },
  timerLabel: { fontSize:10, color:'#888780' },
  filter: { padding:'6px 16px', display:'flex', gap:6, overflowX:'auto', flexShrink:0, borderBottom:'1px solid #2C2C2A' },
  filterBtn: { background:'#16213E', border:'1px solid #2C2C2A', borderRadius:20, padding:'4px 10px', color:'#888780', fontSize:10, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
  filterActive: { background:'#534AB7', border:'1px solid #534AB7', color:'#FFF' },
  comments: { flex:1, overflowY:'auto', padding:'10px 16px', paddingBottom:10 },
  comment: { display:'flex', gap:8, marginBottom:12, alignItems:'flex-start' },
  avatar: { width:28, height:28, borderRadius:'50%', flexShrink:0, background:'#2C2C2A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, overflow:'hidden' },
  bubble: { flex:1, background:'#16213E', borderRadius:'4px 12px 12px 12px', padding:'8px 10px', border:'1px solid #2C2C2A' },
  bubbleOwn: { background:'#1E1B4B', border:'1px solid #534AB7' },
  bubbleTop: { display:'flex', alignItems:'center', gap:5, marginBottom:4, flexWrap:'wrap' },
  username: { fontSize:11, fontWeight:600 },
  badgePill: { fontSize:9, background:'#1E1B4B', borderRadius:10, padding:'1px 5px', color:'#9F9BE8' },
  tsBadge: { fontSize:9, color:'#534AB7', background:'#1A1A2E', borderRadius:5, padding:'1px 4px', fontWeight:600 },
  tagPill: { fontSize:9, background:'#0F0F1A', borderRadius:10, padding:'1px 6px', color:'#888780', border:'1px solid #2C2C2A' },
  timeago: { fontSize:9, color:'#444441', marginLeft:'auto' },
  replyQuote: { fontSize:11, color:'#888780', fontStyle:'italic', borderLeft:'2px solid #2C2C2A', paddingLeft:6, marginBottom:4 },
  text: { fontSize:13, lineHeight:1.5, color:'#D3D1C7', marginBottom:5 },
  actions: { display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' },
  reactionBtn: { background:'#0F0F1A', border:'1px solid #2C2C2A', borderRadius:20, padding:'1px 6px', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', gap:2 },
  addReaction: { background:'none', border:'1px solid #2C2C2A', borderRadius:20, padding:'1px 6px', fontSize:10, cursor:'pointer', color:'#888780' },
  actionBtn: { background:'none', border:'none', color:'#888780', fontSize:10, cursor:'pointer', padding:'0 3px' },
  emojiRow: { display:'flex', gap:5, padding:'4px 0' },
  emojiBtn: { fontSize:16, cursor:'pointer', background:'none', border:'none', padding:1 },
  replyingBar: { background:'#16213E', borderLeft:'2px solid #534AB7', padding:'5px 12px', margin:'0 16px 6px', borderRadius:'0 8px 8px 0', fontSize:11, color:'#9F9BE8', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 },
  inputArea: { padding:'8px 16px 12px', borderTop:'1px solid #2C2C2A', background:'#0F0F1A', flexShrink:0 },
  tagRow: { display:'flex', gap:6, marginBottom:6, overflowX:'auto' },
  tagBtn: { background:'#16213E', border:'1px solid #2C2C2A', borderRadius:20, padding:'3px 10px', fontSize:10, color:'#888780', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
  tagBtnActive: { background:'#1E1B4B', border:'1px solid #534AB7', color:'#9F9BE8' },
  inputRow: { display:'flex', gap:8, alignItems:'flex-end' },
  textarea: { flex:1, background:'#16213E', border:'1px solid #2C2C2A', borderRadius:12, padding:'9px 12px', color:'#FFF', fontSize:13, resize:'none', outline:'none', minHeight:38, maxHeight:90, fontFamily:'inherit', lineHeight:1.4 },
  sendBtn: { background:'#534AB7', border:'none', borderRadius:10, width:38, height:38, color:'#FFF', fontSize:15, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' },
  offlineBanner: { background:'#412402', padding:'5px 16px', fontSize:11, color:'#FAC775', textAlign:'center', flexShrink:0 },
  empty: { textAlign:'center', padding:'24px', color:'#444441', fontSize:13 },
  nav: { position:'fixed', bottom:0, left:0, right:0, background:'#0F0F1A', borderTop:'1px solid #2C2C2A', display:'flex', padding:'10px 0', zIndex:50 },
  navItem: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', padding:'3px 0' },
  navIcon: { fontSize:20 },
  navLabel: { fontSize:10, color:'#888780' },
}

export default function Episode({ user }) {
  const { showId, seasonNum, episodeNum } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { toasts, showToast } = useToast()
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [episode, setEpisode] = useState(state?.episode||null)
  const [show, setShow] = useState(state?.show||null)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [filter, setFilter] = useState('all')
  const [replyTo, setReplyTo] = useState(null)
  const [showEmojiFor, setShowEmojiFor] = useState(null)
  const [selectedTag, setSelectedTag] = useState(null)
  const [isFav, setIsFav] = useState(false)
  const [favCount, setFavCount] = useState(0)
  const [pendingComments, setPendingComments] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [userCommentCount, setUserCommentCount] = useState(0)
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
    if (!episode && parseInt(seasonNum)>0) {
      fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNum}/episode/${episodeNum}?api_key=${TMDB_KEY}&language=fr-FR`).then(r=>r.json()).then(setEpisode)
    }
    if (!show) {
      const url = isMovie
        ? `https://api.themoviedb.org/3/movie/${showId}?api_key=${TMDB_KEY}&language=fr-FR`
        : `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_KEY}&language=fr-FR`
      fetch(url).then(r=>r.json()).then(setShow)
    }
  }, [])

  useEffect(() => {
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const q = query(collection(db, 'comments', colId, 'messages'), orderBy('createdAt','asc'))
    return onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id:d.id, ...d.data() }))))
  }, [showId, seasonNum, episodeNum])

  useEffect(() => {
    getDoc(doc(db, 'favorites', `${user.uid}_${showId}`)).then(snap => setIsFav(snap.exists()))
    getDoc(doc(db, 'favoriteCounts', showId)).then(snap => setFavCount(snap.exists() ? (snap.data().count||0) : 0))
  }, [showId, user.uid])

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setUserCommentCount(snap.data().commentCount||0)
    })
  }, [user.uid])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [comments])

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed*1000
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now()-startRef.current)/1000)), 1000)
    } else clearInterval(timerRef.current)
    return () => clearInterval(timerRef.current)
  }, [running])

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

  async function toggleFav() {
    const favRef = doc(db, 'favorites', `${user.uid}_${showId}`)
    const countRef = doc(db, 'favoriteCounts', showId)
    if (isFav) {
      await setDoc(favRef, { deleted:true }, { merge:true })
      await setDoc(countRef, { count: Math.max(0, favCount-1) }, { merge:true })
      setFavCount(c => Math.max(0,c-1))
      setIsFav(false)
    } else {
      const favData = { userId:user.uid, showId, showName:show?.name||show?.title||'', showPoster:show?.poster_path||'', isMovie, createdAt:serverTimestamp() }
      await setDoc(favRef, favData)
      await setDoc(countRef, { count: favCount+1 }, { merge:true })
      setFavCount(c => c+1)
      setIsFav(true)
      if (!localStorage.getItem('first_fav_done')) {
        localStorage.setItem('first_fav_done','1')
        showToast('Premier favori ajouté !', '⭐')
      }
    }
  }

  async function sendComment() {
    if (!text.trim()) return
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const newCount = userCommentCount + 1
    const commentData = {
      text: text.trim(),
      userId: user.uid,
      userName: user.displayName||'Anonyme',
      userPhoto: user.photoURL||'',
      timestamp: running ? elapsed : null,
      showId, showName: show?.name||show?.title||'',
      showPoster: show?.poster_path||'',
      seasonNum: parseInt(seasonNum), episodeNum: parseInt(episodeNum),
      episodeName: episode?.name||show?.title||'',
      replyTo: replyTo ? { id:replyTo.id, userName:replyTo.userName, text:replyTo.text?.slice(0,60) } : null,
      tag: selectedTag,
      reactions: {},
      createdAt: serverTimestamp()
    }
    if (!isOnline) {
      setPendingComments(p => [...p, commentData])
    } else {
      await addDoc(collection(db, 'comments', colId, 'messages'), commentData)
      await addDoc(collection(db, 'userComments'), commentData)
      await setDoc(doc(db, 'users', user.uid), { commentCount: newCount }, { merge:true })
      setUserCommentCount(newCount)
      if (newCount === 1) {
        localStorage.removeItem('onboarding_done')
        showToast('Premier commentaire posté !', '🎬')
      }
      const prevBadges = BADGES.filter(b => (newCount-1) >= b.threshold)
      const newBadges = BADGES.filter(b => newCount >= b.threshold)
      if (newBadges.length > prevBadges.length) {
        const badge = newBadges[newBadges.length-1]
        showToast(`Badge débloqué : ${badge.label}`, badge.emoji)
      }
    }
    setText('')
    setReplyTo(null)
    setSelectedTag(null)
  }

  async function addReaction(commentId, emoji) {
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const ref = doc(db, 'comments', colId, 'messages', commentId)
    await updateDoc(ref, { [`reactions.${emoji}`]: increment(1) })
    setShowEmojiFor(null)
  }

  function handleShare(c) {
    const ts = c.timestamp !== null ? ` à ${formatTime(c.timestamp)}` : ''
    const url = `${window.location.origin}/episode/${showId}/${seasonNum}/${episodeNum}`
    const msg = `"${c.text}"${ts} — sur ${c.showName||'StreamChat'}\n👉 ${url}`
    if (!localStorage.getItem('first_share_done')) {
      localStorage.setItem('first_share_done','1')
      showToast('Premier partage effectué !', '↗️')
    }
    if (navigator.share) navigator.share({ text:msg })
    else { navigator.clipboard.writeText(msg); showToast('Lien copié !', '📋') }
  }

  function goBack() {
    if (state?.fromShow) navigate(`/show/${showId}`)
    else navigate('/search')
  }

  const filtered = filter==='all' ? comments
    : filter==='ts' ? comments.filter(c => c.timestamp !== null)
    : comments.filter(c => c.userId === user.uid)

  const backdrop = show?.backdrop_path
  const title = show?.name||show?.title||'Série'
  const epLabel = isMovie
    ? (show?.release_date?.slice(0,4)||'Film')
    : `S${String(seasonNum).padStart(2,'0')}E${String(episodeNum).padStart(2,'0')} · ${episode?.name||'Épisode'}`
  const synopsis = show?.overview||episode?.overview||''
  const topBadge = getTopBadge(userCommentCount)

  return (
    <div style={s.page}>
      <ToastContainer toasts={toasts} />
      {backdrop
        ? <img src={`https://image.tmdb.org/t/p/w780${backdrop}`} style={s.banner} alt="" />
        : <div style={s.bannerPlaceholder}>🎬</div>}

      <div style={s.header}>
        <button style={s.back} onClick={goBack}>←</button>
        <div style={s.headerInfo}>
          <div style={s.showName}>{title}</div>
          <div style={s.epName}>{epLabel}</div>
        </div>
        <div style={s.headerRight}>
          <span style={{ fontSize:11, color:'#888780' }}>{favCount} ❤️</span>
          <button style={s.favBtn} onClick={toggleFav}>{isFav ? '❤️' : '🤍'}</button>
          <span style={{ fontSize:11, color:'#888780' }}>{comments.length} 💬</span>
          {!isMovie && <button style={s.episodesBtn} onClick={() => navigate(`/show/${showId}`)}>Épisodes</button>}
        </div>
      </div>

      {synopsis ? <div style={s.synopsis}>{synopsis.slice(0,160)}{synopsis.length>160?'…':''}</div> : null}
      {!isOnline && <div style={s.offlineBanner}>⚠️ Hors-ligne — commentaires en attente</div>}

      <div style={s.sync}>
        <div style={s.syncRow}>
          {!running
            ? <button style={s.syncBtn} onClick={() => setRunning(true)}>▶ Je regarde maintenant</button>
            : <button style={s.syncBtnStop} onClick={() => setRunning(false)}>⏸ Pause</button>}
          {(running||elapsed>0) && (
            <div>
              <div style={{ ...s.timer, color:running?'#534AB7':'#888780' }}>{formatTime(elapsed)}</div>
              <div style={s.timerLabel}>{running?'en cours':'en pause'}</div>
            </div>
          )}
        </div>
      </div>

      <div style={s.filter}>
        {[['all','Tous'],['ts','Horodatés'],['mine','Les miens']].map(([k,l]) => (
          <button key={k} style={{ ...s.filterBtn, ...(filter===k?s.filterActive:{}) }} onClick={() => setFilter(k)}>{l}</button>
        ))}
        {TAGS.map(tag => (
          <button key={tag} style={{ ...s.filterBtn, ...(filter===tag?s.filterActive:{}) }} onClick={() => setFilter(filter===tag?'all':tag)}>{tag}</button>
        ))}
      </div>

      <div style={{ ...s.comments, paddingBottom:70 }}>
        {filtered.length===0 && <div style={s.empty}><div style={{ fontSize:28, marginBottom:8 }}>🎬</div>Lance l'épisode et sois le premier !</div>}
        {filtered.map(c => (
          <div key={c.id} style={s.comment}>
            <div style={s.avatar} onClick={() => navigate(`/user/${c.userId}`)}>
              {c.userPhoto ? <img src={c.userPhoto} style={{ width:'100%', height:'100%' }} alt="" /> : c.userName?.[0]?.toUpperCase()}
            </div>
            <div style={{ ...s.bubble, ...(c.userId===user.uid?s.bubbleOwn:{}) }}>
              <div style={s.bubbleTop}>
                <span style={{ ...s.username, cursor:'pointer' }} onClick={() => navigate(`/user/${c.userId}`)}>{c.userId===user.uid?'Moi':c.userName}</span>
                {c.userBadge && <span style={s.badgePill}>{c.userBadge}</span>}
                {c.timestamp!==null&&c.timestamp!==undefined&&<span style={s.tsBadge}>⏱ {formatTime(c.timestamp)}</span>}
                {c.tag && <span style={s.tagPill}>{c.tag}</span>}
                {c.replyTo && <span style={{ ...s.tagPill, color:'#9F9BE8' }}>↩ @{c.replyTo.userName}</span>}
                <span style={s.timeago}>{timeAgo(c.createdAt)}</span>
              </div>
              {c.replyTo && <div style={s.replyQuote}>"{c.replyTo.text}"</div>}
              <div style={s.text}>{c.text}</div>
              <div style={s.actions}>
                {EMOJIS.map(emoji => {
                  const count = c.reactions?.[emoji]||0
                  if (count===0) return null
                  return <button key={emoji} style={s.reactionBtn} onClick={() => addReaction(c.id,emoji)}><span style={{ fontSize:11 }}>{emoji}</span><span style={{ fontSize:10, color:'#9F9BE8' }}>{count}</span></button>
                })}
                {showEmojiFor===c.id
                  ? <div style={s.emojiRow}>{EMOJIS.map(e => <button key={e} style={s.emojiBtn} onClick={() => addReaction(c.id,e)}>{e}</button>)}</div>
                  : <button style={s.addReaction} onClick={() => setShowEmojiFor(c.id)}>+</button>}
                <button style={s.actionBtn} onClick={() => setReplyTo(c)}>↩</button>
                <button style={s.actionBtn} onClick={() => handleShare(c)}>↗</button>
              </div>
            </div>
          </div>
        ))}
        {pendingComments.length>0 && <div style={{ textAlign:'center', fontSize:10, color:'#888780', padding:6 }}>{pendingComments.length} en attente…</div>}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div style={s.replyingBar}>
          <span>↩ @{replyTo.userName} : "{replyTo.text?.slice(0,40)}"</span>
          <button style={{ background:'none', border:'none', color:'#888780', cursor:'pointer', fontSize:16 }} onClick={() => setReplyTo(null)}>×</button>
        </div>
      )}

      <div style={s.inputArea}>
        <div style={s.tagRow}>
          {TAGS.map(tag => (
            <button key={tag} style={{ ...s.tagBtn, ...(selectedTag===tag?s.tagBtnActive:{}) }} onClick={() => setSelectedTag(selectedTag===tag?null:tag)}>{tag}</button>
          ))}
        </div>
        {running && <div style={{ fontSize:10, color:'#534AB7', marginBottom:5 }}>⏱ Sera horodaté à {formatTime(elapsed)}</div>}
        <div style={s.inputRow}>
          <textarea style={s.textarea}
            placeholder={replyTo ? `Répondre à @${replyTo.userName}…` : 'Écris ton commentaire…'}
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendComment() } }}
            rows={1} />
          <button style={{ ...s.sendBtn, ...(text.trim()?{}:{ background:'#2C2C2A', cursor:'not-allowed' }) }}
            onClick={sendComment} disabled={!text.trim()}>➤</button>
        </div>
      </div>

      <nav style={s.nav}>
        <div style={s.navItem} onClick={() => navigate('/')}><span style={s.navIcon}>🏠</span><span style={s.navLabel}>Accueil</span></div>
        <div style={s.navItem} onClick={() => navigate('/search')}><span style={s.navIcon}>🔍</span><span style={s.navLabel}>Rechercher</span></div>
        <div style={s.navItem} onClick={() => navigate('/profile')}><span style={s.navIcon}>👤</span><span style={s.navLabel}>Profil</span></div>
      </nav>
    </div>
  )
}
