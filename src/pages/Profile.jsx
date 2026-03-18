import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { collection, query, where, orderBy, limit, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const TMDB_KEY = '8265bd1679663a7ea12ac168da84d2e8'

function formatTime(secs) {
  if (!secs && secs !== 0) return null
  return `${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}`
}
function timeAgo(ts) {
  if (!ts) return ''
  const diff = Math.floor((Date.now()-ts.toMillis())/1000)
  if (diff<60) return 'À l\'instant'
  if (diff<3600) return `${Math.floor(diff/60)} min`
  if (diff<86400) return `${Math.floor(diff/3600)}h`
  return `${Math.floor(diff/86400)}j`
}

const BADGES = [
  { id:'first', emoji:'🎬', label:'Premier pas', desc:'Premier commentaire', threshold:1 },
  { id:'fire', emoji:'🔥', label:'En feu', desc:'10 commentaires', threshold:10 },
  { id:'night', emoji:'🌙', label:'Noctambule', desc:'25 commentaires', threshold:25 },
  { id:'star', emoji:'⭐', label:'Top voix', desc:'50 commentaires', threshold:50 },
  { id:'legend', emoji:'👑', label:'Légende', desc:'200 commentaires', threshold:200 },
]

const LEVELS = [
  { min:0, label:'Spectateur' },
  { min:1, label:'Spectateur' },
  { min:10, label:'Critique' },
  { min:50, label:'Cinéphile' },
  { min:200, label:'Expert' },
  { min:500, label:'Légende' },
]

function getLevel(count) {
  let level = LEVELS[0]
  for (const l of LEVELS) { if (count >= l.min) level = l }
  return level
}
function getNextBadge(count) {
  return BADGES.find(b => b.threshold > count)
}

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFFFFF', paddingBottom:80 },
  bannerArea: { height:80, background:'#16213E', position:'relative', marginBottom:36 },
  avatarWrap: { position:'absolute', bottom:-28, left:16 },
  avatar: { width:56, height:56, borderRadius:'50%', border:'3px solid #1A1A2E', objectFit:'cover', background:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#fff', fontWeight:700, overflow:'hidden' },
  editBtn: { position:'absolute', bottom:-20, right:16, background:'#16213E', border:'1px solid #2C2C2A', borderRadius:8, padding:'6px 12px', fontSize:11, color:'#9F9BE8', cursor:'pointer' },
  info: { padding:'0 16px 0' },
  name: { fontSize:18, fontWeight:700, marginBottom:2 },
  levelBadge: { display:'inline-flex', alignItems:'center', gap:4, background:'#1E1B4B', borderRadius:20, padding:'3px 10px', fontSize:11, color:'#9F9BE8', fontWeight:600, marginBottom:12 },
  stats: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, padding:'0 16px', marginBottom:16 },
  statCard: { background:'#16213E', borderRadius:10, padding:'10px 8px', border:'1px solid #2C2C2A', textAlign:'center' },
  statNum: { fontSize:20, fontWeight:700, color:'#534AB7', marginBottom:3 },
  statLabel: { fontSize:10, color:'#888780' },
  section: { padding:'0 16px', marginBottom:16 },
  sectionTitle: { fontSize:11, fontWeight:600, color:'#888780', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 },
  badgesGrid: { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 },
  badgeItem: { background:'#16213E', borderRadius:10, padding:'10px 6px', textAlign:'center', border:'1px solid #534AB7' },
  badgeLocked: { background:'#16213E', borderRadius:10, padding:'10px 6px', textAlign:'center', border:'1px solid #2C2C2A', opacity:0.4 },
  badgeEmoji: { fontSize:22, display:'block', marginBottom:4 },
  badgeLabel: { fontSize:9, color:'#9F9BE8', lineHeight:1.3 },
  progressWrap: { background:'#16213E', borderRadius:10, padding:12, border:'1px solid #2C2C2A' },
  progressBar: { background:'#0F0F1A', borderRadius:20, height:6, overflow:'hidden', margin:'6px 0' },
  progressFill: { height:'100%', background:'#534AB7', borderRadius:20 },
  commentCard: { background:'#16213E', borderRadius:12, padding:12, marginBottom:8, border:'1px solid #2C2C2A', cursor:'pointer' },
  commentTop: { display:'flex', alignItems:'center', gap:6, marginBottom:6, flexWrap:'wrap' },
  showName: { fontSize:11, fontWeight:600, color:'#9F9BE8', flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  epBadge: { fontSize:10, color:'#888780', background:'#0F0F1A', borderRadius:6, padding:'1px 5px', flexShrink:0 },
  tsBadge: { fontSize:10, color:'#534AB7', background:'#1A1A2E', borderRadius:6, padding:'1px 5px', fontWeight:600, flexShrink:0 },
  commentText: { fontSize:13, color:'#D3D1C7', lineHeight:1.4, marginBottom:4 },
  timeago: { fontSize:10, color:'#444441', textAlign:'right' },
  modal: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:20 },
  modalCard: { background:'#16213E', borderRadius:16, padding:24, width:'100%', maxWidth:340, border:'1px solid #2C2C2A' },
  modalTitle: { fontSize:16, fontWeight:700, marginBottom:16 },
  input: { width:'100%', background:'#1A1A2E', border:'1px solid #2C2C2A', borderRadius:10, padding:'12px 14px', color:'#FFF', fontSize:14, outline:'none', marginBottom:12, boxSizing:'border-box' },
  modalBtn: { background:'#534AB7', border:'none', borderRadius:10, padding:'12px 0', color:'#FFF', fontSize:14, fontWeight:600, cursor:'pointer', width:'100%', marginBottom:8 },
  modalBtnCancel: { background:'none', border:'1px solid #2C2C2A', borderRadius:10, padding:'10px 0', color:'#888780', fontSize:14, cursor:'pointer', width:'100%' },
  nav: { position:'fixed', bottom:0, left:0, right:0, background:'#0F0F1A', borderTop:'1px solid #2C2C2A', display:'flex', padding:'10px 0' },
  navItem: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', padding:'4px 0' },
  navIcon: { fontSize:20 },
  navLabel: { fontSize:10, color:'#888780' },
}

