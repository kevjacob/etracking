-- Remove duplicate import documents (keep 1 row per document number).
-- Keeps the row with the most advanced status; ties broken by earliest created_at.

-- ESD invoices
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY trim(invoice_no)
      ORDER BY
        CASE trim(status)
          WHEN 'Completed' THEN 100
          WHEN 'Cancelled' THEN 99
          WHEN 'Delivered' THEN 90
          WHEN 'Delivery In Progress' THEN 80
          WHEN 'Preparing Delivery' THEN 70
          WHEN 'Chop & Sign - Warehouse' THEN 60
          WHEN 'Hold - Warehouse' THEN 50
          WHEN 'Transfer' THEN 40
          WHEN 'Billed' THEN 10
          ELSE 5
        END DESC,
        created_at ASC
    ) AS rn
  FROM public.invoices
  WHERE trim(invoice_no) <> ''
)
DELETE FROM public.invoices i
USING ranked r
WHERE i.id = r.id AND r.rn > 1;

-- Autocount invoices (precaution — usually no dupes)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY trim(invoice_no)
      ORDER BY
        CASE trim(status)
          WHEN 'Completed' THEN 100
          WHEN 'Cancelled' THEN 99
          WHEN 'Delivered' THEN 90
          WHEN 'Delivery In Progress' THEN 80
          WHEN 'Preparing Delivery' THEN 70
          WHEN 'Chop & Sign - Warehouse' THEN 60
          WHEN 'Hold - Warehouse' THEN 50
          WHEN 'Transfer' THEN 40
          WHEN 'Billed' THEN 10
          ELSE 5
        END DESC,
        created_at ASC
    ) AS rn
  FROM public.invoices_autocount
  WHERE trim(invoice_no) <> ''
)
DELETE FROM public.invoices_autocount i
USING ranked r
WHERE i.id = r.id AND r.rn > 1;

-- Credit notes (precaution)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY trim(credit_note_no)
      ORDER BY
        CASE trim(status)
          WHEN 'Completed' THEN 100
          WHEN 'Cancelled' THEN 99
          WHEN 'Delivered' THEN 90
          WHEN 'Delivery In Progress' THEN 80
          WHEN 'Preparing Delivery' THEN 70
          WHEN 'Chop & Sign - Warehouse' THEN 60
          WHEN 'Hold - Warehouse' THEN 50
          WHEN 'Transfer' THEN 40
          WHEN 'Billed' THEN 10
          ELSE 5
        END DESC,
        created_at ASC
    ) AS rn
  FROM public.credit_notes
  WHERE trim(credit_note_no) <> ''
)
DELETE FROM public.credit_notes i
USING ranked r
WHERE i.id = r.id AND r.rn > 1;

-- Prevent future duplicates from import
CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_no_unique
  ON public.invoices (trim(invoice_no))
  WHERE trim(invoice_no) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS invoices_autocount_invoice_no_unique
  ON public.invoices_autocount (trim(invoice_no))
  WHERE trim(invoice_no) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_credit_note_no_unique
  ON public.credit_notes (trim(credit_note_no))
  WHERE trim(credit_note_no) <> '';

notify pgrst, 'reload schema';
