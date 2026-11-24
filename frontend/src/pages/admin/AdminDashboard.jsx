import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageToggleButton from '../../components/LanguageToggleButton';

// Platform admin workspace for managing stores and additional platform admins
export default function AdminDashboard() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('stores');
  const [stores, setStores] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Store creation form state
  const [storeName, setStoreName] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [storePassword, setStorePassword] = useState('');

  // Additional admin creation form state
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const loadData = async () => {
    setErrorMsg('');
    try {
      const [storesRes, adminsRes] = await Promise.all([
        apiClient.get('/admin/stores'),
        apiClient.get('/admin/admins'),
      ]);
      setStores(storesRes.data.stores || []);
      setAdmins(adminsRes.data.admins || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to load admin data');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateStore = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');
    try {
      await apiClient.post('/admin/stores', {
        name: storeName,
        email: storeEmail,
        password: storePassword,
      });
      setStoreName('');
      setStoreEmail('');
      setStorePassword('');
      setMessage('Store account created.');
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to create store');
    }
  };

  const handleToggleStoreStatus = async (store) => {
    setMessage('');
    setErrorMsg('');
    try {
      await apiClient.patch(`/admin/stores/${store.id}/status`, {
        isActive: !store.is_active,
      });
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update store');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');
    try {
      await apiClient.post('/admin/admins', {
        fullName: adminFullName,
        email: adminEmail,
        password: adminPassword,
      });
      setAdminFullName('');
      setAdminEmail('');
      setAdminPassword('');
      setMessage('Platform admin created.');
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to create admin');
    }
  };

  const handleToggleAdminStatus = async (adminItem) => {
    setMessage('');
    setErrorMsg('');
    try {
      await apiClient.patch(`/admin/admins/${adminItem.id}/status`, {
        isActive: !adminItem.is_active,
      });
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update admin');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div>
      <header className="gw-topbar">
        <div className="gw-brand">
          <span>{t('brandName')}</span>
          <span className="gw-brand-badge">{t('adminRoleBadge')}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {user?.fullName} ({user?.email})
          </span>
          <LanguageToggleButton />
          <button type="button" onClick={handleLogout} className="gw-btn gw-btn-sm">
            {t('logout')}
          </button>
        </div>
      </header>

      <main className="gw-container">
        <div className="gw-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('stores')}
            className={`gw-tab ${activeTab === 'stores' ? 'active' : ''}`}
          >
            {t('storesTab')} ({stores.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admins')}
            className={`gw-tab ${activeTab === 'admins' ? 'active' : ''}`}
          >
            {t('adminsTab')} ({admins.length})
          </button>
        </div>

        {message && <div className="gw-alert gw-alert-success">{message}</div>}
        {errorMsg && <div className="gw-alert gw-alert-error">{errorMsg}</div>}

        {activeTab === 'stores' && (
          <>
            <div className="gw-card">
              <h3 className="gw-card-title">{t('createStoreTitle')}</h3>
              <form onSubmit={handleCreateStore} className="gw-form-grid">
                <div className="gw-field">
                  <label className="gw-label">{t('storeNameLabel')}</label>
                  <input
                    type="text"
                    required
                    className="gw-input"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                  />
                </div>
                <div className="gw-field">
                  <label className="gw-label">{t('emailLabel')}</label>
                  <input
                    type="email"
                    required
                    className="gw-input"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                  />
                </div>
                <div className="gw-field">
                  <label className="gw-label">{t('passwordLabel')}</label>
                  <input
                    type="password"
                    required
                    className="gw-input"
                    value={storePassword}
                    onChange={(e) => setStorePassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="gw-btn gw-btn-primary">
                  {t('createStoreButton')}
                </button>
              </form>
            </div>

            <div className="gw-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="gw-table-wrap">
                <table className="gw-table">
                  <thead>
                    <tr>
                      <th>{t('colStore')}</th>
                      <th>{t('colEmail')}</th>
                      <th>{t('colCustomers')}</th>
                      <th>{t('colStatus')}</th>
                      <th>{t('colAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.name}</strong></td>
                        <td>{s.email}</td>
                        <td>{s.customer_count}</td>
                        <td>
                          <span className={`gw-badge ${s.is_active ? 'gw-badge-active' : 'gw-badge-inactive'}`}>
                            {s.is_active ? t('statusActive') : t('statusInactive')}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleToggleStoreStatus(s)}
                            className="gw-btn gw-btn-sm"
                          >
                            {s.is_active ? t('actionDisable') : t('actionEnable')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'admins' && (
          <>
            <div className="gw-card">
              <h3 className="gw-card-title">{t('createAdminTitle')}</h3>
              <form onSubmit={handleCreateAdmin} className="gw-form-grid">
                <div className="gw-field">
                  <label className="gw-label">{t('adminFullNameLabel')}</label>
                  <input
                    type="text"
                    required
                    className="gw-input"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                  />
                </div>
                <div className="gw-field">
                  <label className="gw-label">{t('emailLabel')}</label>
                  <input
                    type="email"
                    required
                    className="gw-input"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
                <div className="gw-field">
                  <label className="gw-label">{t('passwordLabel')}</label>
                  <input
                    type="password"
                    required
                    className="gw-input"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="gw-btn gw-btn-primary">
                  {t('createAdminButton')}
                </button>
              </form>
            </div>

            <div className="gw-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="gw-table-wrap">
                <table className="gw-table">
                  <thead>
                    <tr>
                      <th>{t('colName')}</th>
                      <th>{t('colEmail')}</th>
                      <th>{t('colRole')}</th>
                      <th>{t('colStatus')}</th>
                      <th>{t('colAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((a) => (
                      <tr key={a.id}>
                        <td><strong>{a.full_name}</strong></td>
                        <td>{a.email}</td>
                        <td>
                          <span className="gw-badge gw-badge-neutral">
                            {a.is_owner ? t('roleOwner') : t('roleAdmin')}
                          </span>
                        </td>
                        <td>
                          <span className={`gw-badge ${a.is_active ? 'gw-badge-active' : 'gw-badge-inactive'}`}>
                            {a.is_active ? t('statusActive') : t('statusInactive')}
                          </span>
                        </td>
                        <td>
                          {!a.is_owner && (
                            <button
                              type="button"
                              onClick={() => handleToggleAdminStatus(a)}
                              className="gw-btn gw-btn-sm"
                            >
                              {a.is_active ? t('actionDisable') : t('actionEnable')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}