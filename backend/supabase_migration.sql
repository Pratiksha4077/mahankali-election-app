-- ==============================================================================
-- Mahankali Election & Voter Management System
-- Supabase PostgreSQL Complete Database Migration
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. DROP EXISTING OBJECTS (CLEAN RUN SAFE)
DROP VIEW IF EXISTS public.members CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.import_jobs CASCADE;
DROP TABLE IF EXISTS public.uploaded_files CASCADE;
DROP TABLE IF EXISTS public.voters CASCADE;
DROP TABLE IF EXISTS public.families CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.villages CASCADE;

-- ------------------------------------------------------------------------------
-- 3. VILLAGES TABLE (गावे)
-- ------------------------------------------------------------------------------
CREATE TABLE public.villages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    name_marathi VARCHAR(150) NOT NULL,
    taluka VARCHAR(100) DEFAULT 'वाळवा / Walwa',
    taluka_marathi VARCHAR(100) DEFAULT 'वाळवा',
    district VARCHAR(100) DEFAULT 'सांगली / Sangli',
    district_marathi VARCHAR(100) DEFAULT 'सांगली',
    pin_code VARCHAR(20) DEFAULT '415414',
    total_voters INTEGER DEFAULT 0,
    active_voters INTEGER DEFAULT 0,
    deceased_voters INTEGER DEFAULT 0,
    total_families INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. CATEGORIES TABLE (रंग श्रेणी - हिरवा/पिवळा/केशरी/लाल)
-- ------------------------------------------------------------------------------
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_marathi VARCHAR(100) NOT NULL,
    color VARCHAR(30) NOT NULL,
    description TEXT DEFAULT '',
    display_order INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. USERS TABLE (प्रशासक व कार्यकर्ते / Admin & Field Users)
-- ------------------------------------------------------------------------------
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    mobile_number VARCHAR(30) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(30) DEFAULT 'USER' NOT NULL, -- 'ADMIN' or 'USER'
    account_status VARCHAR(30) DEFAULT 'ACTIVE' NOT NULL, -- 'ACTIVE' or 'DISABLED'
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    assigned_villages JSONB DEFAULT '[]'::jsonb,
    permissions_granted BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{"location": true, "call_history": true, "sms": true}'::jsonb,
    last_login TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'admin'
);

-- ------------------------------------------------------------------------------
-- 6. FAMILIES TABLE (कुटुंब व्यवस्थापन)
-- ------------------------------------------------------------------------------
CREATE TABLE public.families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID REFERENCES public.villages(id) ON DELETE SET NULL,
    family_head_name VARCHAR(200) NOT NULL,
    house_number VARCHAR(100) DEFAULT '',
    total_members INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. UPLOADED_FILES TABLE (Cloudinary मधील Original Excel/PDF फाईल्स)
-- ------------------------------------------------------------------------------
CREATE TABLE public.uploaded_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) DEFAULT 'EXCEL' NOT NULL, -- 'EXCEL', 'PDF', 'CSV'
    file_size BIGINT DEFAULT 0,
    cloudinary_url TEXT NOT NULL,
    cloudinary_public_id VARCHAR(255),
    village_id UUID REFERENCES public.villages(id) ON DELETE SET NULL,
    uploaded_by VARCHAR(100) DEFAULT 'admin',
    total_records INTEGER DEFAULT 0,
    imported_records INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'COMPLETED', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. VOTERS TABLE (सर्व मतदार / Voters Data - Excel & App Records)
