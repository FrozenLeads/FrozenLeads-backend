const express = require('express');
const GamilRouter = express.Router();
const { generateAuthUrl, gmailCallback,syncGmail } = require('../controllers/gmailOAuth');
const  {userAuth}= require('../middlewares/Auth')
const {disconnectGmail} = require('../controllers/gmailController');

GamilRouter.get('/auth',userAuth, generateAuthUrl);
GamilRouter.post('/callback', userAuth,gmailCallback);
GamilRouter.post('/disconnect-gmail', userAuth, disconnectGmail);
GamilRouter.get('/sync-gmail', userAuth, syncGmail);

module.exports = GamilRouter;