-- Add C.O.D (Cash on Delivery) column to ESD and Autocount invoice tables.
alter table public.invoices add column if not exists cod boolean default false;
alter table public.invoices_autocount add column if not exists cod boolean default false;
