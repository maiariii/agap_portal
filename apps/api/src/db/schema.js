import { pgTable, pgEnum, varchar, integer, index, foreignKey, uuid, text, timestamp, unique, jsonb, serial, boolean, date, doublePrecision, numeric } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const applicationStatus = pgEnum("application_status", ['for_comparative_assessment', 'excluded', 'disqualified', 'qualified', 'pending_qs_review', 'pending'])
export const qsDecision = pgEnum("qs_decision", ['fail', 'pass'])
export const assessmentStatusType = pgEnum("assessment_status_type", ['assessment_completed', 'assessment_started', 'marked_qualified'])
export const userRole = pgEnum("user_role", ['admin', 'approver', 'hr_officer'])
export const userStatus = pgEnum("user_status", ['locked', 'disabled', 'active'])
export const conversationStatus = pgEnum("conversation_status", ['resolved', 'read', 'unread'])
export const supportDivision = pgEnum("support_division", ['InsightED', 'SED', 'HRDD', 'PD'])
export const actorRole = pgEnum("actor_role", ['admin', 'user'])


export const agapSchools = pgTable("agap_schools", {
	iern: varchar("iern", { length: 50 }),
	schoolId: integer("school_id"),
	region: varchar("region", { length: 50 }),
	division: varchar("division", { length: 50 }),
	schoolName: varchar("school_name", { length: 150 }),
});

export const messages = pgTable("messages", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" } ),
	authorRole: actorRole("author_role").notNull(),
	authorUserId: text("author_user_id"),
	authorAdminId: uuid("author_admin_id").references(() => admins.id, { onDelete: "set null" } ),
	body: text("body").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxMessagesConversationCreated: index("idx_messages_conversation_created").on(table.conversationId, table.createdAt),
	}
});

export const refreshTokens = pgTable("refresh_tokens", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	subjectId: text("subject_id").notNull(),
	subjectRole: actorRole("subject_role").notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		refreshTokensTokenHashKey: unique("refresh_tokens_token_hash_key").on(table.tokenHash),
	}
});

