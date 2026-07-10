-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "contact_number" TEXT,
    "office" TEXT,
    "password_hash" TEXT NOT NULL,
    "passcode_hash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'hr_officer',
    "status" TEXT NOT NULL DEFAULT 'active',
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" DATETIME,
    "last_login_at" DATETIME,
    "password_changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "container" TEXT NOT NULL,
    "blob_path" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "uploaded_by" TEXT,
    "application_id" TEXT,
    "vacancy_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stored_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stored_files_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stored_files_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "track" TEXT,
    "required_bachelor_degree" TEXT,
    "required_degree_keywords" TEXT NOT NULL,
    "min_years_experience" INTEGER NOT NULL DEFAULT 0,
    "min_training_hours" INTEGER NOT NULL DEFAULT 0,
    "eligibility_required" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "vacancies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "position_id" TEXT NOT NULL,
    "item_no" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "school" TEXT,
    "location" TEXT,
    "region" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "posting_start" DATETIME,
    "posting_end" DATETIME,
    "salary_grade" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vacancies_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "applicants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "local_resident" BOOLEAN NOT NULL DEFAULT false,
    "bachelor_degree" TEXT,
    "major" TEXT,
    "years_experience" REAL NOT NULL DEFAULT 0,
    "training_hours" REAL NOT NULL DEFAULT 0,
    "eligibility" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application_number" TEXT NOT NULL,
    "vacancy_id" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "date_applied" DATETIME NOT NULL,
    "documents" TEXT NOT NULL DEFAULT '{}',
    "documentary_complete" BOOLEAN,
    "doc_checklist" TEXT,
    "reason" TEXT,
    "assessment_status" TEXT,
    "comparative_assessment_scores" TEXT,
    "appointment_status" TEXT,
    "appointment_date" DATETIME,
    "appointment_item_no" TEXT,
    "appointment_reference_code" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "applications_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "applicants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "application_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application_id" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    CONSTRAINT "application_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "qual_evals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "overall_fit" REAL,
    "degree_score" REAL,
    "experience_score" REAL,
    "training_score" REAL,
    "eligibility_score" REAL,
    "degree_decision" TEXT,
    "experience_decision" TEXT,
    "training_decision" TEXT,
    "eligibility_decision" TEXT,
    "documentary_complete" BOOLEAN,
    "remarks" TEXT,
    "area_scores" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "qual_evals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "applicants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vacancies_item_no_key" ON "vacancies"("item_no");

-- CreateIndex
CREATE UNIQUE INDEX "applicants_code_key" ON "applicants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "applications_application_number_key" ON "applications"("application_number");
