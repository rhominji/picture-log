-- albums 테이블 생성
CREATE TABLE IF NOT EXISTS albums (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- picture_logs 테이블에 album_id 컬럼 추가
ALTER TABLE picture_logs 
ADD COLUMN IF NOT EXISTS album_id BIGINT REFERENCES albums(id) ON DELETE SET NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_picture_logs_album_id ON picture_logs(album_id);
CREATE INDEX IF NOT EXISTS idx_albums_created_at ON albums(created_at DESC);

