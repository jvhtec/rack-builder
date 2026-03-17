import { NavLink, Outlet } from 'react-router-dom'
import { Server, LayoutGrid, FolderOpen, Cable, PanelTop } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import ThemeToggle from '../ui/ThemeToggle'

const navItems = [
  { to: '/', label: 'Devices', icon: Server },
  { to: '/racks', label: 'Racks', icon: LayoutGrid },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/connectors', label: 'Connectors', icon: Cable },
  { to: '/panels', label: 'Panels', icon: PanelTop },
]

export default function AppShell() {
  const { isDark, toggle } = useTheme()

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden md:h-screen md:overflow-hidden">
      {/* Desktop sidebar */}
      <nav className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 bg-gray-900 dark:bg-gray-950 text-white flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-700 dark:border-gray-800">
          <h1 className="text-lg font-bold tracking-tight">Rack Builder</h1>
        </div>
        <ul className="flex-1 py-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-700 dark:bg-gray-800 text-white font-medium'
                      : 'text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="px-3 py-3 border-t border-gray-700 dark:border-gray-800">
          <div className="flex justify-end mb-2">
            <ThemeToggle isDark={isDark} toggle={toggle} />
          </div>
          <p className="text-[10px] text-gray-500 text-center">© {new Date().getFullYear()} JVH</p>
        </div>
      </nav>

      <div className="flex-1 flex min-h-screen flex-col md:min-h-0">
        {/* Mobile top header */}
        <header
          className="md:hidden sticky top-0 z-20 bg-gray-900 dark:bg-gray-950 text-white border-b border-gray-700 dark:border-gray-800 px-4 py-3 flex items-center justify-between"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <div>
            <h1 className="text-base font-semibold tracking-tight">Rack Builder</h1>
            <p className="text-[9px] text-gray-500">© {new Date().getFullYear()} JVH</p>
          </div>
          <ThemeToggle isDark={isDark} toggle={toggle} />
        </header>

        <main
          className="flex-1 overflow-auto px-4 py-4 pb-24 md:p-6 md:pb-6 dark:bg-gray-900 dark:text-gray-100"
          style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}>
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-1 min-h-16 px-1 py-2 text-[10px] font-medium transition-colors ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`
                  }
                >
                  <item.icon size={20} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
