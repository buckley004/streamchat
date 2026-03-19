import React, { useState, useEffect } from 'react'
import Nav from '../components/Nav'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

const BADGES = [
  { id:'first', emoji:'🎬', label:'Premier pas', threshold:1 },
  { id:'fire', emoji:'🔥', label:'En feu', threshold:10 },
  { id:'night', emoji:'🌙', label:'Noctambule', threshold:25 },
  { id:'star', emoji:'⭐', label:'Top voix', threshold:50 },
  { id:'legend', emoji:'👑', label:'Légende', threshold:200 },
]

function getLevel(count) {
  const LEVELS = [{ min:0,label:'Spectateur'},{min:10,label:'Critique'},{min:50,label:'Cinéphile'},{min:200,label:'Expert'},{min:500,label:'Légende'}]
  let l = LEVELS[0]
  for (const x of LEVELS) { if (count>=x.min) l=x }
  return l
}

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFF', paddingBottom:70 },
  header: { padding:'16px 16px 0', display:'flex', alignItems:'center', gap:10 },
  back: { fontSize:22, cursor:'pointer', background:'none', border:'none', color:'#FFF', padding:'4px 8px' },
  bannerArea: { height:80, background:'#16213E', position:'relative', marginBottom:36 },
  avatarWrap: { position:'absolute', bottom:-28, left:16 },
  avatar: { width:56, height:56, borderRadius:'50%', border:'3px solid #1A1A2E', background:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#fff', fontWeight:700, overflow:'hidden' },
  info: { padding:'0 16px 12px' },
  name: { fontSize:18, fontWeight:700, marginBottom:4 },
  levelBadge: { display:'inline-flex', alignItems:'center', gap:4, background:'#1E1B4B', borderRadius:20, padding:'3px 10px', fontSize:11, color:'#9F9BE8', fontWeight:600, marginBottom:8 },
  rsRow: { display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 },
  rsLink: { fontSize:12, color:'#534AB7', textDecoration:'none' },
  stats: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, padding:'0 16px', marginBottom:16 },
  statCard: { background:'#16213E', borderRadius:10, padding:'10px 8px', border:'1px solid #2C2C2A', textAlign:'center' },
  statNum: { fontSize:20, fontWeight:700, color:'#534AB7', marginBottom:3 },
  statLabel: { fontSize:10, color:'#888780' },
  section: { padding:'0 16px', marginBottom:16 },
  sectionTitle: { fontSize:11, fontWeight:600, color:'#888780', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 },
  badgesGrid: { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 },
  badgeItem: { background:'#16213E', borderRadius:10, padding:'10px 6px', textAlign:'center', border:'1px solid #534AB7' },
  badgeLocked: { background:'#16213E', borderRadius:10, padding:'10px 6px', textAlign:'center', border:'1px solid #2C2C2A', opacity:0.4 },
  commentCard: { background:'#16213E', borderRadius:10, padding:12, marginBottom:8, border:'1px solid #2C2C2A' },
  commentText: { fontSize:13, color:'#D3D1C7', marginBottom:4 },
  commentMeta: { fontSize:10, color:'#888780' },
  nav: { position:'fixed', bottom:0, left:0, right:0, background:'#0F0F1A', borderTop:'1px solid #2C2C2A', display:'flex', padding:'10px 0', zIndex:50 },
  navItem: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', padding:'3px 0' },
  navIcon: { fontSize:20 },
  navLabel: { fontSize:10, color:'#888780' },
}

export default function UserProfile({ user: currentUser }) {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [comments, setComments] = useState([])
  const isOwn = currentUser.uid === userId

  useEffect(() => {
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) setProfile(snap.data())
      else setProfile({ displayName: 'Utilisateur', commentCount: 0 })
    })
    getDocs(query(collection(db, 'userComments'), where('userId','==',userId), orderBy('createdAt','desc'), limit(5)))
      .then(snap => setComments(snap.docs.map(d => d.data())))
  }, [userId])

  if (!profile) return <div style={{ background:'#1A1A2E', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#888780' }}>Chargement…</div>

  const count = profile.commentCount||0
  const level = getLevel(count)
  const photoURL = profile.photoURL||currentUser.photoURL||''

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate(-1)}>←</button>
        {isOwn && <span style={{ fontSize:13, color:'#9F9BE8', cursor:'pointer' }} onClick={() => navigate('/profile')}>Modifier mon profil →</span>}
      </div>

      <div style={s.bannerArea}>
        <div style={s.avatarWrap}>
          <div style={s.avatar}>
            {photoURL ? <img src={photoURL} style={{ width:'100%', height:'100%' }} alt="" /> : (profile.displayName||'?')[0]?.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={s.info}>
        <div style={s.name}>{profile.displayName||'Anonyme'}</div>
        <div style={s.levelBadge}>🎭 {level.label}</div>
        {profile.social && (
          <div style={s.rsRow}>
            {profile.social.instagram && <a href={`https://instagram.com/${profile.social.instagram}`} style={s.rsLink} target="_blank" rel="noreferrer">📷 @{profile.social.instagram}</a>}
            {profile.social.twitter && <a href={`https://twitter.com/${profile.social.twitter}`} style={s.rsLink} target="_blank" rel="noreferrer">🐦 @{profile.social.twitter}</a>}
            {profile.social.letterboxd && <a href={`https://letterboxd.com/${profile.social.letterboxd}`} style={s.rsLink} target="_blank" rel="noreferrer">🎬 Letterboxd</a>}
          </div>
        )}
      </div>

      <div style={s.stats}>
        <div style={s.statCard}><div style={s.statNum}>{count}</div><div style={s.statLabel}>Commentaires</div></div>
        <div style={s.statCard}><div style={s.statNum}>{profile.favCount||0}</div><div style={s.statLabel}>Favoris</div></div>
        <div style={s.statCard}><div style={s.statNum}>{profile.likesReceived||0}</div><div style={s.statLabel}>Réactions</div></div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Badges</div>
        <div style={s.badgesGrid}>
          {BADGES.map(b => (
            <div key={b.id} style={count>=b.threshold ? s.badgeItem : s.badgeLocked}>
              <span style={{ fontSize:22, display:'block', marginBottom:4 }}>{b.emoji}</span>
              <div style={{ fontSize:9, color:count>=b.threshold?'#9F9BE8':'#444441' }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      {comments.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Derniers commentaires</div>
          {comments.map((c,i) => (
            <div key={i} style={s.commentCard}>
              <div style={s.commentText}>{c.text}</div>
              <div style={s.commentMeta}>{c.showName} {c.seasonNum>0?`S${String(c.seasonNum).padStart(2,'0')}E${String(c.episodeNum).padStart(2,'0')}`:''}</div>
            </div>
          ))}
        </div>
      )}

      <nav style={s.nav}>
        <div style={s.navItem} onClick={() => navigate('/')}><span style={s.navIcon}>🏠</span><span style={s.navLabel}>Accueil</span></div>
        <div style={s.navItem} onClick={() => navigate('/search')}><span style={s.navIcon}>🔍</span><span style={s.navLabel}>Rechercher</span></div>
        <div style={s.navItem} onClick={() => navigate('/profile')}><span style={s.navIcon}>👤</span><span style={s.navLabel}>Profil</span></div>
      </nav>
    </div>
  )
}
