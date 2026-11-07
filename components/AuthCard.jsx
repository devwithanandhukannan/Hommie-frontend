export function AuthCard({ title, sub, children }) {
  return (
    <div className="auth">
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: '36px 32px', borderRadius: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="font-serif" style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Hommi
          </div>
        </div>
        <h1 style={{ fontSize: 20, textAlign: 'center' }}>{title}</h1>
        <p className="muted" style={{ margin: '6px 0 24px', textAlign: 'center', fontSize: 13.5 }}>{sub}</p>
        {children}
      </div>
    </div>
  );
}
