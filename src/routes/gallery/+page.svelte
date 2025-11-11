<script>
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	
	let albums = $state([]);
	let pictures = $state([]);
	let allPictures = $state([]); // 모든 사진 (개수 계산용)
	let selectedAlbum = $state(null);
	let loading = $state(true);
	let error = $state(null);
	
	// 앨범 관리 모달
	let showAlbumModal = $state(false);
	let editingAlbum = $state(null);
	let albumName = $state('');
	let albumDescription = $state('');
	let savingAlbum = $state(false);
	
	// 사진 이동 모달
	let showMoveModal = $state(false);
	let movingPicture = $state(null);
	
	onMount(() => {
		loadAlbums();
		loadPictures();
	});
	
	async function loadAlbums() {
		try {
			const { data, error: err } = await supabase
				.from('albums')
				.select('*')
				.order('created_at', { ascending: false });
			
			if (err) throw err;
			albums = data || [];
		} catch (err) {
			console.error('앨범 로드 실패:', err);
			error = '앨범을 불러오는데 실패했습니다.';
		} finally {
			loading = false;
		}
	}
	
	async function loadPictures(albumId = null) {
		try {
			// 모든 사진 로드 (개수 계산용)
			const { data: allData, error: allErr } = await supabase
				.from('picture_logs')
				.select('id, album_id');
			
			if (allErr) throw allErr;
			allPictures = allData || [];
			
			// 선택된 앨범의 사진만 로드
			let query = supabase
				.from('picture_logs')
				.select('*')
				.order('created_at', { ascending: false });
			
			if (albumId) {
				query = query.eq('album_id', albumId);
			} else if (selectedAlbum === null) {
				query = query.is('album_id', null);
			}
			
			const { data, error: err } = await query;
			
			if (err) throw err;
			pictures = data || [];
		} catch (err) {
			console.error('사진 로드 실패:', err);
			error = '사진을 불러오는데 실패했습니다.';
		}
	}
	
	function getAlbumPictureCount(albumId) {
		if (albumId === null) {
			return allPictures.filter(p => !p.album_id).length;
		}
		return allPictures.filter(p => p.album_id === albumId).length;
	}
	
	function selectAlbum(album) {
		selectedAlbum = album;
		loadPictures(album?.id || null);
	}
	
	function openAlbumModal(album = null) {
		editingAlbum = album;
		albumName = album?.name || '';
		albumDescription = album?.description || '';
		showAlbumModal = true;
	}
	
	function closeAlbumModal() {
		showAlbumModal = false;
		editingAlbum = null;
		albumName = '';
		albumDescription = '';
	}
	
	async function saveAlbum() {
		if (!albumName.trim()) {
			error = '앨범 이름을 입력해주세요.';
			return;
		}
		
		savingAlbum = true;
		error = null;
		
		try {
			if (editingAlbum) {
				// 수정
				const { error: err } = await supabase
					.from('albums')
					.update({
						name: albumName.trim(),
						description: albumDescription.trim() || null,
						updated_at: new Date().toISOString()
					})
					.eq('id', editingAlbum.id);
				
				if (err) throw err;
			} else {
				// 생성
				const { error: err } = await supabase
					.from('albums')
					.insert({
						name: albumName.trim(),
						description: albumDescription.trim() || null
					});
				
				if (err) throw err;
			}
			
			await loadAlbums();
			await loadPictures(selectedAlbum?.id || null); // 사진 개수 업데이트
			closeAlbumModal();
		} catch (err) {
			console.error('앨범 저장 실패:', err);
			error = err.message || '앨범 저장에 실패했습니다.';
		} finally {
			savingAlbum = false;
		}
	}
	
	async function deleteAlbum(album) {
		if (!confirm(`"${album.name}" 앨범을 삭제하시겠습니까? 앨범의 사진들은 앨범에서 제거되지만 삭제되지 않습니다.`)) {
			return;
		}
		
		try {
			// 앨범의 사진들을 앨범에서 제거
			await supabase
				.from('picture_logs')
				.update({ album_id: null })
				.eq('album_id', album.id);
			
			// 앨범 삭제
			const { error: err } = await supabase
				.from('albums')
				.delete()
				.eq('id', album.id);
			
			if (err) throw err;
			
			if (selectedAlbum?.id === album.id) {
				selectedAlbum = null;
			}
			
			await loadAlbums();
			await loadPictures(selectedAlbum?.id || null);
		} catch (err) {
			console.error('앨범 삭제 실패:', err);
			error = err.message || '앨범 삭제에 실패했습니다.';
		}
	}
	
	function openMoveModal(picture) {
		movingPicture = picture;
		showMoveModal = true;
	}
	
	function closeMoveModal() {
		showMoveModal = false;
		movingPicture = null;
	}
	
	async function movePicture(targetAlbumId) {
		if (!movingPicture) return;
		
		try {
			const { error: err } = await supabase
				.from('picture_logs')
				.update({ album_id: targetAlbumId })
				.eq('id', movingPicture.id);
			
			if (err) throw err;
			
			await loadPictures(selectedAlbum?.id || null);
			await loadAlbums(); // 앨범 목록의 사진 개수 업데이트
			closeMoveModal();
		} catch (err) {
			console.error('사진 이동 실패:', err);
			error = err.message || '사진 이동에 실패했습니다.';
		}
	}
	
	function getImageUrl(imagePath) {
		if (!imagePath) return '';
		const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
		return `${supabaseUrl}/storage/v1/object/public/pictures/${imagePath}`;
	}
	
	function handleImageError(event) {
		event.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🖼️%3C/text%3E%3C/svg%3E';
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-sky-50 via-teal-50 to-lime-50 py-8 px-4 sm:px-6 lg:px-8">
	<div class="max-w-7xl mx-auto">
		<!-- 헤더 -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent">갤러리</h1>
				<p class="text-gray-600 mt-1">앨범별로 사진을 관리하세요</p>
			</div>
			<button
				onclick={() => openAlbumModal()}
				class="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-600 transition-all shadow-md hover:shadow-lg"
			>
				➕ 새 앨범
			</button>
		</div>
		
		<!-- 에러 메시지 -->
		{#if error}
			<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
				<p class="text-sm text-red-800">{error}</p>
			</div>
		{/if}
		
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- 앨범 목록 사이드바 -->
			<div class="lg:col-span-1">
				<div class="bg-white rounded-lg shadow p-6">
					<h2 class="text-xl font-semibold text-gray-900 mb-4">앨범 목록</h2>
					
					<!-- 앨범 없음 -->
					<div class="mb-4">
						<button
							onclick={() => selectAlbum(null)}
							class="w-full text-left p-3 rounded-lg transition-colors {selectedAlbum === null ? 'bg-teal-100 text-teal-700 font-semibold border border-teal-200' : 'hover:bg-teal-50 text-teal-700 border border-transparent'}"
						>
							📁 앨범 없음 ({getAlbumPictureCount(null)})
						</button>
					</div>
					
					{#if loading}
						<div class="text-center py-8 text-gray-500">로딩 중...</div>
					{:else if albums.length === 0}
						<div class="text-center py-8 text-gray-500">
							<p>앨범이 없습니다.</p>
							<p class="text-sm mt-2">새 앨범을 만들어보세요!</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each albums as album}
								<div class="group relative">
									<button
										onclick={() => selectAlbum(album)}
										class="w-full text-left p-3 rounded-lg transition-colors {selectedAlbum?.id === album.id ? 'bg-teal-100 text-teal-700 font-semibold border border-teal-200' : 'hover:bg-teal-50 text-teal-700 border border-transparent'}"
									>
										<div class="flex items-center justify-between">
											<span>📁 {album.name}</span>
											<span class="text-xs text-gray-500">
												{getAlbumPictureCount(album.id)}
											</span>
										</div>
									</button>
									<div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
										<button
											onclick={(e) => { e.stopPropagation(); openAlbumModal(album); }}
											class="p-1 text-teal-600 hover:bg-teal-100 rounded"
											title="수정"
										>
											✏️
										</button>
										<button
											onclick={(e) => { e.stopPropagation(); deleteAlbum(album); }}
											class="p-1 text-red-600 hover:bg-red-100 rounded"
											title="삭제"
										>
											🗑️
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
			
			<!-- 사진 그리드 -->
			<div class="lg:col-span-2">
				<div class="bg-white rounded-lg shadow p-6">
					<h2 class="text-xl font-semibold text-gray-900 mb-4">
						{selectedAlbum ? selectedAlbum.name : '앨범 없음'}
					</h2>
					
					{#if loading}
						<div class="text-center py-12 text-gray-500">로딩 중...</div>
					{:else if pictures.length === 0}
						<div class="text-center py-12 text-gray-500">
							<p>사진이 없습니다.</p>
							<p class="text-sm mt-2">새 사진을 업로드해보세요!</p>
						</div>
					{:else}
						<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
							{#each pictures as picture}
								<div class="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:shadow-lg transition-shadow">
									<img
										src={getImageUrl(picture.image_path)}
										alt="사진"
										class="w-full h-full object-cover"
										onerror={handleImageError}
									/>
									<div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
										<button
											onclick={() => openMoveModal(picture)}
											class="px-3 py-1 bg-white text-gray-800 rounded text-sm font-semibold hover:bg-gray-100"
										>
											이동
										</button>
									</div>
									{#if picture.score}
										<div class="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
											⭐ {picture.score}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<!-- 앨범 생성/수정 모달 -->
{#if showAlbumModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
			<h3 class="text-xl font-semibold text-gray-900 mb-4">
				{editingAlbum ? '앨범 수정' : '새 앨범 만들기'}
			</h3>
			
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-semibold text-gray-700 mb-2">
						앨범 이름 *
					</label>
					<input
						type="text"
						bind:value={albumName}
						placeholder="앨범 이름을 입력하세요"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				</div>
				
				<div>
					<label class="block text-sm font-semibold text-gray-700 mb-2">
						설명 (선택사항)
					</label>
					<textarea
						bind:value={albumDescription}
						placeholder="앨범에 대한 설명을 입력하세요"
						rows="3"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					></textarea>
				</div>
			</div>
			
			<div class="mt-6 flex gap-3 justify-end">
				<button
					onclick={closeAlbumModal}
					disabled={savingAlbum}
					class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50"
				>
					취소
				</button>
				<button
					onclick={saveAlbum}
					disabled={savingAlbum || !albumName.trim()}
					class="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
				>
					{savingAlbum ? '저장 중...' : '저장'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 사진 이동 모달 -->
{#if showMoveModal && movingPicture}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
			<h3 class="text-xl font-semibold text-gray-900 mb-4">사진을 앨범으로 이동</h3>
			
			<div class="space-y-2 mb-6">
				<button
					onclick={() => movePicture(null)}
					class="w-full text-left p-3 rounded-lg hover:bg-teal-50 border-2 border-transparent hover:border-teal-200 transition-colors"
				>
					📁 앨범 없음
				</button>
				{#each albums as album}
					<button
						onclick={() => movePicture(album.id)}
						class="w-full text-left p-3 rounded-lg hover:bg-teal-50 border-2 border-transparent hover:border-teal-200 transition-colors"
					>
						📁 {album.name}
					</button>
				{/each}
			</div>
			
			<div class="flex justify-end">
				<button
					onclick={closeMoveModal}
					class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
				>
					취소
				</button>
			</div>
		</div>
	</div>
{/if}

