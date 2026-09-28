-- Super Thanks Hardening on Live Streams and Payments
ALTER TABLE public.live_chat_messages 
    ADD COLUMN IF NOT EXISTS is_super_chat BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS super_chat_amount DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id);

ALTER TABLE public.live_donations 
    ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id);

CREATE INDEX IF NOT EXISTS idx_live_chat_super_chat ON public.live_chat_messages(stream_id, is_super_chat);
CREATE INDEX IF NOT EXISTS idx_payments_status_provider ON public.payments(status, provider);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
