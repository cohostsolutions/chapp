-- Add attachment_url column to message_templates for storing template attachments
ALTER TABLE public.message_templates 
ADD COLUMN attachment_url TEXT NULL,
ADD COLUMN attachment_name TEXT NULL;