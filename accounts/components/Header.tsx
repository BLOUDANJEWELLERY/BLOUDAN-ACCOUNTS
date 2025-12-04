import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

export default function Header() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', current: router.pathname === '/', icon: '🏠' },
    { name: 'Accounts', href: '/accounts', current: router.pathname === '/accounts', icon: '👥' },
    { name: 'Vouchers', href: '/vouchers/list', current: router.pathname.startsWith('/vouchers'), icon: '📄' },
    { name: 'Cheques', href: '/cheques', current: router.pathname === '/cheques', icon: '🏦' },
    { name: 'Type Summary', href: '/balance-sheet/type-summary', current: router.pathname === '/balance-sheet/type-summary', icon: '📊' },
  ];

  const accountTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];

  return (
    <header className="bg-gradient-to-r from-blue-800 via-blue-700 to-blue-600 shadow-2xl border-b-4 border-blue-400/30 backdrop-blur-sm">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 ring-2 ring-blue-400/30">
                  <span className="text-white font-bold text-lg">💎</span>
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-400/30 to-cyan-400/30 rounded-xl blur-sm opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                </div>
              </div>
              <div className="hidden sm:flex flex-col">
                <h1 className="text-lg font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent leading-tight">
                  Bloudan Jewellery
                </h1>
                <p className="text-xs text-blue-200/80 font-medium">
                  Premium Accounting
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation - Hidden on mobile */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  item.current
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md ring-1 ring-cyan-400/50'
                    : 'text-blue-100 hover:bg-blue-700/80 hover:text-white hover:shadow-sm hover:ring-1 hover:ring-blue-400/30'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-base">{item.icon}</span>
                  <span>{item.name}</span>
                </div>
              </Link>
            ))}

            {/* Balances Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-700/80 hover:text-white hover:shadow-sm hover:ring-1 hover:ring-blue-400/30 transition-all duration-200 flex items-center space-x-2">
                <span className="text-base">💰</span>
                <span className="hidden xl:inline">Balances</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-56 bg-gradient-to-b from-blue-800 to-blue-900 rounded-xl shadow-2xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 ring-1 ring-blue-400/30">
                <div className="px-3 py-2 border-b border-blue-700/50">
                  <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">Account Types</p>
                  {accountTypes.map((type) => (
                    <Link
                      key={type}
                      href={`/accounts/balance/${type}`}
                      className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-md transition-colors"
                    >
                      {type} Balances
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Ledgers Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-700/80 hover:text-white hover:shadow-sm hover:ring-1 hover:ring-blue-400/30 transition-all duration-200 flex items-center space-x-2">
                <span className="text-base">📚</span>
                <span className="hidden xl:inline">Ledgers</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-56 bg-gradient-to-b from-blue-800 to-blue-900 rounded-xl shadow-2xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 ring-1 ring-blue-400/30">
                <div className="px-3 py-2 border-b border-blue-700/50">
                  <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">Special Ledgers</p>
                  <Link
                    href="/balance-sheet/open-balance"
                    className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-md transition-colors mb-1"
                  >
                    Open Balance
                  </Link>
                  <Link
                    href="/balance-sheet/locker-ledger"
                    className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-md transition-colors"
                  >
                    Locker Ledger
                  </Link>
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">Account Type Ledgers</p>
                  {accountTypes.map((type) => (
                    <Link
                      key={type}
                      href={`/balance-sheet/type/${type}`}
                      className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-md transition-colors"
                    >
                      {type} Ledger
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          {/* Quick Actions for tablet/desktop */}
          <div className="hidden md:flex items-center space-x-2">
            <Link
              href="/vouchers/create"
              className="px-3 py-2 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-700/80 hover:text-white hover:shadow-sm hover:ring-1 hover:ring-blue-400/30 transition-all duration-200 flex items-center space-x-1"
            >
              <span className="text-base">➕</span>
              <span className="hidden lg:inline">New Voucher</span>
            </Link>
            <Link
              href="/accounts/create"
              className="px-3 py-2 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-700/80 hover:text-white hover:shadow-sm hover:ring-1 hover:ring-blue-400/30 transition-all duration-200 flex items-center space-x-1"
            >
              <span className="text-base">👤</span>
              <span className="hidden lg:inline">New Account</span>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-blue-700/50 text-blue-100 hover:bg-blue-600 hover:text-white transition-all duration-200 ring-1 ring-blue-600/30"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation - Fully responsive */}
        {isMobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-blue-700/50 bg-gradient-to-b from-blue-800/95 to-blue-900/95 backdrop-blur-lg rounded-b-xl shadow-2xl">
            {/* Main Navigation Grid */}
            <div className="grid grid-cols-3 gap-2 px-3 mb-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                    item.current
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md ring-1 ring-cyan-400/50'
                      : 'bg-blue-700/50 text-blue-100 hover:bg-blue-600/70 hover:text-white hover:ring-1 hover:ring-blue-400/30'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="text-xl mb-1">{item.icon}</span>
                  <span className="text-xs font-medium text-center">{item.name}</span>
                </Link>
              ))}
            </div>

            {/* Quick Actions Row */}
            <div className="px-3 mb-4">
              <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2 px-2">Quick Actions</div>
              <div className="flex gap-2">
                <Link
                  href="/vouchers/create"
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="mr-2">➕</span>
                  New Voucher
                </Link>
                <Link
                  href="/accounts/create"
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="mr-2">👤</span>
                  New Account
                </Link>
              </div>
            </div>

            {/* Account Balances Section */}
            <div className="px-3 mb-4">
              <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2 px-2">Account Balances</div>
              <div className="grid grid-cols-2 gap-2">
                {accountTypes.map((type) => (
                  <Link
                    key={type}
                    href={`/accounts/balance/${type}`}
                    className="px-3 py-2 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors text-center"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {type} Balances
                  </Link>
                ))}
              </div>
            </div>

            {/* Ledgers Section */}
            <div className="px-3">
              <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2 px-2">Ledgers</div>
              <div className="space-y-2">
                <Link
                  href="/balance-sheet/open-balance"
                  className="flex items-center px-3 py-2 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="w-2 h-2 rounded-full bg-orange-400 mr-3"></span>
                  Open Balance
                </Link>
                <Link
                  href="/balance-sheet/locker-ledger"
                  className="flex items-center px-3 py-2 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mr-3"></span>
                  Locker Ledger
                </Link>
                {accountTypes.map((type) => (
                  <Link
                    key={type}
                    href={`/balance-sheet/type/${type}`}
                    className="flex items-center px-3 py-2 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-400 mr-3"></span>
                    {type} Ledger
                  </Link>
                ))}
              </div>
            </div>

            {/* Close Button */}
            <div className="px-3 mt-4">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
              >
                Close Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}