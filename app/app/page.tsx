import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-lg font-medium">Time Off</h1>
      <p className="text-sm">Pick a view:</p>
      <ul className="list-disc pl-5 text-sm">
        <li>
          <Link href="/employee" className="underline">
            Employee
          </Link>
        </li>
        <li>
          <Link href="/manager" className="underline">
            Manager
          </Link>
        </li>
      </ul>
    </div>
  )
}
