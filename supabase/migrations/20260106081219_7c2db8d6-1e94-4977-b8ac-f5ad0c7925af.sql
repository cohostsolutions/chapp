-- Create storage bucket for chat/communication images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'communications', 
  'communications', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to communications bucket
CREATE POLICY "Authenticated users can upload communication images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'communications');

-- Allow public read access to communication images
CREATE POLICY "Anyone can view communication images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'communications');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete communication images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'communications');