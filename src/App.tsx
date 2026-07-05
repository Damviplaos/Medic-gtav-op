import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { routes } from './routes';

function ProtectedRoute({ element }: { element: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{element}</>;
}

function AppRoutes() {
  return (
    <>
      <IntersectObserver />
      <Routes>
        {routes.map((route, idx) => (
          <Route
            key={idx}
            path={route.path}
            element={route.public ? route.element : <ProtectedRoute element={route.element} />}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

const App: React.FC = () => (
  <Router>
    <AuthProvider>
      <AppRoutes />
      <Toaster position="top-center" richColors />
    </AuthProvider>
  </Router>
);

export default App;
