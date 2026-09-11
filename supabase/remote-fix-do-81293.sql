-- One-time: prefix the existing Delivery Order 81293 only.
-- Run in hosted Supabase SQL Editor if the app update did not apply.

update public.delivery_orders
set delivery_order_no = 'DO 81293'
where delivery_order_no = '81293';
