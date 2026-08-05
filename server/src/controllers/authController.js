const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
exports.register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const exists = await User.findOne({ email });
        if (exists) { res.status(400); throw new Error('An account with this email already exists'); }
        const user = await User.create({ name, email, password });
        res.status(201).json({
            token: signToken(user._id),
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) { next(err); }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) { res.status(400); throw new Error('Email and password are required'); }
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) {
            res.status(401); throw new Error('Invalid email or password');
        }
        res.json({
            token: signToken(user._id),
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) { next(err); }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
    res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email } });
};
