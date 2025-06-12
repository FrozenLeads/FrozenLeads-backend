const express = require('express');
const GamilRouter = express.Router();
const { generateAuthUrl, gmailCallback } = require('../controllers/gmailOAuth');
const  {userAuth}= require('../middlewares/Auth')

GamilRouter.get('/auth',userAuth, generateAuthUrl);
GamilRouter.post('/callback', userAuth,gmailCallback);

module.exports = GamilRouter;