import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import DeviceManagerPage from './pages/DeviceManagerPage'
import RackManagerPage from './pages/RackManagerPage'
import ProjectManagerPage from './pages/ProjectManagerPage'
import LayoutEditorPage from './pages/LayoutEditorPage'
import LayoutPrintPage from './pages/LayoutPrintPage'
import ProjectPrintPage from './pages/ProjectPrintPage'
import LegacyLayoutEditorRedirectPage from './pages/LegacyLayoutEditorRedirectPage'
import LegacyLayoutPrintRedirectPage from './pages/LegacyLayoutPrintRedirectPage'
import PanelLayoutManagerPage from './pages/PanelLayoutManagerPage'
import PanelLayoutsOverviewPage from './pages/PanelLayoutsOverviewPage'
import PanelLayoutEditorPage from './pages/PanelLayoutEditorPage'
import PanelLayoutPrintPage from './pages/PanelLayoutPrintPage'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL || '/'}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DeviceManagerPage />} />
          <Route path="/racks" element={<RackManagerPage />} />
          <Route path="/projects" element={<ProjectManagerPage />} />
          <Route path="/panels" element={<PanelLayoutsOverviewPage />} />
          <Route path="/layouts" element={<Navigate to="/projects" replace />} />
          <Route path="/editor/project/:projectId/panels" element={<PanelLayoutManagerPage />} />
        </Route>
        <Route path="/editor/project/:projectId" element={<LayoutEditorPage />} />
        <Route path="/editor/project/:projectId/panels/:panelLayoutId" element={<PanelLayoutEditorPage />} />
        <Route path="/editor/project/:projectId/panels/:panelLayoutId/print" element={<PanelLayoutPrintPage />} />
        <Route path="/editor/project/:projectId/print" element={<ProjectPrintPage />} />
        <Route path="/editor/project/:projectId/print/all" element={<ProjectPrintPage />} />
        <Route path="/editor/project/:projectId/print/:layoutId" element={<LayoutPrintPage />} />
        <Route path="/editor/:layoutId" element={<LegacyLayoutEditorRedirectPage />} />
        <Route path="/editor/:layoutId/print" element={<LegacyLayoutPrintRedirectPage />} />
      </Routes>
    </BrowserRouter>
  )
}
