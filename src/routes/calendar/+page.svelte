<script>
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	
	let currentDate = $state(new Date());
	let selectedDate = $state(null);
	let picturesByDate = $state(new Map());
	let loading = $state(true);
	let error = $state(null);
	
	// 상세 보기 모달
	let showDetailModal = $state(false);
	let detailPictures = $state([]);
	let detailDate = $state(null);
	
	onMount(() => {
		loadPictures();
	});
	
	async function loadPictures() {
		loading = true;
		try {
			// 현재 월의 시작일과 종료일 계산
			const year = currentDate.getFullYear();
			const month = currentDate.getMonth();
			const startDate = new Date(year, month, 1);
			const endDate = new Date(year, month + 1, 0, 23, 59, 59);
			
			const { data, error: err } = await supabase
				.from('picture_logs')
				.select('*')
				.gte('created_at', startDate.toISOString())
				.lte('created_at', endDate.toISOString())
				.order('created_at', { ascending: false });
			
			if (err) throw err;
			
			// 날짜별로 그룹화
			const map = new Map();
			(data || []).forEach(picture => {
				const date = new Date(picture.created_at);
				const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
				
				if (!map.has(dateKey)) {
					map.set(dateKey, []);
				}
				map.get(dateKey).push(picture);
			});
			
			picturesByDate = map;
		} catch (err) {
			console.error('사진 로드 실패:', err);
			error = err.message || '사진을 불러오는데 실패했습니다.';
		} finally {
			loading = false;
		}
	}
	
	function changeMonth(delta) {
		currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
		loadPictures();
	}
	
	function getDaysInMonth() {
		const year = currentDate.getFullYear();
		const month = currentDate.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDayOfWeek = firstDay.getDay();
		
		const days = [];
		
		// 이전 달의 마지막 날들
		const prevMonth = new Date(year, month, 0);
		const prevMonthDays = prevMonth.getDate();
		for (let i = startingDayOfWeek - 1; i >= 0; i--) {
			days.push({
				date: new Date(year, month - 1, prevMonthDays - i),
				isCurrentMonth: false
			});
		}
		
		// 현재 달의 날들
		for (let day = 1; day <= daysInMonth; day++) {
			days.push({
				date: new Date(year, month, day),
				isCurrentMonth: true
			});
		}
		
		// 다음 달의 첫 날들 (달력을 채우기 위해)
		const remainingDays = 42 - days.length; // 6주 * 7일
		for (let day = 1; day <= remainingDays; day++) {
			days.push({
				date: new Date(year, month + 1, day),
				isCurrentMonth: false
			});
		}
		
		return days;
	}
	
	function getDateKey(date) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}
	
	function getDateScore(date) {
		const dateKey = getDateKey(date);
		const pictures = picturesByDate.get(dateKey) || [];
		if (pictures.length === 0) return null;
		
		// 평균 점수 계산
		const scores = pictures.filter(p => p.score).map(p => p.score);
		if (scores.length === 0) return null;
		
		const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
		return Math.round(avgScore * 10) / 10; // 소수점 첫째 자리까지
	}
	
	function getDatePictureCount(date) {
		const dateKey = getDateKey(date);
		return (picturesByDate.get(dateKey) || []).length;
	}
	
	async function showDateDetails(date) {
		const dateKey = getDateKey(date);
		const pictures = picturesByDate.get(dateKey) || [];
		
		if (pictures.length === 0) return;
		
		detailDate = date;
		detailPictures = pictures;
		showDetailModal = true;
	}
	
	function closeDetailModal() {
		showDetailModal = false;
		detailPictures = [];
		detailDate = null;
	}
	
	function getImageUrl(imagePath) {
		if (!imagePath) return '';
		const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
		return `${supabaseUrl}/storage/v1/object/public/pictures/${imagePath}`;
	}
	
	function formatDate(date) {
		return date.toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'long'
		});
	}
	
	function getContentTypeLabel(type) {
		const labels = {
			diary: '📔 일기',
			keywords: '🏷️ 키워드',
			poem: '✍️ 시',
			oneLine: '💭 한줄 감상',
			short: '📝 짧은글'
		};
		return labels[type] || type;
	}
	
	function handleImageError(event) {
		event.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🖼️%3C/text%3E%3C/svg%3E';
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-sky-50 via-teal-50 to-lime-50 py-8 px-4 sm:px-6 lg:px-8">
	<div class="max-w-6xl mx-auto">
		<!-- 헤더 -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent mb-2">달력</h1>
			<p class="text-gray-600">날짜를 클릭하여 그날의 사진과 기록을 확인하세요</p>
		</div>
		
		<!-- 에러 메시지 -->
		{#if error}
			<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
				<p class="text-sm text-red-800">{error}</p>
			</div>
		{/if}
		
		<!-- 달력 -->
		<div class="bg-white rounded-lg shadow-lg p-6">
			<!-- 월 네비게이션 -->
			<div class="flex items-center justify-between mb-6">
				<button
					onclick={() => changeMonth(-1)}
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
					</svg>
				</button>
				<h2 class="text-2xl font-semibold text-gray-900">
					{currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
				</h2>
				<button
					onclick={() => changeMonth(1)}
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
					</svg>
				</button>
			</div>
			
			{#if loading}
				<div class="text-center py-12 text-gray-500">로딩 중...</div>
			{:else}
				<!-- 요일 헤더 -->
				<div class="grid grid-cols-7 gap-2 mb-2">
					{#each ['일', '월', '화', '수', '목', '금', '토'] as day}
						<div class="text-center text-sm font-semibold text-gray-600 py-2">
							{day}
						</div>
					{/each}
				</div>
				
				<!-- 달력 그리드 -->
				<div class="grid grid-cols-7 gap-2">
					{#each getDaysInMonth() as { date, isCurrentMonth }}
						{@const dateKey = getDateKey(date)}
						{@const score = getDateScore(date)}
						{@const count = getDatePictureCount(date)}
						{@const hasPictures = count > 0}
						
						<button
							onclick={() => hasPictures && showDateDetails(date)}
							disabled={!hasPictures}
							class="aspect-square p-2 rounded-lg border-2 transition-all {isCurrentMonth ? 'border-gray-200 hover:border-blue-300' : 'border-gray-100 opacity-50'} {hasPictures ? 'cursor-pointer hover:bg-blue-50 hover:shadow-md' : 'cursor-default'} {date.toDateString() === new Date().toDateString() ? 'bg-blue-100 border-blue-400' : ''}"
						>
							<div class="flex flex-col items-center justify-center h-full">
								<div class="text-sm font-semibold {isCurrentMonth ? 'text-gray-900' : 'text-gray-400'} mb-1">
									{date.getDate()}
								</div>
								{#if score !== null}
									<div class="text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
										⭐ {score}
									</div>
								{/if}
								{#if count > 0}
									<div class="text-xs text-gray-500 mt-1">
										📷 {count}
									</div>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- 상세 보기 모달 -->
{#if showDetailModal && detailDate}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
		<div class="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 my-8">
			<!-- 모달 헤더 -->
			<div class="flex items-center justify-between mb-6">
				<div>
					<h3 class="text-2xl font-bold text-gray-900">{formatDate(detailDate)}</h3>
					<p class="text-sm text-gray-600 mt-1">
						{detailPictures.length}개의 기록
					</p>
				</div>
				<button
					onclick={closeDetailModal}
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>
			
			<!-- 사진 및 기록 목록 -->
			<div class="space-y-6 max-h-[70vh] overflow-y-auto">
				{#each detailPictures as picture}
					<div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
						<div class="flex gap-4">
							<!-- 사진 -->
							<div class="flex-shrink-0">
								<img
									src={getImageUrl(picture.image_path)}
									alt="사진"
									class="w-32 h-32 object-cover rounded-lg"
									onerror={handleImageError}
								/>
							</div>
							
							<!-- 기록 정보 -->
							<div class="flex-1 min-w-0">
								<div class="flex items-start justify-between mb-2">
									<div>
										<div class="text-sm font-semibold text-gray-700 mb-1">
											{getContentTypeLabel(picture.content_type)}
										</div>
										{#if picture.score}
											<div class="inline-block bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded">
												⭐ {picture.score}/10
											</div>
										{/if}
									</div>
									<div class="text-xs text-gray-500">
										{new Date(picture.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
									</div>
								</div>
								
								<!-- 콘텐츠 -->
								<div class="text-sm text-gray-800 mb-2 whitespace-pre-wrap line-clamp-3">
									{picture.content}
								</div>
								
								<!-- 추가 정보 -->
								{#if picture.user_input}
									<div class="text-xs text-gray-600 mb-1">
										💡 키워드: {picture.user_input}
									</div>
								{/if}
								{#if picture.additional_text}
									<div class="text-xs text-gray-600 mb-1">
										💬 메모: {picture.additional_text}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

