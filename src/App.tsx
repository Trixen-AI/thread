import { useEffect } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { useApp } from '@/store/appStore'
import { bootstrap } from '@/store/actions'
import { HomePage } from '@/pages/HomePage'
import { ExplorePage } from '@/pages/ExplorePage'
import { SearchPage } from '@/pages/SearchPage'
import { CommunitiesPage } from '@/pages/CommunitiesPage'
import { CommunityPage } from '@/pages/CommunityPage'
import { MessagesPage } from '@/pages/MessagesPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { WalletPage } from '@/pages/WalletPage'
import { MarketplacePage } from '@/pages/MarketplacePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SavedPage } from '@/pages/SavedPage'
import { PostPage } from '@/pages/PostPage'
import { WelcomePage } from '@/pages/WelcomePage'
import { TokensPage } from '@/pages/TokensPage'
import { LaunchPage } from '@/pages/LaunchPage'
import { TokenPage } from '@/pages/TokenPage'
import { Toaster } from '@/components/ui/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import { CreatePostModal } from '@/features/create-post/CreatePostModal'
import { TipModal } from '@/features/payments/TipModal'
import { CollectModal } from '@/features/payments/CollectModal'
import { PurchaseModal } from '@/features/payments/PurchaseModal'
import { AccessModal } from '@/features/communities/AccessModal'
import { WalletSheets } from '@/features/wallet/WalletSheets'
import { NetworkModal } from '@/features/wallet/NetworkModal'
import { StoryViewer } from '@/features/stories/Stories'

/**
 * Overlays live at the root so any screen can open them by setting UI state —
 * no prop drilling, and only one instance of each dialog exists.
 */
function Overlays() {
  return (
    <>
      <CreatePostModal />
      <TipModal />
      <CollectModal />
      <PurchaseModal />
      <AccessModal />
      <WalletSheets />
      <NetworkModal />
      <StoryViewer />
      <Toaster />
    </>
  )
}

/** Shown while the stored session is validated against the server. */
function Booting() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <LogoMark className="size-12 animate-[var(--animate-fade-in)]" />
      <p className="text-[13px] text-ink-500">Connecting…</p>
    </div>
  )
}

export default function App() {
  const { status } = useApp()

  useEffect(() => {
    void bootstrap()
  }, [])

  if (status === 'loading') return <Booting />
  if (status !== 'ready') return <WelcomePage />

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/communities" element={<CommunitiesPage />} />
        <Route path="/c/:slug" element={<CommunityPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:id" element={<MessagesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/u/:handle" element={<ProfilePage />} />
        <Route path="/post/:id" element={<PostPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/launchpad" element={<TokensPage />} />
        <Route path="/launchpad/create" element={<LaunchPage />} />
        <Route path="/t/:address" element={<TokenPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Overlays />
    </Router>
  )
}
