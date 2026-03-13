import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Devices' },
  { to: '/racks', label: 'Racks' },
  { to: '/projects', label: 'Projects' },
]

export default function AppShell() {
  return (
    <div className="flex h-screen flex-col bg-gray-50 md:flex-row">
      <nav className="bg-gray-900 text-white md:flex md:w-56 md:flex-col md:shrink-0">
        <div className="px-4 py-4 border-b border-gray-700 md:py-5">
          <h1 className="text-lg font-bold tracking-tight">Rack Builder</h1>
        </div>
        <ul className="flex overflow-x-auto px-2 py-2 md:flex-1 md:flex-col md:overflow-visible md:px-0">
          {navItems.map((item) => (
            <li key={item.to} className="shrink-0 md:shrink">
              <NavLink
                to={item.to}
                end
                className={({ isActive }) =>
                  `block rounded-md px-4 py-2.5 text-sm transition-colors md:rounded-none ${
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
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
