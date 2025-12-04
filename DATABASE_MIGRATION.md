# Database Migration for New Features

## New Fields Added

The following new fields need to be added to your `orders` table in Supabase:

### 1. `printed_name` (TEXT, nullable)
- **Purpose**: Stores the name to be printed on labels for identifying clothes
- **Example**: "Elerie's clothes", "Juan's laundry"
- **SQL**: 
  ```sql
  ALTER TABLE orders ADD COLUMN printed_name TEXT;
  ```

### 2. `machine_number` (TEXT, nullable)
- **Purpose**: Tracks which machine the clothes are currently in
- **Example**: "Washer 1", "Washer 2", "Dryer 1", "Dryer 2", etc.
- **SQL**: 
  ```sql
  ALTER TABLE orders ADD COLUMN machine_number TEXT;
  ```

## How to Apply

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Run the following SQL commands:

```sql
-- Add printed_name column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS printed_name TEXT;

-- Add machine_number column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS machine_number TEXT;
```

## Notes

- Both fields are **nullable** (optional), so existing orders will work fine
- The `printed_name` field is required when creating new orders (enforced in the frontend)
- The `machine_number` field is optional and can be set/updated anytime
- These fields are automatically included in all order API responses



