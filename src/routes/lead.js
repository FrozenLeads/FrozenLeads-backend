const { userAuth } = require('../middlewares/Auth');
const { ValidateLeadsData } = require('../utils/validation');
const express =  require('express')
const leadRouter  = express.Router();
const Lead =  require('../models/leads')
const {leadLimiter} =  require('../utils/rateLimit')



leadRouter.post('/lead/data/',userAuth,leadLimiter , express.json({ limit: '2mb' }),async (req,res)=>{
    try {
        const { 
            leadName,
            LeadEmailId,
            phone,
            source,
            notes,
        } = req.body

        ValidateLeadsData(req);

        const existingLead = await Lead.findOne({LeadEmailId})

        if(existingLead){
            return res.status(409).json({
                message:'This is email is already present'
            })
        };
        
        const LeadData =  new Lead({
            leadName,
            LeadEmailId,
            phone,
            source,
            notes,
            user:req.user._id,
        })
        data = await LeadData.save();
        res.json({
            message:`Data of ${LeadData.leadName} has been added successfully`,
            data:data
        })



    } catch (error) {
        res.status(404).send(error.message)
    }
})


leadRouter.get('/lead/data/all',userAuth,async (req,res)=>{
    try {

        const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
        const limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 10;
        const skip = (page - 1) * limit;




        const LeadData =  await Lead.find()
        .populate('user', 'firstName -_id')
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .lean()
        .limit(limit);
        if(LeadData.length<1){
            return res.status(404).json({
                message:"No data is found"
            })
        }


        LeadData.forEach(lead => {
            if (!lead.user || !lead.user.firstName) {
                lead.user = { firstName: "Unknown" }; // Assign a default value if user is not populated
            }
        });


        
        const totalRecords = await Lead.countDocuments();
        return res.status(200).json({
            message:'All data is fetched',
            data:LeadData,
            pagination:{
                currentPage:page,
                totalPages: Math.ceil(totalRecords / limit), // Correct total pages calculation
                totalRecords: totalRecords // Correct total record count
            }
            
            
        })
    } catch (error) {
        return res.status(400).json({
            message:'error in getting lead data ' + error.message
        })
    }
})


module.exports = leadRouter