import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { routes } from './routes';

// Guard: redirect to /login if not authenticated (for protected routes)
function ProtectedRoute({ element }: { element: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{element}</>;
}

function AppRoutes() {
  return (
    <>
      <IntersectObserver />
      <Routes>
        {routes.map((route, index) => (
          <Route
            key={index}
            path={route.path}
            element={
              route.public
                ? route.element
                : <ProtectedRoute element={route.element} />
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow">
            <AppRoutes />
          </main>
        </div>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </Router>
  );
};

export default App;
