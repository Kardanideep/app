const db = require('../config/db');
const path = require('path');

// Helper function to get student profile ID from user ID
const getStudentId = async (userId) => {
    const [profiles] = await db.execute('SELECT id FROM student_profiles WHERE user_id = ?', [userId]);
    return profiles.length > 0 ? profiles[0].id : null;
};

exports.getProfile = async (req, res) => {
    try {
        const [profiles] = await db.execute('SELECT * FROM student_profiles WHERE user_id = ?', [req.user.id]);
        if (profiles.length === 0) return res.status(404).json({ message: 'Profile not found' });
        res.json(profiles[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getSemesters = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        if (!studentId) return res.status(404).json({ message: 'Student profile not found' });

        const [semesters] = await db.execute('SELECT * FROM semesters WHERE student_id = ? ORDER BY title ASC', [studentId]);
        res.json(semesters);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getSubjects = async (req, res) => {
    try {
        const { semesterId } = req.params;
        const [subjects] = await db.execute('SELECT * FROM subjects WHERE semester_id = ?', [semesterId]);
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getResults = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        const { semesterId } = req.params;

        const [results] = await db.execute(`
            SELECT r.*, s.name as subject_name, s.code as subject_code 
            FROM results r 
            JOIN subjects s ON r.subject_id = s.id 
            WHERE r.student_id = ? AND r.semester_id = ?
        `, [studentId, semesterId]);
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getAttendance = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        
        // Get attendance summary per subject
        const [summary] = await db.execute(`
            SELECT s.name as subject_name, 
                   COUNT(a.id) as total_classes,
                   SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count
            FROM subjects s
            LEFT JOIN attendance a ON s.id = a.subject_id AND a.student_id = ?
            JOIN semesters sem ON s.semester_id = sem.id
            WHERE sem.student_id = ?
            GROUP BY s.id
        `, [studentId, studentId]);

        res.json(summary);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getTimetable = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);

        const [timetable] = await db.execute(`
            SELECT t.*, s.name as subject_name, s.code as subject_code, sem.title as semester_title
            FROM timetable t
            JOIN subjects s ON t.subject_id = s.id
            JOIN semesters sem ON s.semester_id = sem.id
            WHERE sem.student_id = ? AND sem.status = 'ongoing'
            ORDER BY FIELD(t.day, 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'), t.start_time
        `, [studentId]);

        res.json(timetable);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { full_name, course, semester_current, phone } = req.body;
        
        await db.execute(`
            UPDATE student_profiles 
            SET full_name = ?, course = ?, semester_current = ?, phone = ?
            WHERE user_id = ?
        `, [full_name, course, semester_current, phone, req.user.id]);

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a file' });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        
        await db.execute(
            'UPDATE student_profiles SET avatar_url = ? WHERE user_id = ?',
            [avatarUrl, req.user.id]
        );

        res.json({ 
            message: 'Avatar uploaded successfully',
            avatarUrl: avatarUrl 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.applyLeave = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        const { from_date, to_date, reason } = req.body;

        await db.execute(`
            INSERT INTO leave_applications (student_id, from_date, to_date, reason, status)
            VALUES (?, ?, ?, ?, ?)
        `, [studentId, from_date, to_date, reason, 'pending']);

        res.status(201).json({ message: 'Leave application submitted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.updateLeave = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        const { id } = req.params;
        const { from_date, to_date, reason } = req.body;

        // Check if application exists and belongs to student
        const [applications] = await db.execute(
            'SELECT * FROM leave_applications WHERE id = ? AND student_id = ?',
            [id, studentId]
        );

        if (applications.length === 0) {
            return res.status(404).json({ message: 'Leave application not found' });
        }

        const application = applications[0];
        // Only allow update if status is 'pending'
        if (application.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending applications can be updated' });
        }

        await db.execute(`
            UPDATE leave_applications 
            SET from_date = ?, to_date = ?, reason = ?
            WHERE id = ? AND student_id = ?
        `, [from_date, to_date, reason, id, studentId]);

        res.json({ message: 'Leave application updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getLeaveApplications = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        const [applications] = await db.execute('SELECT * FROM leave_applications WHERE student_id = ? ORDER BY created_at DESC', [studentId]);
        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getExams = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        const [exams] = await db.execute(`
            SELECT e.*, s.name as subject_name, s.code as subject_code 
            FROM exam_schedule e
            JOIN subjects s ON e.subject_id = s.id
            WHERE e.student_id = ?
            ORDER BY e.exam_date ASC
        `, [studentId]);
        res.json(exams);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.getFees = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        const [fees] = await db.execute('SELECT * FROM fees WHERE student_id = ? ORDER BY due_date DESC', [studentId]);
        res.json(fees);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.payFees = async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        
        // In a real app, you'd process payment here via Stripe/Razorpay
        // For this demo, we'll just mark all pending fees as 'paid'
        
        const [result] = await db.execute(
            "UPDATE fees SET status = 'paid' WHERE student_id = ? AND status = 'pending'",
            [studentId]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ message: 'No pending fees found to pay' });
        }

        res.json({ message: 'All pending fees paid successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
