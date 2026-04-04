-- Migration: Fix critical RLS vulnerability on profiles table
-- Prevents admin takeover via self-assigning is_admin = true
-- Run this in the Supabase SQL Editor

-- 1. Drop permissive policies
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;

-- 2. Users can only read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 3. No INSERT policy — admins already exist, create new ones via service role/SQL Editor

-- 4. Users can update own profile but CANNOT change is_admin
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (is_admin = (SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()));
