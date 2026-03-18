import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, query, where, orderBy, limit, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { ToastContainer, useToast } from '../components/Toast'

const BADGES = [
  { id:'first', emoji:'🎬', label:'Premier pas', threshold:1 },
  { id:'fire', emoji:'🔥', label:'En feu', threshold:10 },
  { id:'night', emoji:'🌙', label:'Noctambule', threshold:25 },
  { id:'star', emoji:'⭐', label:'Top voix', threshold:50 },
  { id:'legend', emoji:'👑', label:'Légende', threshold:200 },
]
const LEVELS = [{min:0,label:'Spectateur'},{min:10,label:'Critique'},{min:50,label:'Cinéphile'},{min:200,label:'Expert'},{min:500,label:'Légende'}]
const AVATARS = ['🎬','🎭','🍿','🦊','🌙','⭐','🔥','🎸','🦋','🎮','🌊','🌺']
const COUNTRIES = ['France','Belgique','Suisse','Canada','États-Unis','Royaume-Uni','Espagne','Allemagne','Italie','Japon','Autre']

function getLevel(c) { let l=LEVELS[0]; for(const x of LEVELS){if(c>=x.min)l=x}; return l }
function getNextBadge(c) { return BADGES.find(b=>b.threshold>c) }
function formatTime(s) { if(!s&&s!==0)return null; return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` }
function timeAgo(ts) {
  if(!ts)return ''
  const d=Math.floor((Date.now()-ts.toMillis())/1000)
  if(d<60)return 'À l\'instant'
  if(d<3600)return `${Math.floor(d/60)} min`
  if(d<86400)return `${Math.floor(d/3600)}h`
  return `${Math.floor(d/86400)}j`
}

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFF', paddingBottom:70 },
  bannerArea: { height:80, background:'#16213E', position:'relative', marginBottom:36, cursor:'pointer' },
  bannerLabel: { position:'absolute', bottom:8, right:12, fontSize:10, color:'#888780', background:'rgba(0,0,0,0.5)', borderRadius:6, padding:'2px 6px' },
  avatarWrap: { position:'absolute', bottom:-28, left:16 },
  avatar: { width:56, height:56, borderRadius:'50%', border:'3px solid #1A1A2E', background:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#fff', fontWeight:700, overflow:'hidden', cursor:'pointer' },
  editBtn: { position:'absolute', bottom:-20, right:16, background:'#16213E', border:'1px solid #2C2C2A', borderRadius:8, padding:'5px 10px', fontSize:11, color:'#9F9BE8', cursor:'pointer' },
  info: { padding:'0 16px 12px' },
  name: { fontSize:17, fontWeight:700, marginBottom:2 },
  levelBadge: { display:'inline-flex', gap:4, background:'#1E1B4B', borderRadius:20, padding:'3px 10px', fontSize:11, color:'#9F9BE8', fontWeight:600, marginBottom:10 },
  stats: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, padding:'0 16px', marginBottom:14 },
  statCard: { background:'#16213E', borderRadius:10, padding:'8px 6px', border:'1px solid #2C2C2A', textAlign:'center' },
  statNum: { fontSize:18, fontWeight:700, color:'#534AB7', marginBottom:2 },
  statLabel: { fontSize:9, color:'#888780' },
  section: { padding:'0 16px', marginBottom:14 },
  sectionTitle: { fontSize:11, fontWeight:600, color:'#888780', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 },
  badgesGrid: { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 },
  badgeItem: { background:'#16213E', borderRadius:10, padding:'8px 4px', textAlign:'center', border:'1px solid #534AB7' },
  badgeLocked: { background:'#16213E', borderRadius:10, padding:'8px 4px', textAlign:'center', border:'1px solid #2C2C2A', opacity:0.4 },
  progressWrap: { background:'#16213E', borderRadius:10, padding:10, border:'1px solid #2C2C2A' },
  progressBar: { background:'#0F0F1A', borderRadius:20, height:5, overflow:'hidden', margin:'5px 0' },
  progressFill: { height:'100%', background:'#534AB7', borderRadius:20 },
  commentCard: { background:'#16213E', borderRadius:10, padding:10, marginBottom:7, border:'1px solid #2C2C2A', cursor:'pointer' },
  commentTop: { display:'flex', alignItems:'center', gap:5, marginBottom:5, flexWrap:'wrap' },
  showName: { fontSize:11, fontWeight:600, color:'#9F9BE8', flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  epBadge: { fontSize:9, color:'#888780', background:'#0F0F1A', borderRadius:5, padding:'1px 4px' },
  tsBadge: { fontSize:9, color:'#534AB7', background:'#1A1A2E', borderRadius:5, padding:'1px 4px', fontWeight:600 },
  commentText: { fontSize:12, color:'#D3D1C7', lineHeight:1.4, marginBottom:3 },
  timeago: { fontSize:9, color:'#444441', textAlign:'right' },
  modal: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 },
  modalCard: { background:'#16213E', borderRadius:16, padding:20, width:'100%', maxWidth:340, border:'1px solid #2C2C2A', maxHeight:'85vh', overflowY:'auto' },
  modalTitle: { fontSize:15, fontWeight:700, marginBottom:14 },
  input: { width:'100%', background:'#1A1A2E', border:'1px solid #2C2C2A', borderRadius:10, padding:'10px 12px', color:'#FFF', fontSize:13, outline:'none', marginBottom:10, boxSizing:'border-box' },
  label: { fontSize:11, color:'#888780', marginBottom:5, display:'block' },
  avatarGrid: { display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8, marginBottom:12 },
  avatarOption: { fontSize:24, textAlign:'center', cursor:'pointer', padding:4, borderRadius:8, border:'1px solid transparent' },
  avatarActive: { border:'1px solid #534AB7', background:'#1E1B4B' },
  select: { width:'100%', background:'#1A1A2E', border:'1px solid #2C2C2A', borderRadius:10, padding:'10px 12px', color:'#FFF', fontSize:13, outline:'none', marginBottom:10, boxSizing:'border-box' },
  modalBtn: { background:'#534AB7', border:'none', borderRadius:10, padding:'11px 0', color:'#FFF', fontSize:13, fontWeight:600, cursor:'pointer', width:'100%', marginBottom:8 },
  modalBtnCancel: { background:'none', border:'1px solid #2C2C2A', borderRadius:10, padding:'9px 0', color:'#888780', fontSize:13, cursor:'pointer', width:'100%' },
  nav: { position:'fixed', bottom:0, left:0, right:0, background:'#0F0F1A', borderTop:'1px solid #2C2C2A', display:'flex', padding:'10px 0', zIndex:50 },
  navItem: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', padding:'3px 0' },
  navIcon: { fontSize:20 },
  navLabel: { fontSize:10, color:'#888780' },
}

export default function Profile({ user }) {
  const navigate = useNavigate()
  const { toasts, showToast } = useToast()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [profileData, setProfileData] = useState(null)
  const [newName, setNewName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [instagram, setInstagram] = useState('')
  const [twitter, setTwitter] = useState('')
  const [letterboxd, setLetterboxd] = useState('')
  const [country, setCountry] = useState('France')
  const [favCount, setFavCount] = useState(0)

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data()
        setProfileData(d)
        setNewName(d.displayName||user.displayName||'')
        setSelectedAvatar(d.avatar||null)
        setInstagram(d.social?.instagram||'')
        setTwitter(d.social?.twitter||'')
        setLetterboxd(d.social?.letterboxd||'')
        setCountry(d.country||'France')
      }
    })
    getDoc(doc(db, 'userFavCounts', user.uid)).then(snap => {
      if (snap.exists()) setFavCount(snap.data().count||0)
    })
  }, [user.uid])

  useEffect(() => {
    const q = query(collection(db, 'userComments'), where('userId','==',user.uid), orderBy('createdAt','desc'), limit(50))
    return onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id:d.id, ...d.data() })))
      setLoading(false)
    })
  }, [user.uid])

  async function saveProfile() {
    const data = {
      displayName: newName || user.displayName || 'Anonyme',
      avatar: selectedAvatar,
      photoURL: selectedAvatar ? null : (user.photoURL||''),
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
  const count = profileData?.commentCount || 0
  const level = getLevel(count)
  const nextBadge = getNextBadge(count)
  const nextThreshold = nextBadge?.threshold || count
  const progress = nextBadge ? Math.round((count/nextThreshold)*100) : 100
  const likesReceived = comments.reduce((acc,c) => acc+Object.values(c.reactions||{}).reduce((a,b)=>a+b,0), 0)
  const showsCount = new Set(comments.map(c=>c.showId)).size

  return (
    <div style={s.page}>
      <ToastContainer toasts={toasts} />
      <div style={s.bannerArea}>
        <div style={s.bannerLabel}>✏️ Modifier la bannière</div>
        <div style={s.avatarWrap}>
          <div style={s.avatar} onClick={() => setEditing(true)}>
            {avatarDisplay ? <span style={{ fontSize:28 }}>{avatarDisplay}</span>
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
        <div style={s.statCard}><div style={s.statNum}>{count}</div><div style={s.statLabel}>Commentaires</div></div>
        <div style={s.statCard}><div style={s.statNum}>{showsCount}</div><div style={s.statLabel}>Séries</div></div>
        <div style={s.statCard}><div style={s.statNum}>{favCount}</div><div style={s.statLabel}>Favoris</div></div>
        <div style={s.statCard}><div style={s.statNum}>{likesReceived}</div><div style={s.statLabel}>Réactions</div></div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Badges</div>
        <div style={s.badgesGrid}>
          {BADGES.map(b => (
            <div key={b.id} style={count>=b.threshold?s.badgeItem:s.badgeLocked}>
              <span style={{ fontSize:20, display:'block', marginBottom:3 }}>{b.emoji}</span>
              <div style={{ fontSize:9, color:count>=b.threshold?'#9F9BE8':'#444441' }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      {nextBadge && (
        <div style={{ padding:'0 16px', marginBottom:14 }}>
          <div style={s.progressWrap}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
              <span style={{ color:'#fff', fontWeight:600 }}>{level.label}</span>
              <span style={{ color:'#888780' }}>{count}/{nextThreshold}</span>
            </div>
            <div style={s.progressBar}><div style={{ ...s.progressFill, width:`${progress}%` }}/></div>
            <div style={{ fontSize:10, color:'#888780' }}>Prochain : {nextBadge.emoji} {nextBadge.label}</div>
          </div>
        </div>
      )}

      <div style={s.section}>
        <div style={s.sectionTitle}>Mes commentaires</div>
        {loading && <div style={{ textAlign:'center', padding:16, color:'#888780', fontSize:12 }}>Chargement…</div>}
        {!loading && comments.length===0 && (
          <div style={{ textAlign:'center', padding:'20px', color:'#444441', fontSize:12 }}>
            <div style={{ fontSize:28, marginBottom:6 }}>💬</div>Lance une série et rejoins la conversation !
          </div>
        )}
        {comments.map(c => (
          <div key={c.id} style={s.commentCard} onClick={() => navigate(`/episode/${c.showId}/${c.seasonNum}/${c.episodeNum}`)}>
            <div style={s.commentTop}>
              <span style={s.showName}>{c.showName||'Série'}</span>
              {c.seasonNum>0 && <span style={s.epBadge}>S{String(c.seasonNum).padStart(2,'0')}E{String(c.episodeNum).padStart(2,'0')}</span>}
              {c.timestamp!==null&&c.timestamp!==undefined && <span style={s.tsBadge}>⏱ {formatTime(c.timestamp)}</span>}
            </div>
            <div style={s.commentText}>{c.text}</div>
            <div style={s.timeago}>{timeAgo(c.createdAt)}</div>
          </div>
        ))}
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
            <label style={s.label}>Choisis un avatar</label>
            <div style={s.avatarGrid}>
              {AVATARS.map(a => (
                <div key={a} style={{ ...s.avatarOption, ...(selectedAvatar===a?s.avatarActive:{}) }} onClick={() => setSelectedAvatar(selectedAvatar===a?null:a)}>{a}</div>
              ))}
            </div>
            <label style={s.label}>Instagram</label>
            <input style={s.input} placeholder="@pseudo" value={instagram} onChange={e => setInstagram(e.target.value)} />
            <label style={s.label}>Twitter / X</label>
            <input style={s.input} placeholder="@pseudo" value={twitter} onChange={e => setTwitter(e.target.value)} />
            <label style={s.label}>Letterboxd</label>
            <input style={s.input} placeholder="ton profil" value={letterboxd} onChange={e => setLetterboxd(e.target.value)} />
            <label style={s.label}>Pays (pour les notifications de sorties)</label>
            <select style={s.select} value={country} onChange={e => setCountry(e.target.value)}>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button style={s.modalBtn} onClick={saveProfile}>Enregistrer</button>
            <button style={s.modalBtnCancel} onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </div>
      )}

      <nav style={s.nav}>
        <div style={s.navItem} onClick={() => navigate('/')}><span style={s.navIcon}>🏠</span><span style={s.navLabel}>Accueil</span></div>
        <div style={s.navItem} onClick={() => navigate('/search')}><span style={s.navIcon}>🔍</span><span style={s.navLabel}>Rechercher</span></div>
        <div style={s.navItem}><span style={s.navIcon}>👤</span><span style={{ ...s.navLabel, color:'#534AB7' }}>Profil</span></div>
      </nav>
    </div>
  )
}
