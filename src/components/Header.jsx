import { useAuth } from '../context/AuthContext'
import { useTestMode } from '../context/TestModeContext'

export default function Header() {
  const { user, logout, isSuperuser } = useAuth()
  const { testMode, setTestMode } = useTestMode()
  return (
    <header className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Tai Say Company eTracking</h1>
        {isSuperuser && (
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm font-medium text-blue-100">Test Mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={testMode}
              onClick={() => setTestMode((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                testMode ? 'bg-white/20' : 'bg-blue-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  testMode ? 'translate-x-6' : 'translate-x-0.5'
                }`}
                style={{ marginTop: 2 }}
              />
            </button>
          </label>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-blue-100">Welcome, {user?.name || user?.username || 'User'}</span>
        <button
          type="button"
          onClick={logout}
          className="text-sm px-3 py-1.5 rounded hover:bg-blue-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
