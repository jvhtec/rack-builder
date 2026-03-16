import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Devices' },
  { to: '/racks', label: 'Racks' },
  { to: '/projects', label: 'Projects' },
  { to: '/connectors', label: 'Connectors' },
  { to: '/panels', label: 'Panel Layouts' },
]

export default function AppShell() {
  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden md:h-screen md:overflow-hidden">
      <nav className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 bg-gray-900 text-white flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-700">
          <h1 className="text-lg font-bold tracking-tight">Rack Builder</h1>
        </div>
        <ul className="flex-1 py-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end
                className={({ isActive }) =>
                  `block px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-700 text-white font-medium'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex-1 flex min-h-screen flex-col md:min-h-0">
        <header
          className="md:hidden sticky top-0 z-20 bg-gray-900 text-white border-b border-gray-700 px-4 py-3"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <h1 className="text-base font-semibold tracking-tight">Rack Builder</h1>
        </header>

        <main
          className="flex-1 overflow-auto px-4 py-4 pb-24 md:p-6 md:pb-6"
          style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>

        <nav
          className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-gray-200"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}>
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `flex min-h-14 items-center justify-center px-2 text-xs font-medium transition-colors ${
                      isActive ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
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
