import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import OrdersPage from './pages/OrdersPage'
import OrderProductionPage from './pages/OrderProductionPage'
import ProductionPlanningPage from './pages/ProductionPlanningPage'
import OrderDetailPage from './pages/OrderDetailPage'
import PartDetailPage from './pages/PartDetailPage'
import HandlowkaPage from './pages/HandlowkaPage'
import ProductionCardPage from './pages/ProductionCardPage'

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

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  return (
    <Routes>
      {/* Karta produkcyjna — standalone, bez sidebaru */}
      <Route path="/karta-produkcyjna/:partId" element={<ProductionCardPage />} />

      <Route element={<Layout />}>
        <Route path="/"                                          element={<Navigate to="/home" replace />} />
        {/* Strona główna — siatka produkcyjna ze wszystkimi detalami */}
        <Route path="/home"                                      element={<HomePage />} />
        {/* Lista zamówień */}
        <Route path="/orders"                                    element={<OrdersPage />} />
        {/* Klik z listy zamówień → widok zamówienia (Kop.1/2/3, Handlówka, Przeróbka) */}
        <Route path="/orders/:orderNumber"                       element={<OrderProductionPage />} />
        {/* Sidebar "Planowanie produkcji" → siatka z kolorowaniem statusów */}
        <Route path="/orders/:orderNumber/planowanie"            element={<ProductionPlanningPage />} />
        {/* Karta Detalu — formularz standalone */}
        <Route path="/karta-detalu/:numer_detalu"                element={<PartDetailPage />} />
        {/* Dane poprodukcyjne — wszystkie detale, bez wyboru zamówienia */}
        <Route path="/poprodukcyjne"                             element={<OrderDetailPage />} />
        {/* Stara trasa — zachowana dla kompatybilności */}
        <Route path="/orders/:orderNumber/poprodukcyjne"         element={<OrderDetailPage />} />
        {/* Zamówienia handlówki */}
        <Route path="/handlowka"                                 element={<HandlowkaPage />} />
      </Route>
    </Routes>
  )
}

export default App
