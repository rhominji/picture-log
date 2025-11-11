<script>
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	
	let mapContainer = $state(null);
	let map = $state(null);
	let loading = $state(true);
	let error = $state(null);
	let locationGroups = $state(new Map()); // 위치별 사진 그룹
	
	// 상세 보기 모달
	let showDetailModal = $state(false);
	let detailPictures = $state([]);
	let detailLocation = $state(null);
	let detailScore = $state(null);
	
	onMount(async () => {
		if (!browser) return;
		await loadPictures();
		await initMap();
	});
	
	async function loadPictures() {
		try {
			// 모든 사진 로드 (GPS 정보 필터링은 클라이언트에서)
			const { data, error: err } = await supabase
				.from('picture_logs')
				.select('*')
				.order('created_at', { ascending: false });
			
			if (err) {
				// 컬럼이 없는 경우 에러 처리
				if (err.code === '42703' || err.message?.includes('does not exist')) {
					error = 'GPS 좌표 컬럼이 데이터베이스에 없습니다. SQL을 실행하여 컬럼을 추가해주세요.';
					loading = false;
					return;
				}
				throw err;
			}
			
			// GPS 정보가 있는 사진만 필터링 (유효한 숫자인지 확인)
			const picturesWithLocation = (data || []).filter(p => {
				const lat = Number(p.latitude);
				const lng = Number(p.longitude);
				return !isNaN(lat) && !isNaN(lng) && 
				       lat >= -90 && lat <= 90 && 
				       lng >= -180 && lng <= 180;
			});
			
			// 위치별로 그룹화 (소수점 4자리로 반올림하여 근처 위치 그룹화)
			const groups = new Map();
			
			picturesWithLocation.forEach(picture => {
				const lat = Number(picture.latitude);
				const lng = Number(picture.longitude);
				
				// 유효성 재확인
				if (isNaN(lat) || isNaN(lng)) {
					console.warn('Invalid coordinates:', picture);
					return;
				}
				
				const roundedLat = Math.round(lat * 10000) / 10000;
				const roundedLng = Math.round(lng * 10000) / 10000;
				const key = `${roundedLat},${roundedLng}`;
				
				if (!groups.has(key)) {
					groups.set(key, {
						latitude: roundedLat,
						longitude: roundedLng,
						pictures: [],
						scores: []
					});
				}
				
				groups.get(key).pictures.push(picture);
				if (picture.score) {
					groups.get(key).scores.push(picture.score);
				}
			});
			
			locationGroups = groups;
		} catch (err) {
			console.error('사진 로드 실패:', err);
			error = err.message || '사진을 불러오는데 실패했습니다.';
		} finally {
			loading = false;
		}
	}
	
	let L = $state(null);
	
	async function initMap() {
		if (!mapContainer || loading) return;
		
		// Leaflet 동적 import
		const Leaflet = await import('leaflet');
		L = Leaflet.default || Leaflet;
		
		// Leaflet CSS import
		await import('leaflet/dist/leaflet.css');
		
		// 마커 아이콘 기본 경로 수정 (Leaflet의 기본 아이콘 경로 문제 해결)
		delete L.Icon.Default.prototype._getIconUrl;
		L.Icon.Default.mergeOptions({
			iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
			iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
			shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
		});
		
		// 지도 초기화
		map = L.map(mapContainer).setView([37.5665, 126.9780], 6); // 서울 중심
		
		// OpenStreetMap 한국어 타일 레이어 추가
		// CartoDB의 한국어 지명 지원 타일 사용
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors',
			maxZoom: 19,
			subdomains: ['a', 'b', 'c']
		}).addTo(map);
		
		// 한국어 지명을 위한 추가 레이어 (선택사항)
		// 일부 지역은 한국어 지명이 표시될 수 있습니다
		
		// 마커 추가
		addMarkers();
	}
	
	function addMarkers() {
		if (!map || !L || locationGroups.size === 0) return;
		
		// 기존 마커 제거
		map.eachLayer((layer) => {
			if (layer instanceof L.Marker) {
				map.removeLayer(layer);
			}
		});
		
		locationGroups.forEach((group, key) => {
			// 평균 점수 계산
			const avgScore = group.scores.length > 0
				? Math.round((group.scores.reduce((sum, s) => sum + s, 0) / group.scores.length) * 10) / 10
				: null;
			
			// 점수에 따른 색상 결정
			const getColor = (score) => {
				if (score === null) return '#gray';
				if (score >= 8) return '#22c55e'; // green
				if (score >= 6) return '#eab308'; // yellow
				if (score >= 4) return '#f97316'; // orange
				return '#ef4444'; // red
			};
			
			const color = getColor(avgScore);
			
			// 커스텀 아이콘 생성
			const icon = L.divIcon({
				className: 'custom-marker',
				html: `
					<div style="
						background-color: ${color};
						width: 40px;
						height: 40px;
						border-radius: 50%;
						border: 3px solid white;
						box-shadow: 0 2px 8px rgba(0,0,0,0.3);
						display: flex;
						align-items: center;
						justify-content: center;
						color: white;
						font-weight: bold;
						font-size: 14px;
						cursor: pointer;
					">
						${avgScore !== null ? avgScore : '?'}
					</div>
				`,
				iconSize: [40, 40],
				iconAnchor: [20, 20]
			});
			
			// 마커 생성
			const marker = L.marker([group.latitude, group.longitude], { icon })
				.addTo(map)
				.on('click', () => {
					showLocationDetails(group, avgScore);
				});
			
			// 툴팁 추가
			const tooltipText = avgScore !== null
				? `평균 점수: ${avgScore}/10\n사진: ${group.pictures.length}개`
				: `사진: ${group.pictures.length}개`;
			
			marker.bindTooltip(tooltipText, {
				permanent: false,
				direction: 'top'
			});
		});
	}
	
	function showLocationDetails(group, score) {
		detailLocation = group;
		detailPictures = group.pictures;
		detailScore = score;
		showDetailModal = true;
	}
	
	function closeDetailModal() {
		showDetailModal = false;
		detailPictures = [];
		detailLocation = null;
		detailScore = null;
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
		const labels = {
			diary: '📔 일기',
			keywords: '🏷️ 키워드',
			poem: '✍️ 시',
			oneLine: '💭 한줄 감상',
			short: '📝 짧은글'
		};
		return labels[type] || type;
	}
	
	function formatDate(dateString) {
		return new Date(dateString).toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'long'
		});
	}
	
	// locationGroups가 변경되면 마커 업데이트
	$effect(() => {
		if (map && L && locationGroups.size > 0) {
			addMarkers();
		}
	});
