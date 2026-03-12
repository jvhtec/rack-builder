import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://hocnivfaamoazfqmvodb.supabase.co'

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.EXPO_PUBLIC_SUPABASE_KEY ||
  'sb_publishable_dXrksnqF0EqcuDyihRCsZg_091iL4sd'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
