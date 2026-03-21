import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, query, where, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { ToastContainer, useToast } from '../components/Toast'
import Nav from '../components/Nav'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

const BADGES = [
  { id:'first', emoji:'🎬', label:'Premier pas', desc:'Poste ton premier commentaire', threshold:1 },
  { id:'fire', emoji:'🔥', label:'En feu', desc:'Atteins 10 commentaires', threshold:10 },
  { id:'night', emoji:'🌙', label:'Noctambule', desc:'Atteins 25 commentaires', threshold:25 },
  { id:'star', emoji:'⭐', label:'Top voix', desc:'Atteins 50 commentaires', threshold:50 },
  { id:'legend', emoji:'👑', label:'Légende', desc:'Atteins 200 commentaires', threshold:200 },
]

const LEVELS = [
  { min:0, label:'Spectateur' },
  { min:10, label:'Critique' },
  { min:50, label:'Cinéphile' },
  { min:200, label:'Expert' },
  { min:500, label:'Légende' },
]

const AVATARS = ['🎬','🎭','🍿','🦊','🌙','⭐','🔥','🎸','🦋','🎮','🌊','🌺']
const COUNTRIES = ['France','Belgique','Suisse','Canada','États-Unis','Royaume-Uni','Espagne','Allemagne','Italie','Japon','Autre']
const BANNER_COLORS = ['#1A1A2E','#16213E','#1E1B4B','#085041','#412402','#4A1B0C','#26215C','#0C447C']

function getLevel(count) {
  let level = LEVELS[0]
  LEVELS.forEach(l => { if (count >= l.min) level = l })
  return level
}

function getNextBadge(count) {
  return BADGES.find(b => b.threshold > count)
}

