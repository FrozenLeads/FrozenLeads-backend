const jwt = require('jsonwebtoken');

const User = require('../models/user');



const userAuth = async (req, res, next) => {

  try {

    // Prefer Authorization header, fallback to cookie

    let token = null;



    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {

      token = req.headers.authorization.split(' ')[1];

    } else if (req.cookies.token) {

      token = req.cookies.token;

    }



    if (!token) {

      return res.status(401).json({ message: 'No token provided' });

    }



    if (Array.isArray(token)) {

      return res.status(400).json({ message: 'Multiple tokens found. Only one token is allowed.' });

    }



    const decodedObj = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decodedObj._id);



    if (!user) {

      return res.status(401).json({ message: 'User not found' });

    }



    req.user = user;

    next();

  } catch (err) {

    if (err.name === 'TokenExpiredError') {

      return res.status(401).json({ message: 'Token has expired.' });

    }

    return res.status(401).json({ message: `Authentication failed: ${err.message}` });

  }

};



module.exports = {

  userAuth

};