export const auditLogs = pgTable("audit_logs", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	actorRole: actorRole("actor_role").notNull(),
	actorUserId: text("actor_user_id"),
	actorAdminId: uuid("actor_admin_id").references(() => admins.id, { onDelete: "set null" } ),
	action: text("action").notNull(),
	entityType: text("entity_type").notNull(),
	entityId: uuid("entity_id"),
	metadata: jsonb("metadata").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const allAddress = pgTable("all_address", {
	region: varchar("region", { length: 150 }),
	province: varchar("province", { length: 150 }),
	municipality: varchar("municipality", { length: 150 }),
	barangay: varchar("barangay", { length: 150 }),
});

export const documentAuditLogs = pgTable("document_audit_logs", {
	id: serial("id").primaryKey().notNull(),
	applicantId: varchar("applicant_id", { length: 50 }).notNull(),
	documentType: varchar("document_type", { length: 100 }).notNull(),
	newBlobUrl: text("new_blob_url").notNull(),
	affectedApplicationsCount: integer("affected_applications_count").default(0),
	applicationId: text("application_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isOpen: boolean("is_open").default(true),
	batchNumber: varchar("batch_number", { length: 100 }).default('1'),
});

export const applicantsBackup20260810 = pgTable("applicants_backup_20260810", {
	id: integer("id"),
	passwordHash: varchar("password_hash", { length: 255 }),
	surname: varchar("surname", { length: 100 }),
	firstName: varchar("first_name", { length: 100 }),
	middleName: varchar("middle_name", { length: 100 }),
	dateOfBirth: date("date_of_birth"),
	placeOfBirth: varchar("place_of_birth", { length: 255 }),
	sex: varchar("sex", { length: 20 }),
	civilStatus: varchar("civil_status", { length: 50 }),
	citizenship: varchar("citizenship", { length: 100 }),
	bloodType: varchar("blood_type", { length: 10 }),
	gsisIdNo: varchar("gsis_id_no", { length: 50 }),
	pagIbigIdNo: varchar("pag_ibig_id_no", { length: 50 }),
	philhealthNo: varchar("philhealth_no", { length: 50 }),
	sssNo: varchar("sss_no", { length: 50 }),
	residentialAddress: text("residential_address"),
	permanentAddress: text("permanent_address"),
	telephoneNo: varchar("telephone_no", { length: 50 }),
	mobileNo: varchar("mobile_no", { length: 50 }),
	emailAddress: varchar("email_address", { length: 150 }),
	spouseSurname: varchar("spouse_surname", { length: 100 }),
	spouseFirstName: varchar("spouse_first_name", { length: 100 }),
	spouseOccupation: varchar("spouse_occupation", { length: 150 }),
	fatherSurname: varchar("father_surname", { length: 100 }),
	fatherFirstName: varchar("father_first_name", { length: 100 }),
	motherMaidenSurname: varchar("mother_maiden_surname", { length: 100 }),
	nameExtension: varchar("name_extension", { length: 50 }),
	height: varchar("height", { length: 20 }),
	weight: varchar("weight", { length: 20 }),
	agencyEmployeeNo: varchar("agency_employee_no", { length: 50 }),
	citizenshipType: varchar("citizenship_type", { length: 50 }),
	spouseMiddleName: varchar("spouse_middle_name", { length: 100 }),
	spouseNameExtension: varchar("spouse_name_extension", { length: 50 }),
	spouseEmployerBusiness: varchar("spouse_employer_business", { length: 150 }),
	spouseBusinessAddress: varchar("spouse_business_address", { length: 255 }),
	spouseTelephone: varchar("spouse_telephone", { length: 50 }),
	fatherMiddleName: varchar("father_middle_name", { length: 100 }),
	fatherNameExtension: varchar("father_name_extension", { length: 50 }),
	motherFirstName: varchar("mother_first_name", { length: 100 }),
	motherMiddleName: varchar("mother_middle_name", { length: 100 }),
	childrenDetails: jsonb("children_details"),
	familyBackground: jsonb("family_background"),
	educationalBackground: jsonb("educational_background"),
	civilServiceEligibility: jsonb("civil_service_eligibility"),
	workExperience: jsonb("work_experience"),
	voluntaryWork: jsonb("voluntary_work"),
	learningAndDevelopment: jsonb("learning_and_development"),
	otherInformation: jsonb("other_information"),
	questionnaireResponses: jsonb("questionnaire_responses"),
	code: varchar("code", { length: 255 }),
	localResident: boolean("local_resident"),
	bachelorDegree: varchar("bachelor_degree", { length: 255 }),
	major: varchar("major", { length: 255 }),
	yearsExperience: doublePrecision("years_experience"),
	trainingHours: doublePrecision("training_hours"),
	eligibility: varchar("eligibility", { length: 255 }),
	applicantNumber: varchar("applicant_number", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	alternateEmail: varchar("alternate_email", { length: 255 }),
	religion: text("religion"),
	disability: text("disability"),
	ethnicGroup: text("ethnic_group"),
	age: integer("age"),
	bachelorsDegree: text("bachelors_degree"),
	passcode: varchar("passcode", { length: 6 }),
});

export const documentsAuditLogs = pgTable("documents_audit_logs", {
	id: integer("id"),
	applicantId: varchar("applicant_id", { length: 50 }),
	documentType: varchar("document_type", { length: 100 }),
	newBlobUrl: text("new_blob_url"),
	affectedApplicationsCount: integer("affected_applications_count"),
	applicationId: text("application_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	isOpen: boolean("is_open"),
	batchNumber: varchar("batch_number", { length: 100 }),
});

export const savedClusters = pgTable("saved_clusters", {
	id: serial("id").primaryKey().notNull(),
	applicantId: integer("applicant_id").notNull(),
	jobClusterId: text("job_cluster_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isSaved: boolean("is_saved").default(true),
},
(table) => {
	return {
		savedJobsApplicantIdPositionIdKey: unique("saved_jobs_applicant_id_position_id_key").on(table.applicantId, table.jobClusterId),
		uniqueSavedCluster: unique("unique_saved_cluster").on(table.applicantId, table.jobClusterId),
	}
});

export const reclassificationApplications = pgTable("reclassification_applications", {
	id: serial("id").primaryKey().notNull(),
	applicationNumber: varchar("application_number", { length: 100 }).notNull(),
	applicantId: integer("applicant_id").references(() => applicants.id, { onDelete: "cascade" } ),
	employeeId: text("employee_id").references(() => users.id, { onDelete: "set null" } ),
	positionTitle: varchar("position_title", { length: 255 }).notNull(),
	itemNumber: varchar("item_number", { length: 100 }),
	stationDivision: varchar("station_division", { length: 255 }),
	dateOriginallySubmitted: timestamp("date_originally_submitted", { withTimezone: true, mode: 'string' }).defaultNow(),
	proposedQsEvalResult: varchar("proposed_qs_eval_result", { length: 100 }),
	cscApprovedQsEvalResult: varchar("csc_approved_qs_eval_result", { length: 100 }),
	evaluationStatus: varchar("evaluation_status", { length: 50 }).default('pending_reevaluation'),
	hasUpdatedCredentials: boolean("has_updated_credentials").default(false),
	updatedCredentialsSubmittedAt: timestamp("updated_credentials_submitted_at", { withTimezone: true, mode: 'string' }),
	documents: jsonb("documents").default([]),
	reevaluationTimestamp: timestamp("reevaluation_timestamp", { withTimezone: true, mode: 'string' }),
	dbmExportTimestamp: timestamp("dbm_export_timestamp", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxReclassAppNum: index("idx_reclass_app_num").on(table.applicationNumber),
		idxReclassEvalStatus: index("idx_reclass_eval_status").on(table.evaluationStatus),
		idxReclassApplicantId: index("idx_reclass_applicant_id").on(table.applicantId),
		reclassificationApplicationsApplicationNumberKey: unique("reclassification_applications_application_number_key").on(table.applicationNumber),
	}
});

export const adminConversationList = pgTable("admin_conversation_list", {
	id: uuid("id"),
	userId: text("user_id"),
	userName: text("user_name"),
	userRegion: text("user_region"),
	userDivision: text("user_division"),
	title: text("title"),
	status: conversationStatus("status"),
	assignedTo: supportDivision("assigned_to"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: 'string' }),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	latestMessage: text("latest_message"),
	latestMessageAuthorRole: actorRole("latest_message_author_role"),
	latestMessageCreatedAt: timestamp("latest_message_created_at", { withTimezone: true, mode: 'string' }),
});

export const users = pgTable("users", {
	id: text("id").primaryKey().notNull(),
	username: text("username").notNull(),
	email: text("email").notNull(),
	fullName: text("full_name").notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	region: text("region"),
	division: text("division"),
	contactNumber: text("contact_number"),
	office: text("office"),
	passwordHash: text("password_hash").notNull(),
	passcodeHash: text("passcode_hash"),
	role: text("role").default('hr_officer').notNull(),
	status: text("status").default('active').notNull(),
	failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
	lockedUntil: timestamp("locked_until", { mode: 'string' }),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	passwordChangedAt: timestamp("password_changed_at", { mode: 'string' }).defaultNow().notNull(),
	mustChangePassword: boolean("must_change_password").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		usersUsernameKey: unique("users_username_key").on(table.username),
	}
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	issuedBy: uuid("issued_by"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		idxPasswordResetTokensUserId: index("idx_password_reset_tokens_user_id").on(table.userId),
	}
});

export const admins = pgTable("admins", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	fullName: text("full_name").notNull(),
	email: text("email").notNull(),
	passwordHash: text("password_hash").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		adminsEmailKey: unique("admins_email_key").on(table.email),
	}
});

export const positions = pgTable("positions", {
	id: text("id").primaryKey().notNull(),
	title: text("title").notNull(),
	track: text("track"),
	requiredBachelorDegree: text("required_bachelor_degree"),
	requiredDegreeKeywords: text("required_degree_keywords").notNull(),
	yearsExperience: numeric("years_experience").default('0').notNull(),
	trainingHours: numeric("training_hours").default('0').notNull(),
	eligibilityRequired: text("eligibility_required"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	salaryGrade: integer("salary_grade"),
});

export const jobClusters = pgTable("job_clusters", {
	id: text("id").primaryKey().notNull(),
	positionId: text("position_id").notNull().references(() => positions.id, { onDelete: "cascade" } ),
	division: text("division"),
	region: text("region"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const carUploadBatches = pgTable("car_upload_batches", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	uploaderId: text("uploader_id").references(() => users.id, { onDelete: "set null" } ),
	division: varchar("division", { length: 255 }).notNull(),
	fileName: varchar("file_name", { length: 255 }),
	status: varchar("status", { length: 50 }).default('processing').notNull(),
	totalRows: integer("total_rows").default(0),
	validRows: integer("valid_rows").default(0),
	invalidRows: integer("invalid_rows").default(0),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const conversations = pgTable("conversations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	title: text("title").notNull(),
	status: conversationStatus("status").default('unread').notNull(),
	assignedTo: supportDivision("assigned_to"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		idxConversationsAdminSort: index("idx_conversations_admin_sort").on(table.assignedTo, table.lastMessageAt, table.status),
		idxConversationsUnassigned: index("idx_conversations_unassigned").on(table.lastMessageAt),
		idxConversationsUser: index("idx_conversations_user").on(table.userId),
		idxConversationsStatus: index("idx_conversations_status").on(table.status),
		idxConversationsAssignedTo: index("idx_conversations_assigned_to").on(table.assignedTo),
		idxConversationsLastMessageAt: index("idx_conversations_last_message_at").on(table.lastMessageAt),
	}
});

export const teacherItems = pgTable("teacher_items", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	itemCode: varchar("item_code", { length: 100 }).notNull(),
	schoolName: varchar("school_name", { length: 255 }),
	division: varchar("division", { length: 255 }).notNull(),
	positionTitle: varchar("position_title", { length: 100 }).default('Teacher I'),
	isFilled: boolean("is_filled").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxTeacherItemsDivision: index("idx_teacher_items_division").on(table.division),
		idxTeacherItemsIsFilled: index("idx_teacher_items_is_filled").on(table.isFilled),
		teacherItemsItemCodeKey: unique("teacher_items_item_code_key").on(table.itemCode),
	}
});

export const carResults = pgTable("car_results", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	batchId: uuid("batch_id").references(() => carUploadBatches.id, { onDelete: "cascade" } ),
	applicantCode: varchar("applicant_code", { length: 100 }).notNull(),
	applicantName: varchar("applicant_name", { length: 255 }).notNull(),
	itemReference: varchar("item_reference", { length: 100 }).notNull(),
	educationScore: numeric("education_score", { precision: 5, scale:  2 }),
	trainingScore: numeric("training_score", { precision: 5, scale:  2 }),
	experienceScore: numeric("experience_score", { precision: 5, scale:  2 }),
	pbetScore: numeric("pbet_score", { precision: 5, scale:  2 }),
	interviewScore: numeric("interview_score", { precision: 5, scale:  2 }),
	totalRating: numeric("total_rating", { precision: 5, scale:  2 }).notNull(),
	validationStatus: varchar("validation_status", { length: 20 }).default('valid').notNull(),
	validationErrors: jsonb("validation_errors").default([]),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxCarResultsBatchId: index("idx_car_results_batch_id").on(table.batchId),
	}
});

export const teacherAppointments = pgTable("teacher_appointments", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	batchId: uuid("batch_id").references(() => carUploadBatches.id, { onDelete: "set null" } ),
	carResultId: uuid("car_result_id").references(() => carResults.id, { onDelete: "set null" } ),
	applicantCode: varchar("applicant_code", { length: 100 }).notNull(),
	applicantName: varchar("applicant_name", { length: 255 }).notNull(),
	itemId: uuid("item_id").references(() => teacherItems.id, { onDelete: "cascade" } ),
	appointedBy: text("appointed_by").references(() => users.id, { onDelete: "set null" } ),
	appointedAt: timestamp("appointed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		idxTeacherAppointmentsItemId: index("idx_teacher_appointments_item_id").on(table.itemId),
		idxTeacherAppointmentsCode: index("idx_teacher_appointments_code").on(table.applicantCode),
		teacherAppointmentsItemIdKey: unique("teacher_appointments_item_id_key").on(table.itemId),
	}
});

