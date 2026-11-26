import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageToggleButton from '../../components/LanguageToggleButton';
import { resetViewportZoom } from '../../utils/viewport';

// Platform admin workspace for managing stores and additional platform admins
export default function AdminDashboard() {
  const { t, lang } = useLanguage();
  const { user, token, loginSuccess, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(() => {
    const returnTab = sessionStorage.getItem('gw_admin_return_tab');
    if (returnTab) {
      sessionStorage.removeItem('gw_admin_return_tab');
      return returnTab;
    }
    const nextTab = sessionStorage.getItem('gw_admin_next_tab');
    if (nextTab) {
      sessionStorage.removeItem('gw_admin_next_tab');
      return nextTab;
    }
    return 'overview';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [logoutBtnHovered, setLogoutBtnHovered] = useState(false);

  const [stores, setStores] = useState([]);
  const [storeSearch, setStoreSearch] = useState('');
  const [admins, setAdmins] = useState([]);
  const [overviewStats, setOverviewStats] = useState({
    totalOffers: 0,
    activeOffers: 0,
    totalRedemptions: 0,
    topStores: [],
  });

  const [message, setMessage] = useState('');
  const [messageClosing, setMessageClosing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorClosing, setErrorClosing] = useState(false);

  // Store creation form state
  const [storeName, setStoreName] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [storePassword, setStorePassword] = useState('');

  // Store edit modal state
  const [editingStore, setEditingStore] = useState(null);
  const [editStoreName, setEditStoreName] = useState('');
  const [editStoreEmail, setEditStoreEmail] = useState('');
  const [editStorePassword, setEditStorePassword] = useState('');
  const [savingStoreEdit, setSavingStoreEdit] = useState(false);

  // Additional admin creation form state
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Admin edit modal state
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editAdminFullName, setEditAdminFullName] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [savingAdminEdit, setSavingAdminEdit] = useState(false);

  const messageTimerRef = useRef(null);
  const errorTimerRef = useRef(null);

  const isLeftOpen = !sidebarCollapsed;

  const dismissMessage = () => {
    if (!message || messageClosing) return;
    setMessageClosing(true);
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => {
      setMessage('');
      setMessageClosing(false);
    }, 350);
  };

  const dismissError = () => {
    if (!errorMsg || errorClosing) return;
    setErrorClosing(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setErrorMsg('');
      setErrorClosing(false);
    }, 350);
  };

  useEffect(() => {
    if (!message) {
      setMessageClosing(false);
      return;
    }
    setMessageClosing(false);
    const timer = setTimeout(() => dismissMessage(), 8000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!errorMsg) {
      setErrorClosing(false);
      return;
    }
    setErrorClosing(false);
    const timer = setTimeout(() => dismissError(), 8000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const loadData = async () => {
    setErrorMsg('');

    const [storesResult, adminsResult, overviewResult] = await Promise.allSettled([
      apiClient.get('/admin/stores'),
      apiClient.get('/admin/admins'),
      apiClient.get('/admin/overview'),
    ]);

    const errors = [];
    let loadedStores = [];

    if (storesResult.status === 'fulfilled') {
      const payload = storesResult.value.data;
      const list = Array.isArray(payload)
        ? payload
        : payload?.stores || payload?.data || [];
      loadedStores = Array.isArray(list) ? list : [];
      setStores(loadedStores);
    } else {
      const err = storesResult.reason;
      errors.push(
        err?.response?.data?.error ||
          err?.message ||
          'Failed to load stores'
      );
    }

    if (adminsResult.status === 'fulfilled') {
      const payload = adminsResult.value.data;
      const list = Array.isArray(payload)
        ? payload
        : payload?.admins || payload?.data || [];
      setAdmins(Array.isArray(list) ? list : []);
    } else {
      const err = adminsResult.reason;
      errors.push(
        err?.response?.data?.error ||
          err?.message ||
          'Failed to load admins'
      );
    }

    if (overviewResult.status === 'fulfilled') {
      const data = overviewResult.value.data || {};
      setOverviewStats({
        totalOffers: Number(data.totalOffers ?? data.total_offers ?? 0),
        activeOffers: Number(data.activeOffers ?? data.active_offers ?? 0),
        totalRedemptions: Number(
          data.totalRedemptions ?? data.total_redemptions ?? 0
        ),
        topStores: Array.isArray(data.topStores ?? data.top_stores)
          ? data.topStores ?? data.top_stores
          : [],
      });
    } else if (loadedStores.length > 0) {
      const fallbackTop = [...loadedStores]
        .sort(
          (a, b) =>
            Number(b.customer_count ?? 0) - Number(a.customer_count ?? 0)
        )
        .slice(0, 5)
        .map((s) => ({
          ...s,
          redemptions_count: Number(s.redemptions_count ?? 0),
        }));
      setOverviewStats((prev) => ({
        ...prev,
        topStores: fallbackTop,
      }));
    }

    if (errors.length > 0) {
      setErrorMsg(errors.join(' | '));
    }
  };

  useEffect(() => {
    resetViewportZoom();
    const timer = setTimeout(() => resetViewportZoom(), 180);
    loadData();
    return () => clearTimeout(timer);
  }, []);

  const handleCreateStore = async (e) => {
    e.preventDefault();
    resetViewportZoom();
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
    } finally {
      resetViewportZoom();
    }
  };

  const handleViewStore = async (store) => {
    resetViewportZoom();
    setMessage('');
    setErrorMsg('');

    const currentAdminToken = token || localStorage.getItem('gw_token');
    const currentAdminUser =
      user ||
      (() => {
        try {
          const raw = localStorage.getItem('gw_user');
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

    if (currentAdminToken && currentAdminUser) {
      localStorage.setItem(
        'gw_admin_impersonation',
        JSON.stringify({
          token: currentAdminToken,
          user: currentAdminUser,
        })
      );
    }

    let storeToken = null;
    try {
      const impersonateRes = await apiClient.post(
        `/admin/stores/${store.id}/impersonate`
      );
      storeToken = impersonateRes.data?.token || null;
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.error || 'Failed to open store dashboard'
      );
      return;
    }

    if (!storeToken) {
      setErrorMsg('Failed to issue store session token');
      return;
    }

    sessionStorage.setItem('gw_admin_return_tab', activeTab);

    const storeUser = {
      id: store.id,
      storeId: store.id,
      store_id: store.id,
      name: store.name,
      storeName: store.name,
      email: store.email,
      role: 'STORE',
      impersonatedByAdmin: true,
    };

    loginSuccess({
      token: storeToken,
      user: storeUser,
    });

    navigate('/store');
    setTimeout(() => resetViewportZoom(), 150);
  };

  const handleToggleStoreStatus = async (store) => {
    resetViewportZoom();
    setMessage('');
    setErrorMsg('');
    try {
      await apiClient.patch(`/admin/stores/${store.id}/status`, {
        isActive: !store.is_active,
      });
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update store');
    } finally {
      resetViewportZoom();
    }
  };

  const openEditStoreModal = (store) => {
    resetViewportZoom();
    setMessage('');
    setErrorMsg('');
    setEditingStore(store);
    setEditStoreName(store.name || '');
    setEditStoreEmail(store.email || '');
    setEditStorePassword('');
  };

  const closeEditStoreModal = () => {
    setEditingStore(null);
    setEditStoreName('');
    setEditStoreEmail('');
    setEditStorePassword('');
  };

  const handleSaveStoreEdit = async (e) => {
    e.preventDefault();
    if (!editingStore) return;
    resetViewportZoom();
    setMessage('');
    setErrorMsg('');
    setSavingStoreEdit(true);

    const payload = {
      name: editStoreName,
      email: editStoreEmail,
    };
    if (editStorePassword.trim()) {
      payload.password = editStorePassword;
    }

    try {
      await apiClient.patch(`/admin/stores/${editingStore.id}`, payload);
      setMessage('Store updated.');
      closeEditStoreModal();
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update store');
    } finally {
      setSavingStoreEdit(false);
      resetViewportZoom();
    }
  };

  const handleDeleteStore = async (store) => {
    resetViewportZoom();
    const confirmText =
      lang === 'de'
        ? `Möchten Sie das Geschäft "${store.name}" wirklich löschen?`
        : `Are you sure you want to delete "${store.name}"?`;
    if (!window.confirm(confirmText)) return;

    setMessage('');
    setErrorMsg('');
    try {
      await apiClient.delete(`/admin/stores/${store.id}`);
      setMessage('Store deleted.');
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to delete store');
    } finally {
      resetViewportZoom();
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    resetViewportZoom();
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
    } finally {
      resetViewportZoom();
    }
  };

  const openEditAdminModal = (adminItem) => {
    resetViewportZoom();
    setMessage('');
    setErrorMsg('');
    setEditingAdmin(adminItem);
    setEditAdminFullName(adminItem.full_name || '');
    setEditAdminEmail(adminItem.email || '');
    setEditAdminPassword('');
  };

  const closeEditAdminModal = () => {
    setEditingAdmin(null);
    setEditAdminFullName('');
    setEditAdminEmail('');
    setEditAdminPassword('');
  };

  const handleSaveAdminEdit = async (e) => {
    e.preventDefault();
    if (!editingAdmin) return;
    resetViewportZoom();
    setMessage('');
    setErrorMsg('');
    setSavingAdminEdit(true);

    const payload = {
      fullName: editAdminFullName,
      email: editAdminEmail,
    };
    if (editAdminPassword.trim()) {
      payload.password = editAdminPassword;
    }

    try {
      await apiClient.patch(`/admin/admins/${editingAdmin.id}`, payload);
      setMessage('Admin updated.');
      closeEditAdminModal();
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update admin');
    } finally {
      setSavingAdminEdit(false);
      resetViewportZoom();
    }
  };

  const handleToggleAdminStatus = async (adminItem) => {
    resetViewportZoom();
    setMessage('');
    setErrorMsg('');
    try {
      await apiClient.patch(`/admin/admins/${adminItem.id}/status`, {
        isActive: !adminItem.is_active,
      });
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update admin');
    } finally {
      resetViewportZoom();
    }
  };

  const handleDeleteAdmin = async (adminItem) => {
    resetViewportZoom();
    const confirmText =
      lang === 'de'
        ? `Möchten Sie den Admin "${adminItem.full_name}" wirklich löschen?`
        : `Are you sure you want to delete admin "${adminItem.full_name}"?`;
    if (!window.confirm(confirmText)) return;

    setMessage('');
    setErrorMsg('');
    try {
      await apiClient.delete(`/admin/admins/${adminItem.id}`);
      setMessage('Admin deleted.');
      await loadData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to delete admin');
    } finally {
      resetViewportZoom();
    }
  };

  const handleLogout = () => {
    resetViewportZoom();
    localStorage.removeItem('gw_admin_impersonation');
    logout();
    navigate('/login');
  };

  const handleToggleSidebar = () => {
    resetViewportZoom();
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (!next && window.innerWidth <= 768) {
        setProfileDrawerOpen(false);
      }
      return next;
    });
  };

  const handleToggleProfileDrawer = () => {
    resetViewportZoom();
    setProfileDrawerOpen((prev) => {
      const next = !prev;
      if (next && window.innerWidth <= 768) {
        setSidebarCollapsed(true);
      }
      return next;
    });
  };

  const selectCategory = (tab) => {
    resetViewportZoom();
    setActiveTab(tab);
    if (tab === 'overview') {
      loadData();
    }
    if (window.innerWidth <= 768) {
      setSidebarCollapsed(true);
    }
    setTimeout(() => resetViewportZoom(), 120);
  };

  const adminDisplayName =
    user?.fullName || user?.full_name || user?.name || '';
  const adminRoleLabel = t('adminRoleBadge') || user?.role || 'ADMIN';

  const registeredStoresCount = stores.length;
  const registeredCustomersCount = stores.reduce(
    (sum, s) => sum + Number(s.customer_count ?? s.customers_count ?? 0),
    0
  );

  const sortedStores = [...stores]
    .filter((s) => {
      const query = storeSearch.trim().toLowerCase();
      if (!query) return true;
      return String(s.name || '').toLowerCase().includes(query);
    })
    .sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, {
        sensitivity: 'base',
      })
    );

  const overviewCards = [
    {
      key: 'registered-stores',
      label: lang === 'de' ? 'Registrierte Geschäfte' : 'Registered Stores',
      value: registeredStoresCount,
      accent: '#7c3aed',
      tint: 'rgba(124, 58, 237, 0.08)',
      icon: '🏪',
    },
    {
      key: 'registered-customers',
      label: lang === 'de' ? 'Registrierte Kunden' : 'Registered Customers',
      value: registeredCustomersCount,
      accent: '#059669',
      tint: 'rgba(5, 150, 105, 0.08)',
      icon: '👥',
    },
    {
      key: 'total-offers',
      label:
        lang === 'de'
          ? 'Angebote / Prämien gesamt'
          : 'Total Rewards / Offers',
      value: overviewStats.totalOffers,
      accent: '#2563eb',
      tint: 'rgba(37, 99, 235, 0.08)',
      icon: '🎁',
    },
    {
      key: 'total-redemptions',
      label: lang === 'de' ? 'Einlösungen gesamt' : 'Total Redemptions',
      value: overviewStats.totalRedemptions,
      accent: '#9333ea',
      tint: 'rgba(147, 51, 234, 0.08)',
      icon: '🎟',
    },
  ];

  const topStores =
    overviewStats.topStores.length > 0
      ? overviewStats.topStores
      : [...stores]
          .sort(
            (a, b) =>
              Number(b.customer_count ?? 0) - Number(a.customer_count ?? 0)
          )
          .slice(0, 5);

  const actionBtnBaseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '7px 11px',
    borderRadius: '10px',
    fontSize: '12.5px',
    fontWeight: 700,
    lineHeight: 1.2,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'transform 0.14s ease, box-shadow 0.14s ease, background-color 0.14s ease',
  };

  const renderAdminActions = (a) => (
    <div className="gw-mobile-card-actions">
      <button
        type="button"
        onClick={() => openEditAdminModal(a)}
        className="gw-store-action-btn"
        style={{
          ...actionBtnBaseStyle,
          backgroundColor: '#f3e8ff',
          color: '#6d28d9',
          border: '1px solid #ddd6fe',
        }}
      >
        <span aria-hidden="true">✎</span>
        <span>{lang === 'de' ? 'Bearbeiten' : 'Edit'}</span>
      </button>

      {!a.is_owner && (
        <>
          <button
            type="button"
            onClick={() => handleToggleAdminStatus(a)}
            className="gw-store-action-btn"
            style={{
              ...actionBtnBaseStyle,
              backgroundColor: a.is_active ? '#fee2e2' : '#dcfce7',
              color: a.is_active ? '#991b1b' : '#166534',
              border: `1px solid ${a.is_active ? '#fecaca' : '#bbf7d0'}`,
            }}
          >
            <span>{a.is_active ? t('actionDisable') : t('actionEnable')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleDeleteAdmin(a)}
            className="gw-store-action-btn"
            style={{
              ...actionBtnBaseStyle,
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fecaca',
            }}
          >
            <span aria-hidden="true">🗑</span>
            <span>{lang === 'de' ? 'Löschen' : 'Delete'}</span>
          </button>
        </>
      )}
    </div>
  );

  const renderStoreActions = (s) => (
    <div className="gw-mobile-card-actions">
      <button
        type="button"
        onClick={() => handleViewStore(s)}
        className="gw-store-action-btn"
        style={{
          ...actionBtnBaseStyle,
          backgroundColor: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe',
        }}
      >
        <span aria-hidden="true">👁</span>
        <span>{lang === 'de' ? 'Ansehen' : 'View'}</span>
      </button>

      <button
        type="button"
        onClick={() => handleToggleStoreStatus(s)}
        className="gw-store-action-btn"
        style={{
          ...actionBtnBaseStyle,
          backgroundColor: s.is_active ? '#fee2e2' : '#dcfce7',
          color: s.is_active ? '#991b1b' : '#166534',
          border: `1px solid ${s.is_active ? '#fecaca' : '#bbf7d0'}`,
        }}
      >
        <span>{s.is_active ? t('actionDisable') : t('actionEnable')}</span>
      </button>

      <button
        type="button"
        onClick={() => openEditStoreModal(s)}
        className="gw-store-action-btn"
        style={{
          ...actionBtnBaseStyle,
          backgroundColor: '#f3e8ff',
          color: '#6d28d9',
          border: '1px solid #ddd6fe',
        }}
      >
        <span aria-hidden="true">✎</span>
        <span>{lang === 'de' ? 'Bearbeiten' : 'Edit'}</span>
      </button>

      <button
        type="button"
        onClick={() => handleDeleteStore(s)}
        className="gw-store-action-btn"
        style={{
          ...actionBtnBaseStyle,
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fecaca',
        }}
      >
        <span aria-hidden="true">🗑</span>
        <span>{lang === 'de' ? 'Löschen' : 'Delete'}</span>
      </button>
    </div>
  );

  return (
    <div>
      <style>{`
        @keyframes gwAdminFadeIn {
          0% {
            opacity: 0;
            transform: translate3d(0, 8px, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        @keyframes gwAdminFadeOut {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
          100% {
            opacity: 0;
            transform: translate3d(0, -12px, 0);
          }
        }
        .gw-admin-enter {
          animation: gwAdminFadeIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .gw-admin-leave {
          animation: gwAdminFadeOut 0.35s cubic-bezier(0.4, 0, 1, 1) forwards;
          pointer-events: none;
        }
        .gw-main,
        .gw-container {
          min-width: 0;
        }
        .gw-store-action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
        }
        .gw-aligned-table-wrap {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }
        .gw-aligned-table {
          width: 100%;
          max-width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .gw-aligned-table th,
        .gw-aligned-table td {
          vertical-align: middle;
          padding: 14px 12px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gw-aligned-table th {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-align: left;
        }
        .gw-aligned-table td {
          font-size: 13.5px;
          text-align: left;
        }
        .gw-aligned-table th:last-child,
        .gw-aligned-table td:last-child {
          text-align: right;
          overflow: visible;
        }
        .gw-aligned-actions,
        .gw-mobile-card-actions {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          flex-wrap: nowrap;
        }
        .gw-mobile-list {
          display: none;
        }

        @media (max-width: 768px) {
          .gw-desktop-table-card {
            display: none !important;
          }
          .gw-mobile-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
            width: 100%;
          }
          .gw-mobile-entity-card {
            background: #ffffff;
            border: 1px solid var(--border-color, #e5e7eb);
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
            box-sizing: border-box;
          }
          .gw-mobile-entity-title {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-primary, #111827);
            word-break: break-word;
          }
          .gw-mobile-entity-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding-top: 10px;
            border-top: 1px solid rgba(15, 23, 42, 0.06);
            font-size: 13.5px;
          }
          .gw-mobile-entity-sub {
            color: var(--text-secondary, #6b7280);
            font-size: 13px;
            word-break: break-word;
          }
          .gw-mobile-card-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            flex-wrap: wrap;
            padding-top: 12px;
            border-top: 1px solid rgba(15, 23, 42, 0.06);
            width: 100%;
          }
          .gw-mobile-card-actions .gw-store-action-btn {
            flex: 1 1 auto;
            min-width: 0;
          }
        }
      `}</style>

      <button
        type="button"
        onClick={handleToggleSidebar}
        className={`gw-topbar-btn gw-menu-toggle-btn ${isLeftOpen ? 'panel-open' : ''}`}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      <button
        type="button"
        onClick={handleToggleProfileDrawer}
        className={`gw-topbar-btn gw-profile-toggle-btn ${
          profileDrawerOpen ? 'panel-open' : ''
        }`}
        aria-label="Profile"
        title="Profile"
      >
        👤
      </button>

      <header
        className={`gw-topbar ${isLeftOpen ? 'left-panel-open' : ''} ${
          profileDrawerOpen ? 'right-panel-open' : ''
        }`}
      >
        <div className="gw-topbar-slot" />
        <div className="gw-brand-center">{t('brandName')}</div>
        <div className="gw-topbar-slot" />
      </header>

      {!sidebarCollapsed && (
        <div
          className="gw-sidebar-backdrop"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {profileDrawerOpen && (
        <div
          className="gw-profile-backdrop"
          onClick={() => setProfileDrawerOpen(false)}
        />
      )}

      {/* Right Profile Drawer (Admin Details) */}
      <aside
        className={`gw-profile-drawer ${profileDrawerOpen ? 'open' : ''}`}
        aria-hidden={!profileDrawerOpen}
      >
        <div className="gw-drawer-scroll">
          <div className="gw-profile-drawer-header">
            <span>{lang === 'de' ? 'Profil' : 'Profile'}</span>
          </div>

          <div className="gw-profile-details" style={{ gap: '14px' }}>
            <div
              className="gw-profile-box"
              style={{
                background: 'rgba(24, 24, 27, 0.14)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: '14px',
                padding: '12px 14px',
              }}
            >
              <div
                className="gw-profile-label"
                style={{ letterSpacing: '0.08em', fontSize: '11px' }}
              >
                {lang === 'de' ? 'Rolle' : 'Role'}
              </div>
              <div
                className="gw-profile-value"
                style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}
              >
                {adminRoleLabel}
              </div>
            </div>

            {adminDisplayName && (
              <div
                className="gw-profile-box"
                style={{
                  background: 'rgba(24, 24, 27, 0.14)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                }}
              >
                <div
                  className="gw-profile-label"
                  style={{ letterSpacing: '0.08em', fontSize: '11px' }}
                >
                  {t('colName') || 'Name'}
                </div>
                <div
                  className="gw-profile-value"
                  style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}
                >
                  {adminDisplayName}
                </div>
              </div>
            )}

            {user?.email && (
              <div
                className="gw-profile-box"
                style={{
                  background: 'rgba(24, 24, 27, 0.14)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                }}
              >
                <div
                  className="gw-profile-label"
                  style={{ letterSpacing: '0.08em', fontSize: '11px' }}
                >
                  Email
                </div>
                <div
                  className="gw-profile-value"
                  style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}
                >
                  {user.email}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setProfileDrawerOpen(false);
            handleLogout();
          }}
          onMouseEnter={() => setLogoutBtnHovered(true)}
          onMouseLeave={() => setLogoutBtnHovered(false)}
          className="gw-btn"
          style={{
            width: '100%',
            backgroundColor: logoutBtnHovered ? '#991b1b' : '#b91c1c',
            borderColor: logoutBtnHovered ? '#991b1b' : '#b91c1c',
            color: '#fdf4f5',
            fontWeight: 700,
            transition: 'all 0.2s ease',
          }}
        >
          {t('logout')}
        </button>
      </aside>

      {/* Layout with Left Sidebar Drawer + Main Content */}
      <div className="gw-layout">
        <aside className={`gw-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="gw-drawer-scroll">
            <div className="gw-sidebar-header">Menu</div>

            <nav className="gw-sidebar-nav">
              <button
                type="button"
                onClick={() => selectCategory('overview')}
                className={`gw-nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
              >
                <span className="gw-nav-icon">◈</span>
                <span className="gw-nav-label">
                  {lang === 'de' ? 'Übersicht' : 'Overview'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectCategory('admins')}
                className={`gw-nav-btn ${activeTab === 'admins' ? 'active' : ''}`}
              >
                <span className="gw-nav-icon">★</span>
                <span className="gw-nav-label">
                  {t('adminsTab')} ({admins.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectCategory('stores')}
                className={`gw-nav-btn ${activeTab === 'stores' ? 'active' : ''}`}
              >
                <span className="gw-nav-icon">🏪</span>
                <span className="gw-nav-label">
                  {t('storesTab')} ({stores.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectCategory('settings')}
                className={`gw-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
              >
                <span className="gw-nav-icon">⚙</span>
                <span className="gw-nav-label">
                  {lang === 'de' ? 'Einstellungen' : 'Settings'}
                </span>
              </button>
            </nav>
          </div>
        </aside>

        <main
          className={`gw-main ${!sidebarCollapsed ? 'left-open' : ''} ${
            profileDrawerOpen ? 'right-open' : ''
          }`}
        >
          <div className="gw-container">
            {message && (
              <div
                key={`msg-${message}`}
                className={`gw-alert gw-alert-success ${
                  messageClosing ? 'gw-admin-leave' : 'gw-admin-enter'
                }`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <span>{message}</span>
                <button
                  type="button"
                  onClick={dismissMessage}
                  aria-label="Close notification"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    fontSize: '18px',
                    lineHeight: 1,
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontWeight: 700,
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {errorMsg && (
              <div
                key={`err-${errorMsg}`}
                className={`gw-alert gw-alert-error ${
                  errorClosing ? 'gw-admin-leave' : 'gw-admin-enter'
                }`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={dismissError}
                  aria-label="Close error notification"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    fontSize: '18px',
                    lineHeight: 1,
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontWeight: 700,
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {activeTab === 'overview' && (
              <div key="tab-overview" className="gw-admin-enter">
                <div
                  className="gw-card"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(124, 58, 237, 0.06) 0%, rgba(255, 255, 255, 0.96) 55%)',
                    borderColor: 'rgba(124, 58, 237, 0.16)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '22px',
                    }}
                  >
                    <div>
                      <h3 className="gw-card-title" style={{ margin: 0, fontSize: '20px' }}>
                        {lang === 'de' ? 'Übersicht' : 'Overview'}
                      </h3>
                      <p
                        style={{
                          margin: '5px 0 0',
                          fontSize: '14px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {lang === 'de'
                          ? 'Live-Kennzahlen Ihrer Plattform und registrierten Geschäfte'
                          : 'Live snapshot of your platform and registered stores'}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {overviewCards.map((item) => (
                      <div
                        key={item.key}
                        style={{
                          padding: '18px',
                          borderRadius: '14px',
                          background: '#ffffff',
                          border: '1px solid var(--border-color, #e5e7eb)',
                          borderTop: `3px solid ${item.accent}`,
                          boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          textAlign: 'left',
                          width: '100%',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {item.label}
                          </span>
                          <span
                            aria-hidden="true"
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '9px',
                              background: item.tint,
                              color: item.accent,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 700,
                            }}
                          >
                            {item.icon}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: '28px',
                            fontWeight: 800,
                            lineHeight: 1.1,
                            color: 'var(--text-primary, #111827)',
                          }}
                        >
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Stores Section */}
                <div className="gw-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      marginBottom: '14px',
                    }}
                  >
                    <h3 className="gw-card-title" style={{ margin: 0 }}>
                      {lang === 'de' ? 'Top-Geschäfte' : 'Top Stores'}
                    </h3>
                  </div>

                  {topStores.length === 0 ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {lang === 'de'
                        ? 'Noch keine Geschäfte vorhanden.'
                        : 'No stores available yet.'}
                    </p>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div
                        className="gw-desktop-table-card"
                        style={{
                          border: '1px solid var(--border-color, #e5e7eb)',
                          borderRadius: '14px',
                          overflow: 'hidden',
                        }}
                      >
                        <div className="gw-aligned-table-wrap">
                          <table className="gw-table gw-aligned-table">
                            <colgroup>
                              <col style={{ width: '24%' }} />
                              <col style={{ width: '26%' }} />
                              <col style={{ width: '15%' }} />
                              <col style={{ width: '17%' }} />
                              <col style={{ width: '18%' }} />
                            </colgroup>
                            <thead>
                              <tr>
                                <th>{t('colStore')}</th>
                                <th>{t('colEmail')}</th>
                                <th>{t('colCustomers')}</th>
                                <th>
                                  {lang === 'de' ? 'Einlösungen' : 'Redemptions'}
                                </th>
                                <th>{t('colAction')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topStores.map((st, idx) => (
                                <tr key={st.id} className="gw-table-row">
                                  <td title={st.name}>
                                    <span
                                      style={{
                                        color: 'var(--text-secondary)',
                                        fontWeight: 700,
                                        marginRight: '6px',
                                      }}
                                    >
                                      #{idx + 1}
                                    </span>
                                    <strong>{st.name}</strong>
                                  </td>
                                  <td title={st.email}>{st.email}</td>
                                  <td>{Number(st.customer_count ?? 0)}</td>
                                  <td>{Number(st.redemptions_count ?? 0)}</td>
                                  <td>
                                    <div className="gw-aligned-actions">
                                      <button
                                        type="button"
                                        onClick={() => handleViewStore(st)}
                                        className="gw-store-action-btn"
                                        style={{
                                          ...actionBtnBaseStyle,
                                          backgroundColor: '#eff6ff',
                                          color: '#1d4ed8',
                                          border: '1px solid #bfdbfe',
                                        }}
                                      >
                                        <span aria-hidden="true">👁</span>
                                        <span>
                                          {lang === 'de' ? 'Ansehen' : 'View'}
                                        </span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Mobile Cards */}
                      <div className="gw-mobile-list">
                        {topStores.map((st, idx) => (
                          <div key={st.id} className="gw-mobile-entity-card">
                            <div>
                              <div className="gw-mobile-entity-title">
                                #{idx + 1} {st.name}
                              </div>
                              <div className="gw-mobile-entity-sub">
                                {st.email}
                              </div>
                            </div>

                            <div className="gw-mobile-entity-row">
                              <span style={{ fontWeight: 600 }}>
                                {t('colCustomers')}:{' '}
                                {Number(st.customer_count ?? 0)}
                              </span>
                              <span style={{ fontWeight: 600 }}>
                                {lang === 'de' ? 'Einlösungen' : 'Redemptions'}:{' '}
                                {Number(st.redemptions_count ?? 0)}
                              </span>
                            </div>

                            <div className="gw-mobile-card-actions">
                              <button
                                type="button"
                                onClick={() => handleViewStore(st)}
                                className="gw-store-action-btn"
                                style={{
                                  ...actionBtnBaseStyle,
                                  backgroundColor: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                }}
                              >
                                <span aria-hidden="true">👁</span>
                                <span>
                                  {lang === 'de' ? 'Ansehen' : 'View'}
                                </span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'admins' && (
              <div key="tab-admins" className="gw-admin-enter">
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

                {/* Desktop Table */}
                <div
                  className="gw-card gw-desktop-table-card"
                  style={{ padding: 0, overflow: 'hidden' }}
                >
                  <div className="gw-aligned-table-wrap">
                    <table className="gw-table gw-aligned-table">
                      <colgroup>
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '33%' }} />
                      </colgroup>
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
                          <tr key={a.id} className="gw-table-row">
                            <td title={a.full_name}><strong>{a.full_name}</strong></td>
                            <td title={a.email}>{a.email}</td>
                            <td>
                              <span className="gw-badge gw-badge-neutral">
                                {a.is_owner ? t('roleOwner') : t('roleAdmin')}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`gw-badge ${
                                  a.is_active ? 'gw-badge-active' : 'gw-badge-inactive'
                                }`}
                              >
                                {a.is_active ? t('statusActive') : t('statusInactive')}
                              </span>
                            </td>
                            <td>
                              <div className="gw-aligned-actions">
                                <button
                                  type="button"
                                  onClick={() => openEditAdminModal(a)}
                                  className="gw-store-action-btn"
                                  style={{
                                    ...actionBtnBaseStyle,
                                    backgroundColor: '#f3e8ff',
                                    color: '#6d28d9',
                                    border: '1px solid #ddd6fe',
                                  }}
                                >
                                  <span aria-hidden="true">✎</span>
                                  <span>{lang === 'de' ? 'Bearbeiten' : 'Edit'}</span>
                                </button>

                                {!a.is_owner && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAdminStatus(a)}
                                      className="gw-store-action-btn"
                                      style={{
                                        ...actionBtnBaseStyle,
                                        backgroundColor: a.is_active ? '#fee2e2' : '#dcfce7',
                                        color: a.is_active ? '#991b1b' : '#166534',
                                        border: `1px solid ${
                                          a.is_active ? '#fecaca' : '#bbf7d0'
                                        }`,
                                      }}
                                    >
                                      <span>
                                        {a.is_active ? t('actionDisable') : t('actionEnable')}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAdmin(a)}
                                      className="gw-store-action-btn"
                                      style={{
                                        ...actionBtnBaseStyle,
                                        backgroundColor: '#fee2e2',
                                        color: '#991b1b',
                                        border: '1px solid #fecaca',
                                      }}
                                    >
                                      <span aria-hidden="true">🗑</span>
                                      <span>{lang === 'de' ? 'Löschen' : 'Delete'}</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Cards */}
                <div className="gw-mobile-list">
                  {admins.map((a) => (
                    <div key={a.id} className="gw-mobile-entity-card">
                      <div>
                        <div className="gw-mobile-entity-title">{a.full_name}</div>
                        <div className="gw-mobile-entity-sub">{a.email}</div>
                      </div>

                      <div className="gw-mobile-entity-row">
                        <span className="gw-badge gw-badge-neutral">
                          {a.is_owner ? t('roleOwner') : t('roleAdmin')}
                        </span>
                        <span
                          className={`gw-badge ${
                            a.is_active ? 'gw-badge-active' : 'gw-badge-inactive'
                          }`}
                        >
                          {a.is_active ? t('statusActive') : t('statusInactive')}
                        </span>
                      </div>

                      {renderAdminActions(a)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'stores' && (
              <div key="tab-stores" className="gw-admin-enter">
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

                {/* Store Name Search Bar */}
                <div className="gw-card" style={{ marginBottom: '16px' }}>
                  <div className="gw-field" style={{ margin: 0 }}>
                    <input
                      type="text"
                      className="gw-input"
                      placeholder={
                        lang === 'de'
                          ? 'Geschäft nach Namen suchen...'
                          : 'Search store by name...'
                      }
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                    />
                  </div>
                </div>

                {sortedStores.length === 0 ? (
                  <div className="gw-card">
                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {lang === 'de'
                        ? 'Keine passenden Geschäfte gefunden.'
                        : 'No matching stores found.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div
                      className="gw-card gw-desktop-table-card"
                      style={{ padding: 0, overflow: 'hidden' }}
                    >
                      <div className="gw-aligned-table-wrap">
                        <table className="gw-table gw-aligned-table">
                          <colgroup>
                            <col style={{ width: '15%' }} />
                            <col style={{ width: '23%' }} />
                            <col style={{ width: '11%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '39%' }} />
                          </colgroup>
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
                            {sortedStores.map((s) => (
                              <tr key={s.id} className="gw-table-row">
                                <td title={s.name}><strong>{s.name}</strong></td>
                                <td title={s.email}>{s.email}</td>
                                <td>{s.customer_count}</td>
                                <td>
                                  <span
                                    className={`gw-badge ${
                                      s.is_active ? 'gw-badge-active' : 'gw-badge-inactive'
                                    }`}
                                  >
                                    {s.is_active ? t('statusActive') : t('statusInactive')}
                                  </span>
                                </td>
                                <td>
                                  <div className="gw-aligned-actions">
                                    <button
                                      type="button"
                                      onClick={() => handleViewStore(s)}
                                      className="gw-store-action-btn"
                                      style={{
                                        ...actionBtnBaseStyle,
                                        backgroundColor: '#eff6ff',
                                        color: '#1d4ed8',
                                        border: '1px solid #bfdbfe',
                                      }}
                                    >
                                      <span aria-hidden="true">👁</span>
                                      <span>{lang === 'de' ? 'Ansehen' : 'View'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleStoreStatus(s)}
                                      className="gw-store-action-btn"
                                      style={{
                                        ...actionBtnBaseStyle,
                                        backgroundColor: s.is_active ? '#fee2e2' : '#dcfce7',
                                        color: s.is_active ? '#991b1b' : '#166534',
                                        border: `1px solid ${
                                          s.is_active ? '#fecaca' : '#bbf7d0'
                                        }`,
                                      }}
                                    >
                                      <span>
                                        {s.is_active ? t('actionDisable') : t('actionEnable')}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openEditStoreModal(s)}
                                      className="gw-store-action-btn"
                                      style={{
                                        ...actionBtnBaseStyle,
                                        backgroundColor: '#f3e8ff',
                                        color: '#6d28d9',
                                        border: '1px solid #ddd6fe',
                                      }}
                                    >
                                      <span aria-hidden="true">✎</span>
                                      <span>{lang === 'de' ? 'Bearbeiten' : 'Edit'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStore(s)}
                                      className="gw-store-action-btn"
                                      style={{
                                        ...actionBtnBaseStyle,
                                        backgroundColor: '#fee2e2',
                                        color: '#991b1b',
                                        border: '1px solid #fecaca',
                                      }}
                                    >
                                      <span aria-hidden="true">🗑</span>
                                      <span>{lang === 'de' ? 'Löschen' : 'Delete'}</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="gw-mobile-list">
                      {sortedStores.map((s) => (
                        <div key={s.id} className="gw-mobile-entity-card">
                          <div>
                            <div className="gw-mobile-entity-title">{s.name}</div>
                            <div className="gw-mobile-entity-sub">{s.email}</div>
                          </div>

                          <div className="gw-mobile-entity-row">
                            <span style={{ fontWeight: 600 }}>
                              {t('colCustomers')}: {s.customer_count}
                            </span>
                            <span
                              className={`gw-badge ${
                                s.is_active ? 'gw-badge-active' : 'gw-badge-inactive'
                              }`}
                            >
                              {s.is_active ? t('statusActive') : t('statusInactive')}
                            </span>
                          </div>

                          {renderStoreActions(s)}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div key="tab-settings" className="gw-admin-enter">
                <div className="gw-card">
                  <h3 className="gw-card-title">
                    {lang === 'de' ? 'Sprache' : 'Language'}
                  </h3>
                  <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {lang === 'de'
                      ? 'Wählen Sie die Anzeigesprache des Admin-Dashboards.'
                      : 'Choose the display language for the admin dashboard.'}
                  </p>
                  <LanguageToggleButton />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <div
          onClick={closeEditAdminModal}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="gw-card gw-admin-enter"
            style={{
              width: '100%',
              maxWidth: '460px',
              margin: 0,
              borderTop: '3px solid #7c3aed',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <h3 className="gw-card-title" style={{ margin: 0 }}>
                {lang === 'de' ? 'Admin bearbeiten' : 'Edit Admin'}
              </h3>
              <button
                type="button"
                onClick={closeEditAdminModal}
                aria-label="Close"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSaveAdminEdit}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div className="gw-field" style={{ margin: 0 }}>
                <label className="gw-label">{t('adminFullNameLabel')}</label>
                <input
                  type="text"
                  required
                  className="gw-input"
                  value={editAdminFullName}
                  onChange={(e) => setEditAdminFullName(e.target.value)}
                />
              </div>

              <div className="gw-field" style={{ margin: 0 }}>
                <label className="gw-label">{t('emailLabel')}</label>
                <input
                  type="email"
                  required
                  className="gw-input"
                  value={editAdminEmail}
                  onChange={(e) => setEditAdminEmail(e.target.value)}
                />
              </div>

              <div className="gw-field" style={{ margin: 0 }}>
                <label className="gw-label">
                  {t('passwordLabel')}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                    ({lang === 'de' ? 'optional' : 'optional'})
                  </span>
                </label>
                <input
                  type="password"
                  className="gw-input"
                  placeholder="••••••••"
                  value={editAdminPassword}
                  onChange={(e) => setEditAdminPassword(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '6px',
                }}
              >
                <button
                  type="button"
                  onClick={closeEditAdminModal}
                  className="gw-btn gw-btn-sm"
                >
                  {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={savingAdminEdit}
                  className="gw-btn gw-btn-primary gw-btn-sm"
                >
                  {savingAdminEdit
                    ? lang === 'de'
                      ? 'Speichern...'
                      : 'Saving...'
                    : lang === 'de'
                    ? 'Speichern'
                    : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Store Modal */}
      {editingStore && (
        <div
          onClick={closeEditStoreModal}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="gw-card gw-admin-enter"
            style={{
              width: '100%',
              maxWidth: '460px',
              margin: 0,
              borderTop: '3px solid #7c3aed',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <h3 className="gw-card-title" style={{ margin: 0 }}>
                {lang === 'de' ? 'Geschäft bearbeiten' : 'Edit Store'}
              </h3>
              <button
                type="button"
                onClick={closeEditStoreModal}
                aria-label="Close"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSaveStoreEdit}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div className="gw-field" style={{ margin: 0 }}>
                <label className="gw-label">{t('storeNameLabel')}</label>
                <input
                  type="text"
                  required
                  className="gw-input"
                  value={editStoreName}
                  onChange={(e) => setEditStoreName(e.target.value)}
                />
              </div>

              <div className="gw-field" style={{ margin: 0 }}>
                <label className="gw-label">{t('emailLabel')}</label>
                <input
                  type="email"
                  required
                  className="gw-input"
                  value={editStoreEmail}
                  onChange={(e) => setEditStoreEmail(e.target.value)}
                />
              </div>

              <div className="gw-field" style={{ margin: 0 }}>
                <label className="gw-label">
                  {t('passwordLabel')}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                    ({lang === 'de' ? 'optional' : 'optional'})
                  </span>
                </label>
                <input
                  type="password"
                  className="gw-input"
                  placeholder="••••••••"
                  value={editStorePassword}
                  onChange={(e) => setEditStorePassword(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '6px',
                }}
              >
                <button
                  type="button"
                  onClick={closeEditStoreModal}
                  className="gw-btn gw-btn-sm"
                >
                  {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={savingStoreEdit}
                  className="gw-btn gw-btn-primary gw-btn-sm"
                >
                  {savingStoreEdit
                    ? lang === 'de'
                      ? 'Speichern...'
                      : 'Saving...'
                    : lang === 'de'
                    ? 'Speichern'
                    : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}