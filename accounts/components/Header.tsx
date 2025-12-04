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
    <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 shadow-2xl border-b-4 border-blue-500/30 backdrop-blur-sm">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo and Brand - Enhanced */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-4 group">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl group-hover:shadow-3xl transition-all duration-300 transform group-hover:scale-105 ring-4 ring-blue-400/30">
                  <span className="text-white font-bold text-2xl">💎</span>
                  <div className="absolute -inset-2 bg-gradient-to-r from-blue-400/30 to-cyan-400/30 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                  Bloudan Jewellery
                </h1>
                <p className="text-sm text-blue-200/80 font-medium tracking-wide">
                  Premium Accounting System
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation - Enhanced */}
          <nav className="hidden xl:flex items-center space-x-1">
            {/* Main Navigation Links */}
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`relative px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 group ${
                  item.current
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-xl ring-2 ring-cyan-400/50'
                    : 'text-blue-100 hover:bg-blue-700/70 hover:text-white hover:shadow-lg hover:ring-1 hover:ring-blue-400/30'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.name}</span>
                </div>
                {!item.current && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-400 group-hover:w-3/4 transition-all duration-300"></div>
                )}
              </Link>
            ))}

            {/* Quick Actions Dropdown */}
            <div className="relative group ml-2">
              <button className="px-5 py-3 rounded-xl text-sm font-semibold text-blue-100 hover:bg-blue-700/70 hover:text-white hover:shadow-lg hover:ring-1 hover:ring-blue-400/30 transition-all duration-300 flex items-center space-x-2 group">
                <span className="text-lg">⚡</span>
                <span>Quick Actions</span>
                <svg className="w-4 h-4 ml-1 transform group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-64 bg-gradient-to-b from-blue-800 to-blue-900 rounded-2xl shadow-2xl py-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 ring-2 ring-blue-400/30 backdrop-blur-sm">
                {/* Quick Voucher Creation */}
                <div className="px-4 py-2 border-b border-blue-700/50">
                  <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">Voucher Creation</p>
                  <Link
                    href="/vouchers/create"
                    className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-lg transition-colors hover:pl-4 duration-200 border-l-2 border-transparent hover:border-cyan-400"
                  >
                    ➕ Create New Voucher
                  </Link>
                </div>
                
                {/* Quick Account Actions */}
                <div className="px-4 py-2 border-b border-blue-700/50">
                  <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">Account Management</p>
                  <Link
                    href="/accounts/create"
                    className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-lg transition-colors hover:pl-4 duration-200 border-l-2 border-transparent hover:border-emerald-400"
                  >
                    👤 Create New Account
                  </Link>
                </div>

                {/* Reports Section */}
                <div className="px-4 py-2">
                  <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">Quick Reports</p>
                  <Link
                    href="/balance-sheet/type-summary"
                    className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-lg transition-colors hover:pl-4 duration-200 border-l-2 border-transparent hover:border-yellow-400"
                  >
                    📊 View Type Summary
                  </Link>
                </div>
              </div>
            </div>

            {/* Account Type Balances Dropdown */}
            <div className="relative group">
              <button className="px-5 py-3 rounded-xl text-sm font-semibold text-blue-100 hover:bg-blue-700/70 hover:text-white hover:shadow-lg hover:ring-1 hover:ring-blue-400/30 transition-all duration-300 flex items-center space-x-2 group">
                <span className="text-lg">💰</span>
                <span>Account Balances</span>
                <svg className="w-4 h-4 ml-1 transform group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-56 bg-gradient-to-b from-blue-800 to-blue-900 rounded-2xl shadow-2xl py-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 ring-2 ring-blue-400/30 backdrop-blur-sm">
                <div className="px-4 py-2 border-b border-blue-700/50">
                  <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">Account Types</p>
                  {accountTypes.map((type) => (
                    <Link
                      key={type}
                      href={`/accounts/balance/${type}`}
                      className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-lg transition-colors hover:pl-4 duration-200 mb-1 last:mb-0"
                    >
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-3"></span>
                      {type} Balances
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Ledgers Dropdown */}
            <div className="relative group">
              <button className="px-5 py-3 rounded-xl text-sm font-semibold text-blue-100 hover:bg-blue-700/70 hover:text-white hover:shadow-lg hover:ring-1 hover:ring-blue-400/30 transition-all duration-300 flex items-center space-x-2 group">
                <span className="text-lg">📚</span>
                <span>Ledgers</span>
                <svg className="w-4 h-4 ml-1 transform group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-56 bg-gradient-to-b from-blue-800 to-blue-900 rounded-2xl shadow-2xl py-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 ring-2 ring-blue-400/30 backdrop-blur-sm">
                <div className="px-4 py-2 border-b border-blue-700/50">
                  <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">Special Ledgers</p>
                  <Link
                    href="/balance-sheet/open-balance"
                    className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-lg transition-colors hover:pl-4 duration-200 mb-1"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-3"></span>
                    Open Balance
                  </Link>
                  <Link
                    href="/balance-sheet/locker-ledger"
                    className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-lg transition-colors hover:pl-4 duration-200"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 mr-3"></span>
                    Locker Ledger
                  </Link>
                </div>
                <div className="px-4 py-2">
                  <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">Account Type Ledgers</p>
                  {accountTypes.map((type) => (
                    <Link
                      key={type}
                      href={`/balance-sheet/type/${type}`}
                      className="block px-3 py-2 text-sm text-blue-100 hover:bg-blue-700/50 hover:text-white rounded-lg transition-colors hover:pl-4 duration-200 mb-1 last:mb-0"
                    >
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-3"></span>
                      {type} Ledger
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          {/* Mobile menu button - Enhanced */}
          <div className="xl:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-3 rounded-xl bg-blue-800/50 text-blue-100 hover:bg-blue-700 hover:text-white transition-all duration-300 ring-2 ring-blue-600/30 hover:ring-blue-500/50"
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

        {/* Mobile Navigation - Enhanced */}
        {isMobileMenuOpen && (
          <div className="xl:hidden py-6 border-t border-blue-700/50 bg-gradient-to-b from-blue-800/90 to-blue-900/90 backdrop-blur-lg rounded-b-3xl shadow-2xl mb-4">
            {/* Main Navigation */}
            <div className="grid grid-cols-2 gap-3 px-4 mb-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative px-4 py-4 rounded-xl text-center transition-all duration-300 transform hover:scale-105 ${
                    item.current
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-xl ring-2 ring-cyan-400/50'
                      : 'bg-blue-800/50 text-blue-100 hover:bg-blue-700/70 hover:text-white hover:ring-1 hover:ring-blue-400/30'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-sm font-semibold">{item.name}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="px-4 mb-6">
              <div className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-3 px-3">Quick Actions</div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/vouchers/create"
                  className="px-3 py-3 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-xl text-sm font-medium transition-colors text-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  ➕ New Voucher
                </Link>
                <Link
                  href="/accounts/create"
                  className="px-3 py-3 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-xl text-sm font-medium transition-colors text-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  👤 New Account
                </Link>
              </div>
            </div>

            {/* Account Balances */}
            <div className="px-4 mb-6">
              <div className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-3 px-3">Account Balances</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {accountTypes.map((type) => (
                  <Link
                    key={type}
                    href={`/accounts/balance/${type}`}
                    className="px-3 py-3 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-xl text-sm font-medium transition-colors text-center"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {type}
                  </Link>
                ))}
              </div>
            </div>

            {/* Ledgers */}
            <div className="px-4">
              <div className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-3 px-3">Ledgers</div>
              <div className="space-y-2">
                <Link
                  href="/balance-sheet/open-balance"
                  className="flex items-center px-4 py-3 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-xl text-sm font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="w-2 h-2 rounded-full bg-orange-400 mr-3"></span>
                  Open Balance
                </Link>
                <Link
                  href="/balance-sheet/locker-ledger"
                  className="flex items-center px-4 py-3 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-xl text-sm font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mr-3"></span>
                  Locker Ledger
                </Link>
                {accountTypes.map((type) => (
                  <Link
                    key={type}
                    href={`/balance-sheet/type/${type}`}
                    className="flex items-center px-4 py-3 bg-blue-700/50 text-blue-100 hover:bg-blue-600 rounded-xl text-sm font-medium transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-400 mr-3"></span>
                    {type} Ledger
                  </Link>
                ))}
              </div>
            </div>

            {/* Close Button */}
            <div className="px-4 mt-6">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
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