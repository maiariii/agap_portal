-- Migration: Create agap_invited table for invite allowlist & submissions tracking
-- Target: Staging and Production databases (Azure PostgreSQL / PostgreSQL 13+)

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS agap_invited (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email          TEXT NOT NULL,
  job_cluster_id UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  is_submitted   BOOLEAN DEFAULT FALSE
);

-- 2. Add columns if table existed without them
ALTER TABLE agap_invited 
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS job_cluster_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_submitted BOOLEAN DEFAULT FALSE;

-- 3. Add unique index to prevent duplicate invitations per email & job_cluster_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_agap_invited_email_job_cluster 
ON agap_invited (email, job_cluster_id);

-- 4. Add performance indexes for lookups
CREATE INDEX IF NOT EXISTS idx_agap_invited_email 
ON agap_invited (email);

CREATE INDEX IF NOT EXISTS idx_agap_invited_job_cluster_id 
ON agap_invited (job_cluster_id);
