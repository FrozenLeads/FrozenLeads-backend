const mongoose = require('mongoose');
const express = require('express');
const { userAuth } = require("../middlewares/Auth");

// --- All Required Models ---
const Collaboration = require('../models/collaboration');
const Lead = require('../models/leads');
const SharedLead = require('../models/SharedLead');
const User = require('../models/user');

const collaborationRouter = express.Router();


// --- GROUP LEVEL ROUTES ---

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

// GET ALL GROUPS THE CURRENT USER IS A PART OF
collaborationRouter.get('/collab/my', userAuth, async (req, res) => {
    try {
        const groups = await Collaboration.find({
            $or: [ { owner: req.user._id }, { collaborators: req.user._id } ]
        })
        .populate('owner', 'firstName username discriminator')
        .populate('collaborators', 'firstName username discriminator');
        
        res.json({ data: groups });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching groups: ' + error.message });
    }
});

// GET DETAILS FOR A SINGLE GROUP
collaborationRouter.get('/collab/:groupId', userAuth, async (req, res) => {
    try {
        const group = await Collaboration.findById(req.params.groupId)
            .populate('owner', 'firstName username discriminator')
            .populate('collaborators', 'firstName username discriminator');

        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }
        
        const isMember = group.owner._id.equals(req.user._id) || group.collaborators.some(c => c._id.equals(req.user._id));
        if (!isMember) {
            return res.status(403).json({ message: 'You are not a member of this group.' });
        }

        res.json({ data: group });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching group details: ' + error.message });
    }
});

// DELETE A GROUP
collaborationRouter.delete('/collab/:groupId', userAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const group = await Collaboration.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        if (!group.owner.equals(req.user._id)) {
            return res.status(403).json({ message: 'Only the owner can delete the group' });
        }
        
        await Collaboration.findByIdAndDelete(groupId);
        await SharedLead.deleteMany({ collaborationGroup: groupId });
        
        res.json({ message: 'Group and all its shared lead links have been deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- MEMBER LEVEL ROUTES ---

// ADD A COLLABORATOR BY HANDLE OR EMAIL (The single, correct version)
collaborationRouter.post('/collab/:groupId/add-collaborator', userAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { identifier } = req.body;

        if (!identifier) {
            return res.status(400).json({ message: 'A handle or email is required' });
        }

        let userQuery;
        if (identifier.includes('@')) {
            userQuery = { emailId: identifier.toLowerCase() };
        } else if (identifier.includes('-')) {
            const parts = identifier.split('-');
            if (parts.length !== 2) {
                return res.status(400).json({ message: 'Invalid handle format. Use "username-1234".' });
            }
            const [username, discriminator] = parts;
            userQuery = { username: username.toLowerCase(), discriminator };
        } else {
            return res.status(400).json({ message: 'Invalid input. Please provide an email or a handle (e.g., user-1234).' });
        }

        const collaboratorToAdd = await User.findOne(userQuery);
        if (!collaboratorToAdd) {
            return res.status(404).json({ message: `User with identifier "${identifier}" not found.` });
        }
        
        const group = await Collaboration.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!group.owner.equals(req.user._id)) return res.status(403).json({ message: 'Only the owner can add collaborators' });
        
        const collaboratorId = collaboratorToAdd._id;
        if (group.owner.equals(collaboratorId)) return res.status(400).json({ message: 'Owner cannot be added as a collaborator' });
        if (group.collaborators.some(id => id.equals(collaboratorId))) return res.status(400).json({ message: 'User is already a collaborator' });
        if (group.collaborators.length >= 10) return res.status(400).json({ message: 'Maximum of 10 collaborators reached' });
        
        group.collaborators.push(collaboratorId);
        await group.save();
        
        const updatedGroup = await Collaboration.findById(groupId).populate('owner', 'firstName').populate('collaborators', 'firstName');
        res.json({ message: 'Collaborator added successfully', group: updatedGroup });

    } catch (error) {
        console.error("Error adding collaborator:", error);
        res.status(500).json({ error: 'Error adding collaborator: ' + error.message });
    }
});

// REMOVE A COLLABORATOR
collaborationRouter.post('/collab/:groupId/remove-collaborator', userAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { collaboratorId } = req.body;
        if (!collaboratorId) return res.status(400).json({ message: 'collaboratorId is required' });

        const group = await Collaboration.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!group.owner.equals(req.user._id)) return res.status(403).json({ message: 'Only owner can remove collaborators' });

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


// --- LEAD LEVEL ROUTES ---

// GET ALL LEADS SHARED IN A GROUP
collaborationRouter.get('/collab/:groupId/leads', userAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const group = await Collaboration.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });
        const isMember = group.owner.equals(req.user._id) || group.collaborators.some(c => c.equals(req.user._id));
        if (!isMember) return res.status(403).json({ error: 'Access denied' });
        
        const sharedLeads = await SharedLead.find({ collaborationGroup: groupId })
            .populate('lead')
            .populate('sharedBy', 'firstName');
        res.json({ data: sharedLeads });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SHARE A LEAD TO A GROUP
collaborationRouter.post('/collab/:groupId/share-lead/:leadId', userAuth, async (req, res) => {
    try {
        const { groupId, leadId } = req.params;
        const group = await Collaboration.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Collaboration group not found' });
        const isMember = group.owner.equals(req.user._id) || group.collaborators.some(c => c.equals(req.user._id));
        if (!isMember) return res.status(403).json({ error: 'You are not part of this group' });
        
        const alreadyShared = await SharedLead.findOne({ lead: leadId, collaborationGroup: groupId });
        if (alreadyShared) return res.status(400).json({ error: 'This lead is already in this group' });

        const sharedLead = new SharedLead({
            lead: leadId,
            sharedBy: req.user._id,
            collaborationGroup: groupId
        });
        await sharedLead.save();
        res.status(201).json({ message: 'Lead shared successfully', sharedLead });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UNSHARE A LEAD FROM A GROUP
collaborationRouter.delete('/collab/:groupId/leads/:sharedLeadId', userAuth, async (req, res) => {
    try {
        const { groupId, sharedLeadId } = req.params;
        const sharedLead = await SharedLead.findById(sharedLeadId);
        if (!sharedLead) return res.status(404).json({ message: 'This shared lead does not exist.' });

        const group = await Collaboration.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found.' });

        const isOwner = group.owner.equals(req.user._id);
        const isSharer = sharedLead.sharedBy.equals(req.user._id);
        if (!isOwner && !isSharer) {
            return res.status(403).json({ message: 'You do not have permission to unshare this lead.' });
        }

        await SharedLead.findByIdAndDelete(sharedLeadId);
        res.json({ message: 'Lead has been unshared from the group successfully.' });
    } catch (error) {
        console.error("Error unsharing lead:", error);
        res.status(500).json({ message: 'Failed to unshare lead: ' + error.message });
    }
});


module.exports = collaborationRouter;