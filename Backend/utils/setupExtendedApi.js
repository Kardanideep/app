const db = require('../config/db');

async function setup() {
    try {
        console.log('Creating new tables...');
        
        await db.execute(`
            CREATE TABLE IF NOT EXISTS exam_schedule (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT,
                subject_id INT,
                exam_date DATE,
                exam_time VARCHAR(20),
                room VARCHAR(50),
                type VARCHAR(20),
                FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS fees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT,
                title VARCHAR(100),
                amount DECIMAL(10, 2),
                due_date DATE,
                status ENUM('paid', 'pending') DEFAULT 'pending',
                type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES student_profiles(id) ON DELETE CASCADE
            )
        `);

        console.log('Tables created successfully.');

        // Seed data for existing students
        const [students] = await db.execute('SELECT id FROM student_profiles');
        
        for (const student of students) {
            const studentId = student.id;

            // Seed Exams for ongoing semester subjects
            const [subjects] = await db.execute(`
                SELECT s.id, s.name 
                FROM subjects s
                JOIN semesters sem ON s.semester_id = sem.id
                WHERE sem.student_id = ? AND sem.status = 'ongoing'
            `, [studentId]);

            for (let i = 0; i < Math.min(subjects.length, 4); i++) {
                const sub = subjects[i];
                const examDate = new Date();
                examDate.setDate(examDate.getDate() + 15 + (i * 3));
                
                await db.execute(`
                    INSERT INTO exam_schedule (student_id, subject_id, exam_date, exam_time, room, type)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [studentId, sub.id, examDate.toISOString().split('T')[0], '10:00 AM', `Hall ${String.fromCharCode(65 + i)}`, i % 2 === 0 ? 'Theory' : 'Practical']);
            }

            // Seed Fees
            const feeTypes = [
                { title: 'Semester 4 Tuition', amount: 85000, type: 'Academic', status: 'paid', date: '2026-03-10' },
                { title: 'Library Membership', amount: 2500, type: 'Utility', status: 'paid', date: '2026-03-12' },
                { title: 'Exam Registration', amount: 5000, type: 'Exam', status: 'pending', date: '2026-05-05' },
                { title: 'Lab Materials Fee', amount: 3500, type: 'Lab', status: 'pending', date: '2026-05-10' }
            ];

            for (const fee of feeTypes) {
                await db.execute(`
                    INSERT INTO fees (student_id, title, amount, due_date, status, type)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [studentId, fee.title, fee.amount, fee.date, fee.status, fee.type]);
            }
        }

        console.log('Data seeded successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error during setup:', error);
        process.exit(1);
    }
}

setup();
