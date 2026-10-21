-- Prevent duplicate document numbers from import (ESD, Autocount, credit notes).
CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_no_unique
  ON public.invoices (trim(invoice_no))
  WHERE trim(invoice_no) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS invoices_autocount_invoice_no_unique
  ON public.invoices_autocount (trim(invoice_no))
  WHERE trim(invoice_no) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_credit_note_no_unique
  ON public.credit_notes (trim(credit_note_no))
  WHERE trim(credit_note_no) <> '';
