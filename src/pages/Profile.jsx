import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, query, where, orderBy, limit, onSnapshot, doc, setDoc, getDoc, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { ToastContainer, useToast } from '../components/Toast'
import Nav from '../components/Nav'

const BADGES = [
  { id:'first', emoji:'🎬', label:'Premier pas', desc:'Poste ton premier commentaire', threshold:1 },
  { id:'fire', emoji:'🔥', label:'En feu', desc:'Atteins 10 commentaires', threshold:10 },
  { id:'night', emoji:'🌙', label:'Noctambule', desc:'Atteins 25 commentaires', threshold:25 },
  { id:'star', emoji:'⭐', label:'Top voix', desc:'Atteins 50 commentaires', threshold:50 },
  { id:'legend', emoji:'👑', label:'Légende', desc:'Atteins 200 commentaires', threshold:200 },
]
const LEVELS = [{min:0,label:'Spectateur'},{min:10,label:'Critique'},{min:50,label:'Cinéphile'},{min:200,label:'Expert'},{min:500,label:'Légende'}]
const AVATARS = ['🎬','🎭','🍿','🦊','🌙','⭐','🔥','🎸','🦋','🎮','🌊','🌺']
const COUNTRIES = ['France','Belgique','Suisse','Canada','États-Unis','Royaume-Uni','Espagne','Allemagne','Italie','Japon','Autre']
const BANNER_COLORS = ['#1A1A2E','#16213E','#1E1B4B','#085041','#412402','#4A1B0C','#26215C','#0C447C']
const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

function getLevel(c) { let l=LEVELS[0]; for(const x of LEVELS){if(c>=x.min)l=x}; return l }
function getNextBadge(c) { return BADGES.find(b=>b.threshold>c) }

