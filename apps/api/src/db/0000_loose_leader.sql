-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
DO $$ BEGIN
 CREATE TYPE "application_status" AS ENUM('for_comparative_assessment', 'excluded', 'disqualified', 'qualified', 'pending_qs_review', 'pending');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "qs_decision" AS ENUM('fail', 'pass');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "assessment_status_type" AS ENUM('assessment_completed', 'assessment_started', 'marked_qualified');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_role" AS ENUM('admin', 'approver', 'hr_officer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_status" AS ENUM('locked', 'disabled', 'active');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "conversation_status" AS ENUM('resolved', 'read', 'unread');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "support_division" AS ENUM('InsightED', 'SED', 'HRDD', 'PD');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "actor_role" AS ENUM('admin', 'user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agap_schools" (
	"iern" varchar(50),
	"school_id" integer,
	"region" varchar(50),
	"division" varchar(50),
	"school_name" varchar(150)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_role" "actor_role" NOT NULL,
	"author_user_id" text,
	"author_admin_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" text NOT NULL,
	"subject_role" "actor_role" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_role" "actor_role" NOT NULL,
	"actor_user_id" text,
	"actor_admin_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "all_address" (
	"region" varchar(150),
	"province" varchar(150),
	"municipality" varchar(150),
	"barangay" varchar(150)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"applicant_id" varchar(50) NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"new_blob_url" text NOT NULL,
	"affected_applications_count" integer DEFAULT 0,
	"application_id" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"is_open" boolean DEFAULT true,
	"batch_number" varchar(100) DEFAULT '1'::character varying
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applicants_backup_20260810" (
	"id" integer,
	"password_hash" varchar(255),
	"surname" varchar(100),
	"first_name" varchar(100),
	"middle_name" varchar(100),
	"date_of_birth" date,
	"place_of_birth" varchar(255),
	"sex" varchar(20),
	"civil_status" varchar(50),
	"citizenship" varchar(100),
	"blood_type" varchar(10),
	"gsis_id_no" varchar(50),
	"pag_ibig_id_no" varchar(50),
	"philhealth_no" varchar(50),
	"sss_no" varchar(50),
	"residential_address" text,
	"permanent_address" text,
	"telephone_no" varchar(50),
	"mobile_no" varchar(50),
	"email_address" varchar(150),
	"spouse_surname" varchar(100),
	"spouse_first_name" varchar(100),
	"spouse_occupation" varchar(150),
	"father_surname" varchar(100),
	"father_first_name" varchar(100),
	"mother_maiden_surname" varchar(100),
	"name_extension" varchar(50),
	"height" varchar(20),
	"weight" varchar(20),
	"agency_employee_no" varchar(50),
	"citizenship_type" varchar(50),
	"spouse_middle_name" varchar(100),
	"spouse_name_extension" varchar(50),
	"spouse_employer_business" varchar(150),
	"spouse_business_address" varchar(255),
	"spouse_telephone" varchar(50),
	"father_middle_name" varchar(100),
	"father_name_extension" varchar(50),
	"mother_first_name" varchar(100),
	"mother_middle_name" varchar(100),
	"children_details" jsonb,
	"family_background" jsonb,
	"educational_background" jsonb,
	"civil_service_eligibility" jsonb,
	"work_experience" jsonb,
	"voluntary_work" jsonb,
	"learning_and_development" jsonb,
	"other_information" jsonb,
	"questionnaire_responses" jsonb,
	"code" varchar(255),
	"local_resident" boolean,
	"bachelor_degree" varchar(255),
	"major" varchar(255),
	"years_experience" double precision,
	"training_hours" double precision,
	"eligibility" varchar(255),
	"applicant_number" varchar(255),
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"alternate_email" varchar(255),
	"religion" text,
	"disability" text,
	"ethnic_group" text,
	"age" integer,
	"bachelors_degree" text,
	"passcode" varchar(6)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_clusters" (
	"id" serial PRIMARY KEY NOT NULL,
	"applicant_id" integer NOT NULL,
	"job_cluster_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"is_saved" boolean DEFAULT true,
	CONSTRAINT "saved_jobs_applicant_id_position_id_key" UNIQUE("applicant_id","job_cluster_id"),
	CONSTRAINT "unique_saved_cluster" UNIQUE("applicant_id","job_cluster_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reclassification_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_number" varchar(100) NOT NULL,
	"applicant_id" integer,
	"employee_id" text,
	"position_title" varchar(255) NOT NULL,
	"item_number" varchar(100),
	"station_division" varchar(255),
	"date_originally_submitted" timestamp with time zone DEFAULT now(),
	"proposed_qs_eval_result" varchar(100),
	"csc_approved_qs_eval_result" varchar(100),
	"evaluation_status" varchar(50) DEFAULT 'pending_reevaluation'::character varying,
	"has_updated_credentials" boolean DEFAULT false,
	"updated_credentials_submitted_at" timestamp with time zone,
	"documents" jsonb DEFAULT '[]'::jsonb,
	"reevaluation_timestamp" timestamp with time zone,
	"dbm_export_timestamp" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "reclassification_applications_application_number_key" UNIQUE("application_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_conversation_list" (
	"id" uuid,
	"user_id" text,
	"user_name" text,
	"user_region" text,
	"user_division" text,
	"title" text,
	"status" "conversation_status",
	"assigned_to" "support_division",
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"latest_message" text,
	"latest_message_author_role" "actor_role",
	"latest_message_created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"region" text,
	"division" text,
	"contact_number" text,
	"office" text,
	"password_hash" text NOT NULL,
	"passcode_hash" text,
	"role" text DEFAULT 'hr_officer' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"last_login_at" timestamp,
	"password_changed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "users_username_key" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"issued_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents_audit_logs" (
	"id" integer,
	"applicant_id" varchar(50),
	"document_type" varchar(100),
	"new_blob_url" text,
	"affected_applications_count" integer,
	"application_id" text,
	"created_at" timestamp with time zone,
	"is_open" boolean,
	"batch_number" varchar(100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"track" text,
	"required_bachelor_degree" text,
	"required_degree_keywords" text NOT NULL,
	"years_experience" numeric DEFAULT 0 NOT NULL,
	"training_hours" numeric DEFAULT 0 NOT NULL,
	"eligibility_required" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"salary_grade" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_clusters" (
	"id" text PRIMARY KEY NOT NULL,
	"position_id" text NOT NULL,
	"division" text,
	"region" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "car_upload_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" text,
	"division" varchar(255) NOT NULL,
	"file_name" varchar(255),
	"status" varchar(50) DEFAULT 'processing'::character varying NOT NULL,
	"total_rows" integer DEFAULT 0,
	"valid_rows" integer DEFAULT 0,
	"invalid_rows" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"status" "conversation_status" DEFAULT 'unread' NOT NULL,
	"assigned_to" "support_division",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teacher_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_code" varchar(100) NOT NULL,
	"school_name" varchar(255),
	"division" varchar(255) NOT NULL,
	"position_title" varchar(100) DEFAULT 'Teacher I'::character varying,
	"is_filled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "teacher_items_item_code_key" UNIQUE("item_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "car_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"applicant_code" varchar(100) NOT NULL,
	"applicant_name" varchar(255) NOT NULL,
	"item_reference" varchar(100) NOT NULL,
	"education_score" numeric(5, 2),
	"training_score" numeric(5, 2),
	"experience_score" numeric(5, 2),
	"pbet_score" numeric(5, 2),
	"interview_score" numeric(5, 2),
	"total_rating" numeric(5, 2) NOT NULL,
	"validation_status" varchar(20) DEFAULT 'valid'::character varying NOT NULL,
	"validation_errors" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teacher_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"car_result_id" uuid,
	"applicant_code" varchar(100) NOT NULL,
	"applicant_name" varchar(255) NOT NULL,
	"item_id" uuid,
	"appointed_by" text,
	"appointed_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "teacher_appointments_item_id_key" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applicants" (
	"id" serial PRIMARY KEY NOT NULL,
	"password_hash" varchar(255),
	"surname" varchar(100) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"middle_name" varchar(100),
	"date_of_birth" date,
	"place_of_birth" varchar(255),
	"sex" varchar(20),
	"civil_status" varchar(50),
	"citizenship" varchar(100) DEFAULT 'Filipino'::character varying,
	"blood_type" varchar(10),
	"gsis_id_no" varchar(50),
	"pag_ibig_id_no" varchar(50),
	"philhealth_no" varchar(50),
	"sss_no" varchar(50),
	"residential_address" text,
	"permanent_address" text,
	"telephone_no" varchar(50),
	"mobile_no" varchar(50),
	"email_address" varchar(150) NOT NULL,
	"spouse_surname" varchar(100),
	"spouse_first_name" varchar(100),
	"spouse_occupation" varchar(150),
	"father_surname" varchar(100),
	"father_first_name" varchar(100),
	"mother_maiden_surname" varchar(100),
	"name_extension" varchar(50),
	"height" varchar(20),
	"weight" varchar(20),
	"agency_employee_no" varchar(50),
	"citizenship_type" varchar(50),
	"spouse_middle_name" varchar(100),
	"spouse_name_extension" varchar(50),
	"spouse_employer_business" varchar(150),
	"spouse_business_address" varchar(255),
	"spouse_telephone" varchar(50),
	"father_middle_name" varchar(100),
	"father_name_extension" varchar(50),
	"mother_first_name" varchar(100),
	"mother_middle_name" varchar(100),
	"children_details" jsonb DEFAULT '[]'::jsonb,
	"family_background" jsonb,
	"educational_background" jsonb DEFAULT '[]'::jsonb,
	"civil_service_eligibility" jsonb DEFAULT '[]'::jsonb,
	"work_experience" jsonb DEFAULT '[]'::jsonb,
	"voluntary_work" jsonb DEFAULT '[]'::jsonb,
	"learning_and_development" jsonb DEFAULT '[]'::jsonb,
	"other_information" jsonb DEFAULT '{}'::jsonb,
	"questionnaire_responses" jsonb DEFAULT '{}'::jsonb,
	"code" varchar(255),
	"local_resident" boolean DEFAULT false,
	"bachelor_degree" varchar(255),
	"major" varchar(255),
	"years_experience" double precision DEFAULT 0,
	"training_hours" double precision DEFAULT 0,
	"eligibility" varchar(255),
	"applicant_number" varchar(255),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"alternate_email" varchar(255),
	"religion" text,
	"disability" text,
	"ethnic_group" text,
	"age" integer DEFAULT 0,
	"bachelors_degree" text,
	"passcode" varchar(6),
	"is_test" boolean DEFAULT false,
	CONSTRAINT "applicants_email_address_key" UNIQUE("email_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"application_number" text NOT NULL,
	"job_cluster_id" text NOT NULL,
	"applicant_id" integer NOT NULL,
	"status" text DEFAULT 'Application Submitted' NOT NULL,
	"application_status" text DEFAULT 'Application Submitted' NOT NULL,
	"date_applied" timestamp NOT NULL,
	"documents" text DEFAULT '{}' NOT NULL,
	"documentary_complete" boolean,
	"doc_checklist" text,
	"reason" text,
	"assessment_status" text,
	"comparative_assessment_scores" text,
	"appointment_status" text,
	"appointment_date" timestamp,
	"appointment_item_no" text,
	"appointment_reference_code" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"letter_of_intent" text,
	"sworn_document" text,
	CONSTRAINT "applications_application_number_key" UNIQUE("application_number"),
	CONSTRAINT "applications_applicant_id_job_cluster_id_key" UNIQUE("job_cluster_id","applicant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_history" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qual_evals" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"result" text NOT NULL,
	"overall_fit" double precision,
	"degree_score" double precision,
	"experience_score" double precision,
	"training_score" double precision,
	"eligibility_score" double precision,
	"degree_decision" text,
	"experience_decision" text,
	"training_decision" text,
	"eligibility_decision" text,
	"documentary_complete" boolean,
	"remarks" text,
	"area_scores" text,
	"at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vacancies" (
	"id" text PRIMARY KEY NOT NULL,
	"position_id" text NOT NULL,
	"item_no" text NOT NULL,
	"title" text NOT NULL,
	"school" text,
	"division" text,
	"region" text,
	"status" text DEFAULT 'open' NOT NULL,
	"filling_up_status" varchar(50) DEFAULT 'UNFILLED'::character varying NOT NULL,
	"job_cluster_id" text,
	"school_level" text,
	"school_id" integer,
	"posting_start" timestamp,
	"posting_end" timestamp,
	"salary_grade" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"is_test" boolean DEFAULT false,
	"doc_fetch_preference" text DEFAULT 'RETAIN_OLD',
	"has_fetched_docs" boolean DEFAULT false,
	"doc_fetched_at" timestamp with time zone,
	"allowed_emails" jsonb DEFAULT '[]'::jsonb,
	CONSTRAINT "vacancies_item_no_key" UNIQUE("item_no")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_created" ON "messages" ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reclass_app_num" ON "reclassification_applications" ("application_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reclass_eval_status" ON "reclassification_applications" ("evaluation_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reclass_applicant_id" ON "reclassification_applications" ("applicant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_user_id" ON "password_reset_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_admin_sort" ON "conversations" ("assigned_to","last_message_at","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_unassigned" ON "conversations" ("last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_user" ON "conversations" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_status" ON "conversations" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_assigned_to" ON "conversations" ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_last_message_at" ON "conversations" ("last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_teacher_items_division" ON "teacher_items" ("division");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_teacher_items_is_filled" ON "teacher_items" ("is_filled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_car_results_batch_id" ON "car_results" ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_teacher_appointments_item_id" ON "teacher_appointments" ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_teacher_appointments_code" ON "teacher_appointments" ("applicant_code");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_admin_id_fkey" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reclassification_applications" ADD CONSTRAINT "reclassification_applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reclassification_applications" ADD CONSTRAINT "reclassification_applications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_clusters" ADD CONSTRAINT "job_clusters_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "car_upload_batches" ADD CONSTRAINT "car_upload_batches_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "car_results" ADD CONSTRAINT "car_results_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."car_upload_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teacher_appointments" ADD CONSTRAINT "teacher_appointments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."car_upload_batches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teacher_appointments" ADD CONSTRAINT "teacher_appointments_car_result_id_fkey" FOREIGN KEY ("car_result_id") REFERENCES "public"."car_results"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teacher_appointments" ADD CONSTRAINT "teacher_appointments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."teacher_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teacher_appointments" ADD CONSTRAINT "teacher_appointments_appointed_by_fkey" FOREIGN KEY ("appointed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_job_cluster_id_fkey" FOREIGN KEY ("job_cluster_id") REFERENCES "public"."job_clusters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_history" ADD CONSTRAINT "application_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qual_evals" ADD CONSTRAINT "qual_evals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_job_cluster_id_fkey" FOREIGN KEY ("job_cluster_id") REFERENCES "public"."job_clusters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

*/