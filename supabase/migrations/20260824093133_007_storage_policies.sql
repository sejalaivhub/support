/*
# Storage bucket policies for attachments

## Overview
Sets up RLS policies on the 'attachments' storage bucket so authenticated
users can upload, read, and manage their own file attachments.

## Policies
1. SELECT - any authenticated user can read attachments (they're public)
2. INSERT - authenticated users can upload files
3. UPDATE - users can update their own files
4. DELETE - users can delete their own files

## Notes
1. The bucket is public so images/videos can be displayed inline in the rich text editor.
2. File paths use the pattern: {user_id}/{timestamp}-{filename}
*/

-- Allow authenticated users to read all attachments
DROP POLICY IF EXISTS "attachments_read" ON storage.objects;
CREATE POLICY "attachments_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'attachments');

-- Allow authenticated users to upload attachments
DROP POLICY IF EXISTS "attachments_insert" ON storage.objects;
CREATE POLICY "attachments_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Allow users to update their own attachments
DROP POLICY IF EXISTS "attachments_update" ON storage.objects;
CREATE POLICY "attachments_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'attachments' AND owner = auth.uid())
WITH CHECK (bucket_id = 'attachments' AND owner = auth.uid());

-- Allow users to delete their own attachments
DROP POLICY IF EXISTS "attachments_delete" ON storage.objects;
CREATE POLICY "attachments_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments' AND owner = auth.uid());
