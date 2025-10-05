const express = require('express');
const { userAuth } = require('../middlewares/Auth');
const { ValidateEditProfileData } = require('../utils/validation');

const UserLeadActivity = require('../models/UserLeadActivity');
const Lead = require('../models/leads');
const SharedLead = require('../models/SharedLead');



const profileRouter  = express.Router();

profileRouter.get('/profile/view',userAuth, async (req, res) => {



    try {

        const user = req.user

        if(!user) throw new Error('No User Found')

        res.send(user)

    }

    catch (err) {

        res.status(400).send('Error ' + err.message )

    }



})


profileRouter.patch('/profile/edit', userAuth, async (req, res) => {

    try {

        if (!ValidateEditProfileData(req)) {

            throw new Error('Invalid edit request');

        }

        const LoggedInUser = req.user;

        Object.keys(req.body).forEach((key) => (LoggedInUser[key] = req.body[key]));

        await LoggedInUser.save();

        res.send(`${LoggedInUser.firstName} your data has been updated successfully`);

    } catch (err) {

        res.status(400).send('Error ' + err.message);

    }

});

profileRouter.get('/profile/stats', userAuth, async (req, res) => {
    try {
        const userId = req.user._id;

        // Count different types of activities
        const totalTracked = await UserLeadActivity.countDocuments({ user: userId });
        const totalResponses = await UserLeadActivity.countDocuments({ 
            user: userId, 
            status: { $in: ['responded', 'Engaged', 'revived'] } 
        });
        const totalFollowUps = await UserLeadActivity.countDocuments({ user: userId, status: 'follow-up' });
        
        // Count leads created and shared by the user
        const leadsCreated = await Lead.countDocuments({ user: userId });
        const leadsShared = await SharedLead.countDocuments({ sharedBy: userId });

        // Calculate response rate, avoiding division by zero
        const responseRate = totalTracked > 0 ? (totalResponses / totalTracked) * 100 : 0;

        res.json({
            totalTracked,
            responseRate: responseRate.toFixed(1), // Format to one decimal place
            totalFollowUps,
            leadsCreated,
            leadsShared
        });

    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch user stats: ' + error.message });
    }
});


module.exports = profileRouter