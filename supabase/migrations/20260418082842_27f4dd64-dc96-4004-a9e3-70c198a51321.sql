-- Public bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read for product images
DO $$ BEGIN
  CREATE POLICY "Product images publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;