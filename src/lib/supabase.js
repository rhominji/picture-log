import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 싱글톤 패턴으로 클라이언트 생성 (중복 인스턴스 방지)
let supabaseInstance = null;

export const supabase = (() => {
	if (!supabaseInstance) {
		supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true
			}
		});
	}
	return supabaseInstance;
})();