</script>

<svelte:head>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-sky-50 via-teal-50 to-lime-50">
	<!-- 헤더 -->
	<div class="bg-white/80 backdrop-blur-sm border-b border-sky-200 px-4 sm:px-6 lg:px-8 py-4">
		<div class="max-w-7xl mx-auto">
			<h1 class="text-3xl font-bold bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent mb-2">지도</h1>
			<p class="text-gray-600">위치별 평균 점수를 확인하고, 마커를 클릭하여 해당 위치의 사진들을 보세요</p>
		</div>
	</div>
	
	<!-- 에러 메시지 -->
	{#if error}
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
			<div class="p-4 bg-red-50 border border-red-200 rounded-lg">
				<p class="text-sm text-red-800">{error}</p>
			</div>
		</div>
	{/if}
	
	<!-- 지도 컨테이너 -->
	<div class="relative" style="height: calc(100vh - 200px); min-height: 600px;">
		{#if loading}
			<div class="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
				<div class="text-center">
					<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p class="text-gray-600">지도를 불러오는 중...</p>
				</div>
			</div>
		{/if}
		<div
			bind:this={mapContainer}
			class="w-full h-full"
			style="z-index: 1;"
		></div>
		
		<!-- 범례 -->
		<div class="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000] max-w-xs">
			<h3 class="text-sm font-semibold text-gray-900 mb-3">점수 범례</h3>
			<div class="space-y-2 text-xs">
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
					<span>8.0 이상 (높음)</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 rounded-full bg-yellow-500 border-2 border-white"></div>
					<span>6.0 - 7.9 (보통)</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 rounded-full bg-orange-500 border-2 border-white"></div>
					<span>4.0 - 5.9 (낮음)</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>
					<span>4.0 미만 (매우 낮음)</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 rounded-full bg-gray-500 border-2 border-white"></div>
					<span>점수 없음</span>
				</div>
			</div>
			<div class="mt-4 pt-4 border-t border-gray-200">
				<p class="text-xs text-gray-600">
					총 {locationGroups.size}개 위치에 {Array.from(locationGroups.values()).reduce((sum, g) => sum + g.pictures.length, 0)}개의 사진
				</p>
			</div>
		</div>
	</div>
</div>

<!-- 상세 보기 모달 -->
{#if showDetailModal && detailLocation}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
		<div class="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 my-8">
			<!-- 모달 헤더 -->
			<div class="flex items-center justify-between mb-6">
				<div>
					<h3 class="text-2xl font-bold text-gray-900">위치별 사진</h3>
					<p class="text-sm text-gray-600 mt-1">
						위도: {detailLocation.latitude.toFixed(4)}, 경도: {detailLocation.longitude.toFixed(4)}
					</p>
					{#if detailScore !== null}
						<div class="mt-2 inline-block bg-yellow-100 text-yellow-700 text-sm font-bold px-3 py-1 rounded">
							평균 점수: ⭐ {detailScore}/10
						</div>
					{/if}
					<p class="text-sm text-gray-600 mt-2">
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
										<div class="flex items-center gap-2">
											{#if picture.score}
												<div class="inline-block bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded">
													⭐ {picture.score}/10
												</div>
											{/if}
											<div class="text-xs text-gray-500">
												{formatDate(picture.created_at)}
											</div>
										</div>
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

<style>
	:global(.custom-marker) {
		background: transparent !important;
		border: none !important;
	}
</style>

