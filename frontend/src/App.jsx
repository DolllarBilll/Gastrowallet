import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import StoreDashboard from './pages/store/StoreDashboard';
import { resetViewportZoom } from './utils/viewport';

// Guard routes based on authentication and required role
function ProtectedRoute({ requiredRole, children }) {
  const { token, user } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/store'} replace />;
  }

  return children;
}

export default function App() {
  useEffect(() => {
    const handleButtonClick = (e) => {
      if (e.target.closest('button')) {
        resetViewportZoom();
      }
    };

    document.addEventListener('click', handleButtonClick);
    return () => document.removeEventListener('click', handleButtonClick);
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/store"
              element={
                <ProtectedRoute requiredRole="STORE">
                  <StoreDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}