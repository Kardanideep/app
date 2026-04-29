const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { seedStudentData } = require('../utils/seedData');

exports.register = async (req, res) => {
    const { email, password, role, full_name, roll_number, course, semester_current, phone } = req.body;

    try {
        // Check if user already exists
        const [existingUser] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert into users table
        const [userResult] = await db.execute(
            'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
            [email, hashedPassword, role || 'student']
        );

        const userId = userResult.insertId;

        // If student, insert into student_profiles
        if (role === 'student' || !role) {
            const [profileResult] = await db.execute(
                'INSERT INTO student_profiles (user_id, roll_number, full_name, course, semester_current, phone) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, roll_number, full_name, course, semester_current, phone]
            );
            
            const studentProfileId = profileResult.insertId;
            // Seed initial data based on current semester
            await seedStudentData(studentProfileId, semester_current);
        }

        res.status(201).json({ message: 'User registered successfully', userId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    // console.log(email, password);

    try {
        // Find user
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        // console.log(users);

        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = users[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Fetch student profile if user is a student
        let profile = null;
        if (user.role === 'student') {
            const [profiles] = await db.execute('SELECT * FROM student_profiles WHERE user_id = ?', [user.id]);
            profile = profiles[0];
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                profile
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        // 1. Get user
        const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        // 2. Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // 3. Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Update password
        await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, req.user.id]);

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