const s = {
  page: { minHeight:'100vh', background:'#0F0F1A', color:'#FFFFFF', paddingBottom:70 },
  bannerArea: { height:100, position:'relative', marginBottom:40 },
  avatarWrap: { position:'absolute', bottom:-32, left:16 },
  avatar: { width:64, height:64, borderRadius:'50%', border:'3px solid #0F0F1A', background:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, color:'#fff', fontWeight:700, overflow:'hidden' },
  editBtn: { position:'absolute', bottom:-24, right:16, background:'#534AB7', border:'none', borderRadius:8, padding:'6px 12px', fontSize:11, color:'#FFF', cursor:'pointer', fontWeight:600 },
  info: { padding:'0 16px 14px' },
  name: { fontSize:18, fontWeight:700, marginBottom:3, color:'#FFFFFF' },
  levelBadge: { display:'inline-flex', gap:4, background:'#1E1B4B', borderRadius:20, padding:'4px 12px', fontSize:12, color:'#C8C4F8', fontWeight:600, marginBottom:12 },
  stats: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, padding:'0 16px', marginBottom:16 },
  statCard: { background:'#16213E', borderRadius:10, padding:'10px 6px', border:'1px solid #3A3A5C', textAlign:'center' },
  statNum: { fontSize:18, fontWeight:700, color:'#FFFFFF', marginBottom:3 },
  statLabel: { fontSize:9, color:'#C0BEDE', lineHeight:1.4 },
  section: { padding:'0 16px', marginBottom:16 },
  sectionTitle: { fontSize:12, fontWeight:600, color:'#C0BEDE', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 },
  badgesGrid: { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 },
  badgeItem: { background:'#1E1B4B', borderRadius:10, padding:'10px 4px', textAlign:'center', border:'1px solid #534AB7' },
  badgeLocked: { background:'#16213E', borderRadius:10, padding:'10px 4px', textAlign:'center', border:'1px solid #2C2C4A' },
  badgeEmoji: { fontSize:20, display:'block', marginBottom:3 },
  badgeLabel: { fontSize:9, lineHeight:1.3, marginBottom:2 },
  badgeDesc: { fontSize:8, color:'#888780', lineHeight:1.3 },
  progressWrap: { background:'#16213E', borderRadius:10, padding:12, border:'1px solid #3A3A5C' },
  progressBar: { background:'#0F0F1A', borderRadius:20, height:5, overflow:'hidden', margin:'5px 0' },
  progressFill: { height:'100%', background:'#534AB7', borderRadius:20 },
  tagWrap: { display:'flex', gap:6, flexWrap:'wrap' },
  tag: { background:'#1E1B4B', border:'1px solid #534AB7', borderRadius:20, padding:'4px 12px', fontSize:12, color:'#C8C4F8' },
  modal: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 },
  modalCard: { background:'#16213E', borderRadius:16, padding:18, width:'100%', maxWidth:340, border:'1px solid #3A3A5C', maxHeight:'90vh', overflowY:'auto' },
  modalTitle: { fontSize:15, fontWeight:700, marginBottom:14, color:'#FFFFFF' },
  label: { fontSize:12, color:'#C0BEDE', marginBottom:5, display:'block', marginTop:8 },
  input: { width:'100%', background:'#0F0F1A', border:'1px solid #3A3A5C', borderRadius:10, padding:'10px 12px', color:'#FFFFFF', fontSize:13, outline:'none', marginBottom:4, boxSizing:'border-box' },
  avatarGrid: { display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6, marginBottom:8 },
  avatarOption: { fontSize:22, textAlign:'center', cursor:'pointer', padding:4, borderRadius:8, border:'1px solid transparent' },
  avatarActive: { border:'1px solid #534AB7', background:'#1E1B4B' },
  bannerGrid: { display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 },
  bannerOption: { width:36, height:24, borderRadius:6, cursor:'pointer', border:'2px solid transparent' },
  bannerActive: { border:'2px solid #9F9BE8' },
  bannerImgOption: { width:72, height:44, borderRadius:6, cursor:'pointer', border:'2px solid transparent', objectFit:'cover', display:'block' },
  bannerImgActive: { border:'2px solid #9F9BE8' },
  select: { width:'100%', background:'#0F0F1A', border:'1px solid #3A3A5C', borderRadius:10, padding:'10px 12px', color:'#FFFFFF', fontSize:13, outline:'none', marginBottom:4, boxSizing:'border-box' },
  modalBtn: { background:'#534AB7', border:'none', borderRadius:10, padding:'11px 0', color:'#FFF', fontSize:13, fontWeight:600, cursor:'pointer', width:'100%', marginBottom:8, marginTop:12 },
  modalBtnCancel: { background:'none', border:'1px solid #3A3A5C', borderRadius:10, padding:'9px 0', color:'#C0BEDE', fontSize:13, cursor:'pointer', width:'100%' },
  cropWrap: { position:'relative', width:'100%', height:200, background:'#0F0F1A', borderRadius:10, overflow:'hidden', marginBottom:8 },
  logoutBtn: { background:'none', border:'1px solid #3A3A5C', borderRadius:10, padding:'11px', color:'#C0BEDE', fontSize:12, cursor:'pointer', width:'100%' },
}

