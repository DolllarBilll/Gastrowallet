import { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    brandName: 'GastroWallet',
    switchToGerman: 'Deutsch (DE)',
    switchToEnglish: 'English (EN)',
    logout: 'Sign Out',
    loginTitle: 'Sign In to GastroWallet',
    loginSubtitle: 'Access your platform admin or store workspace.',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    loginButton: 'Sign In',
    adminRoleBadge: 'Platform Admin',
    storeRoleBadge: 'Store Workspace',
    adminPanelTitle: 'Platform Administration',
    storesTab: 'Stores',
    adminsTab: 'Admins',
    createStoreTitle: 'Create Store Account',
    storeNameLabel: 'Store Name',
    createStoreButton: 'Create Store',
    createAdminTitle: 'Add Platform Admin',
    adminFullNameLabel: 'Full Name',
    createAdminButton: 'Add Admin',
    colStore: 'Store',
    colName: 'Name',
    colEmail: 'Email',
    colCustomers: 'Customers',
    colRole: 'Role',
    colStatus: 'Status',
    colAction: 'Action',
    colOffer: 'Offer',
    colPoints: 'Points',
    statusActive: 'Active',
    statusInactive: 'Inactive',
    actionEnable: 'Enable',
    actionDisable: 'Disable',
    roleOwner: 'Owner',
    roleAdmin: 'Admin',
    registerTab: 'Register Customer',
    scanTab: 'Scan QR & Points',
    offersTab: 'Offers',
    customerNameLabel: 'Customer Full Name',
    customerEmailLabel: 'Customer Email',
    walletUrlLabel: 'Mobile Wallet Link (Optional)',
    registerCustomerButton: 'Register & Send Pass Email',
    qrTokenPlaceholder: 'Paste QR token to look up customer',
    lookupButton: 'Lookup',
    pointsBalanceLabel: 'Points Balance',
    pointsToAddLabel: 'Points to Add',
    addPointsButton: 'Add Points',
    redeemOfferButton: 'Redeem Offer',
    recentTransactionsTitle: 'Recent Transactions',
    noTransactions: 'No transactions yet.',
    offerTitleLabel: 'Offer Title',
    offerDescriptionLabel: 'Description (Optional)',
    pointsRequiredLabel: 'Points Required',
    createOfferButton: 'Create Offer',
    noActiveOffers: 'No active offers available',
  },
  de: {
    brandName: 'GastroWallet',
    switchToGerman: 'Deutsch (DE)',
    switchToEnglish: 'English (EN)',
    logout: 'Abmelden',
    loginTitle: 'Bei GastroWallet anmelden',
    loginSubtitle: 'Zugriff auf den Plattform-Admin oder den Store-Bereich.',
    emailLabel: 'E-Mail-Adresse',
    passwordLabel: 'Passwort',
    loginButton: 'Anmelden',
    adminRoleBadge: 'Plattform-Admin',
    storeRoleBadge: 'Store-Bereich',
    adminPanelTitle: 'Plattform-Verwaltung',
    storesTab: 'Stores',
    adminsTab: 'Admins',
    createStoreTitle: 'Store-Konto erstellen',
    storeNameLabel: 'Store-Name',
    createStoreButton: 'Store erstellen',
    createAdminTitle: 'Plattform-Admin hinzufügen',
    adminFullNameLabel: 'Vollständiger Name',
    createAdminButton: 'Admin hinzufügen',
    colStore: 'Store',
    colName: 'Name',
    colEmail: 'E-Mail',
    colCustomers: 'Kunden',
    colRole: 'Rolle',
    colStatus: 'Status',
    colAction: 'Aktion',
    colOffer: 'Angebot',
    colPoints: 'Punkte',
    statusActive: 'Aktiv',
    statusInactive: 'Inaktiv',
    actionEnable: 'Aktivieren',
    actionDisable: 'Deaktivieren',
    roleOwner: 'Inhaber',
    roleAdmin: 'Admin',
    registerTab: 'Kunde registrieren',
    scanTab: 'QR scannen & Punkte',
    offersTab: 'Angebote',
    customerNameLabel: 'Vollständiger Name des Kunden',
    customerEmailLabel: 'Kunden-E-Mail',
    walletUrlLabel: 'Mobile-Wallet-Link (Optional)',
    registerCustomerButton: 'Registrieren & Pass senden',
    qrTokenPlaceholder: 'QR-Token einfügen, um Kunden zu suchen',
    lookupButton: 'Suchen',
    pointsBalanceLabel: 'Punktestand',
    pointsToAddLabel: 'Punkte hinzufügen',
    addPointsButton: 'Punkte hinzufügen',
    redeemOfferButton: 'Angebot einlösen',
    recentTransactionsTitle: 'Letzte Transaktionen',
    noTransactions: 'Noch keine Transaktionen.',
    offerTitleLabel: 'Angebotstitel',
    offerDescriptionLabel: 'Beschreibung (Optional)',
    pointsRequiredLabel: 'Erforderliche Punkte',
    createOfferButton: 'Angebot erstellen',
    noActiveOffers: 'Keine aktiven Angebote verfügbar',
  },
};

const LanguageContext = createContext(null);

// Provide English-default localization with German toggle support
export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('en');

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'de' : 'en'));
  };

  const t = (key) => translations[lang][key] || translations.en[key] || key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}