import React, { useState } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])
  function showToast(msg, emoji='🎉') {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, emoji }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }
  return { toasts, showToast }
}

export function ToastContainer({ toasts }) {
  return (
    <div style={{ position:'fixed', top:20, left:'50%', transform:'translateX(-50%)', zIndex:999, display:'flex', flexDirection:'column', gap:8, alignItems:'center', pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background:'#534AB7', color:'#fff', borderRadius:20, padding:'10px 20px', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap', animation:'slideDown 0.3s ease' }}>
          <span style={{ fontSize:16 }}>{t.emoji}</span>{t.msg}
        </div>
      ))}
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
