const express = require('express');



const { userAuth } = require('../middlewares/Auth');
const { ValidateEditProfileData } = require('../utils/validation');
const profileRouter  = express.Router();




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





module.exports = profileRouter