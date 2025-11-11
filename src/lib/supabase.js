import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 환경 변수 검증
if (!supabaseUrl || !supabaseAnonKey) {
	console.error('Supabase 환경 변수가 설정되지 않았습니다.');
	console.error('VITE_SUPABASE_URL:', supabaseUrl ? '설정됨' : '없음');
	console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '설정됨' : '없음');
}

// 싱글톤 패턴으로 클라이언트 생성 (중복 인스턴스 방지)
let supabaseInstance = null;

export const supabase = (() => {
	if (!supabaseInstance) {
		if (!supabaseUrl || !supabaseAnonKey) {
			throw new Error('Supabase 환경 변수가 설정되지 않았습니다. Vercel에서 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.');
		}
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

