import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import HomePage from './pages/HomePage'
import OrdersPage from './pages/OrdersPage'
import OrderProductionPage from './pages/OrderProductionPage'
import ProductionPlanningPage from './pages/ProductionPlanningPage'
import OrderDetailPage from './pages/OrderDetailPage'
import PartDetailPage from './pages/PartDetailPage'
import HandlowkaPage from './pages/HandlowkaPage'
import KooperacjaPage from './pages/KooperacjaPage'
import ProductionCardPage from './pages/ProductionCardPage'
import SettingsPage from './pages/SettingsPage'
import NewOrderPage from './pages/NewOrderPage'

// ─── Layout ──────────────────────────────────────────────────────────────────

function Layout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </div>
    </div>
  )
}

// ─── Route guard ─────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ─── App ─────────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* Logowanie i reset hasła — publiczne */}
      <Route path="/login"       element={<LoginPage />} />
      <Route path="/reset-hasla" element={<ResetPasswordPage />} />

      {/* Karta produkcyjna — standalone */}
      <Route path="/karta-produkcyjna/:partId" element={
        <RequireAuth><ProductionCardPage /></RequireAuth>
      } />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/"                                          element={<Navigate to="/home" replace />} />
        <Route path="/home"                                      element={<HomePage />} />
        <Route path="/orders"                                    element={<OrdersPage />} />
        <Route path="/orders/nowe/:orderNumber"                  element={<NewOrderPage />} />
        <Route path="/orders/edytuj/:orderNumber"               element={<NewOrderPage />} />
        <Route path="/orders/:orderNumber"                       element={<OrderProductionPage />} />
        <Route path="/orders/:orderNumber/planowanie"            element={<ProductionPlanningPage />} />
        <Route path="/karta-detalu/:numer_detalu"                element={<PartDetailPage />} />
        <Route path="/poprodukcyjne"                             element={<OrderDetailPage />} />
        <Route path="/orders/:orderNumber/poprodukcyjne"         element={<OrderDetailPage />} />
        <Route path="/handlowka"                                 element={<HandlowkaPage />} />
        <Route path="/kooperacja"                                element={<KooperacjaPage />} />
        <Route path="/ustawienia"                                element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
