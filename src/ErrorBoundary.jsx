import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[APG] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#08081A',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ color: '#F0F0F0', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Что-то пошло не так
          </div>
          <div style={{ color: 'rgba(240,240,240,0.45)', fontSize: 14, marginBottom: 32, lineHeight: '20px' }}>
            Попробуйте перезагрузить приложение
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
              border: 'none', borderRadius: 14,
              color: '#0F0F1A', fontSize: 15, fontWeight: 700,
              padding: '14px 32px', cursor: 'pointer',
            }}
          >
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
