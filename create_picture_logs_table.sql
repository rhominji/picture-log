-- picture_logs 테이블 생성
CREATE TABLE IF NOT EXISTS picture_logs (
  id BIGSERIAL PRIMARY KEY,
  image_path TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('diary', 'keywords', 'poem', 'oneLine', 'short')),
  content TEXT NOT NULL,
  additional_text TEXT,
  user_input TEXT,
  score INTEGER CHECK (score >= 1 AND score <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가 (선택사항)
CREATE INDEX IF NOT EXISTS idx_picture_logs_created_at ON picture_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picture_logs_content_type ON picture_logs(content_type);

-- user_input 컬럼 추가 (이미 테이블이 존재하는 경우)
ALTER TABLE picture_logs 
ADD COLUMN IF NOT EXISTS user_input TEXT;

-- score 컬럼 추가 (이미 테이블이 존재하는 경우)
ALTER TABLE picture_logs 
ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score >= 1 AND score <= 10);

-- GPS 좌표 컬럼 추가 (이미 테이블이 존재하는 경우)
ALTER TABLE picture_logs 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE picture_logs 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- GPS 좌표 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_picture_logs_location ON picture_logs(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

