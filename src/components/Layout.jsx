import { Outlet } from 'react-router-dom'
import Header from './Header'
import NavBar from './NavBar'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header />
      <NavBar />
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
