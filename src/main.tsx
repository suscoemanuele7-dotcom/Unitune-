import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AuthBootstrap, RequireAuth } from './auth/AuthGate'
import { AppShell } from './components/AppShell'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { RouteError } from './components/RouteError'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { PlayerScreen } from './pages/PlayerScreen'
import { PlaylistPage } from './pages/PlaylistPage'
import { QueuePage } from './pages/QueuePage'
import { SearchPage } from './pages/SearchPage'
import { FavoritesPage, HistoryPage } from './pages/TrackListPages'
import './pwa/useInstallPrompt'
import './index.css'

const router = createBrowserRouter([
  { path: '/welcome', element: <OnboardingPage />, errorElement: <RouteError /> },
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'library/favorites', element: <FavoritesPage /> },
      { path: 'library/history', element: <HistoryPage /> },
      { path: 'playlist/:id', element: <PlaylistPage /> },
      // Player e coda sono "pagine" sovrapposte: il tasto Indietro le chiude.
      { path: 'player', element: <PlayerScreen /> },
      { path: 'queue', element: <QueuePage /> },
    ],
  },
])

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Elemento #root mancante in index.html')

createRoot(rootElement).render(
  <StrictMode>
    <AuthBootstrap>
      <RouterProvider router={router} />
      <PwaUpdatePrompt />
    </AuthBootstrap>
  </StrictMode>,
)