-- ------------------------------------------------------------------------------
CREATE TABLE public.voters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_number VARCHAR(100),            -- सभासद क्रमांक
    epic_number VARCHAR(100),                  -- मतदार ओळखपत्र क्र. (EPIC)
    serial_number INTEGER,                     -- मतदार यादीतील अनुक्रमांक
    booth_part_number VARCHAR(50) DEFAULT '62',-- यादी भाग क्रमांक / Booth
    
    -- नावे (मराठी व इंग्रजी)
    full_name VARCHAR(255),                    -- Full Name (English)
    full_name_marathi VARCHAR(255) NOT NULL,   -- संपूर्ण नाव (मराठी)
    first_name VARCHAR(100),                   -- पहिले नाव
    first_name_marathi VARCHAR(100),           -- पहिले नाव (मराठी)
    father_name VARCHAR(100),                  -- वडिलांचे / पतीचे नाव
    father_name_marathi VARCHAR(100),          -- वडिलांचे / पतीचे नाव (मराठी)
    surname VARCHAR(100),                      -- आडनाव (English)
    surname_marathi VARCHAR(100),              -- आडनाव (मराठी - उदा. पाटील, कदम, सावंत)
    
    -- नातेसंबंध
    relation_type VARCHAR(50) DEFAULT 'Father',-- Father / Husband / Mother / Other
    relative_name_marathi VARCHAR(255),
    relative_name_english VARCHAR(255),
    
    -- वैयक्तिक माहिती
    house_number VARCHAR(100),                 -- घर क्रमांक
    age INTEGER,                               -- वय
    gender VARCHAR(30) DEFAULT 'Male',         -- Male / Female / Other (पुरुष / महिला / इतर)
    mobile_number VARCHAR(50),                 -- मोबाईल क्रमांक
    address TEXT,                              -- पत्ता
    pin_code VARCHAR(20) DEFAULT '415414',
    
    -- सामाजिक व संस्थात्मक माहिती
    religion VARCHAR(100) DEFAULT '',          -- धर्म
    caste VARCHAR(100) DEFAULT '',             -- जात / प्रवर्ग
    profession VARCHAR(150) DEFAULT '',        -- व्यवसाय (शेती, नोकरी, व्यवसाय, इ.)
    designation VARCHAR(150) DEFAULT '',       -- पद
    organization VARCHAR(150) DEFAULT '',      -- संस्था (उदा. सोसायटी, साखर कारखाना, दूध संघ)
    
    -- मॅपिंग (Foreign Keys)
    village_id UUID REFERENCES public.villages(id) ON DELETE SET NULL,
    village_name VARCHAR(150) DEFAULT '',
    village_name_marathi VARCHAR(150) DEFAULT '',
    
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_code VARCHAR(50) DEFAULT 'UNCATEGORIZED',
    category_color VARCHAR(30) DEFAULT '#6B7280',
    
    family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- स्थिती
    status VARCHAR(30) DEFAULT 'ACTIVE',       -- 'ACTIVE' किंवा 'DECEASED' (जिवंत / मयत)
    is_voted BOOLEAN DEFAULT FALSE,            -- मतदान केले आहे का?
    voted_at TIMESTAMP WITH TIME ZONE,         -- मतदानाची वेळ
    deceased_date TIMESTAMP WITH TIME ZONE,    -- मयत तारीख
    deceased_recorded_by VARCHAR(100),
    
    -- स्त्रोत फाईल (Cloudinary)
    source_file_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL,
    source_file_name VARCHAR(255),
    source_file_type VARCHAR(50) DEFAULT 'EXCEL',
    cloudinary_url TEXT,
    
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(100) DEFAULT 'system'
);

-- ------------------------------------------------------------------------------
-- 9. MEMBERS VIEW (Backward Compatibility - जुना backend code सुरळीत चालण्यासाठी)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.members AS 
SELECT * FROM public.voters;

-- ------------------------------------------------------------------------------
-- 10. IMPORT_JOBS TABLE (Excel / PDF Background Import Jobs)
-- ------------------------------------------------------------------------------
CREATE TABLE public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) DEFAULT 'EXCEL' NOT NULL,
    file_size BIGINT DEFAULT 0,
    village_id UUID REFERENCES public.villages(id) ON DELETE SET NULL,
    village_name VARCHAR(150),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    progress INTEGER DEFAULT 0,
    stage VARCHAR(150) DEFAULT 'File uploaded to Cloudinary',
    total_records INTEGER DEFAULT 0,
    valid_records INTEGER DEFAULT 0,
    invalid_records INTEGER DEFAULT 0,
    duplicate_records INTEGER DEFAULT 0,
    imported_records INTEGER DEFAULT 0,
    error_summary TEXT,
    cloudinary_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. ACTIVITY_LOGS TABLE (कार्यकर्ते व ॲडमिन लॉग्स)
