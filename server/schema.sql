-- Drop existing tables in reverse dependency order (child before parent)
DROP TABLE IF EXISTS readings;
DROP TABLE IF EXISTS users;

-- 1. Users table: stores patient login credentials and profile
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT users_name_not_blank CHECK (length(btrim(name)) > 0)
);

-- 2. Readings table: stores blood glucose measurements
CREATE TABLE readings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    slot VARCHAR(50) NOT NULL,
    value INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_date_slot UNIQUE (user_id, date, slot),
    CONSTRAINT readings_value_range CHECK (value BETWEEN 40 AND 600),
    CONSTRAINT readings_slot_allowed CHECK (slot IN ('Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner'))
);

-- 3. Composite Index: optimizes filtering by user and date queries
CREATE INDEX idx_readings_user_date ON readings(user_id, date);
