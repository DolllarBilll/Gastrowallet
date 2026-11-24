import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import QRCode from 'qrcode';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageToggleButton from '../../components/LanguageToggleButton';
import { resetViewportZoom } from '../../utils/viewport';

export default function StoreDashboard() {
  const { t, lang } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [offers, setOffers] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [customersPanelOpen, setCustomersPanelOpen] = useState(false);
  const [customersPanelClosing, setCustomersPanelClosing] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [customerQrMap, setCustomerQrMap] = useState({});
  const [resendingCustomerId, setResendingCustomerId] = useState(null);
  const [confirmDeleteCustomerId, setConfirmDeleteCustomerId] = useState(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState(null);

  const [overviewStats, setOverviewStats] = useState({
    totalCustomers: 0,
    totalRedemptions: 0,
    totalPointsIssued: 0,
    activePointsBalance: 0,
    recentActivity: [],
  });
  const [statusMsg, setStatusMsg] = useState('');
  const [statusClosing, setStatusClosing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorClosing, setErrorClosing] = useState(false);

  // Store logo state (in profile drawer)
  const [storeLogo, setStoreLogo] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoBtnHovered, setLogoBtnHovered] = useState(false);
  const [logoutBtnHovered, setLogoutBtnHovered] = useState(false);
  const logoInputRef = useRef(null);

  // Welcome Bonus settings state
  const [welcomeBonusEnabled, setWelcomeBonusEnabled] = useState(false);
  const [welcomeBonusPoints, setWelcomeBonusPoints] = useState('10');
  const [savingBonus, setSavingBonus] = useState(false);

  // Points per Euro rate state (in Settings tab)
  const [pointsRateEuros, setPointsRateEuros] = useState('1');
  const [pointsRatePoints, setPointsRatePoints] = useState('10');
  const [savingRate, setSavingRate] = useState(false);

  // Offer creation state
  const [offerTitle, setOfferTitle] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [pointsRequired, setPointsRequired] = useState('');

  // Customer registration state (grid + required phone before birthday + consent)
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerBirthday, setCustomerBirthday] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [registeredPass, setRegisteredPass] = useState(null);
  const [registeredPassClosing, setRegisteredPassClosing] = useState(false);

  // Scan & Points state (phone search below QR scanner + spend in € -> calculated points)
  const [phoneLookupQuery, setPhoneLookupQuery] = useState('');
  const [scannedProfile, setScannedProfile] = useState(null);
  const [scannedProfileClosing, setScannedProfileClosing] = useState(false);
  const [amountSpentEuros, setAmountSpentEuros] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');

  const scannerRef = useRef(null);
  const closeAnimationTimerRef = useRef(null);
  const errorCloseTimerRef = useRef(null);
  const customersPanelTimerRef = useRef(null);
  const registeredPassTimerRef = useRef(null);
  const scannedProfileTimerRef = useRef(null);

  const dismissStatusMsg = () => {
    if (!statusMsg || statusClosing) return;
    setStatusClosing(true);
    if (closeAnimationTimerRef.current) {
      clearTimeout(closeAnimationTimerRef.current);
    }
    closeAnimationTimerRef.current = setTimeout(() => {
      setStatusMsg('');
      setStatusClosing(false);
    }, 400);
  };

  const dismissErrorMsg = () => {
    if (!errorMsg || errorClosing) return;
    setErrorClosing(true);
    if (errorCloseTimerRef.current) {
      clearTimeout(errorCloseTimerRef.current);
    }
    errorCloseTimerRef.current = setTimeout(() => {
      setErrorMsg('');
      setErrorClosing(false);
    }, 400);
  };

  const dismissRegisteredPass = () => {
    if (!registeredPass || registeredPassClosing) return;
    setRegisteredPassClosing(true);
    if (registeredPassTimerRef.current) {
      clearTimeout(registeredPassTimerRef.current);
    }
    registeredPassTimerRef.current = setTimeout(() => {
      setRegisteredPass(null);
      setRegisteredPassClosing(false);
    }, 400);
  };

  const dismissScannedProfile = () => {
    if (!scannedProfile || scannedProfileClosing) return;
    setScannedProfileClosing(true);
    if (scannedProfileTimerRef.current) {
      clearTimeout(scannedProfileTimerRef.current);
    }
    scannedProfileTimerRef.current = setTimeout(() => {
      setScannedProfile(null);
      setScannedProfileClosing(false);
      setAmountSpentEuros('');
    }, 400);
  };

  const openCustomersPanel = () => {
    if (customersPanelTimerRef.current) {
      clearTimeout(customersPanelTimerRef.current);
    }
    setCustomersPanelClosing(false);
    setCustomersPanelOpen(true);
    loadOverviewData();
  };

  const closeCustomersPanel = () => {
    if (!customersPanelOpen || customersPanelClosing) return;
    setCustomersPanelClosing(true);
    setExpandedCustomerId(null);
    setConfirmDeleteCustomerId(null);
    if (customersPanelTimerRef.current) {
      clearTimeout(customersPanelTimerRef.current);
    }
    customersPanelTimerRef.current = setTimeout(() => {
      setCustomersPanelOpen(false);
      setCustomersPanelClosing(false);
    }, 400);
  };

  useEffect(() => {
    if (!statusMsg) {
      setStatusClosing(false);
      return;
    }
    setStatusClosing(false);
    const autoDismissTimer = setTimeout(() => {
      dismissStatusMsg();
    }, 10000);

    return () => clearTimeout(autoDismissTimer);
  }, [statusMsg]);

  useEffect(() => {
    if (!errorMsg) {
      setErrorClosing(false);
      return;
    }
    setErrorClosing(false);
    const autoDismissTimer = setTimeout(() => {
      dismissErrorMsg();
    }, 10000);

    return () => clearTimeout(errorCloseTimerRef.current);
  }, [errorMsg]);

  useEffect(() => {
    return () => {
      if (closeAnimationTimerRef.current) {
        clearTimeout(closeAnimationTimerRef.current);
      }
      if (errorCloseTimerRef.current) {
        clearTimeout(errorCloseTimerRef.current);
      }
      if (customersPanelTimerRef.current) {
        clearTimeout(customersPanelTimerRef.current);
      }
      if (registeredPassTimerRef.current) {
        clearTimeout(registeredPassTimerRef.current);
      }
      if (scannedProfileTimerRef.current) {
        clearTimeout(scannedProfileTimerRef.current);
      }
    };
  }, []);

  const loadOverviewData = async () => {
    try {
      const [customersRes, transactionsRes] = await Promise.allSettled([
        apiClient.get('/store/customers'),
        apiClient.get('/store/transactions'),
      ]);

      const loadedCustomers =
        customersRes.status === 'fulfilled'
          ? customersRes.value.data?.customers || customersRes.value.data || []
          : [];

      const transactionsList =
        transactionsRes.status === 'fulfilled'
          ? transactionsRes.value.data?.transactions || transactionsRes.value.data || []
          : [];

      const safeCustomers = Array.isArray(loadedCustomers) ? loadedCustomers : [];
      setCustomersList(safeCustomers);

      const totalCustomers = safeCustomers.length;

      const activePointsBalance = safeCustomers.reduce(
        (acc, c) => acc + Number(c.points_balance ?? c.points ?? 0),
        0
      );

      const totalRedemptions = Array.isArray(transactionsList)
        ? transactionsList.filter((tx) =>
            String(tx.tx_type || tx.type || '').toLowerCase().includes('redeem')
          ).length
        : 0;

      const totalPointsIssued = Array.isArray(transactionsList)
        ? transactionsList
            .map((tx) => Number(tx.points_delta ?? tx.points ?? 0))
            .filter((pts) => pts > 0)
            .reduce((acc, pts) => acc + pts, 0)
        : 0;

      const recentActivity = Array.isArray(transactionsList)
        ? transactionsList.slice(0, 5)
        : [];

      setOverviewStats({
        totalCustomers,
        totalRedemptions,
        totalPointsIssued,
        activePointsBalance,
        recentActivity,
      });
    } catch {
      // Non-blocking if dedicated endpoints are not present yet
    }
  };

  const handleToggleCustomerExpand = async (customer) => {
    const nextId = expandedCustomerId === customer.id ? null : customer.id;
    setExpandedCustomerId(nextId);
    setConfirmDeleteCustomerId(null);

    if (nextId && customer.qr_token && !customerQrMap[customer.id]) {
      try {
        const dataUrl = await QRCode.toDataURL(customer.qr_token);
        setCustomerQrMap((prev) => ({ ...prev, [customer.id]: dataUrl }));
      } catch {
        // Ignore QR generation error
      }
    }
  };

  const handleResendQrEmail = async (customer) => {
    if (!customer?.id) return;
    setErrorMsg('');
    setStatusMsg('');
    setResendingCustomerId(customer.id);
    try {
      const res = await apiClient.post(`/store/customers/${customer.id}/resend-qr`);
      setStatusMsg(
        res.data?.message ||
          (lang === 'de'
            ? `QR-Code erneut an ${customer.email} gesendet.`
            : `QR code resent to ${customer.email}.`)
      );
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error ||
          (lang === 'de'
            ? 'E-Mail konnte nicht erneut gesendet werden.'
            : 'Failed to resend QR email.')
      );
    } finally {
      setResendingCustomerId(null);
    }
  };

  const handleDeleteCustomer = async (customer) => {
    if (!customer?.id) return;
    setErrorMsg('');
    setStatusMsg('');
    setDeletingCustomerId(customer.id);
    try {
      await apiClient.delete(`/store/customers/${customer.id}`);
      setConfirmDeleteCustomerId(null);
      if (expandedCustomerId === customer.id) {
        setExpandedCustomerId(null);
      }
      if (scannedProfile?.customer?.id === customer.id) {
        if (scannedProfileTimerRef.current) {
          clearTimeout(scannedProfileTimerRef.current);
        }
        setScannedProfileClosing(false);
        setScannedProfile(null);
      }
      setStatusMsg(
        lang === 'de'
          ? `Kunde "${customer.full_name}" wurde gelöscht.`
          : `Customer "${customer.full_name}" deleted.`
      );
      await loadOverviewData();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error ||
          (lang === 'de'
            ? 'Kunde konnte nicht gelöscht werden.'
            : 'Failed to delete customer.')
      );
    } finally {
      setDeletingCustomerId(null);
    }
  };

  const formatBirthday = (birthdayVal) => {
    if (!birthdayVal) {
      return lang === 'de' ? 'Nicht angegeben' : 'Not provided';
    }
    const match = String(birthdayVal).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
    return String(birthdayVal);
  };

  const loadOffers = async () => {
    try {
      const res = await apiClient.get('/store/offers');
      const list = res.data.offers || [];
      setOffers(list);
      const firstActive = list.find((o) => o.is_active);
      if (firstActive) {
        setSelectedOfferId((prev) => prev || firstActive.id);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to load offers');
    }
  };

  const loadStoreSettings = async () => {
    try {
      const res = await apiClient.get('/store/settings');
      if (res.data?.settings) {
        setWelcomeBonusEnabled(Boolean(res.data.settings.welcome_bonus_enabled));
        setWelcomeBonusPoints(String(res.data.settings.welcome_bonus_points ?? 10));
        if (res.data.settings.points_rate_euros != null) {
          setPointsRateEuros(String(res.data.settings.points_rate_euros));
        }
        if (res.data.settings.points_rate_points != null) {
          setPointsRatePoints(String(res.data.settings.points_rate_points));
        }
        const existingLogo =
          res.data.settings.logo_url ||
          res.data.settings.store_logo ||
          user?.storeLogo ||
          user?.logoUrl ||
          '';
        if (existingLogo) {
          setStoreLogo(existingLogo);
        }
      }
    } catch (err) {
      // Non-blocking if settings haven't been queried yet
    }
  };

  useEffect(() => {
    resetViewportZoom();
    const timer = setTimeout(() => resetViewportZoom(), 180);
    loadOverviewData();
    loadOffers();
    loadStoreSettings();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const initialLogo = user?.storeLogo || user?.logoUrl || '';
    if (initialLogo && !storeLogo) {
      setStoreLogo(initialLogo);
    }
  }, [user, storeLogo]);

  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setStatusMsg('');

    if (!file.type.startsWith('image/')) {
      setErrorMsg(
        lang === 'de'
          ? 'Bitte wählen Sie eine gültige Bilddatei aus.'
          : 'Please select a valid image file.'
      );
      e.target.value = '';
      return;
    }

    const maxBytes = 2 * 1024 * 1024; // 2MB
    if (file.size > maxBytes) {
      setErrorMsg(
        lang === 'de'
          ? 'Das Logo darf maximal 2 MB groß sein.'
          : 'Logo image must be 2 MB or smaller.'
      );
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;

      setStoreLogo(dataUrl);
      setUploadingLogo(true);
      try {
        await apiClient.patch('/store/settings/logo', { logo: dataUrl });
        setStatusMsg(
          lang === 'de'
            ? 'Shop-Logo aktualisiert.'
            : 'Store logo updated.'
        );
      } catch (err) {
        setErrorMsg(
          err.response?.data?.error ||
            (lang === 'de'
              ? 'Logo lokal geladen (Backend-Endpunkt /store/settings/logo prüfen).'
              : 'Logo loaded locally (check /store/settings/logo endpoint).')
        );
      } finally {
        setUploadingLogo(false);
        resetViewportZoom();
      }
    };
    reader.readAsDataURL(file);
  };

  const lookupCustomerByQr = async (qrToken) => {
    const cleanToken = String(qrToken || '').trim();
    if (!cleanToken) return;

    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await apiClient.get(`/store/customers/by-qr/${encodeURIComponent(cleanToken)}`);
      if (scannedProfileTimerRef.current) {
        clearTimeout(scannedProfileTimerRef.current);
      }
      setScannedProfileClosing(false);
      setScannedProfile(res.data);
      if (res.data?.customer?.phone) {
        setPhoneLookupQuery(res.data.customer.phone);
      }
    } catch (err) {
      if (scannedProfileTimerRef.current) {
        clearTimeout(scannedProfileTimerRef.current);
      }
      setScannedProfileClosing(false);
      setScannedProfile(null);
      setErrorMsg(err.response?.data?.error || 'Customer not found');
    }
  };

  const lookupCustomerByPhone = async (phoneValue) => {
    const cleanPhone = String(phoneValue || '').trim();
    if (!cleanPhone) {
      setErrorMsg(
        lang === 'de'
          ? 'Bitte geben Sie eine Telefonnummer ein.'
          : 'Please enter a phone number.'
      );
      return;
    }

    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await apiClient.get(
        `/store/customers/by-phone/${encodeURIComponent(cleanPhone)}`
      );
      if (scannedProfileTimerRef.current) {
        clearTimeout(scannedProfileTimerRef.current);
      }
      setScannedProfileClosing(false);
      setScannedProfile(res.data);
    } catch (err) {
      if (scannedProfileTimerRef.current) {
        clearTimeout(scannedProfileTimerRef.current);
      }
      setScannedProfileClosing(false);
      setScannedProfile(null);
      setErrorMsg(
        err.response?.data?.error ||
          (lang === 'de' ? 'Kunde nicht gefunden' : 'Customer not found')
      );
    }
  };

  useEffect(() => {
    if (activeTab !== 'scan') {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    const scanner = new Html5QrcodeScanner(
      'gw-qr-reader',
      { fps: 10, qrbox: { width: 220, height: 220 } },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        lookupCustomerByQr(decodedText);
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [activeTab]);

  const handleSaveWelcomeBonus = async (e) => {
    e.preventDefault();
    resetViewportZoom();
    setErrorMsg('');
    setStatusMsg('');
    setSavingBonus(true);
    try {
      const res = await apiClient.patch('/store/settings/welcome-bonus', {
        enabled: welcomeBonusEnabled,
        points: Number(welcomeBonusPoints),
      });
      setWelcomeBonusEnabled(Boolean(res.data.settings.welcome_bonus_enabled));
      setWelcomeBonusPoints(String(res.data.settings.welcome_bonus_points));
      setStatusMsg(
        lang === 'de'
          ? 'Willkommensbonus-Einstellungen gespeichert.'
          : 'Welcome bonus settings saved.'
      );
      await loadOverviewData();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to save welcome bonus settings');
    } finally {
      setSavingBonus(false);
      resetViewportZoom();
    }
  };

  const handleSavePointsRate = async (e) => {
    e.preventDefault();
    resetViewportZoom();
    setErrorMsg('');
    setStatusMsg('');
    setSavingRate(true);
    try {
      const res = await apiClient.patch('/store/settings/points-rate', {
        euros: Number(pointsRateEuros),
        points: Number(pointsRatePoints),
      });
      setPointsRateEuros(String(res.data.settings.points_rate_euros));
      setPointsRatePoints(String(res.data.settings.points_rate_points));
      setStatusMsg(
        lang === 'de'
          ? 'Punkte-Umrechnung gespeichert.'
          : 'Points conversion rate saved.'
      );
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error ||
          (lang === 'de'
            ? 'Umrechnung konnte nicht gespeichert werden.'
            : 'Failed to save points conversion rate')
      );
    } finally {
      setSavingRate(false);
      resetViewportZoom();
    }
  };

  const handleCreateOffer = async (e) => {
    e.preventDefault();
    resetViewportZoom();
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiClient.post('/store/offers', {
        title: offerTitle,
        description: offerDescription,
        pointsRequired: Number(pointsRequired),
      });
      setOfferTitle('');
      setOfferDescription('');
      setPointsRequired('');
      setStatusMsg('Offer created.');
      await Promise.all([loadOffers(), loadOverviewData()]);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to create offer');
    } finally {
      resetViewportZoom();
    }
  };

  const handleToggleOffer = async (offer) => {
    resetViewportZoom();
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiClient.patch(`/store/offers/${offer.id}/status`, {
        isActive: !offer.is_active,
      });
      await Promise.all([loadOffers(), loadOverviewData()]);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update offer');
    } finally {
      resetViewportZoom();
    }
  };

  const handleRegisterCustomer = async (e) => {
    e.preventDefault();
    resetViewportZoom();
    setErrorMsg('');
    setStatusMsg('');
    if (registeredPassTimerRef.current) {
      clearTimeout(registeredPassTimerRef.current);
    }
    setRegisteredPassClosing(false);
    setRegisteredPass(null);

    const cleanPhone = customerPhone.trim();
    if (!cleanPhone) {
      setErrorMsg(
        lang === 'de'
          ? 'Bitte geben Sie eine Telefonnummer ein.'
          : 'Please enter a phone number.'
      );
      return;
    }

    if (!marketingConsent) {
      setErrorMsg(
        lang === 'de'
          ? 'Der Kunde muss dem Erhalt von Treue-Updates und Angeboten zustimmen.'
          : 'Customer must agree to receive loyalty updates & offers.'
      );
      return;
    }

    const fullName = [customerFirstName.trim(), customerLastName.trim()]
      .filter(Boolean)
      .join(' ');

    try {
      const res = await apiClient.post('/store/customers', {
        fullName,
        email: customerEmail,
        phone: cleanPhone,
        birthday: customerBirthday ? String(customerBirthday).slice(0, 10) : null,
        marketingConsent,
      });

      setRegisteredPassClosing(false);
      setRegisteredPass(res.data);

      if (res.data.alreadyExists) {
        setStatusMsg(
          lang === 'de'
            ? 'Kunde existiert bereits — bestehender QR-Pass wird angezeigt.'
            : 'Customer already registered — showing existing QR pass.'
        );
      } else {
        const bonusNote =
          res.data.welcomeBonusApplied > 0
            ? ` (+${res.data.welcomeBonusApplied} welcome points)`
            : '';
        setStatusMsg(
          lang === 'de'
            ? `Kunde registriert und QR-Pass erstellt${bonusNote}.`
            : `Customer registered and QR pass generated${bonusNote}.`
        );
        setCustomerFirstName('');
        setCustomerLastName('');
        setCustomerEmail('');
        setCustomerPhone('');
        setCustomerBirthday('');
        setMarketingConsent(false);
        await loadOverviewData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to register customer');
    } finally {
      resetViewportZoom();
    }
  };

  const handleOpenRegisteredInScan = async (customer) => {
    resetViewportZoom();
    setPhoneLookupQuery(customer?.phone || '');
    setAmountSpentEuros('');
    setActiveTab('scan');
    if (customer?.phone) {
      await lookupCustomerByPhone(customer.phone);
    } else if (customer?.qr_token) {
      await lookupCustomerByQr(customer.qr_token);
    }
    resetViewportZoom();
  };

  const rateEuros = Number(pointsRateEuros);
  const ratePoints = Number(pointsRatePoints);
  const spentAmount = Number(amountSpentEuros);
  const calculatedPoints =
    Number.isFinite(spentAmount) &&
    spentAmount > 0 &&
    Number.isFinite(rateEuros) &&
    rateEuros > 0 &&
    Number.isFinite(ratePoints) &&
    ratePoints > 0
      ? Math.round((spentAmount / rateEuros) * ratePoints)
      : 0;

  const handleAddPoints = async (e) => {
    e.preventDefault();
    if (!scannedProfile?.customer?.id) return;
    resetViewportZoom();
    setErrorMsg('');
    setStatusMsg('');

    if (!Number.isFinite(spentAmount) || spentAmount <= 0) {
      setErrorMsg(
        lang === 'de'
          ? 'Bitte geben Sie einen gültigen Betrag in € ein.'
          : 'Please enter a valid amount in €.'
      );
      return;
    }

    if (calculatedPoints < 1) {
      setErrorMsg(
        lang === 'de'
          ? 'Der Betrag ergibt weniger als 1 Punkt.'
          : 'Amount is too small to earn at least 1 point.'
      );
      return;
    }

    try {
      await apiClient.post(`/store/customers/${scannedProfile.customer.id}/earn`, {
        points: calculatedPoints,
      });
      setAmountSpentEuros('');
      setStatusMsg(
        lang === 'de'
          ? `+${calculatedPoints} Punkte für ${spentAmount.toFixed(2)} € hinzugefügt.`
          : `+${calculatedPoints} points added for ${spentAmount.toFixed(2)} €.`
      );
      await Promise.all([
        lookupCustomerByQr(scannedProfile.customer.qr_token),
        loadOverviewData(),
      ]);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to add points');
    } finally {
      resetViewportZoom();
    }
  };

  const handleRedeemOffer = async (e) => {
    e.preventDefault();
    if (!scannedProfile?.customer?.id || !selectedOfferId) return;
    resetViewportZoom();
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiClient.post(`/store/customers/${scannedProfile.customer.id}/redeem`, {
        offerId: selectedOfferId,
      });
      setStatusMsg('Offer redeemed.');
      await Promise.all([
        lookupCustomerByQr(scannedProfile.customer.qr_token),
        loadOverviewData(),
      ]);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to redeem offer');
    } finally {
      resetViewportZoom();
    }
  };

  const handleLogout = () => {
    resetViewportZoom();
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
    if (tab !== 'overview') {
      if (customersPanelTimerRef.current) {
        clearTimeout(customersPanelTimerRef.current);
      }
      setCustomersPanelOpen(false);
      setCustomersPanelClosing(false);
      setExpandedCustomerId(null);
      setConfirmDeleteCustomerId(null);
    }
    if (tab === 'overview') {
      loadOverviewData();
      loadOffers();
    }
    if (window.innerWidth <= 768) {
      setSidebarCollapsed(true);
    }
    setTimeout(() => resetViewportZoom(), 120);
  };

  const activeOffers = offers.filter((o) => o.is_active);
  const selectedOffer = activeOffers.find((o) => String(o.id) === String(selectedOfferId));
  const recentTransactions = (scannedProfile?.transactions || []).slice(0, 5);
  const isLeftOpen = !sidebarCollapsed;

  const filteredCustomers = customersList.filter((c) => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    const nameMatch = String(c.full_name || '').toLowerCase().includes(q);
    const emailMatch = String(c.email || '').toLowerCase().includes(q);
    const phoneMatch = String(c.phone || '').toLowerCase().includes(q);
    return nameMatch || emailMatch || phoneMatch;
  });

  const kpiCards = [
    {
      key: 'customers',
      label: lang === 'de' ? 'Registrierte Kunden' : 'Registered Customers',
      value: overviewStats.totalCustomers,
      accent: '#7c3aed',
      tint: 'rgba(124, 58, 237, 0.08)',
      icon: '👥',
      clickable: true,
    },
    {
      key: 'redemptions',
      label: lang === 'de' ? 'Eingelöste Angebote' : 'Redeemed Offers',
      value: overviewStats.totalRedemptions,
      accent: '#059669',
      tint: 'rgba(5, 150, 105, 0.08)',
      icon: '🎁',
      clickable: false,
    },
    {
      key: 'points',
      label: lang === 'de' ? 'Vergebene Punkte' : 'Points Issued',
      value: overviewStats.totalPointsIssued,
      accent: '#2563eb',
      tint: 'rgba(37, 99, 235, 0.08)',
      icon: '✦',
      clickable: false,
    },
    {
      key: 'offers',
      label: lang === 'de' ? 'Aktive Angebote' : 'Active Offers',
      value: `${activeOffers.length} / ${offers.length}`,
      accent: '#9333ea',
      tint: 'rgba(147, 51, 234, 0.08)',
      icon: '%',
      clickable: false,
    },
  ];

  return (
    <div>
      <style>{`
        @keyframes gwFadeSlideUp {
          0% {
            opacity: 0;
            transform: translate3d(0, 8px, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        @keyframes gwFadeSlideDown {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
          100% {
            opacity: 0;
            transform: translate3d(0, -14px, 0);
          }
        }
        .gw-enter-anim {
          animation-name: gwFadeSlideUp;
          animation-duration: 0.4s;
          animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }
        .gw-leave-anim {
          animation-name: gwFadeSlideDown;
          animation-duration: 0.4s;
          animation-timing-function: cubic-bezier(0.4, 0, 1, 1);
          animation-fill-mode: forwards;
          pointer-events: none;
          will-change: transform, opacity;
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
        <div className="gw-brand-center">GastroWallet</div>
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

      <aside
        className={`gw-profile-drawer ${profileDrawerOpen ? 'open' : ''}`}
        aria-hidden={!profileDrawerOpen}
      >
        <div className="gw-drawer-scroll">
          <div className="gw-profile-drawer-header">
            <span>{lang === 'de' ? 'Profil' : 'Profile'}</span>
          </div>

          <div className="gw-profile-details">
            <div className="gw-profile-box">
              <div className="gw-profile-label">
                {lang === 'de' ? 'Geschäftslogo' : 'Store Logo'}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '6px',
                }}
              >
                <div
                  onClick={() => logoInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      logoInputRef.current?.click();
                    }
                  }}
                  style={{
                    width: '100%',
                    maxWidth: '220px',
                    height: '92px',
                    borderRadius: '14px',
                    border: '1px dashed var(--border-color, #d1d5db)',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                  title={
                    lang === 'de'
                      ? 'Logo hochladen'
                      : 'Upload store logo'
                  }
                >
                  {storeLogo ? (
                    <img
                      src={storeLogo}
                      alt="Store logo"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        padding: '8px 12px',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted, #6b7280)',
                        textAlign: 'center',
                        padding: '8px',
                      }}
                    >
                      {lang === 'de' ? 'Kein Logo' : 'No Logo'}
                    </span>
                  )}
                </div>

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                  onMouseEnter={() => setLogoBtnHovered(true)}
                  onMouseLeave={() => setLogoBtnHovered(false)}
                  style={{
                    width: '100%',
                    maxWidth: '220px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    background: logoBtnHovered
                      ? '#ffffff'
                      : 'rgba(255, 255, 255, 0.94)',
                    color: '#4c1d95',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    letterSpacing: '0.2px',
                    boxShadow: logoBtnHovered
                      ? '0 6px 16px rgba(15, 23, 42, 0.22)'
                      : '0 2px 8px rgba(15, 23, 42, 0.14)',
                    transform: logoBtnHovered ? 'translateY(-1px)' : 'translateY(0)',
                    transition: 'all 0.2s ease',
                    cursor: uploadingLogo ? 'wait' : 'pointer',
                    opacity: uploadingLogo ? 0.75 : 1,
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: '14px', lineHeight: 1 }}>
                    ↑
                  </span>
                  <span>
                    {uploadingLogo
                      ? lang === 'de'
                        ? 'Wird hochgeladen...'
                        : 'Uploading...'
                      : lang === 'de'
                      ? 'Logo hochladen'
                      : 'Upload Logo'}
                  </span>
                </button>
              </div>
            </div>

            {user?.storeName && (
              <div className="gw-profile-box">
                <div className="gw-profile-label">
                  {lang === 'de' ? 'Geschäft' : 'Store'}
                </div>
                <div className="gw-profile-value">{user.storeName}</div>
              </div>
            )}

            {user?.email && (
              <div className="gw-profile-box">
                <div className="gw-profile-label">Email</div>
                <div className="gw-profile-value">{user.email}</div>
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
                onClick={() => selectCategory('register')}
                className={`gw-nav-btn ${activeTab === 'register' ? 'active' : ''}`}
              >
                <span className="gw-nav-icon">+</span>
                <span className="gw-nav-label">{t('registerTab')}</span>
              </button>

              <button
                type="button"
                onClick={() => selectCategory('scan')}
                className={`gw-nav-btn ${activeTab === 'scan' ? 'active' : ''}`}
              >
                <span className="gw-nav-icon">QR</span>
                <span className="gw-nav-label">{t('scanTab')}</span>
              </button>

              <button
                type="button"
                onClick={() => selectCategory('offers')}
                className={`gw-nav-btn ${activeTab === 'offers' ? 'active' : ''}`}
              >
                <span className="gw-nav-icon">%</span>
                <span className="gw-nav-label">
                  {t('offersTab')} ({offers.length})
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
            {statusMsg && (
              <div
                key={`status-${statusMsg}`}
                className={`gw-alert gw-alert-success ${
                  statusClosing ? 'gw-leave-anim' : 'gw-enter-anim'
                }`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <span>{statusMsg}</span>
                <button
                  type="button"
                  onClick={dismissStatusMsg}
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
                key={`error-${errorMsg}`}
                className={`gw-alert gw-alert-error ${
                  errorClosing ? 'gw-leave-anim' : 'gw-enter-anim'
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
                  onClick={dismissErrorMsg}
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
              <>
                {!customersPanelOpen ? (
                  <div key="overview-main" className="gw-enter-anim">
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
                          <p style={{ margin: '5px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                            {lang === 'de'
                              ? 'Live-Kennzahlen Ihres Treueprogramms und Ihrer Angebote'
                              : 'Live snapshot of your loyalty program and offers'}
                          </p>
                        </div>

                        {welcomeBonusEnabled && Number(welcomeBonusPoints) > 0 && (
                          <span className="gw-badge gw-badge-active">
                            {lang === 'de'
                              ? `Willkommensbonus: +${welcomeBonusPoints} Pkt.`
                              : `Welcome Bonus: +${welcomeBonusPoints} pts`}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                          gap: '16px',
                        }}
                      >
                        {kpiCards.map((item) => {
                          const isCustomersCard = item.key === 'customers';
                          const CardTag = isCustomersCard ? 'button' : 'div';
                          return (
                            <CardTag
                              key={item.label}
                              {...(isCustomersCard
                                ? {
                                    type: 'button',
                                    onClick: openCustomersPanel,
                                  }
                                : {})}
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
                                cursor: isCustomersCard ? 'pointer' : 'default',
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
                            </CardTag>
                          );
                        })}
                      </div>
                    </div>

                    <div className="gw-card">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '14px',
                        }}
                      >
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                          {lang === 'de' ? 'Letzte Aktivitäten' : 'Recent Activity'}
                        </h4>
                      </div>

                      {overviewStats.recentActivity.length === 0 ? (
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                          {t('noTransactions')}
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {overviewStats.recentActivity.map((tx, idx) => {
                            const delta = Number(tx.points_delta ?? tx.points ?? 0);
                            const isPositive = delta >= 0;
                            return (
                              <div
                                key={tx.id || idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '12px',
                                  padding: '12px 14px',
                                  borderRadius: '12px',
                                  background: 'rgba(124, 58, 237, 0.03)',
                                  border: '1px solid var(--border-color, #e5e7eb)',
                                  fontSize: '14px',
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary, #111827)' }}>
                                    {tx.tx_type || tx.type || 'ACTIVITY'}
                                  </div>
                                  {(tx.note || tx.offer_title || tx.customer_name) && (
                                    <div
                                      style={{
                                        fontSize: '13px',
                                        color: 'var(--text-secondary)',
                                        marginTop: '2px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {tx.note || tx.offer_title || tx.customer_name}
                                    </div>
                                  )}
                                </div>

                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    padding: '5px 10px',
                                    borderRadius: '999px',
                                    whiteSpace: 'nowrap',
                                    background: isPositive
                                      ? 'rgba(16, 185, 129, 0.12)'
                                      : 'rgba(239, 68, 68, 0.12)',
                                    color: isPositive ? '#047857' : '#b91c1c',
                                  }}
                                >
                                  {isPositive ? `+${delta}` : delta} pts
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    key="overview-customers"
                    className={customersPanelClosing ? 'gw-leave-anim' : 'gw-enter-anim'}
                  >
                    <div className="gw-card">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          marginBottom: '14px',
                        }}
                      >
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                          {lang === 'de' ? 'Registrierte Kunden' : 'Registered Customers'} ({filteredCustomers.length})
                        </h4>
                        <button
                          type="button"
                          aria-label={lang === 'de' ? 'Schließen' : 'Close'}
                          onClick={closeCustomersPanel}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color, #e5e7eb)',
                            background: '#f9fafb',
                            color: '#374151',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: 600,
                            lineHeight: 1,
                            padding: 0,
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                            e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.28)';
                            e.currentTarget.style.color = '#6d28d9';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                            e.currentTarget.style.color = '#374151';
                          }}
                        >
                          ×
                        </button>
                      </div>

                      <div className="gw-field" style={{ marginBottom: '14px' }}>
                        <input
                          type="text"
                          className="gw-input"
                          placeholder={
                            lang === 'de'
                              ? 'Kunde suchen (Name, E-Mail oder Telefon)...'
                              : 'Search customer (name, email or phone)...'
                          }
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                      </div>

                      {filteredCustomers.length === 0 ? (
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                          {lang === 'de' ? 'Keine Kunden gefunden.' : 'No customers found.'}
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {filteredCustomers.map((cust) => {
                            const isExpanded = expandedCustomerId === cust.id;
                            const isConfirmingDelete = confirmDeleteCustomerId === cust.id;
                            const isDeleting = deletingCustomerId === cust.id;
                            const qrSrc = customerQrMap[cust.id];
                            return (
                              <div
                                key={cust.id}
                                style={{
                                  borderRadius: '12px',
                                  border: '1px solid var(--border-color, #e5e7eb)',
                                  background: '#ffffff',
                                  overflow: 'hidden',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleCustomerExpand(cust)}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px 14px',
                                    background: isExpanded
                                      ? 'rgba(124, 58, 237, 0.05)'
                                      : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: 'var(--text-primary, #111827)',
                                  }}
                                >
                                  <span>{cust.full_name}</span>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {isExpanded ? '▲' : '▼'}
                                  </span>
                                </button>

                                {isExpanded && (
                                  <div
                                    key={`expand-${cust.id}`}
                                    className="gw-enter-anim"
                                    style={{
                                      padding: '14px',
                                      borderTop: '1px solid var(--border-color, #e5e7eb)',
                                      background: 'rgba(124, 58, 237, 0.02)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '12px',
                                      fontSize: '14px',
                                    }}
                                  >
                                    <div>
                                      <strong>Email:</strong> {cust.email}
                                    </div>
                                    <div>
                                      <strong>
                                        {lang === 'de' ? 'Telefon:' : 'Phone:'}
                                      </strong>{' '}
                                      {cust.phone ||
                                        (lang === 'de' ? 'Nicht angegeben' : 'Not provided')}
                                    </div>
                                    <div>
                                      <strong>
                                        {lang === 'de' ? 'Geburtstag:' : 'Birthday:'}
                                      </strong>{' '}
                                      {formatBirthday(cust.birthday)}
                                    </div>

                                    {qrSrc && (
                                      <div className="gw-enter-anim" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                        <img
                                          src={qrSrc}
                                          alt={`QR code for ${cust.full_name}`}
                                          width="170"
                                          height="170"
                                          style={{
                                            border: '1px solid var(--border-color, #e5e7eb)',
                                            borderRadius: '10px',
                                            padding: '8px',
                                            background: '#ffffff',
                                          }}
                                        />
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                          {cust.qr_token}
                                        </span>
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      disabled={resendingCustomerId === cust.id}
                                      onClick={() => handleResendQrEmail(cust)}
                                      className="gw-btn gw-btn-primary"
                                      style={{ width: '100%' }}
                                    >
                                      {resendingCustomerId === cust.id
                                        ? lang === 'de'
                                          ? 'Wird gesendet...'
                                          : 'Sending...'
                                        : lang === 'de'
                                        ? 'QR-Code erneut an E-Mail senden'
                                        : 'Resend QR to Email'}
                                    </button>

                                    {!isConfirmingDelete ? (
                                      <button
                                        type="button"
                                        disabled={isDeleting}
                                        onClick={() => setConfirmDeleteCustomerId(cust.id)}
                                        className="gw-btn"
                                        style={{
                                          width: '100%',
                                          backgroundColor: '#fee2e2',
                                          color: '#991b1b',
                                          borderColor: '#fecaca',
                                          fontWeight: 600,
                                        }}
                                      >
                                        {lang === 'de' ? 'Kunde löschen' : 'Delete Customer'}
                                      </button>
                                    ) : (
                                      <div
                                        key={`confirm-del-${cust.id}`}
                                        className="gw-enter-anim"
                                        style={{
                                          padding: '12px',
                                          borderRadius: '10px',
                                          backgroundColor: '#fef2f2',
                                          border: '1px solid #fecaca',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '10px',
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            color: '#991b1b',
                                            textAlign: 'center',
                                          }}
                                        >
                                          {lang === 'de'
                                            ? `Möchten Sie "${cust.full_name}" wirklich endgültig löschen?`
                                            : `Are you sure you want to permanently delete "${cust.full_name}"?`}
                                        </div>

                                        <div
                                          style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '8px',
                                          }}
                                        >
                                          <button
                                            type="button"
                                            disabled={isDeleting}
                                            onClick={() => setConfirmDeleteCustomerId(null)}
                                            className="gw-btn"
                                            style={{
                                              backgroundColor: '#ffffff',
                                              color: '#374151',
                                              borderColor: '#d1d5db',
                                              fontWeight: 600,
                                            }}
                                          >
                                            {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                                          </button>

                                          <button
                                            type="button"
                                            disabled={isDeleting}
                                            onClick={() => handleDeleteCustomer(cust)}
                                            className="gw-btn"
                                            style={{
                                              backgroundColor: '#b91c1c',
                                              color: '#ffffff',
                                              borderColor: '#b91c1c',
                                              fontWeight: 700,
                                            }}
                                          >
                                            {isDeleting
                                              ? lang === 'de'
                                                ? 'Löscht...'
                                                : 'Deleting...'
                                              : lang === 'de'
                                              ? 'Bestätigen'
                                              : 'Confirm Delete'}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'register' && (
              <div key="tab-register" className="gw-enter-anim">
                <div className="gw-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      marginBottom: '20px',
                    }}
                  >
                    <h3 className="gw-card-title" style={{ margin: 0 }}>
                      {t('registerTab')}
                    </h3>
                    {welcomeBonusEnabled && Number(welcomeBonusPoints) > 0 && (
                      <span className="gw-badge gw-badge-active">
                        {lang === 'de'
                          ? `Willkommensbonus aktiv: +${welcomeBonusPoints} Pkt.`
                          : `Welcome Bonus Active: +${welcomeBonusPoints} pts`}
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleRegisterCustomer}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '20px',
                      }}
                    >
                      <div className="gw-field">
                        <label className="gw-label">
                          {lang === 'de' ? 'Vorname' : 'First Name'}
                        </label>
                        <input
                          type="text"
                          required
                          className="gw-input"
                          value={customerFirstName}
                          onChange={(e) => setCustomerFirstName(e.target.value)}
                        />
                      </div>

                      <div className="gw-field">
                        <label className="gw-label">
                          {lang === 'de' ? 'Nachname' : 'Last Name'}
                        </label>
                        <input
                          type="text"
                          required
                          className="gw-input"
                          value={customerLastName}
                          onChange={(e) => setCustomerLastName(e.target.value)}
                        />
                      </div>

                      <div className="gw-field">
                        <label className="gw-label">{t('customerEmailLabel')}</label>
                        <input
                          type="email"
                          required
                          className="gw-input"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                        />
                      </div>

                      <div className="gw-field">
                        <label className="gw-label">
                          {lang === 'de' ? 'Telefon' : 'Phone'}
                        </label>
                        <input
                          type="tel"
                          required
                          className="gw-input"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                        />
                      </div>

                      <div className="gw-field">
                        <label className="gw-label">
                          {lang === 'de' ? 'Geburtstag (Optional)' : 'Birthday (Optional)'}
                        </label>
                        <input
                          type="date"
                          className="gw-input"
                          value={customerBirthday}
                          onChange={(e) => setCustomerBirthday(e.target.value)}
                        />
                      </div>
                    </div>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginTop: '18px',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                      />
                      <span>
                        {lang === 'de'
                          ? 'Kunde stimmt dem Erhalt von Treue-Updates und Angeboten zu'
                          : 'Customer agrees to receive loyalty updates & offers'}
                      </span>
                    </label>

                    <div style={{ marginTop: '20px' }}>
                      <button
                        type="submit"
                        className="gw-btn gw-btn-primary"
                        disabled={!marketingConsent}
                      >
                        {t('registerCustomerButton')}
                      </button>
                    </div>
                  </form>
                </div>

                {registeredPass && (
                  <div
                    key={`pass-${registeredPass.customer?.id || registeredPass.customer?.qr_token}`}
                    className={`gw-card ${registeredPassClosing ? 'gw-leave-anim' : 'gw-enter-anim'}`}
                    style={{ position: 'relative', textAlign: 'center' }}
                  >
                    <button
                      type="button"
                      aria-label={lang === 'de' ? 'Schließen' : 'Close'}
                      onClick={dismissRegisteredPass}
                      style={{
                        position: 'absolute',
                        top: '14px',
                        right: '14px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        background: '#f9fafb',
                        color: '#374151',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 600,
                        lineHeight: 1,
                        padding: 0,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.28)';
                        e.currentTarget.style.color = '#6d28d9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                        e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                        e.currentTarget.style.color = '#374151';
                      }}
                    >
                      ×
                    </button>

                    {registeredPass.alreadyExists && (
                      <div style={{ marginBottom: '12px' }}>
                        <span className="gw-badge gw-badge-neutral">
                          {lang === 'de' ? 'Bestehendes Konto' : 'Existing Account'}
                        </span>
                      </div>
                    )}

                    <h3 className="gw-card-title" style={{ marginBottom: '4px' }}>
                      {registeredPass.customer.full_name}
                    </h3>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {registeredPass.customer.email}
                    </div>
                    {registeredPass.customer.phone && (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '2px' }}>
                        {registeredPass.customer.phone}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: '8px',
                        fontWeight: 700,
                        color: 'var(--primary)',
                        fontSize: '15px',
                      }}
                    >
                      {t('pointsBalanceLabel')}: {registeredPass.customer.points_balance ?? 0} pts
                    </div>

                    <div style={{ margin: '20px 0' }}>
                      <img
                        src={registeredPass.qrDataUrl}
                        alt="Customer QR Code"
                        width="220"
                        height="220"
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '12px',
                          background: '#ffffff',
                        }}
                      />
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-all', marginBottom: '16px' }}>
                      Token: {registeredPass.customer.qr_token}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenRegisteredInScan(registeredPass.customer)}
                      className="gw-btn gw-btn-primary"
                    >
                      {lang === 'de' ? 'Punkte verwalten / Einlösen' : 'Manage Points / Redeem'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'scan' && (
              <div key="tab-scan" className="gw-enter-anim">
                <div className="gw-card">
                  <h3 className="gw-card-title">{t('scanTab')}</h3>
                  <div id="gw-qr-reader" style={{ marginBottom: '16px' }} />

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      lookupCustomerByPhone(phoneLookupQuery);
                    }}
                    className="gw-inline-row"
                  >
                    <input
                      type="tel"
                      className="gw-input"
                      placeholder={
                        lang === 'de'
                          ? 'Telefonnummer des Kunden eingeben...'
                          : 'Enter customer phone number...'
                      }
                      value={phoneLookupQuery}
                      onChange={(e) => setPhoneLookupQuery(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="gw-btn gw-btn-primary"
                    >
                      {t('lookupButton')}
                    </button>
                  </form>
                </div>

                {scannedProfile && (
                  <div
                    key={`scanned-${scannedProfile.customer?.id || scannedProfile.customer?.qr_token}`}
                    className={`gw-card ${scannedProfileClosing ? 'gw-leave-anim' : 'gw-enter-anim'}`}
                    style={{ position: 'relative' }}
                  >
                    <button
                      type="button"
                      aria-label={lang === 'de' ? 'Schließen' : 'Close'}
                      onClick={dismissScannedProfile}
                      style={{
                        position: 'absolute',
                        top: '14px',
                        right: '14px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, #e5e7eb)',
                        background: '#f9fafb',
                        color: '#374151',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 600,
                        lineHeight: 1,
                        padding: 0,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.28)';
                        e.currentTarget.style.color = '#6d28d9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                        e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
                        e.currentTarget.style.color = '#374151';
                      }}
                    >
                      ×
                    </button>

                    <h3 className="gw-card-title" style={{ marginBottom: '6px', paddingRight: '38px' }}>
                      {scannedProfile.customer.full_name}
                    </h3>
                    <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                      {scannedProfile.customer.email}
                    </div>

                    <div className="gw-stat-box">
                      <span className="gw-stat-label">{t('pointsBalanceLabel')}</span>
                      <span className="gw-stat-value">{scannedProfile.customer.points_balance}</span>
                    </div>

                    <form onSubmit={handleAddPoints} style={{ marginBottom: '16px' }}>
                      <div className="gw-inline-row">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          className="gw-input"
                          style={{ maxWidth: '150px' }}
                          placeholder={lang === 'de' ? 'Betrag (€)' : 'Amount (€)'}
                          value={amountSpentEuros}
                          onChange={(e) => setAmountSpentEuros(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="gw-btn gw-btn-primary"
                          disabled={calculatedPoints < 1}
                        >
                          {t('addPointsButton')}
                        </button>
                      </div>
                      <div
                        style={{
                          marginTop: '8px',
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {lang === 'de'
                          ? `Kurs: ${pointsRateEuros || 1} € = ${pointsRatePoints || 0} Pkt. · Gutschrift: +${calculatedPoints} Pkt.`
                          : `Rate: ${pointsRateEuros || 1} € = ${pointsRatePoints || 0} pts · Earn: +${calculatedPoints} pts`}
                      </div>
                    </form>

                    <form onSubmit={handleRedeemOffer} className="gw-inline-row" style={{ marginBottom: '24px' }}>
                      <select
                        className="gw-select"
                        value={selectedOfferId}
                        onChange={(e) => setSelectedOfferId(e.target.value)}
                        disabled={activeOffers.length === 0}
                      >
                        {activeOffers.length === 0 ? (
                          <option value="">{t('noActiveOffers')}</option>
                        ) : (
                          activeOffers.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.title} ({o.points_required} pts)
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="submit"
                        className="gw-btn"
                        disabled={
                          activeOffers.length === 0 ||
                          !selectedOffer ||
                          scannedProfile.customer.points_balance < selectedOffer.points_required
                        }
                      >
                        {t('redeemOfferButton')}
                      </button>
                    </form>

                    <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700 }}>
                      {t('recentTransactionsTitle')}
                    </h4>
                    {recentTransactions.length === 0 ? (
                      <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                        {t('noTransactions')}
                      </p>
                    ) : (
                      <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {recentTransactions.map((tx) => (
                          <li key={tx.id} style={{ marginBottom: '6px' }}>
                            <strong>{tx.tx_type}</strong> ({tx.points_delta > 0 ? `+${tx.points_delta}` : tx.points_delta} pts) — {tx.note || tx.offer_title || ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'offers' && (
              <div key="tab-offers" className="gw-enter-anim">
                <div className="gw-card">
                  <h3 className="gw-card-title">
                    {lang === 'de' ? 'Willkommensbonus (Neukunden)' : 'Welcome Bonus (New Customers)'}
                  </h3>
                  <form onSubmit={handleSaveWelcomeBonus} className="gw-form-grid">
                    <div className="gw-field">
                      <label className="gw-label">
                        {lang === 'de' ? 'Status' : 'Status'}
                      </label>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          minHeight: '46px',
                          padding: '0 14px',
                          border: '1px solid #d1d5db',
                          borderRadius: 'var(--radius-md)',
                          background: '#ffffff',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '14px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={welcomeBonusEnabled}
                          onChange={(e) => setWelcomeBonusEnabled(e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                        />
                        <span>
                          {welcomeBonusEnabled
                            ? lang === 'de'
                              ? 'Aktiviert'
                              : 'Enabled'
                            : lang === 'de'
                            ? 'Deaktiviert'
                            : 'Disabled'}
                        </span>
                      </label>
                    </div>

                    <div className="gw-field">
                      <label className="gw-label">
                        {lang === 'de' ? 'Startpunkte bei Registrierung' : 'Initial Bonus Points'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        disabled={!welcomeBonusEnabled}
                        className="gw-input"
                        value={welcomeBonusPoints}
                        onChange={(e) => setWelcomeBonusPoints(e.target.value)}
                      />
                    </div>

                    <button type="submit" disabled={savingBonus} className="gw-btn gw-btn-primary">
                      {lang === 'de' ? 'Bonus speichern' : 'Save Bonus'}
                    </button>
                  </form>
                </div>

                <div className="gw-card">
                  <h3 className="gw-card-title">{t('offersTab')}</h3>
                  <form onSubmit={handleCreateOffer} className="gw-form-grid">
                    <div className="gw-field">
                      <label className="gw-label">{t('offerTitleLabel')}</label>
                      <input
                        type="text"
                        required
                        className="gw-input"
                        value={offerTitle}
                        onChange={(e) => setOfferTitle(e.target.value)}
                      />
                    </div>
                    <div className="gw-field">
                      <label className="gw-label">{t('offerDescriptionLabel')}</label>
                      <input
                        type="text"
                        className="gw-input"
                        value={offerDescription}
                        onChange={(e) => setOfferDescription(e.target.value)}
                      />
                    </div>
                    <div className="gw-field">
                      <label className="gw-label">{t('pointsRequiredLabel')}</label>
                      <input
                        type="number"
                        min="1"
                        required
                        className="gw-input"
                        value={pointsRequired}
                        onChange={(e) => setPointsRequired(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="gw-btn gw-btn-primary">
                      {t('createOfferButton')}
                    </button>
                  </form>
                </div>

                <div className="gw-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="gw-table-wrap">
                    <table className="gw-table">
                      <thead>
                        <tr>
                          <th>{t('colOffer')}</th>
                          <th>{t('colPoints')}</th>
                          <th>{t('colStatus')}</th>
                          <th>{t('colAction')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offers.map((o) => (
                          <tr key={o.id} className="gw-table-row">
                            <td style={{ width: '40%' }}>
                              <strong>{o.title}</strong>
                              {o.description ? (
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  {o.description}
                                </div>
                              ) : null}
                            </td>
                            <td>{o.points_required}</td>
                            <td>
                              <span className={`gw-badge ${o.is_active ? 'gw-badge-active' : 'gw-badge-inactive'}`}>
                                {o.is_active ? t('statusActive') : t('statusInactive')}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleToggleOffer(o)}
                                className="gw-btn gw-btn-sm"
                                style={
                                  o.is_active
                                    ? { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }
                                    : {}
                                }
                              >
                                {o.is_active ? t('actionDisable') : t('actionEnable')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div key="tab-settings" className="gw-enter-anim">
                <div className="gw-card">
                  <h3 className="gw-card-title">
                    {lang === 'de' ? 'Sprache' : 'Language'}
                  </h3>
                  <p style={{ margin: '0 0 14px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {lang === 'de'
                      ? 'Wählen Sie die Anzeigesprache des Dashboards.'
                      : 'Choose the display language for the dashboard.'}
                  </p>
                  <LanguageToggleButton />
                </div>

                <div className="gw-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      marginBottom: '16px',
                    }}
                  >
                    <h3 className="gw-card-title" style={{ margin: 0 }}>
                      {lang === 'de' ? 'Punkte pro Euro' : 'Points per Euro'}
                    </h3>
                    <span className="gw-badge gw-badge-active">
                      {pointsRateEuros || 1} € = {pointsRatePoints || 0} pts
                    </span>
                  </div>

                  <form onSubmit={handleSavePointsRate} className="gw-form-grid">
                    <div className="gw-field">
                      <label className="gw-label">
                        {lang === 'de' ? 'Betrag (€)' : 'Amount (€)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        className="gw-input"
                        value={pointsRateEuros}
                        onChange={(e) => setPointsRateEuros(e.target.value)}
                      />
                    </div>

                    <div className="gw-field">
                      <label className="gw-label">
                        {lang === 'de' ? 'Punkte' : 'Points'}
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        required
                        className="gw-input"
                        value={pointsRatePoints}
                        onChange={(e) => setPointsRatePoints(e.target.value)}
                      />
                    </div>

                    <button type="submit" disabled={savingRate} className="gw-btn gw-btn-primary">
                      {savingRate
                        ? lang === 'de'
                          ? 'Speichert...'
                          : 'Saving...'
                        : lang === 'de'
                        ? 'Speichern'
                        : 'Save'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}