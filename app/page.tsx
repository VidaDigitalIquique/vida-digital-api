import { redirect } from 'next/navigation';

export default function Home() {
  // If the user lands on the root view, redirect them to the dashboard
  // Middleware handles ensuring they are logged in if they don't have an active session.
  redirect('/dashboard');
}
