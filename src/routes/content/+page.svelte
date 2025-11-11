<script>
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	
	const contentTypes = [
		{ value: 'diary', label: '📔 일기', color: 'blue' },
		{ value: 'keywords', label: '🏷️ 키워드', color: 'purple' },
		{ value: 'poem', label: '✍️ 시', color: 'pink' },
		{ value: 'oneLine', label: '💭 한줄 감상', color: 'yellow' },
		{ value: 'short', label: '📝 짧은글', color: 'green' }
	];
	
	let selectedContentType = $state('all'); // 'all' 또는 특정 타입
	let pictures = $state([]);
	let allPictures = $state([]); // 전체 사진 (개수 계산용)
	let loading = $state(true);
	let error = $state(null);
	
	// 상세 보기 모달
	let showDetailModal = $state(false);
	let selectedPicture = $state(null);
	
	onMount(() => {
		loadPictures();
	});
	
	async function loadPictures() {
		try {
			loading = true;
			
			// 전체 데이터 로드 (개수 계산용)
			const { data: allData, error: allErr } = await supabase
				.from('picture_logs')
				.select('content_type');
			
			if (allErr) throw allErr;
			allPictures = allData || [];
			
			// 필터링된 데이터 로드
			let query = supabase
				.from('picture_logs')
				.select('*')
				.order('created_at', { ascending: false });
			
			// 특정 타입 선택 시 필터링
			if (selectedContentType !== 'all') {
				query = query.eq('content_type', selectedContentType);
			}
			
			const { data, error: err } = await query;
			
			if (err) throw err;
			pictures = data || [];
		} catch (err) {
			console.error('사진 로드 실패:', err);
			error = err.message || '사진을 불러오는데 실패했습니다.';
		} finally {
			loading = false;
		}
	}
	
	function selectContentType(type) {
		selectedContentType = type;
		loadPictures();
	}
	
	function openDetailModal(picture) {
		selectedPicture = picture;
		showDetailModal = true;
	}
	
	function closeDetailModal() {
		showDetailModal = false;
		selectedPicture = null;
	}
	
	function getImageUrl(imagePath) {
		if (!imagePath) return '';
		const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
		return `${supabaseUrl}/storage/v1/object/public/pictures/${imagePath}`;
	}
	
	function handleImageError(event) {
		event.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🖼️%3C/text%3E%3C/svg%3E';
	}
	
	function getContentTypeLabel(type) {
		const found = contentTypes.find(ct => ct.value === type);
		return found ? found.label : type;
	}
	
	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'long'
		});
	}
	
	function getContentTypeCount(type) {
		if (type === 'all') {
			return allPictures.length;
		}
		return allPictures.filter(p => p.content_type === type).length;
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-sky-50 via-teal-50 to-lime-50">
	<!-- 헤더 -->
	<div class="bg-white/80 backdrop-blur-sm border-b border-sky-200 px-4 sm:px-6 lg:px-8 py-4">
		<div class="max-w-7xl mx-auto">
			<h1 class="text-3xl font-bold bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent mb-2">컨텐츠</h1>
			<p class="text-gray-600">컨텐츠 타입별로 사진과 저장된 글을 확인하세요</p>
		</div>
	</div>
	
	<!-- 에러 메시지 -->
	{#if error}
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
			<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
				{error}
			</div>
		</div>
	{/if}
	
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
		<!-- 컨텐츠 타입 필터 -->
		<div class="mb-6">
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={() => selectContentType('all')}
					class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors {selectedContentType === 'all' ? 'bg-gradient-to-r from-sky-500 to-teal-500 text-white shadow-md' : 'bg-white/80 text-sky-700 border border-sky-200 hover:bg-sky-50'}"
				>
					전체 ({getContentTypeCount('all')})
				</button>
				{#each contentTypes as contentType}
					<button
						type="button"
						onclick={() => selectContentType(contentType.value)}
						class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors {selectedContentType === contentType.value ? `bg-${contentType.color}-100 text-${contentType.color}-700 border-2 border-${contentType.color}-300` : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}"
					>
						{contentType.label} ({getContentTypeCount(contentType.value)})
					</button>
				{/each}
			</div>
		</div>
		
		<!-- 로딩 상태 -->
		{#if loading}
			<div class="flex justify-center items-center py-12">
				<div class="text-gray-500">로딩 중...</div>
			</div>
		{:else if pictures.length === 0}
			<!-- 빈 상태 -->
			<div class="text-center py-12">
				<div class="text-6xl mb-4">📝</div>
				<p class="text-gray-600 text-lg">표시할 컨텐츠가 없습니다.</p>
				<p class="text-gray-500 text-sm mt-2">
					{#if selectedContentType !== 'all'}
						{getContentTypeLabel(selectedContentType)} 타입의 컨텐츠가 없습니다.
					{:else}
						사진을 업로드하고 컨텐츠를 생성해보세요.
					{/if}
				</p>
			</div>
		{:else}
			<!-- 컨텐츠 그리드 -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each pictures as picture}
					<div
						class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
						onclick={() => openDetailModal(picture)}
					>
						<!-- 이미지 -->
						<div class="aspect-video bg-gray-100 relative">
							<img
								src={getImageUrl(picture.image_path)}
								alt="사진"
								class="w-full h-full object-cover"
								onerror={handleImageError}
							/>
							<!-- 컨텐츠 타입 배지 -->
							<div class="absolute top-2 left-2">
								<span class="bg-black bg-opacity-60 text-white text-xs font-semibold px-2 py-1 rounded">
									{getContentTypeLabel(picture.content_type)}
								</span>
							</div>
							<!-- 점수 배지 -->
							{#if picture.score}
								<div class="absolute top-2 right-2">
									<span class="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
										⭐ {picture.score}/10
									</span>
								</div>
							{/if}
						</div>
						
						<!-- 컨텐츠 미리보기 -->
						<div class="p-4">
							<div class="text-xs text-gray-500 mb-2">
								{formatDate(picture.created_at)}
							</div>
							<div class="text-sm text-gray-700 line-clamp-3">
								{picture.content}
							</div>
							{#if picture.user_input}
								<div class="mt-2 text-xs text-gray-500 italic">
									💡 {picture.user_input}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- 상세 보기 모달 -->
{#if showDetailModal && selectedPicture}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
		onclick={closeDetailModal}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- 모달 헤더 -->
			<div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
				<div>
					<h2 class="text-xl font-bold text-gray-900">
						{getContentTypeLabel(selectedPicture.content_type)}
					</h2>
					<p class="text-sm text-gray-500 mt-1">
						{formatDate(selectedPicture.created_at)}
					</p>
				</div>
				<button
					type="button"
					onclick={closeDetailModal}
					class="text-gray-400 hover:text-gray-600 text-2xl"
				>
					×
				</button>
			</div>
			
			<!-- 모달 내용 -->
			<div class="p-6">
				<!-- 이미지 -->
				<div class="mb-6">
					<img
						src={getImageUrl(selectedPicture.image_path)}
						alt="사진"
						class="w-full rounded-lg shadow-md"
						onerror={handleImageError}
					/>
				</div>
				
				<!-- 점수 -->
				{#if selectedPicture.score}
					<div class="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-lg">
						<div class="flex items-center justify-between">
							<div>
								<div class="text-sm font-semibold text-gray-700 mb-1">⭐ 그날의 점수</div>
								<div class="text-xs text-gray-600">이 순간을 평가한 점수입니다</div>
							</div>
							<div class="text-4xl font-bold text-yellow-600">
								{selectedPicture.score}
								<span class="text-lg text-gray-500">/10</span>
							</div>
						</div>
					</div>
				{/if}
				
				<!-- 컨텐츠 -->
				<div class="mb-6">
					<div class="text-sm font-semibold text-gray-700 mb-2">📝 저장된 글</div>
					<div class="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-gray-800">
						{selectedPicture.content}
					</div>
				</div>
				
				<!-- 사용자 입력 -->
				{#if selectedPicture.user_input}
					<div class="mb-6">
						<div class="text-sm font-semibold text-gray-700 mb-2">💡 추가 키워드/내용</div>
						<div class="bg-blue-50 p-4 rounded-lg text-gray-800">
							{selectedPicture.user_input}
						</div>
					</div>
				{/if}
				
				<!-- 추가 텍스트 -->
				{#if selectedPicture.additional_text}
					<div class="mb-6">
						<div class="text-sm font-semibold text-gray-700 mb-2">📄 추가 메모</div>
						<div class="bg-green-50 p-4 rounded-lg whitespace-pre-wrap text-gray-800">
							{selectedPicture.additional_text}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

