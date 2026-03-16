-- Per-placement rack ear offset in millimeters.
-- Positive = device shifted toward its mounting face (outward).
-- Negative = device shifted away from its mounting face (inward).
ALTER TABLE layout_items
ADD COLUMN ear_offset_mm integer NOT NULL DEFAULT 0;

-- Rollback:
-- ALTER TABLE layout_items DROP COLUMN ear_offset_mm;
