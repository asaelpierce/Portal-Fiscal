import React from 'react'

export function Card({ title, value, sub, color }) {
  const colors = {
    green:  { border: '#12805C', text: '#12805C' },
    red:    { border: '#B42318', text: '#B42318' },
    orange: { border: '#B54708', text: '#B54708' },
    blue:   { border: '#1D5BBF', text: '#1D5BBF' },
    gray:   { border: '#6B7280', text: '#101828' },
  }
  const c = colors[color] || colors.gray
  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB',
      borderTop: `3px solid ${c.border}`,
      borderRadius: 8, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: c.text, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function Panel({ title, action, children, noPad }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '13px 18px', borderBottom: '1px solid #F3F4F6',
      }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
        {action}
      </div>
      <div style={noPad ? {} : { padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

export function Tag({ sit }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 5,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      color: sit.cor, background: sit.bg,
    }}>
      {sit.rot}
    </span>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '80px 20px', color: '#6B7280', fontSize: 13 }}>
      <div style={{
        width: 32, height: 32, border: '3px solid #E5E7EB',
        borderTopColor: '#1D5BBF', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      Carregando dados do Supabase…
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export function EmptyState({ title, text, children }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
      padding: '48px 32px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <strong style={{ fontSize: 16, fontWeight: 600 }}>{title}</strong>
      <p style={{ margin: 0, color: '#6B7280', maxWidth: 420, lineHeight: 1.6 }}>{text}</p>
      {children}
    </div>
  )
}

export function Btn({ children, onClick, primary, disabled, small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: small ? '5px 10px' : '8px 14px',
      fontSize: small ? 12 : 13, fontWeight: 500,
      border: `1px solid ${primary ? '#1D5BBF' : '#E5E7EB'}`,
      borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
      background: primary ? '#1D5BBF' : '#fff',
      color: primary ? '#fff' : '#374151',
      opacity: disabled ? 0.5 : 1,
      fontFamily: 'inherit',
    }}>
      {children}
    </button>
  )
}

export function Select({ label, value, onChange, options, placeholder = 'Todos' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        fontFamily: 'inherit', fontSize: 13, padding: '7px 10px',
        border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff',
        color: '#101828', minWidth: 155, outline: 'none',
      }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>Buscar</label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        border: '1px solid #E5E7EB', borderRadius: 6, padding: '0 10px', background: '#fff',
      }}>
        <svg width="13" height="13" fill="none" stroke="#9CA3AF" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
          border: 'none', outline: 'none', padding: '7px 0',
          fontSize: 13, background: 'transparent', minWidth: 180, fontFamily: 'inherit',
        }} />
      </div>
    </div>
  )
}

export function Drawer({ linha, onClose, brl, dBR, sitDe, isZero }) {
  if (!linha) return null
  const sit = sitDe(linha.motivo_divergencia)

  const campos = [
    ['Conta contábil', linha.conta_contabil],
    ['NUNOTA', linha.nunota],
    ['Nota fiscal', linha.nota_fiscal],
    ['Local', `${linha.cod_local ?? '—'} · ${linha.descr_local ?? '—'}`],
    ['Operação (TOP)', `${linha.cod_top ?? '—'} · ${linha.descr_top ?? '—'}`],
    ['Data negociação', dBR(linha.data_negociacao)],
    ['Data entrada/saída', dBR(linha.data_entrada_saida)],
  ]
  const impostos = [
    ['ICMS', linha.vlr_icms], ['PIS', linha.vlr_pis], ['COFINS', linha.vlr_cofins],
    ['IPI', linha.vlr_ipi], ['Frete líquido', linha.vlr_frete], ['Valor da nota', linha.vlr_nota],
    ['Custo s/ frete', linha.custoprodutosemfrete], ['Custo c/ frete', linha.custoprodutoscomfrete],
  ]

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 40,
        animation: 'fadeIn .15s ease',
      }} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px,100vw)',
        background: '#fff', borderLeft: '1px solid #E5E7EB', zIndex: 41,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 30px rgba(16,24,40,.12)',
        animation: 'slideIn .18s ease',
      }}>
        <style>{`
          @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
          @keyframes slideIn { from { transform:translateX(20px); opacity:.4 } to { transform:none; opacity:1 } }
        `}</style>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
          <div>
            <Tag sit={sit} />
            <h3 style={{ margin: '8px 0 0', fontSize: 17, fontWeight: 600 }}>
              Nota fiscal {linha.nota_fiscal}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280', borderRadius: 5 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 8, padding: 14, marginBottom: 20 }}>
            {[
              ['Custo apurado', brl(linha.saldo_dash), false],
              ['Saldo contábil', brl(linha.saldo_contabil), false],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11.5, color: '#6B7280' }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>R$ {val}</div>
              </div>
            ))}
            <div style={{ gridColumn: '1/-1', paddingTop: 12, borderTop: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: 11.5, color: '#6B7280' }}>Diferença</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: isZero(linha.diferenca) ? '#12805C' : '#B42318' }}>
                R$ {brl(linha.diferenca)}
              </div>
            </div>
          </div>

          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Identificação</h4>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 16px', margin: '0 0 20px', fontSize: 13 }}>
            {campos.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{k}</dt>
                <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v ?? '—'}</dd>
              </React.Fragment>
            ))}
          </dl>

          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Composição fiscal</h4>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 16px', margin: '0 0 20px', fontSize: 13 }}>
            {impostos.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt style={{ color: '#6B7280' }}>{k}</dt>
                <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>R$ {brl(v)}</dd>
              </React.Fragment>
            ))}
          </dl>

          {linha.qtd_cte > 0 && (
            <>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>CTes vinculados</h4>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 16px', margin: 0, fontSize: 13 }}>
                <dt style={{ color: '#6B7280' }}>Quantidade</dt>
                <dd style={{ margin: 0, textAlign: 'right' }}>{linha.qtd_cte}</dd>
                <dt style={{ color: '#6B7280' }}>Números</dt>
                <dd style={{ margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{linha.numeros_cte || '—'}</dd>
              </dl>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
