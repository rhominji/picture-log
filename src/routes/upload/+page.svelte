<script>
	import { supabase } from '$lib/supabase';
	import exifr from 'exifr';
	
	let selectedFile = $state(null);
	let previewUrl = $state(null);
	let uploading = $state(false);
	let uploadSuccess = $state(false);
	let uploadError = $state(null);
	let imageMetadata = $state(null);
	let isDragging = $state(false);
	let uploadedFilePath = $state(null);
	let contentType = $state(null); // 'diary', 'keywords', 'poem', 'oneLine', 'short'
	let userInput = $state(''); // 사용자가 추가하고 싶은 키워드나 내용
	let additionalText = $state(''); // 추가 텍스트 입력
	let saving = $state(false);
	let saveSuccess = $state(false);
	let generating = $state(false);
	let generatedContent = $state(null);
	let editedContent = $state(''); // 사용자가 수정한 콘텐츠
	let dailyScore = $state(null); // 그날의 점수
	let generationError = $state(null);
	
	function handleFile(file) {
		if (!file) return;
		
		// 이미지 파일인지 확인
		if (!file.type.startsWith('image/')) {
			uploadError = '이미지 파일만 업로드할 수 있습니다.';
			return;
		}
		
		selectedFile = file;
		uploadError = null;
		uploadSuccess = false;
		
		// 미리보기 생성
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
		previewUrl = URL.createObjectURL(file);
		
		// EXIF 데이터 추출
		extractMetadata(file);
	}
	
	function handleFileSelect(event) {
		const file = event.target.files?.[0];
		handleFile(file);
	}
	
	function handleDragOver(event) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = true;
	}
	
	function handleDragLeave(event) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;
	}
	
	function handleDrop(event) {
		event.preventDefault();
		event.stopPropagation();
		isDragging = false;
		
		const file = event.dataTransfer?.files?.[0];
		handleFile(file);
	}
	
	async function extractMetadata(file) {
		try {
			const metadata = await exifr.parse(file, {
				exif: true,
				gps: true,
				iptc: true,
				ifd0: true,
				ifd1: true
			});
			imageMetadata = metadata;
		} catch (error) {
			console.error('메타데이터 추출 실패:', error);
			imageMetadata = null;
		}
	}
	
	async function uploadImage() {
		if (!selectedFile) {
			uploadError = '파일을 선택해주세요.';
			return;
		}
		
		uploading = true;
		uploadError = null;
		uploadSuccess = false;
		
		try {
			// 오늘 날짜로 폴더 구조 생성 (YYYY/MM/DD)
			const today = new Date();
			const year = today.getFullYear();
			const month = String(today.getMonth() + 1).padStart(2, '0');
			const day = String(today.getDate()).padStart(2, '0');
			const datePath = `${year}/${month}/${day}`;
			
			// 고유한 파일명 생성
			const timestamp = Date.now();
			const fileExt = selectedFile.name.split('.').pop();
			const fileName = `${timestamp}.${fileExt}`;
			const filePath = `${datePath}/${fileName}`;
			
			// Supabase Storage에 업로드
			const { data, error } = await supabase.storage
				.from('pictures')
				.upload(filePath, selectedFile, {
					cacheControl: '3600',
					upsert: false
				});
			
			if (error) {
				throw error;
			}
			
			// 업로드된 파일 경로 저장
			uploadedFilePath = filePath;
			uploadSuccess = true;
			
		} catch (error) {
			console.error('업로드 실패:', error);
			if (error.message?.includes('row-level security policy')) {
				uploadError = 'Storage 버킷의 RLS 정책이 설정되지 않았습니다. Supabase 대시보드에서 정책을 설정해주세요.';
			} else {
				uploadError = error.message || '이미지 업로드에 실패했습니다.';
			}
		} finally {
			uploading = false;
		}
	}
	
	function selectContentType(type) {
		contentType = type;
		userInput = '';
		additionalText = '';
		saveSuccess = false;
		generatedContent = null;
		editedContent = '';
		dailyScore = null;
		generationError = null;
	}

	// 이미지를 base64로 변환
	function fileToBase64(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				// data:image/jpeg;base64, 부분 제거
				const base64 = reader.result.split(',')[1];
				resolve(base64);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	// OpenAI를 사용하여 콘텐츠 생성
	async function generateContent() {
		if (!selectedFile || !contentType) {
			uploadError = '사진과 콘텐츠 타입을 선택해주세요.';
			return;
		}

		generating = true;
		generationError = null;
		generatedContent = null;
		uploadError = null;

		try {
			// 이미지를 base64로 변환
			const imageBase64 = await fileToBase64(selectedFile);

			// API 호출
			const response = await fetch('/api/generate-content', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
			body: JSON.stringify({
				imageBase64,
				contentType,
				imageMetadata,
				userInput: userInput.trim() || null,
				additionalText: additionalText.trim() || null
			})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || '콘텐츠 생성에 실패했습니다.');
			}

			generatedContent = data.content;
			editedContent = data.content; // 초기값은 생성된 콘텐츠
			dailyScore = data.score || null; // 그날의 점수

		} catch (error) {
			console.error('콘텐츠 생성 실패:', error);
			generationError = error.message || '콘텐츠 생성에 실패했습니다.';
		} finally {
			generating = false;
		}
	}
	
	async function saveContent() {
		if (!contentType || !editedContent.trim()) {
			uploadError = '콘텐츠를 먼저 생성해주세요.';
			return;
		}
		
		if (!uploadSuccess || !uploadedFilePath) {
			uploadError = '먼저 이미지를 업로드해주세요.';
			return;
		}
		
		saving = true;
		uploadError = null;
		
		try {
			// GPS 좌표 추출 (있을 때만)
			let latitude = null;
			let longitude = null;
			if (imageMetadata?.latitude && imageMetadata?.longitude) {
				latitude = Number(imageMetadata.latitude);
				longitude = Number(imageMetadata.longitude);
				// 유효성 검사
				if (isNaN(latitude) || isNaN(longitude) || 
				    latitude < -90 || latitude > 90 || 
				    longitude < -180 || longitude > 180) {
					latitude = null;
					longitude = null;
				}
			}
			
			// 저장할 데이터 객체 생성
			const insertData = {
				image_path: uploadedFilePath,
				content_type: contentType,
				content: editedContent.trim(), // 수정된 콘텐츠 저장
				additional_text: additionalText.trim() || null,
				user_input: userInput.trim() || null, // 사용자가 입력한 키워드/내용
				score: dailyScore, // 그날의 점수
				created_at: new Date().toISOString()
			};
			
			// GPS 정보가 있을 때만 추가
			if (latitude !== null && longitude !== null) {
				insertData.latitude = latitude;
				insertData.longitude = longitude;
			}
			
			// Supabase 데이터베이스에 저장
			const { data, error } = await supabase
				.from('picture_logs')
				.insert(insertData);
			
			if (error) {
				throw error;
			}
			
			saveSuccess = true;
			
			// 2초 후 폼 리셋
			setTimeout(() => {
				resetForm();
			}, 2000);
			
		} catch (error) {
			console.error('저장 실패:', error);
			uploadError = error.message || '콘텐츠 저장에 실패했습니다.';
		} finally {
			saving = false;
		}
	}
	
	function resetForm() {
		selectedFile = null;
		uploadSuccess = false;
		uploadError = null;
		imageMetadata = null;
		uploadedFilePath = null;
		contentType = null;
		userInput = '';
		additionalText = '';
		saveSuccess = false;
		generatedContent = null;
		editedContent = '';
		dailyScore = null;
		generationError = null;
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
		// 파일 입력 리셋
		const fileInput = document.querySelector('input[type="file"]');
		if (fileInput) {
			fileInput.value = '';
		}
	}
	
	// 컴포넌트 언마운트 시 미리보기 URL 정리
	$effect(() => {
		return () => {
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	});
</script>

<div class="min-h-screen bg-gradient-to-br from-sky-50 via-teal-50 to-lime-50 py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-2xl mx-auto">
		<div class="bg-white/80 backdrop-blur-sm shadow-lg rounded-lg p-8 border border-sky-100">
			<h1 class="text-3xl font-bold bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent mb-8 text-center">
				오늘의 사진 업로드
			</h1>
			
			<!-- 파일 선택 영역 (사진이 선택되지 않았고 콘텐츠 생성 전에만 표시) -->
			{#if !generatedContent && !previewUrl}
				<div class="mb-6">
					<label
						for="file-upload"
						class="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors {isDragging ? 'border-sky-400 bg-sky-100' : 'border-sky-200 bg-sky-50/50 hover:bg-sky-100'}"
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
						ondrop={handleDrop}
					>
						<div class="flex flex-col items-center justify-center pt-5 pb-6">
							<svg
								class="w-10 h-10 mb-3 text-gray-400"
								aria-hidden="true"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 20 16"
							>
								<path
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
								/>
							</svg>
							<p class="mb-2 text-sm text-gray-500">
								<span class="font-semibold">클릭하여 파일 선택</span> 또는 드래그 앤 드롭
							</p>
							<p class="text-xs text-gray-500">PNG, JPG, GIF (최대 10MB)</p>
						</div>
						<input
							id="file-upload"
							type="file"
							class="hidden"
							accept="image/*"
							onchange={handleFileSelect}
							disabled={uploading}
						/>
					</label>
				</div>
			{/if}
			
			<!-- 미리보기 영역 -->
			{#if previewUrl}
				<div class="mb-6">
					<div class="relative rounded-lg overflow-hidden border-2 border-gray-200">
						<img
							src={previewUrl}
							alt="미리보기"
							class="w-full h-auto max-h-96 object-contain bg-gray-100"
						/>
					</div>
					{#if selectedFile}
						<p class="mt-2 text-sm text-gray-600">
							파일명: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
						</p>
					{/if}
				</div>
			{/if}
			
			<!-- 메타데이터 표시 -->
			{#if imageMetadata}
				<div class="mb-6 p-4 bg-cyan-50/50 rounded-lg border border-cyan-100">
					<h3 class="text-sm font-semibold text-cyan-700 mb-2">이미지 정보</h3>
					<div class="text-xs text-gray-600 space-y-1">
						{#if imageMetadata.DateTimeOriginal}
							<p>촬영일시: {new Date(imageMetadata.DateTimeOriginal).toLocaleString('ko-KR')}</p>
						{/if}
						{#if imageMetadata.Make || imageMetadata.Model}
							<p>카메라: {imageMetadata.Make || ''} {imageMetadata.Model || ''}</p>
						{/if}
						{#if imageMetadata.ExposureTime}
							<p>노출시간: {imageMetadata.ExposureTime}s</p>
						{/if}
						{#if imageMetadata.ISO}
							<p>ISO: {imageMetadata.ISO}</p>
						{/if}
					</div>
				</div>
			{/if}
			
			<!-- 에러 메시지 -->
			{#if uploadError}
				<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
					<p class="text-sm text-red-800">{uploadError}</p>
				</div>
			{/if}
			
			<!-- 성공 메시지 -->
			{#if uploadSuccess}
				<div class="mb-6 p-4 bg-lime-50 border border-lime-200 rounded-lg">
					<p class="text-sm text-lime-800 font-semibold mb-4">
						✓ 이미지가 성공적으로 업로드되었습니다!
					</p>
					
					<!-- 콘텐츠 타입 선택 -->
					{#if !contentType}
						<div class="mt-4">
							<p class="text-sm font-semibold text-sky-700 mb-3">오늘의 기록 방식을 선택해주세요:</p>
							<div class="grid grid-cols-2 gap-3">
								<button
									type="button"
									onclick={() => selectContentType('diary')}
									class="p-4 border-2 border-sky-200 rounded-lg hover:border-sky-400 hover:bg-sky-100 transition-colors text-left bg-white/50"
								>
									<div class="font-semibold text-sky-800">📔 일기</div>
									<div class="text-xs text-sky-600 mt-1">생각과 감정</div>
								</button>
								<button
									type="button"
									onclick={() => selectContentType('keywords')}
									class="p-4 border-2 border-teal-200 rounded-lg hover:border-teal-400 hover:bg-teal-100 transition-colors text-left bg-white/50"
								>
									<div class="font-semibold text-teal-800">🏷️ 키워드</div>
									<div class="text-xs text-teal-600 mt-1">단어의 나열</div>
								</button>
								<button
									type="button"
									onclick={() => selectContentType('poem')}
									class="p-4 border-2 border-cyan-200 rounded-lg hover:border-cyan-400 hover:bg-cyan-100 transition-colors text-left bg-white/50"
								>
									<div class="font-semibold text-cyan-800">✍️ 시</div>
									<div class="text-xs text-cyan-600 mt-1">리듬과 분위기</div>
								</button>
								<button
									type="button"
									onclick={() => selectContentType('oneLine')}
									class="p-4 border-2 border-lime-200 rounded-lg hover:border-lime-400 hover:bg-lime-100 transition-colors text-left bg-white/50"
								>
									<div class="font-semibold text-lime-800">💭 한줄 감상</div>
									<div class="text-xs text-lime-600 mt-1">압축된 기록</div>
								</button>
								<button
									type="button"
									onclick={() => selectContentType('short')}
									class="p-4 border-2 border-emerald-200 rounded-lg hover:border-emerald-400 hover:bg-emerald-100 transition-colors text-left col-span-2 bg-white/50"
								>
									<div class="font-semibold text-emerald-800">📝 짧은글</div>
									<div class="text-xs text-emerald-600 mt-1">단편적 메모</div>
								</button>
							</div>
						</div>
					{/if}
					
					<!-- 콘텐츠 입력 폼 -->
					{#if contentType}
						<div class="mt-4">
							<div class="mb-3">
								<button
									type="button"
									onclick={() => { contentType = null; userInput = ''; additionalText = ''; generatedContent = null; editedContent = ''; dailyScore = null; }}
									class="text-sm text-gray-600 hover:text-gray-800"
								>
									← 다른 타입 선택하기
								</button>
							</div>
							
							<!-- 사용자 입력 필드 (추가하고 싶은 키워드나 내용) -->
							<div class="mb-4">
								<div class="block text-sm font-semibold text-gray-700 mb-2">
									💡 AI 생성 시 추가하고 싶은 내용 (선택사항)
								</div>
								<textarea
									bind:value={userInput}
									placeholder="AI 생성에 반영하고 싶은 키워드나 내용을 입력해주세요. 예: '평화로운 분위기', '가족과 함께한 순간' 등"
									class="w-full px-4 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-white/50"
									rows="3"
								></textarea>
								<p class="mt-1 text-xs text-gray-500">
									입력한 내용은 AI가 콘텐츠를 생성할 때 참고됩니다.
								</p>
							</div>
							
							<!-- AI 생성 버튼 -->
							{#if !generatedContent}
								<div class="mb-4">
								<button
									type="button"
									onclick={generateContent}
									disabled={generating || !selectedFile}
									class="w-full bg-gradient-to-r from-sky-500 to-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-sky-600 hover:to-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
								>
										{#if generating}
											<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
											<span>AI가 생성 중...</span>
										{:else}
											<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
											</svg>
											<span>✨ AI로 자동 생성하기</span>
										{/if}
									</button>
									<p class="mt-2 text-xs text-gray-500 text-center">
										사진, 메타데이터, 추가 메모를 분석하여 {contentType === 'diary' ? '일기' : contentType === 'keywords' ? '키워드' : contentType === 'poem' ? '시' : contentType === 'oneLine' ? '한줄 감상' : '짧은글'}를 자동으로 생성합니다.
									</p>
								</div>
								
								<!-- 생성 에러 메시지 -->
								{#if generationError}
									<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
										<p class="text-sm text-red-800">{generationError}</p>
									</div>
								{/if}
							{/if}
							
							<!-- AI 생성된 콘텐츠 수정 영역 -->
							{#if generatedContent}
								<div class="mb-4">
									<div class="flex items-center justify-between mb-2">
										<div class="block text-sm font-semibold text-gray-700">
											{#if contentType === 'diary'}
												📔 일기
											{:else if contentType === 'keywords'}
												🏷️ 키워드
											{:else if contentType === 'poem'}
												✍️ 시
											{:else if contentType === 'oneLine'}
												💭 한줄 감상
											{:else if contentType === 'short'}
												📝 짧은글
											{/if}
										</div>
										<div class="flex items-center gap-2">
											{#if editedContent !== generatedContent}
												<span class="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">✏️ 수정됨</span>
											{:else}
												<span class="text-xs text-cyan-600 bg-cyan-50 px-2 py-1 rounded border border-cyan-200">✨ AI 생성됨</span>
											{/if}
										</div>
									</div>
									
									<!-- 생성된 콘텐츠 수정 가능한 필드 -->
									{#if contentType === 'oneLine'}
										<input
											type="text"
											bind:value={editedContent}
											placeholder="한 줄로 감상을 적어주세요..."
											class="w-full px-4 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-white/50"
											maxlength="100"
										/>
									{:else if contentType === 'keywords'}
										<input
											type="text"
											bind:value={editedContent}
											placeholder="키워드를 쉼표로 구분하여 입력하세요 (예: 여행, 자연, 평화)"
											class="w-full px-4 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-white/50"
										/>
									{:else}
										<textarea
											bind:value={editedContent}
											placeholder={contentType === 'poem' ? '시를 작성해주세요...' : contentType === 'diary' ? '오늘의 일기를 작성해주세요...' : '짧은 글을 작성해주세요...'}
											class="w-full px-4 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-white/50"
											rows={contentType === 'poem' ? 8 : contentType === 'diary' ? 10 : 6}
										></textarea>
									{/if}
									
									<div class="mt-2 flex gap-2">
										<button
											type="button"
											onclick={generateContent}
											disabled={generating || !selectedFile}
											class="text-xs text-cyan-600 hover:text-cyan-800 disabled:text-gray-400"
										>
											🔄 다시 생성하기
										</button>
										{#if editedContent !== generatedContent}
											<button
												type="button"
												onclick={() => { editedContent = generatedContent; }}
												class="text-xs text-gray-600 hover:text-gray-800"
											>
												↩️ 원래대로 되돌리기
											</button>
										{/if}
									</div>
									
									<!-- 그날의 점수 표시 (콘텐츠와 함께) -->
									{#if dailyScore !== null}
										<div class="mt-4 p-4 bg-gradient-to-r from-amber-50 via-yellow-50 to-lime-50 border-2 border-amber-200 rounded-lg">
											<div class="flex items-center justify-between">
												<div>
													<div class="text-sm font-semibold text-amber-700 mb-1">⭐ 그날의 점수</div>
													<div class="text-xs text-amber-600">이 순간을 평가한 점수입니다</div>
												</div>
												<div class="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
													{dailyScore}
													<span class="text-lg text-amber-400">/10</span>
												</div>
											</div>
										</div>
									{/if}
								</div>
							{/if}
							
							<!-- 추가 텍스트 입력 (모든 타입에 동일하게) -->
							<div class="mb-4">
								<div class="block text-sm font-semibold text-gray-700 mb-2">
									💬 추가 메모 (선택사항)
								</div>
								<textarea
									bind:value={additionalText}
									placeholder="추가로 기록하고 싶은 내용이 있으시면 입력해주세요..."
									class="w-full px-4 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-400 focus:border-sky-400 bg-white/50"
									rows="4"
								></textarea>
								<p class="mt-1 text-xs text-gray-500">
									원하시는 내용을 자유롭게 추가로 기록할 수 있습니다.
								</p>
							</div>
							
							<!-- 저장 버튼 (AI 생성된 콘텐츠가 있을 때만 표시) -->
							{#if generatedContent}
								<div class="mt-6 flex gap-3">
									<button
										type="button"
										onclick={saveContent}
										disabled={!editedContent.trim() || saving || !uploadSuccess}
										class="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-6 py-2 rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
									>
										{saving ? '저장 중...' : '💾 그림과 함께 저장하기'}
									</button>
									<button
										type="button"
										onclick={() => { generatedContent = null; editedContent = ''; userInput = ''; }}
										disabled={saving}
										class="px-6 py-2 border border-sky-200 text-sky-700 rounded-lg font-semibold hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white/50"
									>
										지우기
									</button>
								</div>
							{/if}
							
							{#if saveSuccess}
								<div class="mt-3 p-3 bg-lime-50 border border-lime-200 rounded-lg">
									<p class="text-sm text-lime-800 font-semibold">
										✓ 저장되었습니다!
									</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
			
			<!-- 업로드 버튼 (업로드 전에만 표시) -->
			{#if !uploadSuccess}
				<div class="flex gap-4">
					<button
						type="button"
						onclick={uploadImage}
						disabled={!selectedFile || uploading}
						class="flex-1 bg-gradient-to-r from-sky-500 to-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-sky-600 hover:to-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
					>
						{uploading ? '업로드 중...' : '업로드'}
					</button>
					{#if selectedFile}
						<button
							type="button"
							onclick={resetForm}
							disabled={uploading}
							class="px-6 py-3 border border-sky-200 text-sky-700 rounded-lg font-semibold hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white/50"
						>
							취소
						</button>
					{/if}
				</div>
			{/if}
			
			<!-- 오늘 날짜 표시 -->
			<div class="mt-6 text-center">
				<p class="text-sm text-gray-500">
					업로드 일시: {new Date().toLocaleString('ko-KR', {
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						weekday: 'long',
						hour: '2-digit',
						minute: '2-digit',
						second: '2-digit'
					})}
				</p>
			</div>
		</div>
	</div>
</div>

