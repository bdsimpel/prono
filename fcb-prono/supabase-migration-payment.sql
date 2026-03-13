-- Payment tracking for €2 registration fee
ALTER TABLE players
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid')),
  ADD COLUMN payment_method TEXT
    CHECK (payment_method IN ('wero', 'transfer', 'cash')),
  ADD COLUMN paid_at TIMESTAMPTZ;
