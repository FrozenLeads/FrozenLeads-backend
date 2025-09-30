const mongoose = require('mongoose');
const express= require('express')

const collaborationRouter = express.Router();
const {userAuth}= require("../middlewares/Auth")

collaborationRouter.post('/collab/:groupId/add-collaborator', userAuth, async (req, res) => {

    try {

        const user = req.user;

        const { groupId } = req.params;

        const { collaboratorId } = req.body;



        if (!collaboratorId) return res.status(400).json({ message: 'collaboratorId is required' });



        if (!mongoose.Types.ObjectId.isValid(collaboratorId)) {

            return res.status(400).json({ message: 'Invalid collaboratorId format' });

        }



        const group = await collaboration.findById(groupId);

        if (!group) return res.status(404).json({ message: 'Group not found' });



        if (!group.owner.equals(user._id))

            return res.status(403).json({ message: 'Only owner can add collaborators' });



        if (group.owner.equals(collaboratorId))

            return res.status(400).json({ message: 'Owner cannot be added as collaborator' });



        if (group.collaborators.some(id => id.equals(collaboratorId)))

            return res.status(400).json({ message: 'Collaborator already exists' });



        if (group.collaborators.length >= 10)

            return res.status(400).json({ message: 'Max 10 collaborators reached' });



        group.collaborators.push(collaboratorId);

        await group.save();



        res.json({ message: 'Collaborator added', group });

    } catch (error) {

        res.status(500).json({ error: 'Error in adding collaborator: ' + error.message });

    }

});



collaborationRouter.post('/collab/:groupId/remove-collaborator', userAuth, async (req, res) => {

    try {

        const { groupId } = req.params;

        const { collaboratorId } = req.body;



        if (!collaboratorId) return res.status(400).json({ message: 'collaboratorId is required' });



        if (!mongoose.Types.ObjectId.isValid(collaboratorId)) {

            return res.status(400).json({ message: 'Invalid collaboratorId format' });

        }



        const group = await collaboration.findById(groupId);

        if (!group) return res.status(404).json({ message: 'Group not found' });



        if (!group.owner.equals(req.user._id))

            return res.status(403).json({ message: 'Only owner can remove collaborators' });



        const exists = group.collaborators.some(id => id.equals(collaboratorId));

        if (!exists) {

            return res.status(400).json({ message: 'Collaborator not found in group' });

        }



        group.collaborators = group.collaborators.filter(id => !id.equals(collaboratorId));

        await group.save();



        res.json({ message: 'Collaborator removed', group });

    } catch (error) {

        res.status(500).json({ message: 'Error removing collaborator: ' + error.message });

    }

});





// Share lead to collaboration group

collaborationRouter.post('/collab/:groupId/share-lead/:leadId', userAuth, async (req, res) => {

    try {

        const userId = req.user._id;

        const { groupId, leadId } = req.params;



        const group = await collaboration.findById(groupId);

        if (!group) return res.status(404).json({ error: 'Collaboration group not found' });



        const isMember = group.owner.equals(userId) || group.collaborators.some(c => c.equals(userId));

        if (!isMember) return res.status(403).json({ error: 'You are not part of this group' });



        const lead = await Lead.findById(leadId);

        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        if (!lead.isPublic) return res.status(400).json({ error: 'Cannot share private lead' });



        const alreadyShared = await SharedLead.findOne({ lead: leadId, collaborationGroup: groupId });

        if (alreadyShared) return res.status(400).json({ error: 'Lead already shared in this group' });



        const sharedLead = new SharedLead({

            lead: leadId,

            sharedBy: userId,

            collaborationGroup: groupId

        });

        await sharedLead.save();



        lead.collaborationGroup = groupId;

        lead.isPublic = false;

        await lead.save();



        res.status(201).json({ message: 'Lead shared successfully', sharedLead });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



// Get all leads shared in group

collaborationRouter.get('/collab/:groupId/leads', userAuth, async (req, res) => {

    try {

        const userId = req.user._id;

        const { groupId } = req.params;



        const group = await collaboration.findById(groupId);

        if (!group) return res.status(404).json({ error: 'Group not found' });



        const isMember = group.owner.equals(userId) || group.collaborators.some(c => c.equals(userId));

        if (!isMember) return res.status(403).json({ error: 'Access denied' });



        const sharedLeads = await SharedLead.find({ collaborationGroup: groupId })

            .populate('lead')

            .populate('sharedBy', 'firstName lastName emailId');



        res.json({ data: sharedLeads });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



// Delete collaboration group

collaborationRouter.delete('/collab/:groupId', userAuth, async (req, res) => {

    try {

        const { groupId } = req.params;



        const group = await collaboration.findById(groupId);

        if (!group) return res.status(404).json({ message: 'Group not found' });



        if (!group.owner.equals(req.user._id)) {

            return res.status(403).json({ message: 'Only owner can delete the group' });

        }



        await collaboration.findByIdAndDelete(groupId);



        // Optional: Delete all leads related to this group

        await Lead.deleteMany({ collaborationGroup: groupId });



        res.json({ message: 'Group and related leads deleted' });

    } catch (err) {

        res.status(500).json({ error: err.message });

    }

});



// Get my groups (owner or collaborator)

collaborationRouter.get('/collab/my', userAuth, async (req, res) => {

    try {

        const groups = await collaboration.find({

            $or: [

                { owner: req.user._id },

                { collaborators: req.user._id }

            ]

        }).populate('owner', 'firstName').populate('collaborators', 'firstName');

        res.json({ data: groups });

    } catch (error) {

        res.status(500).json({ message: 'Error fetching groups: ' + error.message });

    }

});



module.exports = collaborationRouter;