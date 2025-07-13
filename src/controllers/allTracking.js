const UserLeadActivity = require('../models/UserLeadActivity');

const   allTracking = async(req,res)=>{
    try{
        const tracking= await UserLeadActivity.find({user:req.user._id})
        .sort({createdAt:-1});  
        res.json(tracking);
    }catch(err){
        res.status(500).json({
            error:'failed to track email'
        })
    }


}

module.exports = allTracking;