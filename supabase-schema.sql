-- Run this in Supabase SQL Editor to create tables for Tai Say eTracking

-- Employees (Salesman, Lorry Driver, Clerk)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT NOT NULL CHECK (position IN ('Salesman', 'Lorry Driver', 'Clerk')),
  name TEXT NOT NULL,
  number TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pic_name TEXT DEFAULT '',
  pic_phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices (references employees and warehouses)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT DEFAULT '',
  date_of_invoice DATE,
  status TEXT NOT NULL DEFAULT 'Billed',
  assigned_driver_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_salesman_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_clerk_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  transfer_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  delivery_date DATE,
  delivery_slot TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  discrepancy_checked BOOLEAN DEFAULT false,
  discrepancy_title TEXT DEFAULT '',
  discrepancy_description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: trigger to auto-set updated_at on invoices
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Enable RLS if needed (optional; allow all for simplicity)
-- ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
