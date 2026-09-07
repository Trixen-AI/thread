import { NavLink } from 'react-router-dom'
import { Compass, Home, Mail, Plus, Rocket, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { selectCurrentUser, selectUnreadMessages, setUi, useApp } from '@/store/appStore'

/**
 * Floating glass tab bar.
 *
 * Detached from the screen edge so content scrolls *under* it — that motion is
 * what makes the material read as glass. The create action is a separate
 * capsule beside it: a primary action deserves its own target, not a slot that
 * looks like a destination.
 */
export function MobileTabBar() {
  const state = useApp()
  const me = selectCurrentUser(state)
  const unread = selectUnreadMessages(state)

  const tab = (isActive: boolean) =>
    cn(
      'flex flex-1 flex-col items-center justify-center gap-[3px] rounded-[16px] py-2',
      'text-[10px] font-semibold tracking-[-0.01em] transition-colors duration-200',
      isActive ? 'text-brand-600' : 'text-ink-500',
    )

  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3 lg:hidden">
      <nav
        aria-label="Primary"
        className="glass pointer-events-auto flex flex-1 items-stretch rounded-[22px] px-1.5"
      >
        <NavLink to="/" end className={({ isActive }) => tab(isActive)}>
          {({ isActive }) => (
            <>
              <Home className="size-[23px]" strokeWidth={isActive ? 2.4 : 1.9} />
              Home
            </>
          )}
        </NavLink>

        <NavLink to="/explore" className={({ isActive }) => tab(isActive)}>
          {({ isActive }) => (
            <>
              <Compass className="size-[23px]" strokeWidth={isActive ? 2.4 : 1.9} />
              Explore
            </>
          )}
        </NavLink>

        <NavLink to="/launchpad" className={({ isActive }) => tab(isActive)}>
          {({ isActive }) => (
            <>
              <Rocket className="size-[23px]" strokeWidth={isActive ? 2.4 : 1.9} />
              Launch
            </>
          )}
        </NavLink>

        <NavLink to="/messages" className={({ isActive }) => tab(isActive)}>
          {({ isActive }) => (
            <>
              <span className="relative">
                <Mail className="size-[23px]" strokeWidth={isActive ? 2.4 : 1.9} />
                {!!unread && (
                  <span className="absolute -right-2 -top-1 min-w-[17px] rounded-full bg-like px-1 text-center text-[10px] font-bold leading-[17px] text-white shadow-[0_0_0_2px_rgb(255_255_255/0.8)]">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </span>
              Messages
            </>
          )}
        </NavLink>

        <NavLink to={`/u/${me.handle}`} className={({ isActive }) => tab(isActive)}>
          {({ isActive }) => (
            <>
              <UserIcon className="size-[23px]" strokeWidth={isActive ? 2.4 : 1.9} />
              Profile
            </>
          )}
        </NavLink>
      </nav>

      <button
        onClick={() => setUi({ composerOpen: true })}
        aria-label="Create post"
        className={cn(
          'pointer-events-auto ml-2 flex size-[58px] shrink-0 items-center justify-center rounded-[22px]',
          'bg-brand-600 text-white transition-transform duration-200',
          '[transition-timing-function:var(--ease-tap)] active:scale-90',
          'shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_24px_-6px_rgb(88_86_214/0.6)]',
        )}
      >
        <Plus className="size-7" strokeWidth={2.4} />
      </button>
    </div>
  )
}
