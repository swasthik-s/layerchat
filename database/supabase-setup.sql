-- LayerChat Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    messages JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_title ON conversations USING GIN(to_tsvector('english', title));

-- Enable Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS (allow all operations for now - you can restrict later)
CREATE POLICY "Allow all operations on conversations" ON conversations
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
INSERT INTO conversations (id, title, model, messages, metadata) VALUES 
(
    'sample-chat-1', 
    'Welcome to LayerChat', 
    'GPT-4',
    '[
        {
            "id": "msg-1",
            "role": "assistant",
            "content": "Hello! How can I help you today?",
            "type": "text",
            "timestamp": 1692144000000,
            "metadata": {},
            "attachments": []
        }
    ]'::jsonb,
    '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
