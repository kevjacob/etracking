import { useAuth } from '../context/AuthContext'
import { useTestMode } from '../context/TestModeContext'
import { useMaintenanceMode } from '../context/MaintenanceModeContext'

function ToggleSwitch({ checked, onClick, disabled, id }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-white/20' : 'bg-blue-800'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0.5'
        }`}
        style={{ marginTop: 2 }}
      />
    </button>
  )
}

export default function Header() {
  const { user, logout, isSuperuser } = useAuth()
  const { testMode, setTestMode } = useTestMode()
  const { maintenanceEnabled, toggling, toggleError, toggleMaintenanceMode } = useMaintenanceMode()
  return (
    <header className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">Tai Say Company eTracking</h1>
        {isSuperuser && (
          <>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium text-blue-100">Maintenance Mode</span>
              <ToggleSwitch
                id="maintenance-mode-toggle"
                checked={maintenanceEnabled}
                disabled={toggling}
                onClick={toggleMaintenanceMode}
              />
            </label>
            {maintenanceEnabled && (
              <span className="text-xs font-medium uppercase tracking-wide text-amber-200 bg-amber-900/40 px-2 py-0.5 rounded">
                Site locked for users
              </span>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm font-medium text-blue-100">Test Mode</span>
              <ToggleSwitch
                id="test-mode-toggle"
                checked={testMode}
                onClick={() => setTestMode((v) => !v)}
              />
            </label>
          </>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        {toggleError && (
          <p className="text-xs text-red-200 max-w-xs text-right" role="alert">
            {toggleError}
          </p>
        )}
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
      </div>
    </header>
  )
}
