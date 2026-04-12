-- ETH Databases Course — Standard Schema (FR-19)
-- This schema is injected into the sandbox before executing student SQL queries.
-- Modelled after a typical ETH "Datenbanken" course relational schema.

CREATE TABLE Students (
    student_id   INTEGER PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(150) UNIQUE NOT NULL,
    major        VARCHAR(50),
    enroll_year  INTEGER
);

CREATE TABLE Courses (
    course_id    VARCHAR(20) PRIMARY KEY,
    title        VARCHAR(200) NOT NULL,
    credits      INTEGER NOT NULL,
    department   VARCHAR(50)
);

CREATE TABLE Professors (
    professor_id INTEGER PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    department   VARCHAR(50)
);

CREATE TABLE Teaches (
    professor_id INTEGER REFERENCES Professors(professor_id),
    course_id    VARCHAR(20) REFERENCES Courses(course_id),
    semester     VARCHAR(20),
    PRIMARY KEY (professor_id, course_id, semester)
);

CREATE TABLE Enrollments (
    student_id   INTEGER REFERENCES Students(student_id),
    course_id    VARCHAR(20) REFERENCES Courses(course_id),
    semester     VARCHAR(20),
    grade        DECIMAL(3,1),
    PRIMARY KEY (student_id, course_id, semester)
);

CREATE TABLE Prerequisites (
    course_id    VARCHAR(20) REFERENCES Courses(course_id),
    prereq_id    VARCHAR(20) REFERENCES Courses(course_id),
    PRIMARY KEY (course_id, prereq_id)
);

-- Sample data
INSERT INTO Students VALUES
    (1, 'Alice Müller', 'alice@student.ethz.ch', 'Computer Science', 2022),
    (2, 'Bob Sutter',   'bob@student.ethz.ch',   'Computer Science', 2021),
    (3, 'Clara Fischer','clara@student.ethz.ch',  'Mathematics',      2023);

INSERT INTO Courses VALUES
    ('252-0063-00L', 'Datenbanken', 4, 'Computer Science'),
    ('252-0026-00L', 'Algorithmen und Datenstrukturen', 7, 'Computer Science'),
    ('401-0131-00L', 'Lineare Algebra', 7, 'Mathematics');

INSERT INTO Professors VALUES
    (1, 'Prof. Dr. Moira Norbert',  'Computer Science'),
    (2, 'Prof. Dr. Stefan Haller',  'Computer Science'),
    (3, 'Prof. Dr. Anna Klein',     'Mathematics');

INSERT INTO Teaches VALUES
    (1, '252-0063-00L', 'FS2025'),
    (2, '252-0026-00L', 'FS2025'),
    (3, '401-0131-00L', 'FS2025');

INSERT INTO Enrollments VALUES
    (1, '252-0063-00L', 'FS2025', 5.5),
    (1, '252-0026-00L', 'FS2025', 6.0),
    (2, '252-0063-00L', 'FS2025', 4.5),
    (3, '401-0131-00L', 'FS2025', 5.0);

INSERT INTO Prerequisites VALUES
    ('252-0063-00L', '252-0026-00L');
