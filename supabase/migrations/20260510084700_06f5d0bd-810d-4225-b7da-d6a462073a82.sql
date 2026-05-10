-- Allow drivers to view pets of customers whose order they are actively handling
CREATE POLICY "Drivers view pets of active orders"
ON public.pets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = pets.user_id
      AND o.driver_id = auth.uid()
      AND o.order_status IN ('confirmed', 'in_progress')
  )
);