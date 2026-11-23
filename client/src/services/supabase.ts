import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

let mockClient: SupabaseClient | null = null;
if (import.meta.env.VITE_USE_MOCK === 'true' || import.meta.env.MODE === 'mock') {
    const mockModules = import.meta.glob('../mock-data/mockSupabase.ts', { eager: true }) as Record<string, any>;
    mockClient = (mockModules['../mock-data/mockSupabase.ts']?.mockSupabase as SupabaseClient | null) ?? null;
}

export const supabase: SupabaseClient =
    mockClient ||
    createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
        },
    });
