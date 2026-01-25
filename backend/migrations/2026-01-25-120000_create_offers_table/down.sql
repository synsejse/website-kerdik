-- Revert migration: remove the `offers` table (indexes are dropped automatically)
DROP TABLE IF EXISTS offers;
