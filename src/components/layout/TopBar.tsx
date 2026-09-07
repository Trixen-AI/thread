import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  AtSign,
  Bell,
  Bookmark,
  Home,
  LogOut,
  Mail,
  MoreHorizontal,
  Search,
  Settings,
  User as UserIcon,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  selectCurrentUser,
  selectUnreadMessages,
  selectUnreadNotifications,
  useApp,
} from '@/store/appStore'
import { signOut } from '@/store/actions'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Menu, MenuDivider, MenuItem } from '@/components/ui/Menu'
import { SearchBox } from '@/features/search/SearchBox'

function QuickNavLink({
  to,
  label,
  icon: Icon,
  badge,
  end,
}: {
  to: string
  label: string
  icon: typeof Home
  badge?: number
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        cn(
          'relative flex h-11 w-[68px] items-center justify-center rounded-[14px] transition-all duration-200',
          isActive
            ? 'bg-brand-600/12 text-brand-600'
            : 'text-ink-500 hover:bg-ink-700/8 hover:text-ink-800',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="size-[22px]" strokeWidth={isActive ? 2.3 : 1.9} />
          {!!badge && (
            <span className="absolute right-3 top-1.5 min-w-[17px] rounded-full bg-like px-1 text-center text-[10px] font-bold leading-[17px] text-white shadow-[0_0_0_2px_rgb(255_255_255/0.75)]">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

/** Desktop header: brand, global search, quick nav, account menu. */
export function TopBar() {
  const state = useApp()
  const me = selectCurrentUser(state)
  const navigate = useNavigate()

  return (
    <header className="glass-bar hairline sticky top-0 z-40 hidden lg:block">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-4 px-5">
        <Link to="/" className="w-[212px] shrink-0" aria-label="MESH home">
          <Logo />
        </Link>

        <SearchBox className="w-full max-w-[300px]" />

        <nav className="mx-auto flex items-center gap-1" aria-label="Quick navigation">
          <QuickNavLink to="/" label="Home" icon={Home} end />
          <QuickNavLink
            to="/notifications"
            label="Notifications"
            icon={Bell}
            badge={selectUnreadNotifications(state)}
          />
          <QuickNavLink
            to="/messages"
            label="Messages"
            icon={Mail}
            badge={selectUnreadMessages(state)}
          />
          <QuickNavLink to="/explore" label="Explore" icon={AtSign} />
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link to={`/u/${me.handle}`} aria-label="Your profile">
            <Avatar
              seed={me.avatar}
              size="md"
              name={me.name}
              className="ring-2 ring-white/80 transition-transform duration-200 hover:scale-105"
            />
          </Link>
          <Menu
            trigger={({ toggle, open }) => (
              <button
                onClick={toggle}
                aria-label="Account menu"
                aria-expanded={open}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full transition-colors',
                  open ? 'bg-ink-700/12 text-ink-800' : 'text-ink-500 hover:bg-ink-700/8',
                )}
              >
                <MoreHorizontal className="size-[19px]" />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <Avatar seed={me.avatar} size="sm" name={me.name} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink-900">{me.name}</p>
                    <p className="truncate text-[12.5px] text-ink-500">@{me.handle}</p>
                  </div>
                </div>
                <MenuDivider />
                <MenuItem
                  icon={<UserIcon className="size-[17px]" />}
                  onClick={() => {
                    close()
                    navigate(`/u/${me.handle}`)
                  }}
                >
                  View profile
                </MenuItem>
                <MenuItem
                  icon={<Wallet className="size-[17px]" />}
                  onClick={() => {
                    close()
                    navigate('/wallet')
                  }}
                >
                  Wallet & identity
                </MenuItem>
                <MenuItem
                  icon={<Bookmark className="size-[17px]" />}
                  onClick={() => {
                    close()
                    navigate('/saved')
                  }}
                >
                  Saved posts
                </MenuItem>
                <MenuItem
                  icon={<Settings className="size-[17px]" />}
                  onClick={() => {
                    close()
                    navigate('/settings')
                  }}
                >
                  Settings
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  icon={<LogOut className="size-[17px]" />}
                  danger
                  onClick={() => {
                    close()
                    void signOut()
                  }}
                >
                  Sign out
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>
    </header>
  )
}

/** Mobile header: compact brand mark, search shortcut, notifications. */
export function MobileTopBar({
  title,
  showLogo = true,
}: {
  title?: string
  showLogo?: boolean
}) {
  const state = useApp()
  const unread = selectUnreadNotifications(state)

  return (
    <header className="glass-bar hairline sticky top-0 z-30 flex h-[52px] items-center gap-3 px-4 lg:hidden">
      {showLogo ? (
        <Link to="/" className="flex items-center gap-2" aria-label="MESH home">
          <LogoMark className="size-8" />
          <span className="text-[19px] font-bold tracking-[-0.03em] text-ink-900">MESH</span>
        </Link>
      ) : (
        <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-ink-900">
          {title}
        </h1>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Link
          to="/search"
          aria-label="Search"
          className="flex size-9 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-ink-700/8"
        >
          <Search className="size-[21px]" strokeWidth={2.1} />
        </Link>
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-ink-700/8"
        >
          <Bell className="size-[21px]" strokeWidth={2.1} />
          {!!unread && (
            <span className="absolute right-[7px] top-[7px] size-[9px] rounded-full bg-like shadow-[0_0_0_2px_rgb(255_255_255/0.9)]" />
          )}
        </Link>
      </div>
    </header>
  )
}
