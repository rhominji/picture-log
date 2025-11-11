<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
	
	let { children } = $props();
	
	function isActive(path) {
		return $page.url.pathname === path;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- 네비게이션 바 -->
<nav class="bg-gradient-to-r from-sky-50 to-teal-50 border-b border-sky-200 shadow-sm sticky top-0 z-40">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-16">
			<!-- 로고/홈 -->
			<a href="/" class="flex items-center space-x-2">
				<span class="text-2xl font-bold bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent">Picture Log</span>
			</a>
			
			<!-- 네비게이션 링크 -->
			<div class="flex items-center space-x-1">
				<a
					href="/upload"
					class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/upload') ? 'bg-sky-200 text-sky-700 shadow-sm' : 'text-sky-700 hover:bg-sky-100'}"
				>
					📷 사진 업로드
				</a>
				<a
					href="/gallery"
					class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/gallery') ? 'bg-teal-200 text-teal-700 shadow-sm' : 'text-teal-700 hover:bg-teal-100'}"
				>
					🖼️ 갤러리
				</a>
				<a
					href="/content"
					class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/content') ? 'bg-cyan-200 text-cyan-700 shadow-sm' : 'text-cyan-700 hover:bg-cyan-100'}"
				>
					📝 컨텐츠
				</a>
				<a
					href="/calendar"
					class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/calendar') ? 'bg-lime-200 text-lime-700 shadow-sm' : 'text-lime-700 hover:bg-lime-100'}"
				>
					📅 달력
				</a>
				<a
					href="/map"
					class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors {isActive('/map') ? 'bg-emerald-200 text-emerald-700 shadow-sm' : 'text-emerald-700 hover:bg-emerald-100'}"
				>
					🗺️ 지도
				</a>
			</div>
		</div>
	</div>
</nav>

{@render children()}