export const applicants = pgTable("applicants", {
	id: serial("id").primaryKey().notNull(),
	passwordHash: varchar("password_hash", { length: 255 }),
	surname: varchar("surname", { length: 100 }).notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	middleName: varchar("middle_name", { length: 100 }),
	dateOfBirth: date("date_of_birth"),
	placeOfBirth: varchar("place_of_birth", { length: 255 }),
	sex: varchar("sex", { length: 20 }),
	civilStatus: varchar("civil_status", { length: 50 }),
	citizenship: varchar("citizenship", { length: 100 }).default('Filipino'),
	bloodType: varchar("blood_type", { length: 10 }),
	gsisIdNo: varchar("gsis_id_no", { length: 50 }),
	pagIbigIdNo: varchar("pag_ibig_id_no", { length: 50 }),
	philhealthNo: varchar("philhealth_no", { length: 50 }),
	sssNo: varchar("sss_no", { length: 50 }),
	residentialAddress: text("residential_address"),
	permanentAddress: text("permanent_address"),
	telephoneNo: varchar("telephone_no", { length: 50 }),
	mobileNo: varchar("mobile_no", { length: 50 }),
	emailAddress: varchar("email_address", { length: 150 }).notNull(),
	spouseSurname: varchar("spouse_surname", { length: 100 }),
	spouseFirstName: varchar("spouse_first_name", { length: 100 }),
	spouseOccupation: varchar("spouse_occupation", { length: 150 }),
	fatherSurname: varchar("father_surname", { length: 100 }),
	fatherFirstName: varchar("father_first_name", { length: 100 }),
	motherMaidenSurname: varchar("mother_maiden_surname", { length: 100 }),
	nameExtension: varchar("name_extension", { length: 50 }),
	height: varchar("height", { length: 20 }),
	weight: varchar("weight", { length: 20 }),
	agencyEmployeeNo: varchar("agency_employee_no", { length: 50 }),
	citizenshipType: varchar("citizenship_type", { length: 50 }),
	spouseMiddleName: varchar("spouse_middle_name", { length: 100 }),
	spouseNameExtension: varchar("spouse_name_extension", { length: 50 }),
	spouseEmployerBusiness: varchar("spouse_employer_business", { length: 150 }),
	spouseBusinessAddress: varchar("spouse_business_address", { length: 255 }),
	spouseTelephone: varchar("spouse_telephone", { length: 50 }),
	fatherMiddleName: varchar("father_middle_name", { length: 100 }),
	fatherNameExtension: varchar("father_name_extension", { length: 50 }),
	motherFirstName: varchar("mother_first_name", { length: 100 }),
	motherMiddleName: varchar("mother_middle_name", { length: 100 }),
	childrenDetails: jsonb("children_details").default([]),
	familyBackground: jsonb("family_background"),
	educationalBackground: jsonb("educational_background").default([]),
	civilServiceEligibility: jsonb("civil_service_eligibility").default([]),
	workExperience: jsonb("work_experience").default([]),
	voluntaryWork: jsonb("voluntary_work").default([]),
	learningAndDevelopment: jsonb("learning_and_development").default([]),
	otherInformation: jsonb("other_information").default({}),
	questionnaireResponses: jsonb("questionnaire_responses").default({}),
	code: varchar("code", { length: 255 }),
	localResident: boolean("local_resident").default(false),
	bachelorDegree: varchar("bachelor_degree", { length: 255 }),
	major: varchar("major", { length: 255 }),
	yearsExperience: doublePrecision("years_experience"),
	trainingHours: doublePrecision("training_hours"),
	eligibility: varchar("eligibility", { length: 255 }),
	applicantNumber: varchar("applicant_number", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	alternateEmail: varchar("alternate_email", { length: 255 }),
	religion: text("religion"),
	disability: text("disability"),
	ethnicGroup: text("ethnic_group"),
	age: integer("age").default(0),
	bachelorsDegree: text("bachelors_degree"),
	passcode: varchar("passcode", { length: 6 }),
	isTest: boolean("is_test").default(false),
},
(table) => {
	return {
		applicantsEmailAddressKey: unique("applicants_email_address_key").on(table.emailAddress),
	}
});

export const applications = pgTable("applications", {
	id: text("id").primaryKey().notNull(),
	applicationNumber: text("application_number").notNull(),
	jobClusterId: text("job_cluster_id").notNull().references(() => jobClusters.id, { onDelete: "cascade" } ),
	applicantId: integer("applicant_id").notNull().references(() => applicants.id, { onDelete: "cascade" } ),
	status: text("status").default('Application Submitted').notNull(),
	applicationStatus: text("application_status").default('Application Submitted').notNull(),
	dateApplied: timestamp("date_applied", { mode: 'string' }).notNull(),
	documents: text("documents").default('{}').notNull(),
	documentaryComplete: boolean("documentary_complete"),
	docChecklist: text("doc_checklist"),
	reason: text("reason"),
	assessmentStatus: text("assessment_status"),
	comparativeAssessmentScores: text("comparative_assessment_scores"),
	appointmentStatus: text("appointment_status"),
	appointmentDate: timestamp("appointment_date", { mode: 'string' }),
	appointmentItemNo: text("appointment_item_no"),
	appointmentReferenceCode: text("appointment_reference_code"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	letterOfIntent: text("letter_of_intent"),
	swornDocument: text("sworn_document"),
},
(table) => {
	return {
		applicationsApplicationNumberKey: unique("applications_application_number_key").on(table.applicationNumber),
		applicationsApplicantIdJobClusterIdKey: unique("applications_applicant_id_job_cluster_id_key").on(table.jobClusterId, table.applicantId),
	}
});

export const notifications = pgTable("notifications", {
	id: text("id").primaryKey().notNull(),
	userId: integer("user_id").notNull().references(() => applicants.id, { onDelete: "cascade" } ),
	title: text("title").notNull(),
	message: text("message").notNull(),
	at: timestamp("at", { mode: 'string' }).defaultNow().notNull(),
});

export const applicationHistory = pgTable("application_history", {
	id: text("id").primaryKey().notNull(),
	applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" } ),
	at: timestamp("at", { mode: 'string' }).defaultNow().notNull(),
	text: text("text").notNull(),
});

export const qualEvals = pgTable("qual_evals", {
	id: text("id").primaryKey().notNull(),
	applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" } ),
	result: text("result").notNull(),
	overallFit: doublePrecision("overall_fit"),
	degreeScore: doublePrecision("degree_score"),
	experienceScore: doublePrecision("experience_score"),
	trainingScore: doublePrecision("training_score"),
	eligibilityScore: doublePrecision("eligibility_score"),
	degreeDecision: text("degree_decision"),
	experienceDecision: text("experience_decision"),
	trainingDecision: text("training_decision"),
	eligibilityDecision: text("eligibility_decision"),
	documentaryComplete: boolean("documentary_complete"),
	remarks: text("remarks"),
	areaScores: text("area_scores"),
	at: timestamp("at", { mode: 'string' }).defaultNow().notNull(),
});

export const vacancies = pgTable("vacancies", {
	id: text("id").primaryKey().notNull(),
	positionId: text("position_id").notNull().references(() => positions.id, { onDelete: "cascade" } ),
	itemNo: text("item_no").notNull(),
	title: text("title").notNull(),
	school: text("school"),
	division: text("division"),
	region: text("region"),
	status: text("status").default('open').notNull(),
	fillingUpStatus: varchar("filling_up_status", { length: 50 }).default('UNFILLED').notNull(),
	jobClusterId: text("job_cluster_id").references(() => jobClusters.id, { onDelete: "set null" } ),
	schoolLevel: text("school_level"),
	schoolId: integer("school_id"),
	postingStart: timestamp("posting_start", { mode: 'string' }),
	postingEnd: timestamp("posting_end", { mode: 'string' }),
	salaryGrade: integer("salary_grade"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isTest: boolean("is_test").default(false),
	docFetchPreference: text("doc_fetch_preference").default('RETAIN_OLD'),
	hasFetchedDocs: boolean("has_fetched_docs").default(false),
	docFetchedAt: timestamp("doc_fetched_at", { withTimezone: true, mode: 'string' }),
	allowedEmails: jsonb("allowed_emails").default([]),
},
(table) => {
	return {
		vacanciesItemNoKey: unique("vacancies_item_no_key").on(table.itemNo),
	}
});

export const incumbentGuidanceCounselors = pgTable("incumbent_guidance_counselors", {
	id: serial("id").primaryKey().notNull(),
	employeeId: text("employee_id").notNull(),
	fullName: varchar("full_name", { length: 255 }).notNull(),
	currentPosition: varchar("current_position", { length: 255 }).notNull(),
	stationDivision: varchar("station_division", { length: 255 }).notNull(),
	stageOfReclassification: varchar("stage_of_reclassification", { length: 100 }).default('For Review').notNull(),
	reclassPosition: varchar("reclass_position", { length: 100 }),
	region: varchar("region", { length: 255 }),
	division: varchar("division", { length: 255 }),
	uacsOperDsc: text("uacs_oper_dsc"),
	orgCd: varchar("org_cd", { length: 100 }),
	plantillaItemNumber: varchar("plantilla_item_number", { length: 150 }),
	salaryGrade: varchar("salary_grade", { length: 50 }),
	remarks: text("remarks"),
	documentChecklist: jsonb("document_checklist").default([]),
	qsEvaluation: jsonb("qs_evaluation").default({}),
	qsEvalResult: varchar("qs_eval_result", { length: 50 }).default('PENDING'),
	evaluatedBy: varchar("evaluated_by", { length: 255 }),
	evaluatedAt: timestamp("evaluated_at", { withTimezone: true, mode: 'string' }),
	evaluatorRemarks: text("evaluator_remarks"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		incumbentCounselorsEmployeeIdKey: unique("incumbent_guidance_counselors_employee_id_key").on(table.employeeId),
	}
});

export const reclassificationNoscaItems = pgTable("reclassification_nosca_items", {
	id: serial("id").primaryKey().notNull(),
	serialNo: varchar("serial_no", { length: 100 }),
	plantillaItemNumber: varchar("plantilla_item_number", { length: 150 }).notNull(),
	category: varchar("category", { length: 50 }).default('ELEMENTARY'),
	positionTitle: varchar("position_title", { length: 255 }).default('School Counselor Associate I'),
	division: varchar("division", { length: 255 }),
	schoolId: varchar("school_id", { length: 50 }),
	schoolName: varchar("school_name", { length: 255 }),
	assignmentStatus: varchar("assignment_status", { length: 50 }).default('AVAILABLE'),
	assignedToIncumbentId: integer("assigned_to_incumbent_id").references(() => incumbentGuidanceCounselors.id, { onDelete: "set null" }),
	assignedToEmployeeId: text("assigned_to_employee_id"),
	assignedAt: timestamp("assigned_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		noscaItemNoIdx: index("idx_nosca_items_item_no").on(table.plantillaItemNumber),
		noscaSerialIdx: index("idx_nosca_items_serial").on(table.serialNo),
		noscaStatusIdx: index("idx_nosca_items_status").on(table.assignmentStatus),
		noscaAssignedIdx: index("idx_nosca_items_assigned").on(table.assignedToIncumbentId),
	}
});