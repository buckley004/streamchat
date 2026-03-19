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
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [episode, setEpisode] = useState(state?.episode||null)
  const [show, setShow] = useState(state?.show||null)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [filter, setFilter] = useState('all')
  const [replyTo, setReplyTo] = useState(null)
  const [showEmojiFor, setShowEmojiFor] = useState(null)
  const [isFav, setIsFav] = useState(false)
  const [favCount, setFavCount] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [sliderTime, setSliderTime] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingComments, setPendingComments] = useState([])
  const [userCommentCount, setUserCommentCount] = useState(0)
  const [maxTime, setMaxTime] = useState(120)
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
      fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNum}/episode/${episodeNum}?api_key=${TMDB_KEY}&language=fr-FR`).then(r=>r.json()).then(d => { setEpisode(d); if (d.runtime) setMaxTime(d.runtime*60) })
    }
    if (!show) {
      const url = isMovie ? `https://api.themoviedb.org/3/movie/${showId}?api_key=${TMDB_KEY}&language=fr-FR` : `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_KEY}&language=fr-FR`
      fetch(url).then(r=>r.json()).then(d => { setShow(d); if (d.runtime) setMaxTime(d.runtime*60) })
    }
  }, [])

  useEffect(() => {
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const q = query(collection(db, 'comments', colId, 'messages'), orderBy('createdAt','asc'))
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id:d.id, ...d.data() }))
      setComments(all)
      if (all.length > 0) {
        const ts = all.filter(c => c.timestamp).map(c => c.timestamp)
        if (ts.length) setMaxTime(m => Math.max(m, Math.max(...ts)+60))
      }
    })
  }, [showId, seasonNum, episodeNum])

  useEffect(() => {
    getDoc(doc(db, 'favorites', `${user.uid}_${showId}`)).then(snap => setIsFav(snap.exists() && !snap.data()?.deleted))
    getDoc(doc(db, 'favoriteCounts', showId)).then(snap => setFavCount(snap.exists() ? snap.data().count||0 : 0))
    getDoc(doc(db, 'users', user.uid)).then(snap => { if (snap.exists()) setUserCommentCount(snap.data().commentCount||0) })
  }, [showId, user.uid])

  useEffect(() => { if (running) bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [comments])

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

  const heatmap = useMemo(() => {
    const buckets = 40
    const data = new Array(buckets).fill(0)
    comments.forEach(c => {
      if (c.timestamp != null) {
        const idx = Math.min(Math.floor((c.timestamp/maxTime)*buckets), buckets-1)
        data[idx]++
      }
    })
    const max = Math.max(...data, 1)
    return data.map(v => v/max)
  }, [comments, maxTime])

  async function toggleFav() {
    const favRef = doc(db, 'favorites', `${user.uid}_${showId}`)
    const countRef = doc(db, 'favoriteCounts', showId)
    const isFilm = isMovie
    if (isFav) {
      await setDoc(favRef, { deleted:true }, { merge:true })
      await setDoc(countRef, { count: Math.max(0, favCount-1) }, { merge:true })
      setFavCount(c => Math.max(0,c-1)); setIsFav(false)
    } else {
      const favData = { userId:user.uid, showId, showName:show?.name||show?.title||'', showPoster:show?.poster_path||'', isMovie:isFilm, createdAt:serverTimestamp() }
      await setDoc(favRef, favData)
      await setDoc(countRef, { count: favCount+1 }, { merge:true })
      setFavCount(c => c+1); setIsFav(true)
      if (!localStorage.getItem('first_fav_done')) { localStorage.setItem('first_fav_done','1'); showToast('Premier favori ajouté !','⭐') }
    }
  }

  async function sendComment() {
    if (!text.trim()) return
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    const newCount = userCommentCount + 1
    const topBadge = getTopBadge(newCount)
    const commentData = {
      text: text.trim(), userId: user.uid,
      userName: user.displayName||'Anonyme', userPhoto: user.photoURL||'',
      userBadge: topBadge ? `${topBadge.emoji} ${topBadge.label}` : null,
      timestamp: running ? elapsed : null,
      showId, showName: show?.name||show?.title||'',
      showPoster: show?.poster_path||'',
      seasonNum: parseInt(seasonNum), episodeNum: parseInt(episodeNum),
      episodeName: episode?.name||show?.title||'',
      replyTo: replyTo ? { id:replyTo.id, userName:replyTo.userName, text:replyTo.text?.slice(0,60) } : null,
      reactions: {}, createdAt: serverTimestamp()
    }
    if (!isOnline) {
      setPendingComments(p => [...p, commentData])
    } else {
      await addDoc(collection(db, 'comments', colId, 'messages'), commentData)
      await addDoc(collection(db, 'userComments'), commentData)
      await setDoc(doc(db, 'users', user.uid), { commentCount: newCount }, { merge:true })
      setUserCommentCount(newCount)
      if (newCount === 1) showToast('Premier commentaire posté !','🎬')
      const prevBadges = BADGES.filter(b => (newCount-1) >= b.threshold)
      const newBadges = BADGES.filter(b => newCount >= b.threshold)
      if (newBadges.length > prevBadges.length) {
        const badge = newBadges[newBadges.length-1]
        showToast(`Badge débloqué : ${badge.label}`, badge.emoji)
      }
    }
    setText(''); setReplyTo(null)
  }

  async function addReaction(commentId, emoji) {
    const colId = `${showId}_s${seasonNum}_e${episodeNum}`
    await updateDoc(doc(db, 'comments', colId, 'messages', commentId), { [`reactions.${emoji}`]: increment(1) })
    setShowEmojiFor(null)
  }

  function handleShare(c) {
    const ts = c.timestamp !== null ? ` à ${formatTime(c.timestamp)}` : ''
    const url = `${window.location.origin}/episode/${showId}/${seasonNum}/${episodeNum}`
    const msg = `"${c.text}"${ts} — sur ${c.showName||'StreamChat'}\n👉 ${url}`
    if (!localStorage.getItem('first_share_done')) { localStorage.setItem('first_share_done','1'); showToast('Premier partage !','↗️') }
    if (navigator.share) navigator.share({ text:msg })
    else { navigator.clipboard.writeText(msg); showToast('Lien copié !','📋') }
  }

  function goBack() {
    if (isMovie) navigate(-1)
    else navigate(`/show/${showId}`)
  }

  const filtered = useMemo(() => {
    let list = filter==='all' ? comments : filter==='ts' ? comments.filter(c=>c.timestamp!==null) : comments.filter(c=>c.userId===user.uid)
    if (sliderTime !== null) list = list.filter(c => c.timestamp === null || Math.abs(c.timestamp - sliderTime) <= 60)
    return list
  }, [comments, filter, sliderTime, user.uid])

  const backdrop = show?.backdrop_path
  const title = show?.name||show?.title||'Série'
  const epLabel = isMovie ? (show?.release_date?.slice(0,4)||'Film') : `S${String(seasonNum).padStart(2,'0')}E${String(episodeNum).padStart(2,'0')} · ${episode?.name||'Épisode'}`
  const synopsis = show?.overview||episode?.overview||''

  const st = {
    page: { height:'100vh', background:'#1A1A2E', color:'#FFF', display:'flex', flexDirection:'column', overflow:'hidden' },
    banner: { width:'100%', height:120, objectFit:'cover', background:'#16213E', flexShrink:0 },
    bannerPlaceholder: { width:'100%', height:70, background:'#16213E', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 },
    header: { padding:'8px 14px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #2C2C2A', flexShrink:0 },
    back: { fontSize:20, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:'4px 6px', flexShrink:0 },
    headerInfo: { flex:1, minWidth:0 },
    showName: { fontSize:11, color:'#888780', marginBottom:1 },
    epRow: { display:'flex', alignItems:'center', gap:8 },
    epName: { fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
    favBtn: { fontSize:20, background:'none', border:'none', cursor:'pointer', padding:2, flexShrink:0 },
    headerRight: { display:'flex', alignItems:'center', gap:6, flexShrink:0 },
    commentCount: { fontSize:11, color:'#888780' },
    episodesBtn: { background:'#16213E', border:'1px solid #2C2C2A', borderRadius:8, padding:'3px 8px', fontSize:10, color:'#9F9BE8', cursor:'pointer' },
    synopsis: { padding:'7px 14px', fontSize:11, color:'#888780', lineHeight:1.5, borderBottom:'1px solid #2C2C2A', flexShrink:0 },
    offlineBanner: { background:'#412402', padding:'4px 14px', fontSize:10, color:'#FAC775', textAlign:'center', flexShrink:0 },
    sync: { padding:'7px 14px', background:'#16213E', borderBottom:'1px solid #2C2C2A', flexShrink:0 },
    syncRow: { display:'flex', alignItems:'center', gap:8 },
    syncBtn: { background:'#534AB7', border:'none', borderRadius:8, padding:'6px 12px', color:'#FFF', fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0 },
    syncBtnStop: { background:'#2C2C2A', border:'none', borderRadius:8, padding:'6px 12px', color:'#E24B4A', fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0 },
    timer: { fontSize:16, fontWeight:700, color:'#534AB7', fontVariantNumeric:'tabular-nums' },
    timerLabel: { fontSize:9, color:'#888780' },
    heatmapWrap: { padding:'6px 14px', flexShrink:0, borderBottom:'1px solid #2C2C2A' },
    heatmapLabel: { fontSize:10, color:'#888780', marginBottom:4 },
    heatmapBars: { display:'flex', gap:1, height:24, alignItems:'flex-end', marginBottom:4 },
    heatmapBar: { flex:1, borderRadius:2, minHeight:2, background:'#534AB7', opacity:0.3 },
    heatmapBarActive: { opacity:1 },
    slider: { width:'100%', accentColor:'#534AB7' },
    sliderRow: { display:'flex', justifyContent:'space-between', fontSize:9, color:'#444441', marginTop:2 },
    revealBanner: { background:'rgba(26,26,46,0.95)', borderBottom:'1px solid #2C2C2A', padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
    revealBtn: { background:'#534AB7', border:'none', borderRadius:8, padding:'6px 14px', color:'#FFF', fontSize:11, fontWeight:600, cursor:'pointer' },
    filter: { padding:'5px 14px', display:'flex', gap:5, overflowX:'auto', flexShrink:0, borderBottom:'1px solid #2C2C2A' },
    filterBtn: { background:'#16213E', border:'1px solid #2C2C2A', borderRadius:20, padding:'3px 9px', color:'#888780', fontSize:10, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
    filterActive: { background:'#534AB7', border:'1px solid #534AB7', color:'#FFF' },
    comments: { flex:1, overflowY:'auto', padding:'8px 14px' },
    comment: { display:'flex', gap:8, marginBottom:10, alignItems:'flex-start' },
    avatar: { width:26, height:26, borderRadius:'50%', flexShrink:0, background:'#2C2C2A', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, overflow:'hidden', cursor:'pointer' },
    bubble: { flex:1, background:'#16213E', borderRadius:'4px 10px 10px 10px', padding:'7px 10px', border:'1px solid #2C2C2A' },
    bubbleOwn: { background:'#1E1B4B', border:'1px solid #534AB7' },
    blurred: { filter:'blur(5px)', userSelect:'none', pointerEvents:'none' },
    bubbleTop: { display:'flex', alignItems:'center', gap:4, marginBottom:3, flexWrap:'wrap' },
    username: { fontSize:11, fontWeight:600, cursor:'pointer' },
    badgePill: { fontSize:9, background:'#1E1B4B', borderRadius:8, padding:'1px 4px', color:'#9F9BE8' },
    tsBadge: { fontSize:9, color:'#534AB7', background:'#1A1A2E', borderRadius:4, padding:'1px 4px', fontWeight:600 },
    timeago: { fontSize:9, color:'#444441', marginLeft:'auto' },
    replyQuote: { fontSize:10, color:'#888780', fontStyle:'italic', borderLeft:'2px solid #2C2C2A', paddingLeft:5, marginBottom:3 },
    text: { fontSize:12, lineHeight:1.5, color:'#D3D1C7', marginBottom:4 },
    actions: { display:'flex', gap:3, flexWrap:'wrap', alignItems:'center' },
    reactionBtn: { background:'#0F0F1A', border:'1px solid #2C2C2A', borderRadius:20, padding:'1px 5px', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', gap:2 },
    addReaction: { background:'none', border:'1px solid #2C2C2A', borderRadius:20, padding:'1px 5px', fontSize:10, cursor:'pointer', color:'#888780' },
    actionBtn: { background:'none', border:'none', color:'#888780', fontSize:10, cursor:'pointer', padding:'0 3px' },
    emojiRow: { display:'flex', gap:4, padding:'3px 0' },
    emojiBtn: { fontSize:14, cursor:'pointer', background:'none', border:'none', padding:1 },
    replyingBar: { background:'#16213E', borderLeft:'2px solid #534AB7', padding:'4px 10px', margin:'0 14px 4px', borderRadius:'0 8px 8px 0', fontSize:10, color:'#9F9BE8', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 },
    inputArea: { padding:'7px 14px 10px', borderTop:'1px solid #2C2C2A', background:'#0F0F1A', flexShrink:0 },
    inputRow: { display:'flex', gap:7, alignItems:'flex-end' },
    textarea: { flex:1, background:'#16213E', border:'1px solid #2C2C2A', borderRadius:10, padding:'8px 11px', color:'#FFF', fontSize:13, resize:'none', outline:'none', minHeight:36, maxHeight:80, fontFamily:'inherit', lineHeight:1.4 },
    sendBtn: { background:'#534AB7', border:'none', borderRadius:9, width:36, height:36, color:'#FFF', fontSize:14, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' },
    empty: { textAlign:'center', padding:'20px', color:'#444441', fontSize:12 },
  }

  const sliderMax = maxTime || 120

  return (
    <div style={st.page}>
      <ToastContainer toasts={toasts} />

      {backdrop ? <img src={`https://image.tmdb.org/t/p/w780${backdrop}`} style={st.banner} alt="" /> : <div style={st.bannerPlaceholder}>🎬</div>}

      <div style={st.header}>
        <button style={st.back} onClick={goBack}>←</button>
        <div style={st.headerInfo}>
          <div style={st.showName}>{title}</div>
          <div style={st.epRow}>
            <div style={st.epName}>{epLabel}</div>
            <button style={st.favBtn} onClick={toggleFav} title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
              {isFav ? '❤️' : '🤍'}
            </button>
          </div>
        </div>
        <div style={st.headerRight}>
          <span style={st.commentCount}>{favCount} ❤️ · {comments.length} 💬</span>
          {!isMovie && <button style={st.episodesBtn} onClick={() => navigate(`/show/${showId}`)}>Épisodes</button>}
        </div>
      </div>

      {synopsis ? <div style={st.synopsis}>{synopsis.slice(0,140)}{synopsis.length>140?'…':''}</div> : null}
      {!isOnline && <div style={st.offlineBanner}>⚠️ Hors-ligne — commentaires en attente</div>}

      <div style={st.sync}>
        <div style={st.syncRow}>
          {!running
            ? <button style={st.syncBtn} onClick={() => setRunning(true)}>▶ Je regarde maintenant</button>
            : <button style={st.syncBtnStop} onClick={() => setRunning(false)}>⏸ Pause</button>}
          {(running||elapsed>0) && (
            <div>
              <div style={{ ...st.timer, color:running?'#534AB7':'#888780' }}>{formatTime(elapsed)}</div>
              <div style={st.timerLabel}>{running?'en cours':'en pause'}</div>
            </div>
          )}
        </div>
      </div>

      <div style={st.heatmapWrap}>
        <div style={st.heatmapLabel}>🔥 Intensité des réactions {sliderTime!==null ? `— filtre : ${formatTime(sliderTime)} ±1min` : ''}</div>
        <div style={st.heatmapBars}>
          {heatmap.map((v,i) => {
            const bucketTime = Math.floor((i/heatmap.length)*sliderMax)
            const isActive = sliderTime !== null && Math.abs(bucketTime - sliderTime) < (sliderMax/heatmap.length)*2
            return <div key={i} style={{ ...st.heatmapBar, height:`${Math.max(4, v*100)}%`, ...(isActive ? st.heatmapBarActive : {}) }} />
          })}
        </div>
        <input type="range" min={0} max={sliderMax} step={1} value={sliderTime??0} style={st.slider}
          onChange={e => setSliderTime(e.target.value==0&&sliderTime===null?null:parseInt(e.target.value))}
          onDoubleClick={() => setSliderTime(null)} />
        <div style={st.sliderRow}>
          <span>0:00</span>
          {sliderTime!==null && <span style={{ color:'#534AB7', fontWeight:600 }}>{formatTime(sliderTime)} (double-clic pour réinitialiser)</span>}
          <span>{formatTime(sliderMax)}</span>
        </div>
      </div>

      {!revealed && (
        <div style={st.revealBanner}>
          <span style={{ fontSize:12, color:'#888780' }}>💬 {comments.length} commentaires — floutés pour éviter les spoilers</span>
          <button style={st.revealBtn} onClick={() => setRevealed(true)}>Révéler</button>
        </div>
      )}

      <div style={st.filter}>
        {[['all','Tous'],['ts','Horodatés'],['mine','Les miens']].map(([k,l]) => (
          <button key={k} style={{ ...st.filterBtn, ...(filter===k?st.filterActive:{}) }} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div style={st.comments}>
        {filtered.length===0 && <div style={st.empty}><div style={{ fontSize:26, marginBottom:6 }}>🎬</div>Lance l'épisode et sois le premier !</div>}
        {filtered.map(c => (
          <div key={c.id} style={st.comment}>
            <div style={st.avatar} onClick={() => navigate(`/user/${c.userId}`)}>
              {c.userPhoto ? <img src={c.userPhoto} style={{ width:'100%', height:'100%' }} alt="" /> : c.userName?.[0]?.toUpperCase()}
            </div>
            <div style={{ ...st.bubble, ...(c.userId===user.uid?st.bubbleOwn:{}), ...(!revealed?st.blurred:{}) }}>
              <div style={st.bubbleTop}>
                <span style={st.username} onClick={() => navigate(`/user/${c.userId}`)}>{c.userId===user.uid?'Moi':c.userName}</span>
                {c.userBadge && <span style={st.badgePill}>{c.userBadge}</span>}
                {c.timestamp!=null&&c.timestamp!==undefined&&<span style={st.tsBadge}>⏱ {formatTime(c.timestamp)}</span>}
                {c.replyTo && <span style={{ ...st.badgePill, color:'#9F9BE8' }}>↩ @{c.replyTo.userName}</span>}
                <span style={st.timeago}>{timeAgo(c.createdAt)}</span>
              </div>
              {c.replyTo && <div style={st.replyQuote}>"{c.replyTo.text}"</div>}
              <div style={st.text}>{c.text}</div>
              <div style={st.actions}>
                {EMOJIS.map(emoji => {
                  const cnt = c.reactions?.[emoji]||0
                  if (cnt===0) return null
                  return <button key={emoji} style={st.reactionBtn} onClick={() => addReaction(c.id,emoji)}><span style={{ fontSize:10 }}>{emoji}</span><span style={{ fontSize:10, color:'#9F9BE8' }}>{cnt}</span></button>
                })}
                {showEmojiFor===c.id
                  ? <div style={st.emojiRow}>{EMOJIS.map(e => <button key={e} style={st.emojiBtn} onClick={() => addReaction(c.id,e)}>{e}</button>)}</div>
                  : <button style={st.addReaction} onClick={() => setShowEmojiFor(c.id)}>+</button>}
                <button style={st.actionBtn} onClick={() => setReplyTo(c)}>↩</button>
                <button style={st.actionBtn} onClick={() => handleShare(c)}>↗</button>
              </div>
            </div>
          </div>
        ))}
        {pendingComments.length>0 && <div style={{ textAlign:'center', fontSize:10, color:'#888780', padding:4 }}>{pendingComments.length} en attente…</div>}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div style={st.replyingBar}>
          <span>↩ @{replyTo.userName} : "{replyTo.text?.slice(0,40)}"</span>
          <button style={{ background:'none', border:'none', color:'#888780', cursor:'pointer', fontSize:14 }} onClick={() => setReplyTo(null)}>×</button>
        </div>
      )}

      <div style={st.inputArea}>
        {running && <div style={{ fontSize:10, color:'#534AB7', marginBottom:4 }}>⏱ Sera horodaté à {formatTime(elapsed)}</div>}
        <div style={st.inputRow}>
          <textarea style={st.textarea}
            placeholder={replyTo ? `Répondre à @${replyTo.userName}…` : 'Écris ton commentaire…'}
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendComment() } }}
            rows={1} />
          <button style={{ ...st.sendBtn, ...(text.trim()?{}:{ background:'#2C2C2A', cursor:'not-allowed' }) }}
            onClick={sendComment} disabled={!text.trim()}>➤</button>
        </div>
      </div>

      <Nav />
    </div>
  )
}
