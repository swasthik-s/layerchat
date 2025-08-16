-- Supabase SQL Schema for LayerChat
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create conversations table
CREATE TABLE conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4',
  messages JSONB NOT NULL DEFAULT '[]'::JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversations_title ON conversations USING GIN(to_tsvector('english', title));

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create policies for conversations (public access for now)
-- Note: In production, you'd want to add user authentication and user-specific policies
CREATE POLICY "Allow all operations on conversations" ON conversations
    FOR ALL USING (true) WITH CHECK (true);

-- Optional: Create a view for conversation list (without messages for performance)
CREATE VIEW conversation_list AS
SELECT 
  id,
  title,
  model,
  COALESCE(jsonb_array_length(messages), 0) as message_count,
  (messages->-1->>'timestamp')::BIGINT as last_message_timestamp,
  created_at,
  updated_at
FROM conversations
ORDER BY updated_at DESC;

-- Grant permissions
GRANT ALL ON conversations TO anon;
GRANT ALL ON conversation_list TO anon;

-- Insert sample data (optional)
INSERT INTO conversations (id, title, model, messages) VALUES 
(
  'sample-conversation-1',
  'Welcome to LayerChat',
  'gpt-4',
  '[
    {
      "id": "msg-1",
      "role": "user", 
      "content": "Hello, how are you?",
      "type": "text",
      "timestamp": 1692198000000
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "Hello! I''m doing well, thank you for asking. How can I help you today?",
      "type": "text", 
      "timestamp": 1692198001000
    }
  ]'::JSONB
);

-- Function to get conversation with message count
CREATE OR REPLACE FUNCTION get_conversation_with_stats(conversation_id TEXT)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  model TEXT,
  messages JSONB,
  message_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.model,
    c.messages,
    COALESCE(jsonb_array_length(c.messages), 0)::INTEGER as message_count,
    c.created_at,
    c.updated_at
  FROM conversations c
  WHERE c.id = conversation_id;
END;
$$ LANGUAGE plpgsql;
