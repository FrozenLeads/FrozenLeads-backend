const jwt = require('jsonwebtoken');
const User =  require('../models/user');


const userAuth = async (req,res,next)=>{
    try {
        const {token} = req.cookies;
        if(!token){
            throw new Error('token is not valid');
        }
        const decodedObj = await jwt.verify(token,process.env.JWT_SECRET,);
        const {_id} = decodedObj;
        const user =  await User.findOne({_id});
        if(!user){
            return res.status(401).json({ message: 'User not found.' });
        }
        if (Array.isArray(token)) {
            return res.status(400).json({ message: 'Multiple tokens found. Only one token is allowed.' });
        }

        req.user = user
        next()
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired.' });
        }
        return res.status(401).json({ message: `Authentication failed: ${err.message}` });
    }
}

module.exports = {
    userAuth
}