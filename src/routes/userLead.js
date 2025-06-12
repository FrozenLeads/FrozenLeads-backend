const { userAuth } = require('../middlewares/Auth');
const { ValidateLeadsData } = require('../utils/validation');
const express =  require('express')
const userLeadRouter  = express.Router();
const Lead =  require('../models/leads');

const SafeData = 'leadName LeadEmailId phone source notes -_id'

userLeadRouter.get('/user/lead/data',userAuth, async (req,res)=>{
    try{
        const userId = req.user?._id;
        if(!userId)  return res.status(401).json({messsage:'Unauthorized: No user Found'});
        const UserLead =  await Lead.find({user:userId})
        .select(SafeData)
        .sort({createdAt:-1})
        .lean();

        res.status(200).json({
            data:UserLead
        })
    }catch(error){
        res.status(500).send(error.message)
    }
})

module.exports  =  userLeadRouter;