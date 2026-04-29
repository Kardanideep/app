const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Configure Multer for Avatar Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/avatars');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed (jpeg, jpg, png)'));
    }
});

// All student routes are protected
router.use(auth);

router.get('/profile', studentController.getProfile);
router.get('/semesters', studentController.getSemesters);
router.get('/subjects/:semesterId', studentController.getSubjects);
router.get('/results/:semesterId', studentController.getResults);
router.get('/attendance', studentController.getAttendance);
router.get('/timetable', studentController.getTimetable);
router.put('/profile', studentController.updateProfile);
router.post('/avatar-upload', upload.single('avatar'), studentController.uploadAvatar);
router.post('/leave', studentController.applyLeave);
router.put('/leave/:id', studentController.updateLeave);
router.get('/leaves', studentController.getLeaveApplications);
router.get('/exams', studentController.getExams);
router.get('/fees', studentController.getFees);
router.post('/pay-fees', studentController.payFees);

module.exports = router;
