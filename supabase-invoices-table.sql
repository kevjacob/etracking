-- ============================================================
-- Invoices table for Tai Say eTracking
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
-- Status and all invoice fields are stored in the "invoices" table.
-- This way status (and everything else) is saved and shared for all users.
-- ============================================================

-- Option A: Create the full table if you don't have it yet
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT DEFAULT '',
  date_of_invoice DATE,
  status TEXT NOT NULL DEFAULT 'Billed',
  assigned_driver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_salesman_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_clerk_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  transfer_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  hold_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  hold_warehouse_type TEXT DEFAULT '',
  delivery_date DATE,
  delivery_slot TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  discrepancy_checked BOOLEAN DEFAULT false,
  discrepancy_title TEXT DEFAULT '',
  discrepancy_description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Option B: If you already have an "invoices" table but are missing columns,
-- run these (ignore errors for columns that already exist):

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_no TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS date_of_invoice DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Billed';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS assigned_driver_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS assigned_salesman_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS assigned_clerk_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transfer_warehouse_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hold_warehouse_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hold_warehouse_type TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_slot TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS remark TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discrepancy_checked BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discrepancy_title TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discrepancy_description TEXT DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
