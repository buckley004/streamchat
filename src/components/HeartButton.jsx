import React, { useState, useEffect } from 'react'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

function HeartIcon({ filled, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? '#B0AECB' : 'none'}
      stroke="#B0AECB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

export default function HeartButton({ user, showId, showName, showPoster, isMovie, size = 18, style = {} }) {
  const [isFav, setIsFav] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !showId) return
    getDoc(doc(db, 'favorites', `${user.uid}_${showId}`))
      .then(snap => setIsFav(snap.exists() && !snap.data()?.deleted))
  }, [user?.uid, showId])

  async function toggle(e) {
    e.stopPropagation()
    if (loading || !user) return
    setLoading(true)
    try {
      const favRef = doc(db, 'favorites', `${user.uid}_${showId}`)
      const countRef = doc(db, 'favoriteCounts', showId)
      const [favSnap, countSnap] = await Promise.all([getDoc(favRef), getDoc(countRef)])
      const currentlyFav = favSnap.exists() && !favSnap.data()?.deleted
      const currentCount = countSnap.exists() ? (countSnap.data().count || 0) : 0

      if (currentlyFav) {
        await setDoc(favRef, { deleted: true, updatedAt: serverTimestamp() }, { merge: true })
        await setDoc(countRef, { count: Math.max(0, currentCount - 1) }, { merge: true })
        setIsFav(false)
      } else {
        await setDoc(favRef, {
          userId: user.uid, showId: String(showId),
          showName: showName || '', showPoster: showPoster || '',
          isMovie: !!isMovie, deleted: false,
          createdAt: serverTimestamp()
        })
        await setDoc(countRef, { count: currentCount + 1 }, { merge: true })
        setIsFav(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={toggle} disabled={loading}
      style={{ background:'none', border:'none', cursor:'pointer', padding:4, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity: loading ? 0.5 : 1, ...style }}>
      <HeartIcon filled={isFav} size={size} />
    </button>
  )
}