export default function Profile({ user }) {
  const navigate = useNavigate()
  const { toasts, showToast } = useToast()
  const fileInputRef = useRef(null)

  // Données profil
  const [profileData, setProfileData] = useState(null)
  const [editing, setEditing] = useState(false)

  // Formulaire édition
  const [newName, setNewName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [selectedBanner, setSelectedBanner] = useState(BANNER_COLORS[0])
  const [bannerImg, setBannerImg] = useState('')
  const [bannerPosY, setBannerPosY] = useState(50)
  const [instagram, setInstagram] = useState('')
  const [twitter, setTwitter] = useState('')
  const [letterboxd, setLetterboxd] = useState('')
  const [country, setCountry] = useState('France')
  const [photoPreview, setPhotoPreview] = useState('')

  // Crop photo
  const [rawPhoto, setRawPhoto] = useState(null)
  const [cropOffset, setCropOffset] = useState({ x:0, y:0 })
  const [cropScale, setCropScale] = useState(1.2)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)

  // Stats
  const [stats, setStats] = useState({ comments:0, movieFavs:0, serieFavs:0, reactions:0 })
  const [autoTags, setAutoTags] = useState([])
  const [comments, setComments] = useState([])
  const [favsList, setFavsList] = useState([])
  const [activeList, setActiveList] = useState(null)
  const [favBanners, setFavBanners] = useState([])

  // Charger profil
  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setProfileData(d)
        setNewName(d.displayName || user.displayName || '')
        setSelectedAvatar(d.avatar || null)
        setSelectedBanner(d.bannerColor || BANNER_COLORS[0])
        setBannerImg(d.bannerImg || '')
        setBannerPosY(d.bannerPosY || 50)
        setInstagram(d.social?.instagram || '')
        setTwitter(d.social?.twitter || '')
        setLetterboxd(d.social?.letterboxd || '')
        setCountry(d.country || 'France')
        setPhotoPreview(d.photoURL || user.photoURL || '')
      }
    })
  }, [user.uid])

  // Commentaires temps réel
  useEffect(() => {
    const q = query(collection(db, 'userComments'), where('userId', '==', user.uid))
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => d.data())
      const sorted = [...all].sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
      setComments(sorted)

      const commentCount = all.length
      const reactionsReceived = all.reduce((acc, c) => acc + Object.values(c.reactions || {}).reduce((a, b) => a + b, 0), 0)

      // Tags genres
      const genreCounts = {}
      const toEnrich = []
      all.forEach(c => {
        if (c.showGenres?.length > 0) {
          c.showGenres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1 })
        } else if (c.showId && !toEnrich.find(x => x.showId === c.showId)) {
          toEnrich.push({ showId: c.showId, isMovie: c.showMediaType === 'movie' })
        }
      })

      if (Object.keys(genreCounts).length > 0) {
        setAutoTags(Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g))
      } else if (toEnrich.length > 0) {
        Promise.all(toEnrich.slice(0, 5).map(({ showId, isMovie }) => {
          const url = isMovie
            ? `https://api.themoviedb.org/3/movie/${showId}?api_key=${TMDB_KEY}&language=fr-FR`
            : `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_KEY}&language=fr-FR`
          return fetch(url).then(r => r.json()).catch(() => null)
        })).then(results => {
          results.filter(Boolean).forEach(d => {
            (d.genres || []).forEach(g => { genreCounts[g.name] = (genreCounts[g.name] || 0) + 1 })
          })
          setAutoTags(Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g))
        })
      }

      setStats(s => ({ ...s, comments: commentCount, reactions: reactionsReceived }))
      setDoc(doc(db, 'users', user.uid), { commentCount, reactionsReceived }, { merge: true })
    })
  }, [user.uid])

  // Favoris temps réel
  useEffect(() => {
    const q = query(collection(db, 'favorites'), where('userId', '==', user.uid))
    return onSnapshot(q, snap => {
      const favs = snap.docs.map(d => d.data()).filter(d => !d.deleted)
      const movieFavs = favs.filter(f => f.isMovie).length
      const serieFavs = favs.filter(f => !f.isMovie).length
      setFavsList(favs)
      setFavBanners(favs.filter(f => f.showPoster).map(f => ({
        url: `https://image.tmdb.org/t/p/w780${f.showPoster}`,
        name: f.showName
      })).slice(0, 8))
      setStats(s => ({ ...s, movieFavs, serieFavs }))
      setDoc(doc(db, 'users', user.uid), { movieFavs, serieFavs }, { merge: true })
    })
  }, [user.uid])

  // Photo
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
      ctx.arc(100, 100, 100, 0, Math.PI * 2)
      ctx.clip()
      const aspect = img.width / img.height
      const ds = 160
      const dw = aspect > 1 ? ds * cropScale * aspect : ds * cropScale
      const dh = aspect > 1 ? ds * cropScale : ds * cropScale / aspect
      const sc = 200 / ds
      ctx.drawImage(img, (200 - dw * sc) / 2 + cropOffset.x * sc, (200 - dh * sc) / 2 + cropOffset.y * sc, dw * sc, dh * sc)
      setPhotoPreview(canvas.toDataURL('image/jpeg', 0.9))
      setRawPhoto(null)
    }
    img.src = rawPhoto
  }

  const onDragStart = (e) => { setIsDragging(true); setDragStart({ x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y }) }
  const onDragMove = (e) => { if (!isDragging || !dragStart) return; setCropOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }) }
  const onDragEnd = () => setIsDragging(false)
  const onTouchStart = (e) => { const t = e.touches[0]; setIsDragging(true); setDragStart({ x: t.clientX - cropOffset.x, y: t.clientY - cropOffset.y }) }
  const onTouchMove = (e) => { if (!isDragging || !dragStart) return; const t = e.touches[0]; setCropOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y }) }

  async function saveProfile() {
    const data = {
      displayName: newName || user.displayName || 'Anonyme',
      avatar: selectedAvatar,
      bannerColor: selectedBanner,
      bannerImg,
      bannerPosY,
      photoURL: selectedAvatar ? null : photoPreview,
      social: { instagram, twitter, letterboxd },
      country,
      updatedAt: new Date()
    }
    await setDoc(doc(db, 'users', user.uid), data, { merge: true })
    setProfileData(prev => ({ ...prev, ...data }))
    setEditing(false)
    showToast('Profil mis à jour !', '✅')
  }

  const displayName = profileData?.displayName || user.displayName || 'Anonyme'
  const avatarDisplay = profileData?.avatar || null
  const photoURL = !avatarDisplay ? (profileData?.photoURL || user.photoURL || '') : null
  const bannerColor = profileData?.bannerColor || BANNER_COLORS[0]
  const bannerImgUrl = profileData?.bannerImg || ''
  const bannerPos = profileData?.bannerPosY || 50
  const count = stats.comments
  const level = getLevel(count)
  const nextBadge = getNextBadge(count)
  const nextThreshold = nextBadge?.threshold || count
  const progress = nextBadge ? Math.round((count / nextThreshold) * 100) : 100

  const c = {
    page: { minHeight:'100vh', background:'#0F0F1A', color:'#FFF', paddingBottom:70 },
    bannerArea: { height:100, position:'relative', marginBottom:40, backgroundSize:'cover', backgroundRepeat:'no-repeat' },
    avatar: { position:'absolute', bottom:-32, left:16, width:64, height:64, borderRadius:'50%', border:'3px solid #0F0F1A', background:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, color:'#fff', fontWeight:700, overflow:'hidden' },
    editBtn: { position:'absolute', bottom:-24, right:16, background:'#534AB7', border:'none', borderRadius:8, padding:'6px 12px', fontSize:11, color:'#FFF', cursor:'pointer', fontWeight:600 },
    statCard: { background:'#1A2340', borderRadius:10, padding:'10px 6px', border:'1px solid #3A3A5C', textAlign:'center', cursor:'pointer' },
    statNum: { fontSize:18, fontWeight:700, color:'#FFF', marginBottom:3 },
    statLabel: { fontSize:9, color:'#B0AECB', lineHeight:1.4 },
    badgeItem: { background:'#1E1B4B', borderRadius:10, padding:'10px 4px', textAlign:'center', border:'1px solid #534AB7' },
    badgeLocked: { background:'#1A2340', borderRadius:10, padding:'10px 4px', textAlign:'center', border:'1px solid #2C2C4A' },
    tag: { background:'#1E1B4B', border:'1px solid #534AB7', borderRadius:20, padding:'4px 12px', fontSize:12, color:'#C8C4F8' },
    modal: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 },
    modalCard: { background:'#16213E', borderRadius:16, padding:18, width:'100%', maxWidth:340, border:'1px solid #3A3A5C', maxHeight:'90vh', overflowY:'auto' },
    label: { fontSize:12, color:'#B0AECB', marginBottom:5, display:'block', marginTop:10 },
    input: { width:'100%', background:'#0F0F1A', border:'1px solid #3A3A5C', borderRadius:10, padding:'10px 12px', color:'#FFF', fontSize:13, outline:'none', marginBottom:4, boxSizing:'border-box' },
    select: { width:'100%', background:'#0F0F1A', border:'1px solid #3A3A5C', borderRadius:10, padding:'10px 12px', color:'#FFF', fontSize:13, outline:'none', marginBottom:4, boxSizing:'border-box' },
    btnPrimary: { background:'#534AB7', border:'none', borderRadius:10, padding:'11px 0', color:'#FFF', fontSize:13, fontWeight:600, cursor:'pointer', width:'100%', marginBottom:8, marginTop:12 },
    btnSecondary: { background:'none', border:'1px solid #3A3A5C', borderRadius:10, padding:'9px 0', color:'#B0AECB', fontSize:13, cursor:'pointer', width:'100%' },
    listModal: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.95)', zIndex:200, display:'flex', flexDirection:'column' },
  }

  return (
    <div style={c.page}>
      <ToastContainer toasts={toasts} />

      {/* Bannière */}
      <div style={{ ...c.bannerArea, background: bannerColor, ...(bannerImgUrl ? { backgroundImage:`url(${bannerImgUrl})`, backgroundPosition:`center ${bannerPos}%` } : {}) }}>
        <div style={c.avatar}>
          {avatarDisplay ? <span>{avatarDisplay}</span>
            : photoURL ? <img src={photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" />
            : displayName[0]?.toUpperCase()}
        </div>
        <button style={c.editBtn} onClick={() => setEditing(true)}>✏️ Modifier</button>
      </div>

      {/* Infos */}
      <div style={{ padding:'0 16px 14px' }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:3 }}>{displayName}</div>
        <div style={{ display:'inline-flex', gap:4, background:'#1E1B4B', borderRadius:20, padding:'4px 12px', fontSize:12, color:'#C8C4F8', fontWeight:600, marginBottom:12 }}>
          🎭 {level.label} · {country}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, padding:'0 16px', marginBottom:16 }}>
        <div style={c.statCard} onClick={() => setActiveList('comments')}>
          <div style={c.statNum}>{count}</div><div style={c.statLabel}>Commentaires</div>
        </div>
        <div style={c.statCard} onClick={() => setActiveList('movieFavs')}>
          <div style={c.statNum}>{stats.movieFavs}</div><div style={c.statLabel}>Films favoris</div>
        </div>
        <div style={c.statCard} onClick={() => setActiveList('serieFavs')}>
          <div style={c.statNum}>{stats.serieFavs}</div><div style={c.statLabel}>Séries favorites</div>
        </div>
        <div style={c.statCard} onClick={() => setActiveList('reactions')}>
          <div style={c.statNum}>{stats.reactions === 0 ? '🤷‍♂️' : stats.reactions}</div><div style={c.statLabel}>Réactions reçues</div>
        </div>
      </div>

      {/* Tags genres */}
      {autoTags.length > 0 && (
        <div style={{ padding:'0 16px', marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Mes genres favoris</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {autoTags.map(tag => <div key={tag} style={c.tag}>{tag}</div>)}
          </div>
        </div>
      )}

      {/* Badges */}
      <div style={{ padding:'0 16px', marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Badges</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
          {BADGES.map(b => {
            const earned = count >= b.threshold
            return (
              <div key={b.id} style={earned ? c.badgeItem : c.badgeLocked}>
                <span style={{ fontSize:20, display:'block', marginBottom:3 }}>{b.emoji}</span>
                <div style={{ fontSize:9, color: earned ? '#C8C4F8' : '#888780' }}>{b.label}</div>
                {!earned && <div style={{ fontSize:8, color:'#8888A0', lineHeight:1.3 }}>{b.desc}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Progression */}
      {nextBadge && (
        <div style={{ padding:'0 16px', marginBottom:16 }}>
          <div style={{ background:'#1A2340', borderRadius:10, padding:12, border:'1px solid #3A3A5C' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
              <span style={{ color:'#FFF', fontWeight:600 }}>{level.label}</span>
              <span style={{ color:'#B0AECB' }}>{count}/{nextThreshold}</span>
            </div>
            <div style={{ background:'#0F0F1A', borderRadius:20, height:5, overflow:'hidden', marginBottom:6 }}>
              <div style={{ height:'100%', width:`${progress}%`, background:'#534AB7', borderRadius:20 }} />
            </div>
            <div style={{ fontSize:11, color:'#B0AECB' }}>Prochain : {nextBadge.emoji} {nextBadge.label} — {nextBadge.desc}</div>
          </div>
        </div>
      )}

      {/* Déconnexion */}
      <div style={{ padding:'0 16px 16px' }}>
        <button style={{ background:'none', border:'1px solid #3A3A5C', borderRadius:10, padding:'11px', color:'#B0AECB', fontSize:12, cursor:'pointer', width:'100%' }}
          onClick={() => signOut(auth)}>Se déconnecter</button>
      </div>

      {/* Modal liste */}
      {activeList && (
        <div style={c.listModal}>
          <div style={{ padding:'16px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid #3A3A5C' }}>
            <button style={{ background:'none', border:'none', color:'#FFF', fontSize:22, cursor:'pointer' }} onClick={() => setActiveList(null)}>‹</button>
            <span style={{ fontSize:15, fontWeight:700 }}>
              {activeList === 'comments' ? 'Mes commentaires' : activeList === 'movieFavs' ? 'Films favoris' : activeList === 'serieFavs' ? 'Séries favorites' : 'Réactions reçues'}
            </span>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
            {activeList === 'comments' && comments.map((c2, i) => (
              <div key={i} style={{ background:'#1A2340', borderRadius:10, padding:12, marginBottom:8, border:'1px solid #3A3A5C', cursor:'pointer' }}
                onClick={() => { setActiveList(null); navigate(`/episode/${c2.showId}/${c2.seasonNum}/${c2.episodeNum}`) }}>
                <div style={{ fontSize:11, color:'#B0AECB', marginBottom:4 }}>
                  {c2.showName} {c2.seasonNum > 0 ? `S${String(c2.seasonNum).padStart(2,'0')}E${String(c2.episodeNum).padStart(2,'0')}` : 'Film'}
                </div>
                <div style={{ fontSize:13, color:'#E8E6F8' }}>{c2.text}</div>
              </div>
            ))}
            {(activeList === 'movieFavs' || activeList === 'serieFavs') && favsList
              .filter(f => activeList === 'movieFavs' ? f.isMovie : !f.isMovie)
              .map((f, i) => (
                <div key={i} style={{ background:'#1A2340', borderRadius:10, padding:12, marginBottom:8, border:'1px solid #3A3A5C', cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}
                  onClick={() => { setActiveList(null); if (f.isMovie) navigate(`/episode/${f.showId}/0/0`); else navigate(`/show/${f.showId}`) }}>
                  {f.showPoster && <img src={`https://image.tmdb.org/t/p/w92${f.showPoster}`} style={{ width:40, height:40, borderRadius:8, objectFit:'cover' }} alt="" />}
                  <div style={{ fontSize:13, color:'#FFF', fontWeight:600, flex:1 }}>{f.showName}</div>
                  <span style={{ fontSize:14, color:'#B0AECB' }}>›</span>
                </div>
              ))}
            {activeList === 'reactions' && comments
              .filter(c2 => Object.values(c2.reactions || {}).reduce((a, b) => a + b, 0) > 0)
              .map((c2, i) => (
                <div key={i} style={{ background:'#1A2340', borderRadius:10, padding:12, marginBottom:8, border:'1px solid #3A3A5C', cursor:'pointer' }}
                  onClick={() => { setActiveList(null); navigate(`/episode/${c2.showId}/${c2.seasonNum}/${c2.episodeNum}`) }}>
                  <div style={{ fontSize:11, color:'#B0AECB', marginBottom:4 }}>{c2.showName}</div>
                  <div style={{ fontSize:13, color:'#E8E6F8', marginBottom:6 }}>{c2.text}</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {Object.entries(c2.reactions || {}).filter(([, v]) => v > 0).map(([k, v]) => (
                      <span key={k} style={{ background:'#1E1B4B', borderRadius:20, padding:'2px 8px', fontSize:11, color:'#C8C4F8' }}>{k} {v}</span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Modal édition */}
      {editing && (
        <div style={c.modal}>
          <div style={c.modalCard}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:14, color:'#FFF' }}>Modifier mon profil</div>

            <label style={c.label}>Pseudo</label>
            <input style={c.input} placeholder="Ton pseudo" value={newName} onChange={e => setNewName(e.target.value)} />

            <label style={c.label}>Photo de profil</label>
            {rawPhoto ? (
              <div style={{ marginBottom:10 }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ width:140, height:140, borderRadius:'50%', overflow:'hidden', background:'#0F0F1A', cursor:'move', userSelect:'none', flexShrink:0, border:'2px solid #534AB7' }}
                    onMouseDown={onDragStart} onMouseMove={onDragMove} onMouseUp={onDragEnd} onMouseLeave={onDragEnd}
                    onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onDragEnd}>
                    <img src={rawPhoto} style={{ position:'relative', width:`${100*cropScale}%`, height:`${100*cropScale}%`, objectFit:'cover', left:`calc(50% + ${cropOffset.x}px)`, top:`calc(50% + ${cropOffset.y}px)`, transform:'translate(-50%,-50%)' }} alt="" draggable={false} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:'#B0AECB', marginBottom:6 }}>Glisse pour repositionner</div>
                    <div style={{ fontSize:11, color:'#B0AECB', marginBottom:4 }}>Zoom ×{cropScale.toFixed(1)}</div>
                    <input type="range" min="0.5" max="3" step="0.05" value={cropScale} style={{ width:'100%', accentColor:'#534AB7' }} onChange={e => setCropScale(parseFloat(e.target.value))} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button style={{ ...c.btnPrimary, margin:0, flex:1 }} onClick={applyCrop}>Valider</button>
                  <button style={{ ...c.btnSecondary, flex:1 }} onClick={() => setRawPhoto(null)}>Annuler</button>
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
                  <div style={{ fontSize:10, color:'#8888A0', marginTop:4 }}>Recadrage interactif</div>
                </div>
              </div>
            )}

            <label style={c.label}>Ou choisir un avatar emoji</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6, marginBottom:8 }}>
              {AVATARS.map(a => (
                <div key={a} style={{ fontSize:22, textAlign:'center', cursor:'pointer', padding:4, borderRadius:8, border: selectedAvatar===a ? '1px solid #534AB7' : '1px solid transparent', background: selectedAvatar===a ? '#1E1B4B' : 'transparent' }}
                  onClick={() => { setSelectedAvatar(selectedAvatar===a ? null : a); if (selectedAvatar!==a) { setPhotoPreview(''); setRawPhoto(null) } }}>{a}</div>
              ))}
            </div>

            <label style={c.label}>Bannière — tes favoris</label>
            {favBanners.length > 0 ? (
              <div style={{ display:'flex', gap:6, overflowX:'auto', marginBottom:8, paddingBottom:4 }}>
                {favBanners.map((b, i) => (
                  <div key={i} style={{ width:72, height:44, borderRadius:6, overflow:'hidden', cursor:'pointer', border: bannerImg===b.url ? '2px solid #9F9BE8' : '2px solid transparent', flexShrink:0 }}
                    onClick={() => setBannerImg(bannerImg===b.url ? '' : b.url)}>
                    <img src={b.url} alt={b.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize:11, color:'#8888A0', marginBottom:8 }}>Ajoute des favoris pour voir leurs images ici</div>}

            {bannerImg && (
              <>
                <div style={{ width:'100%', height:60, borderRadius:8, backgroundImage:`url(${bannerImg})`, backgroundSize:'cover', backgroundPosition:`center ${bannerPosY}%`, marginBottom:6 }} />
                <label style={c.label}>Position verticale</label>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:10, color:'#8888A0' }}>Haut</span>
                  <input type="range" min="0" max="100" step="1" value={bannerPosY} style={{ flex:1, accentColor:'#534AB7' }} onChange={e => setBannerPosY(parseInt(e.target.value))} />
                  <span style={{ fontSize:10, color:'#8888A0' }}>Bas</span>
                </div>
              </>
            )}

            <label style={c.label}>Ou URL d'image personnalisée</label>
            <input style={c.input} placeholder="https://..." value={bannerImg} onChange={e => setBannerImg(e.target.value)} />

            <label style={c.label}>Ou couleur de bannière</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
              {BANNER_COLORS.map(col => (
                <div key={col} style={{ width:36, height:24, borderRadius:6, cursor:'pointer', background:col, border: selectedBanner===col && !bannerImg ? '2px solid #9F9BE8' : '2px solid transparent' }}
                  onClick={() => { setSelectedBanner(col); setBannerImg('') }} />
              ))}
            </div>

            <label style={c.label}>Instagram</label>
            <input style={c.input} placeholder="@pseudo" value={instagram} onChange={e => setInstagram(e.target.value)} />
            <label style={c.label}>Twitter / X</label>
            <input style={c.input} placeholder="@pseudo" value={twitter} onChange={e => setTwitter(e.target.value)} />
            <label style={c.label}>Letterboxd</label>
            <input style={c.input} placeholder="ton profil" value={letterboxd} onChange={e => setLetterboxd(e.target.value)} />
            <label style={c.label}>Pays (notifications de sorties)</label>
            <select style={c.select} value={country} onChange={e => setCountry(e.target.value)}>
              {COUNTRIES.map(co => <option key={co} value={co}>{co}</option>)}
            </select>

            <button style={c.btnPrimary} onClick={saveProfile}>Enregistrer</button>
            <button style={c.btnSecondary} onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </div>
      )}

      <Nav />
    </div>
  )
}
