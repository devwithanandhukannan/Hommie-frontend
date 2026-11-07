export function AuthCard({ title, sub, children }) {
  return (
    <div className="auth"><div className="card">
      <div className="logo" style={{ background: 'transparent', width: 56, height: 56, borderRadius: 0, padding: 0, marginBottom: 12 }}>
        <img src="/icon.svg" alt="Hommi" width="56" height="56" style={{ display: 'block', objectFit: 'contain' }} />
      </div>
      <h1>{title}</h1><p className="muted" style={{ margin: '4px 0 16px' }}>{sub}</p>
      {children}
    </div></div>
  );
}
