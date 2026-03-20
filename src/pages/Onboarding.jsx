import React, { useState } from 'react'

const STEPS = [
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

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div style={{ minHeight:'100vh', background:'#0F0F1A', color:'#FFF', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between', padding:'60px 32px 48px' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:72, marginBottom:32, display:'block', textAlign:'center' }}>{current.emoji}</span>
        <h1 style={{ fontSize:26, fontWeight:700, textAlign:'center', marginBottom:16, lineHeight:1.3 }}>{current.title}</h1>
        <p style={{ fontSize:16, color:'#B0AECB', textAlign:'center', lineHeight:1.7, maxWidth:300 }}>{current.desc}</p>
        <div style={{ display:'flex', gap:8, justifyContent:'center', margin:'32px 0' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ height:8, borderRadius:4, background: i === step ? '#534AB7' : '#2C2C4A', width: i === step ? 24 : 8, transition:'all 0.2s' }} />
          ))}
        </div>
      </div>
      <div style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
        <button
          style={{ background:'#534AB7', border:'none', borderRadius:14, padding:'16px 0', color:'#FFF', fontSize:16, fontWeight:700, cursor:'pointer', width:'100%', maxWidth:320 }}
          onClick={() => isLast ? onDone() : setStep(s => s + 1)}>
          {isLast ? 'C\'est parti !' : 'Suivant'}
        </button>
        {!isLast && (
          <button style={{ marginTop:16, color:'#8888A0', fontSize:13, cursor:'pointer', background:'none', border:'none' }} onClick={onDone}>
            Passer
          </button>
        )}
      </div>
    </div>
  )
}
