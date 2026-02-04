-- Remove latitude and longitude columns from offers table
ALTER TABLE offers
DROP COLUMN latitude,
DROP COLUMN longitude;
