import { clerkMiddleware } from '@clerk/nextjs/server'

// Demo mode: disable protected routes
// const isProtectedRoute = createRouteMatcher(['/dashboard(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Demo mode: no auth protection on any routes
})

export const config = {
  matcher: [
    // Demo mode: no routes are matched for middleware protection
  ],
}