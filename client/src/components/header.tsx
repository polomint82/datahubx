export function Header() {
  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end px-6">
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Acme Corp</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">admin@acme.com</p>
      </div>
    </header>
  );
}