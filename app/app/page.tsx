import { redirect } from 'next/navigation'

// The root path is a placeholder — the real entry points are /employee and
// /manager. Redirect at the routing layer so a deep-link to / never lands on
// an empty page.
export default function HomePage() {
  redirect('/employee')
}
