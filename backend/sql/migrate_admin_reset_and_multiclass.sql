-- Latest migration for multi-class + admin-managed lecturer resets
-- Run against your active DB, e.g. school_attendance

USE school_attendance;

-- teachers table (role + audit)
CREATE TABLE IF NOT EXISTS teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(120) NOT NULL UNIQUE,
  full_name VARCHAR(160) NULL,
  password_hash CHAR(128) NOT NULL,
  password_salt CHAR(32) NOT NULL,
  role ENUM('admin', 'lecturer') NOT NULL DEFAULT 'lecturer',
  created_by_admin_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS role ENUM('admin', 'lecturer') NOT NULL DEFAULT 'lecturer',
  ADD COLUMN IF NOT EXISTS created_by_admin_id INT NULL;

SET @fk_teachers_admin_exists := (
  SELECT COUNT(*)
  FROM information_schema.key_column_usage
  WHERE table_schema = DATABASE()
    AND table_name = 'teachers'
    AND column_name = 'created_by_admin_id'
    AND referenced_table_name = 'teachers'
);
SET @sql_add_fk_teachers_admin := IF(@fk_teachers_admin_exists = 0,
  'ALTER TABLE teachers ADD CONSTRAINT fk_teachers_created_by_admin FOREIGN KEY (created_by_admin_id) REFERENCES teachers(id) ON DELETE SET NULL',
  'SELECT "fk_teachers_created_by_admin exists"');
PREPARE stmt_fk_teachers_admin FROM @sql_add_fk_teachers_admin;
EXECUTE stmt_fk_teachers_admin;
DEALLOCATE PREPARE stmt_fk_teachers_admin;

-- classes table
CREATE TABLE IF NOT EXISTS classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_name VARCHAR(120) NOT NULL,
  class_code VARCHAR(32) NOT NULL UNIQUE,
  teacher_username VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- students table updates
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  registration_number VARCHAR(64) NULL,
  class_id INT NULL,
  coursework_1_score DECIMAL(5,2) NULL,
  coursework_2_score DECIMAL(5,2) NULL,
  coursework_3_score DECIMAL(5,2) NULL,
  final_exam_score DECIMAL(5,2) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS class_id INT NULL,
  ADD COLUMN IF NOT EXISTS coursework_1_score DECIMAL(5,2) NULL,
  ADD COLUMN IF NOT EXISTS coursework_2_score DECIMAL(5,2) NULL,
  ADD COLUMN IF NOT EXISTS coursework_3_score DECIMAL(5,2) NULL,
  ADD COLUMN IF NOT EXISTS final_exam_score DECIMAL(5,2) NULL;

-- drop legacy global registration uniqueness if present
SET @idx_old_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'students'
    AND index_name = 'uniq_registration_number'
);
SET @sql_drop_old_idx := IF(@idx_old_exists > 0,
  'ALTER TABLE students DROP INDEX uniq_registration_number',
  'SELECT "uniq_registration_number not present"');
PREPARE stmt_drop_old_idx FROM @sql_drop_old_idx;
EXECUTE stmt_drop_old_idx;
DEALLOCATE PREPARE stmt_drop_old_idx;

SET @idx_class_reg_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'students'
    AND index_name = 'uniq_class_registration'
);
SET @sql_add_class_reg_idx := IF(@idx_class_reg_exists = 0,
  'ALTER TABLE students ADD UNIQUE KEY uniq_class_registration (class_id, registration_number)',
  'SELECT "uniq_class_registration exists"');
PREPARE stmt_add_class_reg_idx FROM @sql_add_class_reg_idx;
EXECUTE stmt_add_class_reg_idx;
DEALLOCATE PREPARE stmt_add_class_reg_idx;

SET @fk_students_class_exists := (
  SELECT COUNT(*)
  FROM information_schema.key_column_usage
  WHERE table_schema = DATABASE()
    AND table_name = 'students'
    AND column_name = 'class_id'
    AND referenced_table_name = 'classes'
);
SET @sql_add_fk_students_class := IF(@fk_students_class_exists = 0,
  'ALTER TABLE students ADD CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE',
  'SELECT "fk_students_class exists"');
PREPARE stmt_add_fk_students_class FROM @sql_add_fk_students_class;
EXECUTE stmt_add_fk_students_class;
DEALLOCATE PREPARE stmt_add_fk_students_class;

-- attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  status ENUM('present', 'late', 'absent') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_student_date (student_id, attendance_date),
  CONSTRAINT fk_attendance_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE CASCADE
);

-- admin-generated password reset keys (one-time)
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_by_admin_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_teacher_resets (teacher_id),
  INDEX idx_token_hash (token_hash),
  CONSTRAINT fk_password_resets_teacher
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  CONSTRAINT fk_password_resets_admin
    FOREIGN KEY (created_by_admin_id) REFERENCES teachers(id) ON DELETE CASCADE
);
