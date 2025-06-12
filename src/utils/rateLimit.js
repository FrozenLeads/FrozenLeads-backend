const rateLimit = require('express-rate-limit');

// Define the rate limit for account creation
const accountCreationLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 1 day
    max: 2, // Allow a maximum of 2 account creations per IP per day
    message: "Too many accounts created from this IP address, please try again later",
});

// Define the rate limit for lead fetching (user or IP-based)
const leadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each user/IP combination to 100 requests per windowMs
    keyGenerator: (req) => {
        // First, try to use user ID if user is authenticated
        if (req.user && req.user._id) {
            return req.user._id; // User-based rate limiting
        }
        // If no user is authenticated, use IP-based rate limiting
        return req.ip; // IP-based rate limiting
    },
    message: "Too many requests, please try again later",
});

module.exports = { accountCreationLimiter, leadLimiter };
