import React, { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Moon, Sun, LogOut, Mail } from 'lucide-react'

export default function Navbar({ theme, onThemeToggle, user, onLogout }) {
  const handleSignOut = () => {
    if (onLogout) {
      onLogout()
    }
  }

  return (
    <div className="h-12 border-b border-ide-border bg-ide-panel flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-ide-text">EarthCode</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onThemeToggle()
          }}
          className="p-2 rounded hover:bg-ide-bg transition-colors text-ide-text-muted hover:text-ide-text"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* User Profile Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-ide-bg transition-colors">
              <div className="w-8 h-8 rounded-full bg-ide-accent flex items-center justify-center text-white text-sm font-medium">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[200px] bg-ide-panel border border-ide-border rounded shadow-lg p-1 z-50"
              sideOffset={5}
            >
              <div className="px-3 py-2 border-b border-ide-border mb-1">
                <div className="text-sm font-medium text-ide-text">{user?.name || 'User'}</div>
                <div className="text-xs text-ide-text-muted mt-0.5 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {user?.email || 'user@example.com'}
                </div>
              </div>

              <DropdownMenu.Item
                onSelect={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ide-text rounded cursor-pointer outline-none hover:bg-red-500/20 hover:text-red-400 focus:bg-red-500/20 focus:text-red-400 transition-colors data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-400"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </DropdownMenu.Item>

              <DropdownMenu.Arrow className="fill-ide-panel" />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  )
}
