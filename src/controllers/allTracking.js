const UserLeadActivity = require('../models/UserLeadActivity');

const allTracking = async (req, res) => {
    try {
        const { search } = req.query; // Get search term from query params
        
        const findQuery = { user: req.user._id };

        // If a search term is provided, build a hybrid search query
        if (search) {
            const regex = new RegExp(search, 'i'); // 'i' for case-insensitive
            findQuery.$or = [
                { name: { $regex: regex } }, // Search the custom 'name' field
                { to: { $regex: regex } }    // Search the recipient 'to' field
            ];
        }

        const tracking = await UserLeadActivity.find(findQuery)
            .sort({ createdAt: -1 });
            
        res.json(tracking);
    } catch (err) {
        console.error("Error in allTracking controller:", err); 
        res.status(500).json({
            error: 'failed to get tracking data'
        });
    }
}

module.exports = allTracking;