export default function Profile({ user }) {
  const navigate = useNavigate()
  const { toasts, showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [profileData, setProfileData] = useState(null)
  const [newName, setNewName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [selectedBanner, setSelectedBanner] = useState(BANNER_COLORS[0])
  const [bannerImg, setBannerImg] = useState('')
  const [bannerPosY, setBannerPosY] = useState(50)
  const [activeList, setActiveList] = useState(null)
  const [instagram, setInstagram] = useState('')
  const [twitter, setTwitter] = useState('')
  const [letterboxd, setLetterboxd] = useState('')
  const [country, setCountry] = useState('France')
  const [photoPreview, setPhotoPreview] = useState('')
  const [rawPhoto, setRawPhoto] = useState(null)
  const [cropOffset, setCropOffset] = useState({ x:0, y:0 })
  const [cropScale, setCropScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [stats, setStats] = useState({ comments:0, movieFavs:0, serieFavs:0, reactions:0 })
  const [autoTags, setAutoTags] = useState([])
  const [comments, setComments] = useState([])
  const [favsList, setFavsList] = useState([])
  const [favBanners, setFavBanners] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setProfileData(d)
        setNewName(d.displayName||user.displayName||'')
        setSelectedAvatar(d.avatar||null)
        setSelectedBanner(d.bannerColor||BANNER_COLORS[0])
        setBannerImg(d.bannerImg||'')
        setBannerPosY(d.bannerPosY||50)
        setInstagram(d.social?.instagram||'')
        setTwitter(d.social?.twitter||'')
        setLetterboxd(d.social?.letterboxd||'')
        setCountry(d.country||'France')
        setPhotoPreview(d.photoURL||user.photoURL||'')
      }
    })
  }, [user.uid])

  // Compteurs en temps réel
  useEffect(() => {
    const q = query(collection(db, 'userComments'), where('userId','==',user.uid))
    return onSnapshot(q, snap => {
      const allComments = snap.docs.map(d => d.data())
      setComments([...allComments].sort((a,b) => (b.createdAt?.toMillis()||0) - (a.createdAt?.toMillis()||0)))
      const commentCount = allComments.length
      const reactionsReceived = allComments.reduce((acc,c) => acc + Object.values(c.reactions||{}).reduce((a,b)=>a+b,0), 0)

      // Tags automatiques depuis les genres
      const genreCounts = {}
      allComments.forEach(c => { if (c.showGenres) c.showGenres.forEach(g => { genreCounts[g] = (genreCounts[g]||0)+1 }) })
      const topGenres = Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([g])=>g)
      setAutoTags(topGenres)

      setStats(s => ({ ...s, comments: commentCount, reactions: reactionsReceived }))
      setDoc(doc(db, 'users', user.uid), { commentCount, reactionsReceived }, { merge:true })
    })
  }, [user.uid])

  // Compteurs favoris en temps réel
  useEffect(() => {
    const q = query(collection(db, 'favorites'), where('userId','==',user.uid))
    return onSnapshot(q, snap => {
      const favs = snap.docs.map(d => d.data()).filter(d => !d.deleted)
      const movieFavs = favs.filter(f => f.isMovie).length
      const serieFavs = favs.filter(f => !f.isMovie).length
      setFavsList(favs)
      const banners = favs.filter(f => f.showPoster).map(f => ({
        url: `https://image.tmdb.org/t/p/w780${f.showPoster}`,
        name: f.showName
      })).slice(0, 8)
      setFavBanners(banners)
      setStats(s => ({ ...s, movieFavs, serieFavs }))
      setDoc(doc(db, 'users', user.uid), { movieFavs, serieFavs }, { merge:true })
    })
  }, [user.uid])

  const cropCanvasRef = useRef(null)

  function handlePhotoSelect(e) {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => {
      setRawPhoto(ev.target.result)
      setCropOffset({ x:0, y:0 })
      setCropScale(1.2)
      setSelectedAvatar(null)
    }
    reader.readAsDataURL(f)
  }

  function applyCrop() {
    if (!rawPhoto) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 200; canvas.height = 200
      const ctx = canvas.getContext('2d')
      ctx.beginPath()
      ctx.arc(100, 100, 100, 0, Math.PI*2)
      ctx.clip()
      const displaySize = 160
      const imgAspect = img.width / img.height
      let drawW, drawH
      if (imgAspect > 1) { drawH = displaySize * cropScale; drawW = drawH * imgAspect }
      else { drawW = displaySize * cropScale; drawH = drawW / imgAspect }
      const scaleToCanvas = 200 / displaySize
      const cx = (200 - drawW * scaleToCanvas) / 2 + cropOffset.x * scaleToCanvas
      const cy = (200 - drawH * scaleToCanvas) / 2 + cropOffset.y * scaleToCanvas
      ctx.drawImage(img, cx, cy, drawW * scaleToCanvas, drawH * scaleToCanvas)
      setPhotoPreview(canvas.toDataURL('image/jpeg', 0.9))
      setRawPhoto(null)
    }
    img.src = rawPhoto
  }

  function onCropMouseDown(e) { setIsDragging(true); setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y }) }
  function onCropMouseMove(e) { if (!isDragging || !dragStart) return; setCropOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }) }
  function onCropMouseUp() { setIsDragging(false) }
  function onCropTouchStart(e) { const t=e.touches[0]; setIsDragging(true); setDragStart({ x:t.clientX-cropOffset.x, y:t.clientY-cropOffset.y }) }
  function onCropTouchMove(e) { if(!isDragging||!dragStart)return; const t=e.touches[0]; setCropOffset({ x:t.clientX-dragStart.x, y:t.clientY-dragStart.y }) }

  async function saveProfile() {
    const data = {
      displayName: newName || user.displayName || 'Anonyme',
      avatar: selectedAvatar,
      bannerColor: selectedBanner,
      bannerImg,
      photoURL: selectedAvatar ? null : photoPreview,
      social: { instagram, twitter, letterboxd },
      country,
      updatedAt: new Date()
    }
    await setDoc(doc(db, 'users', user.uid), data, { merge:true })
    setProfileData(prev => ({ ...prev, ...data }))
    setEditing(false)
    showToast('Profil mis à jour !', '✅')
  }

  const displayName = profileData?.displayName || user.displayName || 'Anonyme'
  const avatarDisplay = profileData?.avatar || null
  const photoURL = !avatarDisplay ? (profileData?.photoURL || user.photoURL || '') : null
  const bannerColor = profileData?.bannerColor || BANNER_COLORS[0]
  const bannerImgUrl = profileData?.bannerImg || ''
  const count = stats.comments
  const level = getLevel(count)
  const nextBadge = getNextBadge(count)
  const nextThreshold = nextBadge?.threshold || count
  const progress = nextBadge ? Math.round((count/nextThreshold)*100) : 100

  return (
    <div style={s.page}>
      <ToastContainer toasts={toasts} />

      <div style={{ ...s.bannerArea, background: bannerColor, ...(bannerImgUrl ? { backgroundImage:`url(${bannerImgUrl})`, backgroundSize:'cover', backgroundPosition:`center ${bannerPosY}%`, backgroundRepeat:'no-repeat' } : {}) }}>
        <div style={s.avatarWrap}>
          <div style={s.avatar}>
            {avatarDisplay ? <span style={{ fontSize:28 }}>{avatarDisplay}</span>
              : photoURL ? <img src={photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
              : displayName[0]?.toUpperCase()}
          </div>
        </div>
        <button style={s.editBtn} onClick={() => setEditing(true)}>✏️ Modifier mon profil</button>
      </div>

      <div style={s.info}>
        <div style={s.name}>{displayName}</div>
        <div style={s.levelBadge}>🎭 {level.label} · {country}</div>
      </div>

      {activeList && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.9)', zIndex:200, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'16px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid #3A3A5C' }}>
            <button style={{ background:'none', border:'none', color:'#FFF', fontSize:20, cursor:'pointer' }} onClick={() => setActiveList(null)}>‹</button>
            <span style={{ fontSize:15, fontWeight:700 }}>{activeList === 'comments' ? 'Mes commentaires' : activeList === 'movieFavs' ? 'Films favoris' : activeList === 'serieFavs' ? 'Séries favorites' : 'Réactions reçues'}</span>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
            {activeList === 'comments' && comments.map((c,i) => (
              <div key={i} style={{ background:'#1A2340', borderRadius:10, padding:12, marginBottom:8, border:'1px solid #3A3A5C', cursor:'pointer' }}
                onClick={() => { setActiveList(null); navigate(`/episode/${c.showId}/${c.seasonNum}/${c.episodeNum}`) }}>
                <div style={{ fontSize:11, color:'#B0AECB', marginBottom:4 }}>{c.showName} {c.seasonNum > 0 ? `S${String(c.seasonNum).padStart(2,'0')}E${String(c.episodeNum).padStart(2,'0')}` : 'Film'}</div>
                <div style={{ fontSize:13, color:'#FFFFFF', marginBottom:4 }}>{c.text}</div>
                <div style={{ fontSize:10, color:'#8888A0' }}>{c.timestamp != null ? `⏱ ${Math.floor(c.timestamp/60)}:${String(c.timestamp%60).padStart(2,'0')}` : ''}</div>
              </div>
            ))}
            {(activeList === 'movieFavs' || activeList === 'serieFavs') && favsList.filter(f => activeList === 'movieFavs' ? f.isMovie : !f.isMovie).map((f,i) => (
              <div key={i} style={{ background:'#1A2340', borderRadius:10, padding:12, marginBottom:8, border:'1px solid #3A3A5C', cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}
                onClick={() => { setActiveList(null); if (f.isMovie) navigate(`/episode/${f.showId}/0/0`); else navigate(`/show/${f.showId}`) }}>
                {f.showPoster && <img src={`https://image.tmdb.org/t/p/w92${f.showPoster}`} style={{ width:40, height:40, borderRadius:8, objectFit:'cover' }} alt="" />}
                <div style={{ fontSize:13, color:'#FFFFFF', fontWeight:600 }}>{f.showName}</div>
                <span style={{ fontSize:12, color:'#B0AECB', marginLeft:'auto' }}>›</span>
              </div>
            ))}
            {activeList === 'reactions' && comments.filter(c => Object.values(c.reactions||{}).reduce((a,b)=>a+b,0) > 0).map((c,i) => (
              <div key={i} style={{ background:'#1A2340', borderRadius:10, padding:12, marginBottom:8, border:'1px solid #3A3A5C', cursor:'pointer' }}
                onClick={() => { setActiveList(null); navigate(`/episode/${c.showId}/${c.seasonNum}/${c.episodeNum}`) }}>
                <div style={{ fontSize:11, color:'#B0AECB', marginBottom:4 }}>{c.showName}</div>
                <div style={{ fontSize:13, color:'#FFFFFF', marginBottom:6 }}>{c.text}</div>
                <div style={{ display:'flex', gap:6 }}>
                  {Object.entries(c.reactions||{}).filter(([,v])=>v>0).map(([k,v]) => (
                    <span key={k} style={{ background:'#1E1B4B', borderRadius:20, padding:'2px 8px', fontSize:11, color:'#C8C4F8' }}>{k} {v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={s.stats}>
        <div style={{ ...s.statCard, cursor:'pointer' }} onClick={() => setActiveList('comments')}><div style={s.statNum}>{count}</div><div style={s.statLabel}>Commentaires</div></div>
        <div style={{ ...s.statCard, cursor:'pointer' }} onClick={() => setActiveList('movieFavs')}><div style={s.statNum}>{stats.movieFavs}</div><div style={s.statLabel}>Films favoris</div></div>
        <div style={{ ...s.statCard, cursor:'pointer' }} onClick={() => setActiveList('serieFavs')}><div style={s.statNum}>{stats.serieFavs}</div><div style={s.statLabel}>Séries favorites</div></div>
        <div style={{ ...s.statCard, cursor:'pointer' }} onClick={() => setActiveList('reactions')}><div style={s.statNum}>{stats.reactions}</div><div style={s.statLabel}>Réactions reçues</div></div>
      </div>

      {autoTags.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Mes genres favoris</div>
          <div style={s.tagWrap}>
            {autoTags.map(tag => <div key={tag} style={s.tag}>{tag}</div>)}
          </div>
        </div>
      )}

      <div style={s.section}>
        <div style={s.sectionTitle}>Badges</div>
        <div style={s.badgesGrid}>
          {BADGES.map(b => {
            const earned = count >= b.threshold
            return (
              <div key={b.id} style={earned ? s.badgeItem : s.badgeLocked}>
                <span style={s.badgeEmoji}>{b.emoji}</span>
                <div style={{ ...s.badgeLabel, color: earned ? '#C8C4F8' : '#888780' }}>{b.label}</div>
                {!earned && <div style={s.badgeDesc}>{b.desc}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ padding:'0 16px', marginBottom:16 }}>
        <div style={s.progressWrap}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
            <span style={{ color:'#FFFFFF', fontWeight:600 }}>Progression</span>
            <span style={{ color:'#C0BEDE' }}>{count} commentaire{count>1?'s':''}</span>
          </div>
          {nextBadge && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                <span style={{ color:'#C0BEDE' }}>{level.label}</span>
                <span style={{ color:'#C0BEDE' }}>{nextBadge.label}</span>
              </div>
              <div style={s.progressBar}>
                <div style={{ ...s.progressFill, width:`${progress}%` }}/>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#8888A0', marginTop:3 }}>
                <span>{count} commentaires</span>
                <span>Objectif : {nextThreshold}</span>
              </div>
              <div style={{ fontSize:11, color:'#C0BEDE', marginTop:6 }}>Prochain badge : {nextBadge.emoji} {nextBadge.label} — {nextBadge.desc}</div>
            </>
          )}
          {!nextBadge && <div style={{ fontSize:12, color:'#C8C4F8', textAlign:'center' }}>🏆 Tu as atteint le niveau maximum !</div>}
        </div>
      </div>

      <div style={{ padding:'0 16px 16px' }}>
        <button style={s.logoutBtn} onClick={() => signOut(auth)}>Se déconnecter</button>
      </div>

      {editing && (
        <div style={s.modal}>
          <div style={s.modalCard}>
            <div style={s.modalTitle}>Modifier mon profil</div>

            <label style={s.label}>Pseudo</label>
            <input style={s.input} placeholder="Ton pseudo" value={newName} onChange={e => setNewName(e.target.value)} />

            <label style={s.label}>Photo de profil</label>
            {rawPhoto ? (
              <div style={{ marginBottom:10 }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ position:'relative', width:140, height:140, borderRadius:'50%', overflow:'hidden', background:'#0F0F1A', cursor:'move', userSelect:'none', flexShrink:0 }}
                    onMouseDown={onCropMouseDown} onMouseMove={onCropMouseMove} onMouseUp={onCropMouseUp} onMouseLeave={onCropMouseUp}
                    onTouchStart={onCropTouchStart} onTouchMove={onCropTouchMove} onTouchEnd={onCropMouseUp}>
                    <img src={rawPhoto} style={{ position:'absolute', width:`${100*cropScale}%`, height:`${100*cropScale}%`, objectFit:'cover', left:`calc(50% + ${cropOffset.x}px)`, top:`calc(50% + ${cropOffset.y}px)`, transform:'translate(-50%,-50%)' }} alt="" draggable={false} />
                    <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid #534AB7', pointerEvents:'none' }} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:'#B0AECB', marginBottom:6 }}>Glisse pour repositionner</div>
                    <div style={{ fontSize:11, color:'#B0AECB', marginBottom:4 }}>Zoom</div>
                    <input type="range" min="0.5" max="3" step="0.05" value={cropScale} style={{ width:'100%', accentColor:'#534AB7' }} onChange={e => setCropScale(parseFloat(e.target.value))} />
                    <div style={{ fontSize:10, color:'#8888A0', marginTop:4 }}>×{cropScale.toFixed(1)}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:10, color:'#B0AECB' }}>Zoom</span>
                  <input type="range" min="1" max="3" step="0.05" value={cropScale} style={{ flex:1, accentColor:'#534AB7' }} onChange={e => setCropScale(parseFloat(e.target.value))} />
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button style={{ flex:1, background:'#534AB7', border:'none', borderRadius:8, padding:'7px', color:'#FFF', fontSize:12, cursor:'pointer' }} onClick={applyCrop}>Valider</button>
                  <button style={{ flex:1, background:'none', border:'1px solid #3A3A5C', borderRadius:8, padding:'7px', color:'#B0AECB', fontSize:12, cursor:'pointer' }} onClick={() => setRawPhoto(null)}>Annuler</button>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                <div style={{ width:52, height:52, borderRadius:'50%', background:'#0F0F1A', border:'1px solid #3A3A5C', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                  {photoPreview && !selectedAvatar ? <img src={photoPreview} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (selectedAvatar || '👤')}
                </div>
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoSelect} />
                  <button style={{ background:'#534AB7', border:'none', borderRadius:8, padding:'7px 14px', color:'#FFF', fontSize:12, cursor:'pointer' }} onClick={() => fileInputRef.current?.click()}>
                    Choisir une photo
                  </button>
                  <div style={{ fontSize:10, color:'#8888A0', marginTop:4 }}>Glisse pour recadrer, zoom pour ajuster</div>
                </div>
              </div>
            )}

            <label style={s.label}>Ou choisir un avatar emoji</label>
            <div style={s.avatarGrid}>
              {AVATARS.map(a => (
                <div key={a} style={{ ...s.avatarOption, ...(selectedAvatar===a?s.avatarActive:{}) }}
                  onClick={() => { setSelectedAvatar(selectedAvatar===a?null:a); if(selectedAvatar!==a) setPhotoPreview('') }}>{a}</div>
              ))}
            </div>

            <label style={s.label}>Bannière — tes favoris</label>
            {favBanners.length > 0 ? (
              <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:8, paddingBottom:4 }}>
                {favBanners.map((b,i) => (
                  <div key={i} style={{ width:72, height:44, borderRadius:6, overflow:'hidden', cursor:'pointer', border: bannerImg===b.url ? '2px solid #9F9BE8' : '2px solid transparent', flexShrink:0 }}
                    onClick={() => setBannerImg(bannerImg===b.url?'':b.url)}>
                    <img src={b.url} alt={b.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize:11, color:'#888780', marginBottom:8 }}>Ajoute des favoris pour voir leurs images ici</div>}

            <label style={s.label}>Ou URL d'image personnalisée</label>
            <input style={s.input} placeholder="https://..." value={bannerImg} onChange={e => setBannerImg(e.target.value)} />

            {(bannerImg) && (
              <div style={{ marginBottom:8 }}>
                <div style={{ width:'100%', height:60, borderRadius:8, backgroundImage:`url(${bannerImg})`, backgroundSize:'cover', backgroundPosition:`center ${bannerPosY}%`, marginBottom:6 }} />
                <label style={s.label}>Position verticale de l'image</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:10, color:'#8888A0' }}>Haut</span>
                  <input type="range" min="0" max="100" step="1" value={bannerPosY} style={{ flex:1, accentColor:'#534AB7' }} onChange={e => setBannerPosY(parseInt(e.target.value))} />
                  <span style={{ fontSize:10, color:'#8888A0' }}>Bas</span>
                </div>
              </div>
            )}
            <label style={s.label}>Ou couleur de bannière</label>
            <div style={s.bannerGrid}>
              {BANNER_COLORS.map(c => (
                <div key={c} style={{ ...s.bannerOption, background:c, ...(selectedBanner===c&&!bannerImg?s.bannerActive:{}) }}
                  onClick={() => { setSelectedBanner(c); setBannerImg('') }} />
              ))}
            </div>

            <label style={s.label}>Instagram</label>
            <input style={s.input} placeholder="@pseudo" value={instagram} onChange={e => setInstagram(e.target.value)} />
            <label style={s.label}>Twitter / X</label>
            <input style={s.input} placeholder="@pseudo" value={twitter} onChange={e => setTwitter(e.target.value)} />
            <label style={s.label}>Letterboxd</label>
            <input style={s.input} placeholder="ton profil" value={letterboxd} onChange={e => setLetterboxd(e.target.value)} />
            <label style={s.label}>Pays (notifications de sorties)</label>
            <select style={s.select} value={country} onChange={e => setCountry(e.target.value)}>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <button style={s.modalBtn} onClick={saveProfile}>Enregistrer</button>
            <button style={s.modalBtnCancel} onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </div>
      )}

      <Nav />
    </div>
  )
}
