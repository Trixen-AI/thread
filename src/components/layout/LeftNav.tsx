import { NavLink, Link } from 'react-router-dom'
import {
  Bell,
  Compass,
  Home,
  Mail,
  PenSquare,
  Rocket,
  ShoppingBag,
  User as UserIcon,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  selectCurrentUser,
  selectSuggestedUsers,
  selectUnreadMessages,
  selectUnreadNotifications,
  setUi,
  useApp,
} from '@/store/appStore'
import { Button } from '@/components/ui/Button'
import { UserRow } from '@/components/social/UserBits'
import { WalletMiniCard } from '@/features/wallet/WalletMiniCard'

interface NavItemDef {
  to: string
  label: string
  icon: typeof Home
  badge?: number
  end?: boolean
}

function useNavItems(): NavItemDef[] {
  const state = useApp()
  const me = selectCurrentUser(state)
  return [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/communities', label: 'Communities', icon: Users },
    { to: '/messages', label: 'Messages', icon: Mail, badge: selectUnreadMessages(state) },
    {
      to: '/notifications',
      label: 'Notifications',
      icon: Bell,
      badge: selectUnreadNotifications(state),
    },
    { to: '/launchpad', label: 'Launchpad', icon: Rocket },
    { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
    { to: `/u/${me.handle}`, label: 'Profile', icon: UserIcon },
  ]
}

function NavItem({ item }: { item: NavItemDef }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-[14px] px-3 py-2.5',
          'text-[15px] font-semibold tracking-[-0.01em] transition-all duration-200',
          isActive ? 'glass text-brand-700' : 'text-ink-600 hover:bg-white/55 hover:text-ink-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn('size-[21px] shrink-0', isActive ? 'text-brand-600' : 'text-ink-500')}
            strokeWidth={isActive ? 2.3 : 1.9}
          />
          <span className="flex-1">{item.label}</span>
          {!!item.badge && (
            <span className="min-w-[21px] rounded-full bg-like px-1.5 py-[1px] text-center text-[11px] font-bold text-white">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export function LeftNav() {
  const state = useApp()
  const suggested = selectSuggestedUsers(state, 3)
  const items = useNavItems()

  return (
    <nav className="flex h-full flex-col gap-4" aria-label="Primary">
      <div className="space-y-1">
        {items.map((item) => (
          <NavItem key={item.to} item={item} />
        ))}
      </div>

      <Button
        block
        size="lg"
        icon={<PenSquare className="size-[18px]" />}
        onClick={() => setUi({ composerOpen: true })}
      >
        Create Post
      </Button>

      <WalletMiniCard />

      {suggested.length > 0 && (
        <div className="pt-1">
          <h2 className="px-2 pb-1.5 text-[13px] font-semibold tracking-[-0.01em] text-ink-500">
            Suggested for you
          </h2>
          <div className="-mx-1">
            {suggested.map((user) => (
              <UserRow key={user.id} user={user} size="sm" />
            ))}
          </div>
          <Link
            to="/explore?tab=people"
            className="mt-1 inline-block px-2 text-[13.5px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            View more
          </Link>
        </div>
      )}
    </nav>
  )
}
