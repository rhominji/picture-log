import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

// VITE_ 접두사 환경 변수는 빌드 타임에 주입됨 (클라이언트 사이드에서만 접근 가능)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 환경 변수 검증 (브라우저에서만)
if (browser && (!supabaseUrl || !supabaseAnonKey)) {
	console.error('⚠️ Supabase 환경 변수가 설정되지 않았습니다.');
	console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅ 설정됨' : '❌ 없음');
	console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ 설정됨' : '❌ 없음');
	console.error('\n📋 Vercel에서 환경 변수를 설정하는 방법:');
	console.error('1. Vercel 대시보드 접속: https://vercel.com');
	console.error('2. 프로젝트 선택 > Settings > Environment Variables');
	console.error('3. 다음 변수들을 추가:');
	console.error('   - Key: VITE_SUPABASE_URL');
	console.error('   - Value: (Supabase 프로젝트 URL)');
	console.error('   - Key: VITE_SUPABASE_ANON_KEY');
	console.error('   - Value: (Supabase Anon Key)');
	console.error('4. Environment: Production, Preview, Development 모두 선택');
	console.error('5. Save 후 재배포 (Redeploy)');
}

// 싱글톤 패턴으로 클라이언트 생성 (중복 인스턴스 방지)
let supabaseInstance = null;

export const supabase = (() => {
	if (!supabaseInstance) {
		// 서버 사이드에서는 더미 객체 반환 (에러 방지)
		if (!browser) {
			// 서버 사이드에서는 빈 객체 반환
			return {
				from: () => ({ 
					select: () => Promise.resolve({ data: [], error: null }), 
					insert: () => Promise.resolve({ data: null, error: null }), 
					update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }), 
					delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) 
				}),
				storage: { 
					from: () => ({ 
						upload: () => Promise.resolve({ data: null, error: null }), 
						remove: () => Promise.resolve({ data: null, error: null }), 
						getPublicUrl: () => ({ data: { publicUrl: '' } }) 
					}) 
				}
			};
		}
		
		if (!supabaseUrl || !supabaseAnonKey) {
			const errorMsg = 'Supabase 환경 변수가 설정되지 않았습니다.\n\n' +
				'Vercel에서 환경 변수를 설정해주세요:\n' +
				'1. Vercel 대시보드 > 프로젝트 선택 > Settings > Environment Variables\n' +
				'2. 다음 변수들을 추가:\n' +
				'   - VITE_SUPABASE_URL: (Supabase 프로젝트 URL)\n' +
				'   - VITE_SUPABASE_ANON_KEY: (Supabase Anon Key)\n' +
				'3. Production, Preview, Development 모두 선택\n' +
				'4. 저장 후 재배포';
			throw new Error(errorMsg);
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

