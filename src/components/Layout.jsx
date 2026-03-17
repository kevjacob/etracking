import { Outlet } from 'react-router-dom'
import { TestModeProvider } from '../context/TestModeContext'
import Header from './Header'
import NavBar from './NavBar'
import ChatBox from './ChatBox'

export default function Layout() {
  return (
    <TestModeProvider>
      <div className="min-h-screen flex flex-col bg-slate-100">
        <Header />
        <NavBar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
        <ChatBox />
      </div>
    </TestModeProvider>
  )
}
