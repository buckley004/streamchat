import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import Nav from '../components/Nav'

const BADGES = [
  { id:'first', emoji:'🎬', label:'Premier pas', threshold:1 },
  { id:'fire', emoji:'🔥', label:'En feu', threshold:10 },
  { id:'night', emoji:'🌙', label:'Noctambule', threshold:25 },
  { id:'star', emoji:'⭐', label:'Top voix', threshold:50 },
  { id:'legend', emoji:'👑', label:'Légende', threshold:200 },
]

const LEVELS = [
  { min:0, label:'Spectateur' },
  { min:10, label:'Critique' },
  { min:50, label:'Cinéphile' },
  { min:200, label:'Expert' },
  { min:500, label:'Légende' },
]

function getLevel(count) {
  let level = LEVELS[0]
  LEVELS.forEach(l => { if (count >= l.min) level = l })
  return level
}

export default function UserProfile({ user: currentUser }) {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [comments, setComments] = useState([])
  const isOwn = currentUser.uid === userId

  useEffect(() => {
    getDoc(doc(db, 'users', userId)).then(snap => {
      setProfile(snap.exists() ? snap.data() : { displayName:'Utilisateur', commentCount:0 })
    })
    getDocs(query(
      collection(db, 'userComments'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(5)
    )).then(snap => setComments(snap.docs.map(d => d.data())))
  }, [userId])

  if (!profile) return (
    <div style={{ background:'#0F0F1A', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#B0AECB' }}>
      Chargement…
    </div>
  )

  const count = profile.commentCount || 0
  const level = getLevel(count)
  const photoURL = profile.photoURL || ''
  const avatarDisplay = profile.avatar || null

  return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', color:'#FFF', paddingBottom:70 }}>
      <div style={{ padding:'16px 16px 0', display:'flex', alignItems:'center', gap:10 }}>
        <button style={{ background:'none', border:'none', color:'#FFF', fontSize:22, cursor:'pointer' }} onClick={() => navigate(-1)}>‹</button>
        {isOwn && <span style={{ fontSize:13, color:'#9F9BE8', cursor:'pointer', marginLeft:'auto' }} onClick={() => navigate('/profile')}>Modifier →</span>}
      </div>

      <div style={{ height:80, background:'#16213E', position:'relative', marginBottom:40 }}>
        <div style={{ position:'absolute', bottom:-28, left:16, width:56, height:56, borderRadius:'50%', border:'3px solid #0F0F1A', background:'#534AB7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:'#fff', fontWeight:700, overflow:'hidden' }}>
          {avatarDisplay ? <span style={{ fontSize:26 }}>{avatarDisplay}</span>
            : photoURL ? <img src={photoURL} style={{ width:'100%', height:'100%' }} alt="" />
            : (profile.displayName || '?')[0]?.toUpperCase()}
        </div>
      </div>

      <div style={{ padding:'0 16px 12px' }}>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:3 }}>{profile.displayName || 'Anonyme'}</div>
        <div style={{ display:'inline-flex', gap:4, background:'#1E1B4B', borderRadius:20, padding:'3px 10px', fontSize:11, color:'#C8C4F8', fontWeight:600, marginBottom:12 }}>
          🎭 {level.label}
        </div>
        {profile.social && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            {profile.social.instagram && <a href={`https://instagram.com/${profile.social.instagram}`} style={{ fontSize:12, color:'#534AB7', textDecoration:'none' }} target="_blank" rel="noreferrer">📷 @{profile.social.instagram}</a>}
            {profile.social.twitter && <a href={`https://twitter.com/${profile.social.twitter}`} style={{ fontSize:12, color:'#534AB7', textDecoration:'none' }} target="_blank" rel="noreferrer">🐦 @{profile.social.twitter}</a>}
            {profile.social.letterboxd && <a href={`https://letterboxd.com/${profile.social.letterboxd}`} style={{ fontSize:12, color:'#534AB7', textDecoration:'none' }} target="_blank" rel="noreferrer">🎬 Letterboxd</a>}
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, padding:'0 16px', marginBottom:16 }}>
        {[['Commentaires', count], ['Favoris', (profile.movieFavs||0)+(profile.serieFavs||0)], ['Réactions', profile.reactionsReceived||0]].map(([label, val]) => (
          <div key={label} style={{ background:'#1A2340', borderRadius:10, padding:'10px 8px', border:'1px solid #3A3A5C', textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:700, color:'#FFF', marginBottom:3 }}>{val}</div>
            <div style={{ fontSize:10, color:'#B0AECB' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding:'0 16px', marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Badges</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
          {BADGES.map(b => (
            <div key={b.id} style={{ background:'#1A2340', borderRadius:10, padding:'10px 4px', textAlign:'center', border: count >= b.threshold ? '1px solid #534AB7' : '1px solid #2C2C4A', opacity: count >= b.threshold ? 1 : 0.4 }}>
              <span style={{ fontSize:20, display:'block', marginBottom:3 }}>{b.emoji}</span>
              <div style={{ fontSize:9, color: count >= b.threshold ? '#C8C4F8' : '#888780' }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      {comments.length > 0 && (
        <div style={{ padding:'0 16px' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#B0AECB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Derniers commentaires</div>
          {comments.map((c, i) => (
            <div key={i} style={{ background:'#1A2340', borderRadius:10, padding:12, marginBottom:8, border:'1px solid #3A3A5C', cursor:'pointer' }}
              onClick={() => navigate(`/episode/${c.showId}/${c.seasonNum}/${c.episodeNum}`)}>
              <div style={{ fontSize:11, color:'#B0AECB', marginBottom:4 }}>{c.showName} {c.seasonNum > 0 ? `S${String(c.seasonNum).padStart(2,'0')}E${String(c.episodeNum).padStart(2,'0')}` : ''}</div>
              <div style={{ fontSize:13, color:'#E8E6F8' }}>{c.text}</div>
            </div>
          ))}
        </div>
      )}

      <Nav />
    </div>
  )
}
