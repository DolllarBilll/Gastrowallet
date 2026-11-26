import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageToggleButton from '../components/LanguageToggleButton';
import { resetViewportZoom } from '../utils/viewport';

// Shared login screen routing platform admins and store users to their workspace
export default function LoginPage() {
  const { t, lang } = useLanguage();
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="gw-login-wrapper gw-login-modern-bg">
      <style>{`
        @keyframes gwLoginCardIn {
          0% {
            opacity: 0;
            transform: translate3d(0, 12px, 0) scale(0.99);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes gwSpin {
          to {
            transform: rotate(360deg);
          }
        }
        .gw-login-modern-bg {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          background:
            radial-gradient(circle at 12% 14%, rgba(124, 58, 237, 0.16), transparent 44%),
            radial-gradient(circle at 88% 86%, rgba(147, 51, 234, 0.13), transparent 44%),
            linear-gradient(180deg, #f8f7ff 0%, #f1f5f9 100%);
        }
        .gw-login-modern-card {
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(124, 58, 237, 0.15);
          border-top: 3.5px solid #7c3aed;
          border-radius: 22px;
          padding: 34px 28px 26px;
          box-shadow:
            0 20px 45px rgba(15, 23, 42, 0.08),
            0 4px 14px rgba(124, 58, 237, 0.06);
          animation: gwLoginCardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .gw-login-brand-centered {
          text-align: center;
          font-family: 'Pacifico', cursive;
          font-size: 38px;
          font-weight: 400;
          letter-spacing: 0.015em;
          line-height: 1.2;
          color: #f59e0b;
          text-shadow: 0 1px 2px rgba(180, 100, 0, 0.14);
          -webkit-font-smoothing: antialiased;
          margin: 0 0 24px;
        }
        .gw-login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .gw-login-input-icon {
          position: absolute;
          left: 13px;
          color: #9ca3af;
          display: inline-flex;
          align-items: center;
          pointer-events: none;
          transition: color 0.18s ease;
        }
        .gw-login-input-wrap:focus-within .gw-login-input-icon {
          color: #7c3aed;
        }
        .gw-login-input-padded {
          padding-left: 40px !important;
          border-radius: 12px !important;
          min-height: 46px;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .gw-login-input-padded:focus {
          border-color: #7c3aed !important;
          box-shadow: 0 0 0 3.5px rgba(124, 58, 237, 0.13) !important;
          outline: none;
        }
        .gw-login-pass-input {
          padding-right: 42px !important;
        }
        .gw-login-eye-btn {
          position: absolute;
          right: 10px;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #6b7280;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          transition: background-color 0.16s ease, color 0.16s ease;
        }
        .gw-login-eye-btn:hover {
          background: rgba(124, 58, 237, 0.08);
          color: #6d28d9;
        }
        .gw-login-submit-btn {
          width: 100%;
          min-height: 48px;
          margin-top: 6px;
          border-radius: 12px !important;
          font-size: 15px !important;
          font-weight: 700 !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%) !important;
          border-color: #6d28d9 !important;
          box-shadow: 0 8px 20px rgba(109, 40, 217, 0.24);
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }
        .gw-login-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 11px 24px rgba(109, 40, 217, 0.32);
        }
        .gw-login-spinner {
          width: 17px;
          height: 17px;
          border: 2.2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: gwSpin 0.7s linear infinite;
        }
        .gw-login-lang-footer {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .gw-login-lang-footer button {
          min-height: 34px !important;
          padding: 5px 14px !important;
          font-size: 12.5px !important;
          border-radius: 999px !important;
          color: var(--text-secondary) !important;
          border-color: #e5e7eb !important;
          background-color: #f9fafb !important;
        }
        .gw-login-lang-footer button:hover {
          border-color: rgba(124, 58, 237, 0.3) !important;
          color: #6d28d9 !important;
          background-color: rgba(124, 58, 237, 0.05) !important;
        }
        @media (max-width: 480px) {
          .gw-login-modern-card {
            padding: 28px 20px 22px;
            border-radius: 18px;
          }
          .gw-login-brand-centered {
            font-size: 33px;
          }
        }
      `}</style>

      <div className="gw-login-card gw-login-modern-card">
        <div className="gw-login-brand-centered">
          {t('brandName')}
        </div>

        <h2
          style={{
            margin: '0 0 6px',
            fontSize: '23px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary, #111827)',
          }}
        >
          {t('loginTitle')}
        </h2>
        <p
          style={{
            margin: '0 0 22px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            lineHeight: 1.5,
          }}
        >
          {t('loginSubtitle')}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="gw-field" style={{ margin: 0 }}>
            <label className="gw-label" style={{ fontWeight: 700, fontSize: '13px' }}>
              {t('emailLabel')}
            </label>
            <div className="gw-login-input-wrap">
              <span className="gw-login-input-icon" aria-hidden="true">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="name@store.com"
                className="gw-input gw-login-input-padded"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="gw-field" style={{ margin: 0 }}>
            <label className="gw-label" style={{ fontWeight: 700, fontSize: '13px' }}>
              {t('passwordLabel')}
            </label>
            <div className="gw-login-input-wrap">
              <span className="gw-login-input-icon" aria-hidden="true">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="gw-input gw-login-input-padded gw-login-pass-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="gw-login-eye-btn"
                aria-label={
                  showPassword
                    ? lang === 'de'
                      ? 'Passwort verbergen'
                      : 'Hide password'
                    : lang === 'de'
                    ? 'Passwort anzeigen'
                    : 'Show password'
                }
                title={
                  showPassword
                    ? lang === 'de'
                      ? 'Passwort verbergen'
                      : 'Hide password'
                    : lang === 'de'
                    ? 'Passwort anzeigen'
                    : 'Show password'
                }
              >
                {showPassword ? (
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              className="gw-alert gw-alert-error"
              style={{
                marginBottom: 0,
                borderRadius: '12px',
                fontSize: '13.5px',
                fontWeight: 600,
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="gw-btn gw-btn-primary gw-login-submit-btn"
          >
            {loading ? (
              <span className="gw-login-spinner" aria-label="Loading" />
            ) : (
              t('loginButton')
            )}
          </button>
        </form>

        <div className="gw-login-lang-footer">
          <LanguageToggleButton />
        </div>
      </div>
    </div>
  );
}