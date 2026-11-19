import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key'

const mockModules = import.meta.glob('../mock-data/mockSupabase.ts', { eager: true }) as Record<string, any>
const isMockMode = import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.MODE === 'mock'
const mockClient = isMockMode ? mockModules['../mock-data/mockSupabase.ts']?.mockSupabase : null

export const supabase = mockClient || createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
})
