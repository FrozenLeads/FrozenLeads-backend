const jwt = require('jsonwebtoken');
const  bcrypt = require('bcrypt') 
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName:{
        type:String,
        required:true,
        minLength:4,    
        maxLength:50,
        trim:true
    },
    lastName:{
        type:String,
        trim:true
    },
    emailId:{
        type:String,
        required:true,
        lowercase:true,
        trim:true,
        unique: true
    },
    password:{
        type:String,
        required:true,
    },
    age:{
        type:Number,
        min:17
    },
    gender: {
        type: String,
        enum: {
          values: ['male', 'female', 'others'],
          message: '{VALUE} is not a valid gender'
        }
      },
      
    photoUrl:{
        type:String,
        default:'https://imgs.search.brave.com/zXViuUpCT1g5k-aOXp12gFfJdBh9uWwpLeP_5YN9W5Y/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9pLnBp/bmltZy5jb20vb3Jp/Z2luYWxzL2FiLzhk/L2RmL2FiOGRkZjQ5/ZGE0NmVkMTYyNjZj/NDE2NWMzNTIxMGRl/LmpwZw'
    },


},{timestamps:true})


userSchema.methods.getJwt =async  function () {
    const user = this
      const token = await jwt.sign({_id:user._id},process.env.JWT_SECRET,{
        expiresIn:"7d"
      });
    return token
}




userSchema.methods.validatePassword = async function(passwordInputByUser) {
    const user = this;
    const passwordHash = user.password;
    const isPasswordValid = await bcrypt.compare(passwordInputByUser, passwordHash);
    return isPasswordValid;
};


userSchema.pre('save', async function(next) {
    const user = this;
    try {
        // Only hash the password if it is a plain password (not already hashed)
        if (user.isModified('password')) {
            user.password = await bcrypt.hash(user.password, 10);
        }
        next();
    } catch (error) {
        next(error);
    }
});



module.exports = mongoose.model('User',userSchema)