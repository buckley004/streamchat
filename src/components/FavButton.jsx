import React, { useState, useEffect } from 'react'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

function Heart({ filled, size=20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? "#B0AECB" : "none"}
      stroke="#B0AECB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

export default function FavButton({ user, showId, showName, showPoster, isMovie, size=18, showCount=false }) {
  const [isFav, setIsFav] = useState(false)
  const [favCount, setFavCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !showId) return
    getDoc(doc(db, 'favorites', `${user.uid}_${showId}`))
      .then(snap => setIsFav(snap.exists() && !snap.data()?.deleted))
    if (showCount) {
      getDoc(doc(db, 'favoriteCounts', String(showId)))
        .then(snap => setFavCount(snap.exists() ? snap.data().count || 0 : 0))
    }
  }, [showId, user?.uid])

  async function toggle(e) {
    e.stopPropagation()
    if (loading || !user) return
    setLoading(true)
    try {
      const favRef = doc(db, 'favorites', `${user.uid}_${showId}`)
      const countRef = doc(db, 'favoriteCounts', String(showId))
      // Toujours vérifier l'état réel dans Firebase
      const snap = await getDoc(favRef)
      const currentlyFav = snap.exists() && !snap.data()?.deleted
      if (currentlyFav) {
        await setDoc(favRef, { deleted: true, updatedAt: serverTimestamp() }, { merge: true })
        await setDoc(countRef, { count: Math.max(0, favCount - 1) }, { merge: true })
        setFavCount(c => Math.max(0, c - 1))
        setIsFav(false)
      } else {
        await setDoc(favRef, {
          userId: user.uid, showId: String(showId),
          showName: showName || '', showPoster: showPoster || '',
          isMovie: !!isMovie, deleted: false,
          createdAt: serverTimestamp()
        })
        await setDoc(countRef, { count: favCount + 1 }, { merge: true })
        setFavCount(c => c + 1)
        setIsFav(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{ background:'none', border:'none', cursor:'pointer', padding:4, display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
      <Heart filled={isFav} size={size} />
      {showCount && favCount > 0 && <span style={{ fontSize:10, color:'#B0AECB' }}>{favCount}</span>}
    </button>
  )
}
