import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export default function Header() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);

  const navigation = [
    { name: 'Dashboard', href: '/', current: router.pathname === '/', icon: '🏠' },
    { name: 'Accounts', href: '/accounts', current: router.pathname === '/accounts', icon: '👥' },
    { name: 'Vouchers', href: '/vouchers/list', current: router.pathname.startsWith('/vouchers'), icon: '📄' },
    { name: 'Cheques', href: '/cheques', current: router.pathname === '/cheques', icon: '🏦' },
    { name: 'Type Summary', href: '/balance-sheet/type-summary', current: router.pathname === '/balance-sheet/type-summary', icon: '📊' },
  ];

  const accountTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router.pathname]);

  // Lock scrolling when mobile menu or desktop sidebar is open
  useEffect(() => {
    if (isMobileMenuOpen || !isDesktopSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen, isDesktopSidebarOpen]);

  return (
    <>
      {/* Top Header Bar (Visible on all screens) */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 shadow-lg border-b border-blue-400/30 relative z-50">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-3">
              {/* Desktop sidebar toggle button - Only shown on desktop */}
              <button
                onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
                className="p-2 rounded-lg bg-blue-500/20 text-white hover:bg-blue-500/30 transition-colors hidden lg:block"
                aria-label="Toggle sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <Link href="/" className="flex items-center space-x-2 group">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-md ring-2 ring-white/30">
                  <span className="text-white font-bold">💎</span>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-base font-bold text-white leading-tight">Bloudan Jewellery</h1>
                  <p className="text-xs text-blue-100/80">Premium Accounting</p>
                </div>
              </Link>
            </div>

            {/* Desktop Quick Actions */}
            <div className="hidden md:flex items-center space-x-2">
              <Link
                href="/vouchers/create"
                className="px-3 py-1.5 rounded-lg text-sm text-white hover:bg-blue-500/30 transition-colors flex items-center space-x-1"
              >
                <span className="text-sm">➕</span>
                <span>New Voucher</span>
              </Link>
              <Link
                href="/accounts"
                className="px-3 py-1.5 rounded-lg text-sm text-white hover:bg-blue-500/30 transition-colors flex items-center space-x-1"
              >
                <span className="text-sm">👤</span>
                <span>New Account</span>
              </Link>
            </div>

            {/* Mobile menu button - Only shown on mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-blue-500/20 text-white hover:bg-blue-500/30 transition-colors lg:hidden"
              aria-label="Toggle mobile menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:block fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-blue-50 via-white to-blue-100 shadow-xl border-r border-blue-200 transition-all duration-300 z-40 ${isDesktopSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
             style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}>
        <div className="flex flex-col h-full">
          {/* Close button for desktop sidebar */}
          <div className="p-4 border-b border-blue-200 flex justify-end">
            <button
              onClick={() => setIsDesktopSidebarOpen(false)}
              className="p-1 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-100 transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-4">
            <div className="space-y-1 px-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                    item.current
                      ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 border-l-4 border-blue-500 shadow-sm'
                      : 'text-blue-600 hover:bg-blue-50 hover:text-blue-800 hover:pl-4'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              ))}
            </div>

            {/* Balances Section */}
            <div className="mt-8 px-4">
              <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3 px-3">Account Balances</h3>
              <div className="space-y-1">
                {accountTypes.map((type) => (
                  <Link
                    key={type}
                    href={`/accounts/balance/${type}`}
                    className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-800 hover:pl-4 rounded-lg transition-all duration-200"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-400 mr-3"></span>
                    {type} Balances
                  </Link>
                ))}
              </div>
            </div>

            {/* Ledgers Section */}
            <div className="mt-4 px-4">
              <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3 px-3">Ledgers</h3>
              <div className="space-y-1">
                <Link
                  href="/balance-sheet/open-balance"
                  className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-800 hover:pl-4 rounded-lg transition-all duration-200"
                >
                  <span className="w-2 h-2 rounded-full bg-orange-400 mr-3"></span>
                  Open Balance
                </Link>
                <Link
                  href="/balance-sheet/locker-ledger"
                  className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-800 hover:pl-4 rounded-lg transition-all duration-200"
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mr-3"></span>
                  Locker Ledger
                </Link>
                {accountTypes.map((type) => (
                  <Link
                    key={type}
                    href={`/balance-sheet/type/${type}`}
                    className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-800 hover:pl-4 rounded-lg transition-all duration-200"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-400 mr-3"></span>
                    {type} Ledger
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-blue-200">
            <div className="text-center text-xs text-blue-500">
              <p>Premium Accounting System</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Desktop overlay when sidebar is open */}
      {isDesktopSidebarOpen && (
        <div 
          className="hidden lg:block fixed inset-0 top-16 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsDesktopSidebarOpen(false)}
          style={{ pointerEvents: 'auto' }}
        />
      )}

      {/* Mobile Menu Sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
          style={{ pointerEvents: 'auto' }}
        ></div>
        
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 w-80 max-w-full bg-gradient-to-b from-blue-50 via-white to-blue-100 shadow-2xl transform transition-transform duration-300 ease-in-out z-50">
          <div className="flex flex-col h-full">
            {/* Mobile Header */}
            <div className="p-4 border-b border-blue-200 bg-gradient-to-r from-blue-500 to-blue-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">💎</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Bloudan Jewellery</h2>
                    <p className="text-xs text-blue-100">Menu</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 overflow-y-auto py-4">
              <div className="space-y-1 px-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                      item.current
                        ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 border-l-4 border-blue-500 shadow-sm'
                        : 'text-blue-600 hover:bg-blue-50 hover:text-blue-800'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-medium">{item.name}</span>
                  </Link>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="mt-6 px-4">
                <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3 px-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/vouchers/create"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className="mr-2">➕</span>
                    New Voucher
                  </Link>
                  <Link
                    href="/accounts/create"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className="mr-2">👤</span>
                    New Account
                  </Link>
                </div>
              </div>

              {/* Account Balances */}
              <div className="mt-6 px-4">
                <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3 px-3">Account Balances</h3>
                <div className="grid grid-cols-2 gap-2">
                  {accountTypes.map((type) => (
                    <Link
                      key={type}
                      href={`/accounts/balance/${type}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="px-3 py-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg text-sm font-medium transition-colors text-center"
                    >
                      {type}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Ledgers */}
              <div className="mt-6 px-4">
                <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3 px-3">Ledgers</h3>
                <div className="space-y-2">
                  <Link
                    href="/balance-sheet/open-balance"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-800 rounded-lg transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-orange-400 mr-3"></span>
                    Open Balance
                  </Link>
                  <Link
                    href="/balance-sheet/locker-ledger"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-800 rounded-lg transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-400 mr-3"></span>
                    Locker Ledger
                  </Link>
                  {accountTypes.map((type) => (
                    <Link
                      key={type}
                      href={`/balance-sheet/type/${type}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:text-blue-800 rounded-lg transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-400 mr-3"></span>
                      {type} Ledger
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            {/* Mobile Footer */}
            <div className="p-4 border-t border-blue-200">
              <div className="text-center text-xs text-blue-500">
                <p>Premium Accounting System</p>
                <p className="mt-1">© 2025 Bloudan Jewellery</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Toggle Button (when sidebar is closed) */}
      {!isDesktopSidebarOpen && (
        <button
          onClick={() => setIsDesktopSidebarOpen(true)}
          className="fixed left-4 top-20 z-30 p-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-r-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:pl-3 hidden lg:block"
          aria-label="Open sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Main content wrapper with dynamic padding */}
      <main className={`transition-all duration-300 min-h-screen ${
        isDesktopSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
      }`}>
        {/* The rest of your page content goes here */}
        {/* Note: You'll need to wrap your page content in this structure */}
      </main>
    </>
  );
}
