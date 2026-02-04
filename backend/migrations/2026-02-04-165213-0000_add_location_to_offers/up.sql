-- Add latitude and longitude columns to offers table
ALTER TABLE offers
ADD COLUMN latitude DOUBLE NULL,
ADD COLUMN longitude DOUBLE NULL;
