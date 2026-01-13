import type { User, AuthError, AuthResponse } from '@supabase/supabase-js'

export interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ data: AuthResponse['data'] | null; error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ data: AuthResponse['data'] | null; error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
}