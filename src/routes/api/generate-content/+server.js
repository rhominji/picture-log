import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function POST({ request }) {
	try {
		// 요청 크기 확인
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 4.5 * 1024 * 1024) {
			return json(
				{ error: '이미지가 너무 큽니다. 더 작은 이미지를 사용해주세요. (권장: 3MB 이하)' },
				{ status: 413 }
			);
		}

		let requestData;
		try {
			requestData = await request.json();
		} catch (parseError) {
			// JSON 파싱 실패 시 (413 에러로 인한 경우)
			if (parseError.message?.includes('413') || contentLength > 4.5 * 1024 * 1024) {
				return json(
					{ error: '이미지가 너무 큽니다. 더 작은 이미지를 사용해주세요. (권장: 3MB 이하)' },
					{ status: 413 }
				);
			}
			throw parseError;
		}

		const { imageBase64, contentType, imageMetadata, userInput, additionalText } = requestData;

		if (!imageBase64 || !contentType) {
			return json({ error: '이미지와 콘텐츠 타입이 필요합니다.' }, { status: 400 });
		}

		const OPENAI_API_KEY = env.OPENAI_API_KEY;
		
		if (!OPENAI_API_KEY) {
			return json({ error: 'OpenAI API 키가 설정되지 않았습니다.' }, { status: 500 });
		}

		// 콘텐츠 타입에 따른 프롬프트 생성
		const prompts = {
			diary: `이 사진을 분석하여 일기 형식의 글을 작성해주세요. 사진에 무엇이 있는지, 어떤 분위기인지, 어떤 감정을 느끼는지에 대해 자연스럽고 진솔하게 작성해주세요. 사진에 사람이 포함되어 있더라도, 그 순간의 경험과 감정에 초점을 맞춰 작성해주세요.`,
			keywords: `이 사진을 표현하는 키워드를 5-10개 정도 쉼표로 구분하여 나열해주세요. 사진의 주요 요소, 감정, 분위기 등을 포함해주세요.`,
			poem: `이 사진을 보고 시를 작성해주세요. 사진의 이미지, 감정, 분위기를 시적으로 표현해주세요.`,
			oneLine: `이 사진에 대한 한 줄 감상을 작성해주세요. 간결하고 감동적인 한 문장으로 표현해주세요.`,
			short: `이 사진에 대한 짧은 글을 작성해주세요. 사진의 내용과 느낌을 간결하게 2-3문단으로 표현해주세요.`
		};

		const basePrompt = prompts[contentType] || prompts.short;
		
		// 점수 생성 프롬프트 추가 (더 명확하고 간결하게)
		const scorePrompt = `\n\n마지막으로, 이 사진과 순간의 의미와 가치를 1-10점 척도로 평가해주세요. 응답은 반드시 다음 형식으로 작성해주세요:\n\n[콘텐츠]\n(위에서 요청한 콘텐츠 내용)\n\n[점수]\n(1부터 10까지의 정수 숫자만)`;

		// 메타데이터 정보 추가
		let metadataText = '';
		if (imageMetadata) {
			const metadataParts = [];
			if (imageMetadata.DateTimeOriginal) {
				metadataParts.push(`촬영일시: ${new Date(imageMetadata.DateTimeOriginal).toLocaleString('ko-KR')}`);
			}
			if (imageMetadata.Make || imageMetadata.Model) {
				metadataParts.push(`카메라: ${imageMetadata.Make || ''} ${imageMetadata.Model || ''}`);
			}
			if (imageMetadata.ExposureTime) {
				metadataParts.push(`노출시간: ${imageMetadata.ExposureTime}s`);
			}
			if (imageMetadata.ISO) {
				metadataParts.push(`ISO: ${imageMetadata.ISO}`);
			}
			if (metadataParts.length > 0) {
				metadataText = `\n\n사진 메타데이터 정보:\n${metadataParts.join('\n')}`;
			}
		}

		// 사용자 입력 추가
		const userInputPart = userInput?.trim() 
			? `\n\n사용자가 추가하고 싶은 키워드나 내용:\n${userInput.trim()}` 
			: '';

		// 추가 메모 추가
		const additionalTextPart = additionalText?.trim() 
			? `\n\n사용자가 추가로 제공한 정보:\n${additionalText.trim()}` 
			: '';

		const fullPrompt = `${basePrompt}${scorePrompt}${metadataText}${userInputPart}${additionalTextPart}`;

		// OpenAI Vision API 호출
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${env.OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-4o',
				messages: [
					{
						role: 'system',
						content: '당신은 사진을 분석하여 감성적인 글을 작성하는 전문가입니다. 어떤 종류의 사진이든 (사람, 풍경, 사물 등) 그 순간의 경험과 감정을 진솔하게 표현해주세요. 사진의 내용을 존중하며, 긍정적이고 감성적인 관점에서 글을 작성해주세요.'
					},
					{
						role: 'user',
						content: [
							{
								type: 'text',
								text: fullPrompt
							},
							{
								type: 'image_url',
								image_url: {
									url: `data:image/jpeg;base64,${imageBase64}`
								}
							}
						]
					}
				],
				max_tokens: 1500,
				temperature: 0.8
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const errorMessage = errorData.error?.message || 'OpenAI API 호출 실패';
			
			// 콘텐츠 정책 위반 관련 에러 처리
			if (errorMessage.includes('content policy') || 
			    errorMessage.includes('safety') || 
			    errorMessage.includes('person') ||
			    errorMessage.includes('cannot') ||
			    errorData.error?.code === 'content_filter') {
				throw new Error('이미지의 내용으로 인해 콘텐츠를 생성할 수 없습니다. 다른 사진을 시도해주세요.');
			}
			
			throw new Error(errorMessage);
		}

		const data = await response.json();
		const fullResponse = data.choices[0]?.message?.content || '';
		
		// 응답이 비어있거나 정책 위반으로 필터링된 경우
		if (!fullResponse || fullResponse.trim() === '') {
			throw new Error('콘텐츠 생성에 실패했습니다. 다른 사진을 시도해주세요.');
		}
		
		// 콘텐츠 정책 위반 메시지 확인
		if (fullResponse.includes('cannot') || 
		    fullResponse.includes('content policy') ||
		    fullResponse.includes('safety') ||
		    fullResponse.toLowerCase().includes('i cannot') ||
		    fullResponse.toLowerCase().includes('i\'m sorry')) {
			throw new Error('이미지의 내용으로 인해 콘텐츠를 생성할 수 없습니다. 다른 사진을 시도해주세요.');
		}
		
		// 콘텐츠와 점수 분리
		let generatedContent = fullResponse;
		let score = null;
		
		// [점수] 섹션에서 점수 추출
		const scoreMatch = fullResponse.match(/\[점수\]\s*(\d+)/i);
		if (scoreMatch) {
			score = parseInt(scoreMatch[1], 10);
			// 점수가 1-10 범위인지 확인
			if (score < 1) score = 1;
			if (score > 10) score = 10;
			
			// 점수 섹션 제거
			generatedContent = fullResponse.replace(/\[점수\][\s\S]*/i, '').trim();
		}
		
		// [콘텐츠] 섹션이 있으면 해당 부분만 추출
		const contentMatch = fullResponse.match(/\[콘텐츠\]\s*([\s\S]*?)(?=\[점수\]|$)/i);
		if (contentMatch) {
			generatedContent = contentMatch[1].trim();
		}

		return json({ content: generatedContent, score });
	} catch (error) {
		console.error('OpenAI API 오류:', error);
		
		// 413 에러 처리
		if (error.message?.includes('413') || error.message?.includes('Payload Too Large')) {
			return json(
				{ error: '이미지가 너무 큽니다. 더 작은 이미지를 사용해주세요. (권장: 3MB 이하)' },
				{ status: 413 }
			);
		}
		
		return json(
			{ error: error.message || '콘텐츠 생성에 실패했습니다.' },
			{ status: 500 }
		);
	}
}