export default function Profile({ user }) {
  const navigate = useNavigate()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhoto, setNewPhoto] = useState('')
  const [profileData, setProfileData] = useState(null)

  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setProfileData(snap.data())
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
    const data = { displayName: newName || displayName, photoURL: newPhoto || photoURL, updatedAt: new Date() }
    await setDoc(doc(db, 'users', user.uid), data, { merge: true })
    setProfileData(data)
    setEditing(false)
  }

  const displayName = profileData?.displayName || user.displayName || 'Anonyme'
  const photoURL = profileData?.photoURL || user.photoURL || ''
  const count = comments.length
  const level = getLevel(count)
  const nextBadge = getNextBadge(count)
  const earnedBadges = BADGES.filter(b => count >= b.threshold)
  const lockedBadges = BADGES.filter(b => count < b.threshold)
  const showsCount = new Set(comments.map(c => c.showId)).size
  const likesReceived = comments.reduce((acc, c) => acc + Object.values(c.reactions || {}).reduce((a,b) => a+b, 0), 0)
  const nextThreshold = nextBadge?.threshold || count
  const progress = nextBadge ? Math.round((count / nextThreshold) * 100) : 100

  return (
    <div style={s.page}>
      <div style={s.bannerArea}>
        <div style={s.avatarWrap}>
          <div style={s.avatar}>
            {photoURL ? <img src={photoURL} style={{ width:'100%', height:'100%' }} alt="" /> : displayName[0]?.toUpperCase()}
          </div>
        </div>
        <button style={s.editBtn} onClick={() => { setNewName(displayName); setNewPhoto(photoURL); setEditing(true) }}>✏️ Modifier</button>
      </div>

      <div style={s.info}>
        <div style={s.name}>{displayName}</div>
        <div style={s.levelBadge}>🎭 {level.label} · Niveau {LEVELS.filter(l => count >= l.min).length}</div>
      </div>

      <div style={s.stats}>
        <div style={s.statCard}><div style={s.statNum}>{count}</div><div style={s.statLabel}>Commentaires</div></div>
        <div style={s.statCard}><div style={s.statNum}>{showsCount}</div><div style={s.statLabel}>Séries</div></div>
        <div style={s.statCard}><div style={s.statNum}>{likesReceived}</div><div style={s.statLabel}>Réactions reçues</div></div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Badges</div>
        <div style={s.badgesGrid}>
          {BADGES.map(b => {
            const earned = count >= b.threshold
            return (
              <div key={b.id} style={earned ? s.badgeItem : s.badgeLocked} title={b.desc}>
                <span style={s.badgeEmoji}>{b.emoji}</span>
                <div style={{ ...s.badgeLabel, color: earned ? '#9F9BE8' : '#444441' }}>{b.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {nextBadge && (
        <div style={{ padding:'0 16px', marginBottom:16 }}>
          <div style={s.progressWrap}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
              <span style={{ color:'#fff', fontWeight:600 }}>{level.label}</span>
              <span style={{ color:'#888780' }}>{count}/{nextThreshold} commentaires</span>
            </div>
            <div style={s.progressBar}><div style={{ ...s.progressFill, width:`${progress}%` }}/></div>
            <div style={{ fontSize:11, color:'#888780' }}>Prochain badge : {nextBadge.emoji} {nextBadge.label}</div>
          </div>
        </div>
      )}

      <div style={s.section}>
        <div style={s.sectionTitle}>Mes commentaires</div>
        {loading && <div style={{ textAlign:'center', padding:20, color:'#888780', fontSize:13 }}>Chargement…</div>}
        {!loading && comments.length === 0 && (
          <div style={{ textAlign:'center', padding:'24px', color:'#444441', fontSize:13 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
            Lance une série et rejoins la conversation !
          </div>
        )}
        {comments.map(c => (
          <div key={c.id} style={s.commentCard} onClick={() => navigate(`/episode/${c.showId}/${c.seasonNum}/${c.episodeNum}`)}>
            <div style={s.commentTop}>
              <span style={s.showName}>{c.showName || 'Série'}</span>
              {!isNaN(c.seasonNum) && c.seasonNum > 0 && <span style={s.epBadge}>S{String(c.seasonNum).padStart(2,'0')}E{String(c.episodeNum).padStart(2,'0')}</span>}
              {c.timestamp !== null && c.timestamp !== undefined && <span style={s.tsBadge}>⏱ {formatTime(c.timestamp)}</span>}
            </div>
            <div style={s.commentText}>{c.text}</div>
            <div style={s.timeago}>{timeAgo(c.createdAt)}</div>
          </div>
        ))}
      </div>

      <div style={{ padding:'0 16px 16px' }}>
        <button style={{ background:'none', border:'1px solid #2C2C2A', borderRadius:10, padding:'12px', color:'#888780', fontSize:13, cursor:'pointer', width:'100%' }}
          onClick={() => signOut(auth)}>Se déconnecter</button>
      </div>

      {editing && (
        <div style={s.modal}>
          <div style={s.modalCard}>
            <div style={s.modalTitle}>Modifier mon profil</div>
            <input style={s.input} placeholder="Pseudo" value={newName} onChange={e => setNewName(e.target.value)} />
            <input style={s.input} placeholder="URL de ta photo (optionnel)" value={newPhoto} onChange={e => setNewPhoto(e.target.value)} />
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
