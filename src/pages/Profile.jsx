import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, query, where, orderBy, limit, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore'
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
const IMGBB_KEY = '7c8a1e3c5f9b2d4a6e8f0c1b3d5e7f9a'
const COUNTRIES = ['France','Belgique','Suisse','Canada','États-Unis','Royaume-Uni','Espagne','Allemagne','Italie','Japon','Autre']
const BANNER_COLORS = ['#1A1A2E','#16213E','#1E1B4B','#085041','#412402','#4A1B0C','#26215C','#0C447C']

function getLevel(c) { let l=LEVELS[0]; for(const x of LEVELS){if(c>=x.min)l=x}; return l }
function getLevelIndex(c) { let i=0; LEVELS.forEach((x,j)=>{if(c>=x.min)i=j}); return i }
function getNextBadge(c) { return BADGES.find(b=>b.threshold>c) }

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFF', paddingBottom:70 },
  bannerArea: { height:80, position:'relative', marginBottom:36 },
  avatarWrap: { position:'absolute', bottom:-28, left:16 },
  avatar: { width:56, height:56, borderRadius:'50%', border:'3px solid #1A1A2E', background:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#fff', fontWeight:700, overflow:'hidden' },
  editBtn: { position:'absolute', bottom:-20, right:16, background:'#16213E', border:'1px solid #2C2C2A', borderRadius:8, padding:'5px 10px', fontSize:11, color:'#9F9BE8', cursor:'pointer' },
  info: { padding:'0 16px 12px' },
  name: { fontSize:17, fontWeight:700, marginBottom:2 },
  levelBadge: { display:'inline-flex', gap:4, background:'#1E1B4B', borderRadius:20, padding:'3px 10px', fontSize:11, color:'#9F9BE8', fontWeight:600, marginBottom:10 },
  stats: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, padding:'0 16px', marginBottom:14 },
  statCard: { background:'#16213E', borderRadius:10, padding:'8px 4px', border:'1px solid #2C2C2A', textAlign:'center' },
  statNum: { fontSize:16, fontWeight:700, color:'#FFFFFF', marginBottom:2 },
  statLabel: { fontSize:9, color:'#D3D1C7', lineHeight:1.3 },
  section: { padding:'0 16px', marginBottom:14 },
  sectionTitle: { fontSize:11, fontWeight:600, color:'#D3D1C7', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 },
  badgesGrid: { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 },
  badgeItem: { background:'#16213E', borderRadius:10, padding:'8px 4px', textAlign:'center', border:'1px solid #534AB7' },
  badgeLocked: { background:'#16213E', borderRadius:10, padding:'8px 4px', textAlign:'center', border:'1px solid #2C2C2A' },
  badgeEmoji: { fontSize:18, display:'block', marginBottom:3 },
  badgeLabel: { fontSize:9, lineHeight:1.3, marginBottom:2 },
  badgeDesc: { fontSize:8, color:'#444441', lineHeight:1.3 },
  progressWrap: { background:'#16213E', borderRadius:10, padding:10, border:'1px solid #2C2C2A' },
  progressBar: { background:'#0F0F1A', borderRadius:20, height:5, overflow:'hidden', margin:'5px 0' },
  progressFill: { height:'100%', background:'#534AB7', borderRadius:20 },
  modal: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 },
  modalCard: { background:'#16213E', borderRadius:16, padding:18, width:'100%', maxWidth:340, border:'1px solid #2C2C2A', maxHeight:'88vh', overflowY:'auto' },
  modalTitle: { fontSize:14, fontWeight:700, marginBottom:12 },
  label: { fontSize:11, color:'#888780', marginBottom:4, display:'block' },
  input: { width:'100%', background:'#1A1A2E', border:'1px solid #2C2C2A', borderRadius:10, padding:'9px 12px', color:'#FFF', fontSize:13, outline:'none', marginBottom:10, boxSizing:'border-box' },
  avatarGrid: { display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6, marginBottom:12 },
  avatarOption: { fontSize:22, textAlign:'center', cursor:'pointer', padding:4, borderRadius:8, border:'1px solid transparent' },
  avatarActive: { border:'1px solid #534AB7', background:'#1E1B4B' },
  bannerGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12 },
  bannerOption: { height:28, borderRadius:8, cursor:'pointer', border:'2px solid transparent' },
  bannerActive: { border:'2px solid #534AB7' },
  select: { width:'100%', background:'#1A1A2E', border:'1px solid #2C2C2A', borderRadius:10, padding:'9px 12px', color:'#FFF', fontSize:13, outline:'none', marginBottom:10, boxSizing:'border-box' },
  modalBtn: { background:'#534AB7', border:'none', borderRadius:10, padding:'10px 0', color:'#FFF', fontSize:13, fontWeight:600, cursor:'pointer', width:'100%', marginBottom:8 },
  modalBtnCancel: { background:'none', border:'1px solid #2C2C2A', borderRadius:10, padding:'8px 0', color:'#888780', fontSize:13, cursor:'pointer', width:'100%' },
}

