import React from 'react'

// Calendário livre (De → Até) com indicador de status ao lado. Quando o
// período escolhido ainda não existe no banco, a tela dona deste seletor é
// responsável por chamar a sincronização (ver src/lib/sync.js) e passar o
// resultado via prop `fase` — este componente só exibe, não decide nada.
export default function SeletorPeriodo({ dtIni, dtFim, onChange, fase, maxData }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const max = maxData || hoje

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="date" value={dtIni} max={dtFim || max}
        onChange={e => onChange(e.target.value, dtFim)}
        style={{ fontFamily: 'inherit', fontSize: 13, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', color: '#374151' }}
      />
      <span style={{ color: '#9CA3AF', fontSize: 13 }}>→</span>
      <input
        type="date" value={dtFim} min={dtIni} max={max}
        onChange={e => onChange(dtIni, e.target.value)}
        style={{ fontFamily: 'inherit', fontSize: 13, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', color: '#374151' }}
      />

      {fase === 'verificando' && (
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>Verificando…</span>
      )}
      {fase === 'sincronizando' && (
        <span style={{ fontSize: 12, color: '#1D5BBF', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 12, height: 12, border: '2px solid #DBEAFE', borderTopColor: '#1D5BBF',
            borderRadius: '50%', display: 'inline-block', animation: 'girarSeletorPeriodo .8s linear infinite',
          }} />
          Buscando no Sankhya…
          <style>{`@keyframes girarSeletorPeriodo{to{transform:rotate(360deg)}}`}</style>
        </span>
      )}
      {fase === 'erro' && (
        <span style={{ fontSize: 12, color: '#B42318' }}>⚠ Não consegui sincronizar esse período</span>
      )}
    </div>
  )
}
