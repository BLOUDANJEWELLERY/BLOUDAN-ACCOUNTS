import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

export default function Header() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Home', href: '/', current: router.pathname === '/' },
    { name: 'Accounts', href: '/accounts', current: router.pathname === '/accounts' },
    { name: 'Create Vouchers', href: '/vouchers/create', current: router.pathname === '/vouchers/create' },
    { name: 'View Vouchers', href: '/vouchers/list', current: router.pathname === '/vouchers/list' },
    { name: 'Type Summary', href: '/accounts/summary', current: router.pathname === '/accounts/summary' },
  ];

  const accountTypes = ["Market", "Casting", "Faceting", "Project", "Gold Fixing"];

  return (
    <header className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">$</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Gold Ledger Pro</h1>
                <p className="text-xs text-gray-500">Business Management System</p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  item.current
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.name}
              </Link>
            ))}

            {/* Account Type Balances Dropdown */}
            <div className="relative group">
              <button className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors flex items-center">
                Balances
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                {accountTypes.map((type) => (
                  <Link
                    key={type}
                    href={`/accounts/balance/${type}`}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {type} Balances
                  </Link>
                ))}
              </div>
            </div>

            {/* Balance Sheets Dropdown */}
            <div className="relative group">
              <button className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors flex items-center">
                Ledgers
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                {accountTypes.map((type) => (
                  <Link
                    key={type}
                    href={`/balance-sheet/type/${type}`}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {type} Ledger
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
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

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    item.current
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}

              {/* Mobile Account Type Balances */}
              <div className="px-3 py-2">
                <div className="text-sm font-medium text-gray-500 mb-2">Account Balances</div>
                <div className="space-y-1">
                  {accountTypes.map((type) => (
                    <Link
                      key={type}
                      href={`/accounts/balance/${type}`}
                      className="block px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {type} Balances
                    </Link>
                  ))}
                </div>
              </div>

              {/* Mobile Balance Sheets */}
              <div className="px-3 py-2">
                <div className="text-sm font-medium text-gray-500 mb-2">Ledgers</div>
                <div className="space-y-1">
                  {accountTypes.map((type) => (
                    <Link
                      key={type}
                      href={`/balance-sheet/type/${type}`}
                      className="block px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {type} Ledger
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}