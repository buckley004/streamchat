import React, { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogle() {
    setLoading(true)
    setError('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch {
      setError('Connexion annulée. Réessaie !')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🎬</div>
      <h1 style={{ fontSize:28, fontWeight:700, color:'#FFF', marginBottom:8 }}>StreamChat</h1>
      <p style={{ fontSize:15, color:'#B0AECB', marginBottom:48, textAlign:'center', maxWidth:280, lineHeight:1.6 }}>
        Commente tes séries et films en temps réel, synchronisé à la seconde près.
      </p>

      <button
        style={{ display:'flex', alignItems:'center', gap:12, background:'#FFF', color:'#0F0F1A', border:'none', borderRadius:12, padding:'14px 28px', fontSize:15, fontWeight:600, cursor:'pointer', width:'100%', maxWidth:300, justifyContent:'center' }}
        onClick={handleGoogle} disabled={loading}>
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {loading ? 'Connexion…' : 'Continuer avec Google'}
      </button>

      {error && <p style={{ color:'#E24B4A', marginTop:16, fontSize:13 }}>{error}</p>}

      <div style={{ marginTop:40, display:'flex', flexDirection:'column', gap:12 }}>
        {['Commentaires synchronisés à la seconde', 'Toutes les séries et tous les films', 'Communauté en temps réel'].map(f => (
          <div key={f} style={{ display:'flex', alignItems:'center', gap:10, color:'#B0AECB', fontSize:14 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#534AB7', flexShrink:0 }} />
            {f}
          </div>
        ))}
      </div>
    </div>
  )
}