export default function Profile({ user }) {
  const navigate = useNavigate()
  const { toasts, showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [profileData, setProfileData] = useState(null)
  const [newName, setNewName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [selectedBanner, setSelectedBanner] = useState(BANNER_COLORS[0])
  const [instagram, setInstagram] = useState('')
  const [twitter, setTwitter] = useState('')
  const [letterboxd, setLetterboxd] = useState('')
  const [country, setCountry] = useState('France')
  const [bannerImg, setBannerImg] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [stats, setStats] = useState({ comments:0, movieFavs:0, serieFavs:0, reactions:0 })

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setProfileData(d)
        setNewName(d.displayName||user.displayName||'')
        setSelectedAvatar(d.avatar||null)
        setSelectedBanner(d.bannerColor||BANNER_COLORS[0])
        setBannerImg(d.bannerImg||'')
        setPhotoPreview(d.photoURL||'')
        setInstagram(d.social?.instagram||'')
        setTwitter(d.social?.twitter||'')
        setLetterboxd(d.social?.letterboxd||'')
        setCountry(d.country||'France')
        setStats({ comments: d.commentCount||0, movieFavs: d.movieFavs||0, serieFavs: d.serieFavs||0, reactions: d.reactionsReceived||0 })
      }
    })
  }, [user.uid])

  async function saveProfile() {
    const data = {
      displayName: newName || user.displayName || 'Anonyme',
      avatar: selectedAvatar,
      bannerColor: selectedBanner,
      bannerImg: bannerImg,
      photoURL: selectedAvatar ? null : (photoPreview || user.photoURL||''),
      social: { instagram, twitter, letterboxd },
      country,
      commentCount: profileData?.commentCount||0,
      updatedAt: new Date()
    }
    await setDoc(doc(db, 'users', user.uid), data, { merge:true })
    setProfileData(data)
    setEditing(false)
    showToast('Profil mis à jour !', '✅')
  }

  const displayName = profileData?.displayName || user.displayName || 'Anonyme'
  const avatarDisplay = profileData?.avatar || null
  const photoURL = !avatarDisplay ? (profileData?.photoURL || user.photoURL || '') : null
  const bannerColor = profileData?.bannerColor || BANNER_COLORS[0]
  const count = stats.comments
  const level = getLevel(count)
  const nextBadge = getNextBadge(count)
  const nextThreshold = nextBadge?.threshold || count
  const progress = nextBadge ? Math.round((count/nextThreshold)*100) : 100

  return (
    <div style={s.page}>
      <ToastContainer toasts={toasts} />

      <div style={{ ...s.bannerArea, background: bannerColor, backgroundImage: (profileData?.bannerImg||bannerImg) ? `url(${profileData?.bannerImg||bannerImg})` : 'none', backgroundSize:'cover', backgroundPosition:'center' }}>
        <div style={s.avatarWrap}>
          <div style={s.avatar}>
            {avatarDisplay ? <span style={{ fontSize:26 }}>{avatarDisplay}</span>
              : photoURL ? <img src={photoURL} style={{ width:'100%', height:'100%' }} alt="" />
              : displayName[0]?.toUpperCase()}
          </div>
        </div>
        <button style={s.editBtn} onClick={() => setEditing(true)}>✏️ Modifier</button>
      </div>

      <div style={s.info}>
        <div style={s.name}>{displayName}</div>
        <div style={s.levelBadge}>🎭 {level.label} · {country}</div>
      </div>

      <div style={s.stats}>
        <div style={s.statCard}><div style={s.statNum}>{stats.comments}</div><div style={s.statLabel}>Commen-taires</div></div>
        <div style={s.statCard}><div style={s.statNum}>{stats.movieFavs}</div><div style={s.statLabel}>Films favoris</div></div>
        <div style={s.statCard}><div style={s.statNum}>{stats.serieFavs}</div><div style={s.statLabel}>Séries favorites</div></div>
        <div style={s.statCard}><div style={s.statNum}>{stats.reactions}</div><div style={s.statLabel}>Réactions reçues</div></div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Badges</div>
        <div style={s.badgesGrid}>
          {BADGES.map(b => {
            const earned = count >= b.threshold
            return (
              <div key={b.id} style={earned ? s.badgeItem : s.badgeLocked}>
                <span style={s.badgeEmoji}>{b.emoji}</span>
                <div style={{ ...s.badgeLabel, color: earned ? '#9F9BE8' : '#888780' }}>{b.label}</div>
                {!earned && <div style={s.badgeDesc}>{b.desc}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ padding:'0 16px', marginBottom:14 }}>
        <div style={s.progressWrap}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:6 }}>
            <span style={{ color:'#fff', fontWeight:600 }}>Niveau actuel : {level.label}</span>
            <span style={{ color:'#D3D1C7' }}>{count} commentaire{count>1?'s':''}</span>
          </div>
          <div style={{ display:'flex', gap:4, marginBottom:8 }}>
            {LEVELS.map((l,i) => {
              const reached = count >= l.min
              return (
                <div key={l.label} style={{ flex:1, textAlign:'center' }}>
                  <div style={{ height:4, borderRadius:2, background: reached ? '#534AB7' : '#2C2C2A', marginBottom:3 }} />
                  <div style={{ fontSize:8, color: reached ? '#9F9BE8' : '#444441' }}>{l.label}</div>
                </div>
              )
            })}
          </div>
          {nextBadge && <div style={{ fontSize:10, color:'#888780' }}>Prochain badge : {nextBadge.emoji} {nextBadge.label} — {nextBadge.desc}</div>}
        </div>
      </div>

      <div style={{ padding:'0 16px 16px' }}>
        <button style={{ background:'none', border:'1px solid #2C2C2A', borderRadius:10, padding:'11px', color:'#888780', fontSize:12, cursor:'pointer', width:'100%' }}
          onClick={() => signOut(auth)}>Se déconnecter</button>
      </div>

      {editing && (
        <div style={s.modal}>
          <div style={s.modalCard}>
            <div style={s.modalTitle}>Modifier mon profil</div>
            <label style={s.label}>Pseudo</label>
            <input style={s.input} placeholder="Ton pseudo" value={newName} onChange={e => setNewName(e.target.value)} />
            <label style={s.label}>Photo de profil</label>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'#1A1A2E', border:'1px solid #2C2C2A', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                {photoPreview ? <img src={photoPreview} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="" /> : (selectedAvatar || '👤')}
              </div>
              <div style={{ flex:1 }}>
                <input type="file" accept="image/*" style={{ display:'none' }} id="photo-upload"
                  onChange={e => {
                    const f = e.target.files[0]
                    if (f) {
                      setPhotoFile(f)
                      const reader = new FileReader()
                      reader.onload = ev => setPhotoPreview(ev.target.result)
                      reader.readAsDataURL(f)
                      setSelectedAvatar(null)
                    }
                  }} />
                <label htmlFor="photo-upload" style={{ background:'#534AB7', border:'none', borderRadius:8, padding:'7px 14px', color:'#FFF', fontSize:12, cursor:'pointer', display:'inline-block' }}>Choisir une photo</label>
              </div>
            </div>
            <label style={s.label}>Ou choisir un avatar emoji</label>
            <div style={s.avatarGrid}>
              {AVATARS.map(a => (
                <div key={a} style={{ ...s.avatarOption, ...(selectedAvatar===a?s.avatarActive:{}) }} onClick={() => { setSelectedAvatar(selectedAvatar===a?null:a); if(selectedAvatar!==a){setPhotoPreview('');setPhotoFile(null)} }}>{a}</div>
              ))}
            </div>
            <label style={s.label}>Image de bannière (URL)</label>
            <input style={s.input} placeholder="https://... (image en ligne)" value={bannerImg} onChange={e => setBannerImg(e.target.value)} />
            <label style={s.label}>Ou couleur de bannière</label>
            <div style={s.bannerGrid}>
              {BANNER_COLORS.map(c => (
                <div key={c} style={{ ...s.bannerOption, background:c, ...(selectedBanner===c?s.bannerActive:{}) }} onClick={() => { setSelectedBanner(c); setBannerImg('') }} />
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
