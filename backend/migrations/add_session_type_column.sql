-- Add session_type column to existing practice_sessions table
-- This migration adds the session_type column if it doesn't exist

-- Add session_type column (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'practice_sessions' 
        AND column_name = 'session_type'
    ) THEN
        ALTER TABLE practice_sessions 
        ADD COLUMN session_type VARCHAR(20) NOT NULL DEFAULT 'flashcard';
    END IF;
END $$;

-- Create indexes for efficient filtering by session type (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_practice_sessions_session_type ON practice_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_type_date ON practice_sessions(user_id, session_type, completed_at);