-- ------------------------------------------------------------------------------
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL, -- 'LOGIN', 'SEARCH', 'UPDATE_VOTER', 'IMPORT_EXCEL'
    entity_type VARCHAR(50),      -- 'VOTER', 'USER', 'FILE', 'FAMILY'
    entity_id VARCHAR(100),
    details TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. PERFORMANCE INDEXES (जलद शोध आणि फिल्टरिंगसाठी)
-- ------------------------------------------------------------------------------
CREATE INDEX idx_voters_surname_mr ON public.voters (surname_marathi);
CREATE INDEX idx_voters_full_name_mr ON public.voters (full_name_marathi);
CREATE INDEX idx_voters_mobile ON public.voters (mobile_number);
CREATE INDEX idx_voters_membership ON public.voters (membership_number);
CREATE INDEX idx_voters_epic ON public.voters (epic_number);
CREATE INDEX idx_voters_village ON public.voters (village_id, status);
CREATE INDEX idx_voters_category ON public.voters (category_id);
CREATE INDEX idx_voters_family ON public.voters (family_id);
CREATE INDEX idx_voters_serial ON public.voters (serial_number);
CREATE INDEX idx_voters_assigned ON public.voters (assigned_user_id);
CREATE INDEX idx_voters_status ON public.voters (status, is_deleted);
CREATE INDEX idx_users_username ON public.users (username);
CREATE INDEX idx_users_mobile ON public.users (mobile_number);
CREATE INDEX idx_activity_logs_time ON public.activity_logs (timestamp DESC);
CREATE INDEX idx_import_jobs_time ON public.import_jobs (created_at DESC);
CREATE INDEX idx_uploaded_files_time ON public.uploaded_files (created_at DESC);

-- ------------------------------------------------------------------------------
-- 13. SEED DEFAULT DATA (प्रारंभिक गावे, वर्गवारी आणि वापरकर्ते)
-- ------------------------------------------------------------------------------

-- Default Villages
INSERT INTO public.villages (id, name, name_marathi, taluka, taluka_marathi, district, district_marathi)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Sakharale', 'साखराळे', 'Walwa', 'वाळवा', 'Sangli', 'सांगली'),
    ('22222222-2222-2222-2222-222222222222', 'Walwa', 'वाळवा', 'Walwa', 'वाळवा', 'Sangli', 'सांगली'),
    ('33333333-3333-3333-3333-333333333333', 'Islampur', 'इस्लामपूर', 'Walwa', 'वाळवा', 'Sangli', 'सांगली')
ON CONFLICT (id) DO NOTHING;

-- Default Categories (रंग श्रेणी)
INSERT INTO public.categories (id, code, name, name_marathi, color, description, display_order)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GREEN', 'Green (Supporter)', 'हिरवा (समर्थक)', '#10B981', 'नक्की मतदान करणारे समर्थक', 1),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'YELLOW', 'Yellow (Neutral)', 'पिवळा (तटस्थ)', '#F59E0B', 'तटस्थ मतदार', 2),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'ORANGE', 'Orange (Doubtful)', 'केशरी (साशंक)', '#F97316', 'साशंक मतदार', 3),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'RED', 'Red (Opponent)', 'लाल (विरोधी)', '#EF4444', 'विरोधी मतदार', 4)
ON CONFLICT (code) DO NOTHING;

-- Default Users (Password: admin123 & patil@123)
INSERT INTO public.users (id, username, full_name, mobile_number, hashed_password, role, account_status, is_active, permissions_granted)
VALUES 
    (
        '99999999-9999-9999-9999-999999999999',
        'admin',
        'प्रशासक (Admin)',
        '9822011223',
        '$2b$12$/SxfLKXtL.6nfNFPSYz8DeTmm/lRLXaO2jci9cdUgUo4UCbTfDcB6',
        'ADMIN',
        'ACTIVE',
        TRUE,
        TRUE
    ),
    (
        '88888888-8888-8888-8888-888888888888',
        'karan',
        'करण पाटील (कार्यकर्ता)',
        '9822011224',
        '$2b$12$DDi43U9CmuxrXldy0khNYe2LsCSqUzikfIxKSxQQ7zR6WrsO1fCLC',
        'USER',
        'ACTIVE',
        TRUE,
        TRUE
    )
ON CONFLICT (username) DO NOTHING;
