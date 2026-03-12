import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import DeviceManagerPage from './pages/DeviceManagerPage'
import RackManagerPage from './pages/RackManagerPage'
import LayoutManagerPage from './pages/LayoutManagerPage'
import LayoutEditorPage from './pages/LayoutEditorPage'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL || '/'}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DeviceManagerPage />} />
          <Route path="/racks" element={<RackManagerPage />} />
          <Route path="/layouts" element={<LayoutManagerPage />} />
        </Route>
        <Route path="/editor/:layoutId" element={<LayoutEditorPage />} />
      </Routes>
    </BrowserRouter>
  )
}
