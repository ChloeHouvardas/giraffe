import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth()

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
      >
        <div className="text-center">
          <div 
            className="inline-block w-12 h-12 border-4 rounded-full animate-spin mb-4"
            style={{ 
              borderColor: 'var(--color-primary)',
              borderTopColor: 'transparent'
            }}
          />
          <p style={{ color: 'var(--color-text-subdued)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If authenticated, render the children (protected page)
  return <>{children}</>
}