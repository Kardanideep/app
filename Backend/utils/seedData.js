const db = require('../config/db');

async function seedStudentData(studentId, currentSem = 4) {
    try {
        const [existingSemesters] = await db.execute('SELECT id FROM semesters WHERE student_id = ?', [studentId]);
        if (existingSemesters.length > 0) return;

        // Ensure currentSem is a number and at least 1
        const targetSem = parseInt(currentSem) || Math.floor(Math.random() * 4) + 1;

        const subjectPool = [
            'Advanced Mathematics', 'Quantum Physics', 'Data Structures', 'Algorithms', 'Computer Networks',
            'Operating Systems', 'Software Engineering', 'Database Management', 'Artificial Intelligence',
            'Machine Learning', 'Cloud Computing', 'Cyber Security', 'Web Technologies', 'Mobile App Development',
            'Theory of Computation', 'Compiler Design', 'Microprocessors', 'Digital Electronics', 'Discrete Mathematics',
            'Information Security', 'Big Data Analytics', 'Internet of Things', 'Graphics and Multimedia',
            'Human Computer Interaction', 'Distributed Systems', 'Blockchain Technology', 'Software Testing'
        ];

        const facultyNames = ['Dr. Alice', 'Prof. Bob', 'Dr. Charlie', 'Ms. Diana', 'Mr. Edward', 'Dr. Fiona', 'Prof. George'];

        for (let s = 1; s <= targetSem; s++) {
            const status = s === targetSem ? 'ongoing' : 'completed';
            const title = `Semester ${s}`;

            const [semResult] = await db.execute(
                'INSERT INTO semesters (student_id, title, status, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
                [studentId, title, status, '2023-01-01', '2023-06-30']
            );
            const semesterId = semResult.insertId;

            // Pick 6 UNIQUE subjects for this semester
            const selectedSubjects = [...subjectPool].sort(() => 0.5 - Math.random()).slice(0, 6);

            for (let i = 0; i < selectedSubjects.length; i++) {
                const subName = selectedSubjects[i];
                const subCode = `${subName.substring(0, 3).toUpperCase()}_S${s}_${Math.floor(Math.random() * 1000)}_${studentId}`;
                const faculty = facultyNames[Math.floor(Math.random() * facultyNames.length)];

                const [subResult] = await db.execute(
                    'INSERT INTO subjects (name, code, semester_id, faculty_name) VALUES (?, ?, ?, ?)',
                    [subName, subCode, semesterId, faculty]
                );
                const subjectId = subResult.insertId;

                if (status === 'completed') {
                    const marks = Math.floor(Math.random() * 50) + 50;
                    const grade = marks >= 90 ? 'O' : marks >= 80 ? 'A+' : marks >= 70 ? 'A' : marks >= 60 ? 'B+' : 'B';
                    await db.execute(
                        'INSERT INTO results (student_id, subject_id, semester_id, marks, total_marks, grade) VALUES (?, ?, ?, ?, ?, ?)',
                        [studentId, subjectId, semesterId, marks, 100, grade]
                    );
                }

                // Random Attendance (15-25 entries per subject)
                const attendanceCount = Math.floor(Math.random() * 10) + 15;
                for (let d = 1; d <= attendanceCount; d++) {
                    const date = new Date();
                    date.setDate(date.getDate() - (d + Math.floor(Math.random() * 30)));
                    const attendanceStatus = Math.random() > 0.15 ? 'present' : 'absent';
                    await db.execute(
                        'INSERT INTO attendance (student_id, subject_id, date, status) VALUES (?, ?, ?, ?)',
                        [studentId, subjectId, date.toISOString().split('T')[0], attendanceStatus]
                    );
                }

                if (status === 'ongoing') {
                    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const day = days[Math.floor(Math.random() * days.length)];
                    const startHour = 8 + Math.floor(Math.random() * 6);
                    const startTime = `${startHour}:00:00`;
                    const endTime = `${startHour + 1}:00:00`;
                    await db.execute(
                        'INSERT INTO timetable (day, subject_id, start_time, end_time, room, faculty_name) VALUES (?, ?, ?, ?, ?, ?)',
                        [day, subjectId, startTime, endTime, `Lab ${Math.floor(Math.random() * 500)}`, faculty]
                    );

                    // Seed Exams for ongoing subjects
                    const examDate = new Date();
                    examDate.setDate(examDate.getDate() + 30 + (i * 2));
                    await db.execute(
                        'INSERT INTO exam_schedule (student_id, subject_id, exam_date, exam_time, room, type) VALUES (?, ?, ?, ?, ?, ?)',
                        [studentId, subjectId, examDate.toISOString().split('T')[0], '10:00 AM', `Hall ${String.fromCharCode(65 + i)}`, i % 2 === 0 ? 'Theory' : 'Practical']
                    );
                }
            }
        }

        // Seed initial fees for the student
        const feeTypes = [
            { title: 'Admission Fee', amount: 50000, type: 'Academic', status: 'paid', date: '2025-12-01' },
            { title: 'Semester Tuition', amount: 85000, type: 'Academic', status: 'pending', date: '2026-06-15' },
            { title: 'Library Fee', amount: 2000, type: 'Utility', status: 'paid', date: '2026-01-15' }
        ];

        for (const fee of feeTypes) {
            await db.execute(
                'INSERT INTO fees (student_id, title, amount, due_date, status, type) VALUES (?, ?, ?, ?, ?, ?)',
                [studentId, fee.title, fee.amount, fee.date, fee.status, fee.type]
            );
        }
    } catch (error) {
        console.error('Error seeding data:', error);
    }
}

module.exports = { seedStudentData };
