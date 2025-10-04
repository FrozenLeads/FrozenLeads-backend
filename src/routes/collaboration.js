const mongoose = require('mongoose');
const express = require('express');
const { userAuth } = require("../middlewares/Auth");

// --- 1. ADD ALL REQUIRED MODELS HERE ---
const Collaboration = require('../models/collaboration');
const Lead = require('../models/leads');
const SharedLead = require('../models/SharedLead');

const collaborationRouter = express.Router();

// CREATE A NEW COLLABORATION GROUP
collaborationRouter.post('/collab/create', userAuth, async (req, res) => {
    try {
        const { groupName } = req.body;
        if (!groupName || groupName.trim() === '') {
            return res.status(400).json({ message: 'Group name is required.' });
        }
        const existingGroup = await Collaboration.findOne({ 
            owner: req.user._id, 
            groupName: groupName 
        });
        if (existingGroup) {
            return res.status(409).json({ message: `You already have a group named "${groupName}".` });
        }
        const newGroup = new Collaboration({
            owner: req.user._id,
            groupName: groupName,
            collaborators: []
        });
        await newGroup.save();
        res.status(201).json({ message: 'Group created successfully!', group: newGroup });
    } catch (error) {
        res.status(500).json({ message: 'Failed to create group: ' + error.message });
    }
});

