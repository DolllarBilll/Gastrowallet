import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageToggleButton from '../components/LanguageToggleButton';
import { resetViewportZoom } from '../utils/viewport';

// Shared login screen routing platform admins and store users to their workspace
export default function LoginPage() {
  const { t } = useLanguage();
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    resetViewportZoom();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetViewportZoom();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/login', { email, password });
      loginSuccess(res.data);
      resetViewportZoom();

      const nextRoute = res.data.user.role === 'ADMIN' ? '/admin' : '/store';
      navigate(nextRoute);
      setTimeout(() => resetViewportZoom(), 200);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Sign in failed');
      resetViewportZoom();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gw-login-wrapper">
      <div className="gw-login-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span className="gw-brand">{t('brandName')}</span>
          <LanguageToggleButton />
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: '22px' }}>{t('loginTitle')}</h2>
        <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          {t('loginSubtitle')}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="gw-field">
            <label className="gw-label">{t('emailLabel')}</label>
            <input
              type="email"
              required
              className="gw-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="gw-field">
            <label className="gw-label">{t('passwordLabel')}</label>
            <input
              type="password"
              required
              className="gw-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {errorMsg && <div className="gw-alert gw-alert-error" style={{ marginBottom: 0 }}>{errorMsg}</div>}

          <button
            type="submit"
            disabled={loading}
            className="gw-btn gw-btn-primary"
            style={{ width: '100%', marginTop: '4px' }}
          >
            {loading ? '...' : t('loginButton')}
          </button>
        </form>
      </div>
    </div>
  );
}