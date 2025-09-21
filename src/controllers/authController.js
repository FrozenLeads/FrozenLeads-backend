// src/controllers/authController.js

const User = require('../models/user');
const { validateSignupData } = require('../utils/validation');

exports.signup = async (req, res) => {
    try {
        validateSignupData(req);
        const { emailId } = req.body;
        const existingUser = await User.findOne({ emailId });
        if (existingUser) {
            return res.status(400).send(`Signup failed: ${emailId} is already registered`);
        }
        const user = new User(req.body);
        await user.save();
        res.status(201).send('User created successfully');
    } catch (err) {
        res.status(400).send(`Signup failed: ${err.message}`);
    }
};

exports.login = async (req, res) => {
    try {
        const { emailId, password } = req.body;
        if (!emailId || !password) {
            return res.status(400).send('Email and password are required');
        }
        const user = await User.findOne({ emailId });
        if (!user) {
            return res.status(400).send('User does not exist');
        }
        const isPasswordValid = await user.validatePassword(password);
        if (!isPasswordValid) {
            return res.status(400).send('Password is not correct');
        }
        const token = await user.getJwt();
        const { password: _, ...safeUser } = user.toObject();
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        res.status(200).json({ token, user: safeUser });
    } catch (error) {
        res.status(500).send(`Login Failed: ${error.message}`);
    }
};

exports.logout = (req, res) => {
    res.cookie('token', null, { expires: new Date(Date.now()) }).send('Logged out');
};

exports.getMe = (req, res) => {
    const { password, ...safeUser } = req.user.toObject();
    res.json(safeUser);
};

exports.updatePassword = async (req, res) => {
    try {
        if (!req.body.password) {
            throw new Error('New password is required');
        }
        req.user.password = req.body.password;
        await req.user.save();
        const { password, ...safeUser } = req.user.toObject();
        res.json({ message: 'Password updated successfully', data: safeUser });
    } catch (err) {
        res.status(400).send(`Error: ${err.message}`);
    }
};

exports.viewProfile = (req, res) => {
    const { password, ...safeUser } = req.user.toObject();
    res.send(safeUser);
};

exports.editProfile = async (req, res) => {
    try {
        Object.keys(req.body).forEach((key) => {
            req.user[key] = req.body[key];
        });
        await req.user.save();
        res.send(`${req.user.firstName}, your data has been updated successfully`);
    } catch (err) {
        res.status(400).send(`Error: ${err.message}`);
    }
};  