// ADD COLLABORATOR
collaborationRouter.post('/collab/:groupId/add-collaborator', userAuth, async (req, res) => {
    try {
        const user = req.user;
        const { groupId } = req.params;
        const { collaboratorId } = req.body;
        if (!collaboratorId) return res.status(400).json({ message: 'collaboratorId is required' });
        if (!mongoose.Types.ObjectId.isValid(collaboratorId)) {
            return res.status(400).json({ message: 'Invalid collaboratorId format' });
        }
        // --- 2. FIX: Use capital 'C' for Collaboration ---
        const group = await Collaboration.findById(groupId);
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

// REMOVE COLLABORATOR
collaborationRouter.post('/collab/:groupId/remove-collaborator', userAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { collaboratorId } = req.body;
        if (!collaboratorId) return res.status(400).json({ message: 'collaboratorId is required' });
        if (!mongoose.Types.ObjectId.isValid(collaboratorId)) {
            return res.status(400).json({ message: 'Invalid collaboratorId format' });
        }
        const group = await Collaboration.findById(groupId); // FIX
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

// SHARE LEAD
collaborationRouter.post('/collab/:groupId/share-lead/:leadId', userAuth, async (req, res) => {
    try {
        const userId = req.user._id;
        const { groupId, leadId } = req.params;

        const group = await Collaboration.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Collaboration group not found' });
        
        const isMember = group.owner.equals(userId) || group.collaborators.some(c => c.equals(userId));
        if (!isMember) return res.status(403).json({ error: 'You are not part of this group' });
        
        const lead = await Lead.findById(leadId);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        
        // This check is still important to prevent duplicates in the same group
        const alreadyShared = await SharedLead.findOne({ lead: leadId, collaborationGroup: groupId });
        if (alreadyShared) return res.status(400).json({ error: 'This lead is already in this group' });

        const sharedLead = new SharedLead({
            lead: leadId,
            sharedBy: userId,
            collaborationGroup: groupId
        });
        await sharedLead.save();

        // --- REMOVE THE FOLLOWING 3 LINES ---
        // lead.collaborationGroup = groupId;
        // lead.isPublic = false;
        // await lead.save();
        // --- NO LONGER NEEDED ---

        res.status(201).json({ message: 'Lead shared successfully', sharedLead });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// GET ALL LEADS IN A GROUP
collaborationRouter.get('/collab/:groupId/leads', userAuth, async (req, res) => {
    try {
        const userId = req.user._id;
        const { groupId } = req.params;
        const group = await Collaboration.findById(groupId); // FIX
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

// DELETE A GROUP
collaborationRouter.delete('/collab/:groupId', userAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const group = await Collaboration.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });

        if (!group.owner.equals(req.user._id)) {
            return res.status(403).json({ message: 'Only the owner can delete the group' });
        }
        
        await Collaboration.findByIdAndDelete(groupId);

        // --- CHANGE THIS LOGIC ---
        // We no longer delete the original Leads, only the links to them
        await SharedLead.deleteMany({ collaborationGroup: groupId });
        // --- END OF CHANGE ---
        
        res.json({ message: 'Group and all its shared lead links have been deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET MY GROUPS
collaborationRouter.get('/collab/my', userAuth, async (req, res) => {
    try {
        const groups = await Collaboration.find({ // FIX
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


collaborationRouter.get('/collab/:groupId', userAuth, async (req, res) => {
    try {
        const group = await Collaboration.findById(req.params.groupId)
            .populate('owner', 'firstName lastName emailId')
            .populate('collaborators', 'firstName lastName emailId');

        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }
        
        // Check if the current user is a member of the group
        const isMember = group.owner._id.equals(req.user._id) || group.collaborators.some(c => c._id.equals(req.user._id));
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this group.' });
        }

        res.json({ data: group });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching group details: ' + error.message });
    }
});


collaborationRouter.post('/collab/:groupId/add-collaborator', userAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { email } = req.body; // We now use email

        if (!email) return res.status(400).json({ message: 'Collaborator email is required' });

        const group = await Collaboration.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        
        if (!group.owner.equals(req.user._id))
            return res.status(403).json({ message: 'Only the owner can add collaborators' });

        const collaboratorToAdd = await User.findOne({ emailId: email });
        if (!collaboratorToAdd) {
            return res.status(404).json({ message: `User with email "${email}" not found.` });
        }
        
        const collaboratorId = collaboratorToAdd._id;

        if (group.owner.equals(collaboratorId))
            return res.status(400).json({ message: 'Owner cannot be added as a collaborator' });

        if (group.collaborators.some(id => id.equals(collaboratorId)))
            return res.status(400).json({ message: 'User is already a collaborator' });

        if (group.collaborators.length >= 10)
            return res.status(400).json({ message: 'Maximum of 10 collaborators reached' });
        
        group.collaborators.push(collaboratorId);
        await group.save();
        
        // Populate the newly added collaborator to send back full info
        const updatedGroup = await Collaboration.findById(groupId)
            .populate('owner', 'firstName')
            .populate('collaborators', 'firstName');

        res.json({ message: 'Collaborator added successfully', group: updatedGroup });

    } catch (error) {
        res.status(500).json({ error: 'Error adding collaborator: ' + error.message });
    }
});

// In src/routes/collaboration.js

// UNSHARE A LEAD FROM A GROUP
collaborationRouter.delete('/collab/:groupId/leads/:sharedLeadId', userAuth, async (req, res) => {
    try {
        const { groupId, sharedLeadId } = req.params;
        const currentUserId = req.user._id;

        // Find the specific "link" document that connects the lead to the group
        const sharedLead = await SharedLead.findById(sharedLeadId);
        if (!sharedLead) {
            return res.status(404).json({ message: 'This shared lead does not exist.' });
        }

        // Find the group to check for ownership
        const group = await Collaboration.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }

        // --- PERMISSION CHECK ---
        // Check if the current user is the group owner
        const isOwner = group.owner.equals(currentUserId);
        // Check if the current user is the one who originally shared the lead
        const isSharer = sharedLead.sharedBy.equals(currentUserId);

        // If the user is NOT the owner AND NOT the original sharer, deny access
        if (!isOwner && !isSharer) {
            return res.status(403).json({ message: 'You do not have permission to unshare this lead.' });
        }

        // If permission check passes, delete the SharedLead document
        await SharedLead.findByIdAndDelete(sharedLeadId);

        res.json({ message: 'Lead has been unshared from the group successfully.' });

    } catch (error) {
        console.error("Error unsharing lead:", error);
        res.status(500).json({ message: 'Failed to unshare lead: ' + error.message });
    }
});

module.exports = collaborationRouter;