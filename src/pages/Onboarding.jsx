import React, { useState } from 'react'

const steps = [
  {
    emoji: '🎬',
    title: 'Commente tes séries et films en temps réel',
    desc: 'Ouvre StreamChat pendant que tu regardes et rejoins une communauté de spectateurs qui commentent au même moment que toi.',
  },
  {
    emoji: '⏱',
    title: 'Synchronisé à la seconde près',
    desc: 'Appuie sur "Je regarde maintenant" quand tu lances ton film ou épisode. Tes commentaires seront horodatés automatiquement.',
  },
  {
    emoji: '💬',
    title: 'Réagis et réponds aux commentaires',
    desc: 'Like les commentaires, réponds à ceux qui t\'intéressent, ajoute des réactions emoji et partage les moments qui t\'ont marqué.',
  },
]

const s = {
  page: { minHeight:'100vh', background:'#1A1A2E', color:'#FFF', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', padding:'60px 32px 48px' },
  emoji: { fontSize:72, marginBottom:32, display:'block', textAlign:'center' },
  title: { fontSize:26, fontWeight:700, textAlign:'center', marginBottom:16, lineHeight:1.3 },
  desc: { fontSize:16, color:'#888780', textAlign:'center', lineHeight:1.7, maxWidth:300 },
  dots: { display:'flex', gap:8, justifyContent:'center', margin:'32px 0' },
  dot: { width:8, height:8, borderRadius:'50%', background:'#2C2C2A', transition:'all 0.2s' },
  dotActive: { background:'#534AB7', width:24, borderRadius:4 },
  btn: { background:'#534AB7', border:'none', borderRadius:14, padding:'16px 0', color:'#FFF', fontSize:16, fontWeight:700, cursor:'pointer', width:'100%', maxWidth:320 },
  skip: { marginTop:16, color:'#444441', fontSize:13, cursor:'pointer', background:'none', border:'none' },
}

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const current = steps[step]
  const isLast = step === steps.length - 1
  return (
    <div style={s.page}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={s.emoji}>{current.emoji}</span>
        <h1 style={s.title}>{current.title}</h1>
        <p style={s.desc}>{current.desc}</p>
        <div style={s.dots}>
          {steps.map((_, i) => <div key={i} style={{ ...s.dot, ...(i===step ? s.dotActive : {}) }} />)}
        </div>
      </div>
      <div style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
        <button style={s.btn} onClick={() => isLast ? onDone() : setStep(s => s+1)}>
          {isLast ? 'C\'est parti !' : 'Suivant'}
        </button>
        {!isLast && <button style={s.skip} onClick={onDone}>Passer</button>}
      </div>
    </div>
  )
}
