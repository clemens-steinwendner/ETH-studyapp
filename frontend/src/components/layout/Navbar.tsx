import Link from "next/link";

export function Navbar() {
  return (
    <nav className="flex items-center gap-6 px-6 py-3 border-b border-gray-800 bg-gray-900">
      <span className="font-bold text-lg">ETH Study</span>
      <Link href="/dashboard" className="text-gray-300 hover:text-white">Dashboard</Link>
      <Link href="/history" className="text-gray-300 hover:text-white">History</Link>
      <Link href="/budget" className="text-gray-300 hover:text-white">Budget</Link>
    </nav>
  );
}
