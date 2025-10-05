const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt')
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        minLength: 4,
        maxLength: 50,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    emailId: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
    },
     username: {
        type: String,
        lowercase: true,
        trim: true,
    },
    discriminator: {
        type: String, // Stored as a string to preserve leading zeros e.g., '0042'
    },
    age: {
        type: Number,
        min: 17
    },
    gender: {
        type: String,
        enum: {
            values: ['male', 'female', 'others'],
            message: '{VALUE} is not a valid gender'
        }
    },
    photoUrl: {
        type: String,
        default: 'https://imgs.search.brave.com/zXViuUpCT1g5k-aOXp12gFfJdBh9uWwpLeP_5YN9W5Y/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9pLnBp/bmltZy5jb20vb3Jp/Z2luYWxzL2FiLzhk/L2RmL2FiOGRkZjQ5/ZGE0NmVkMTYyNjZj/NDE2NWMzNTIxMGRl/LmpwZw'
    },
    googleTokens: {
        type: Object,
        default: null,
    },
}, { timestamps: true });
userSchema.index({ username: 1, discriminator: 1 }, { unique: true });

userSchema.methods.getJwt = async function () {
    const user = this
    const token = await jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d"
    });
    return token
}
userSchema.methods.validatePassword = async function (passwordInputByUser) {
    const user = this;
    const passwordHash = user.password;
    const isPasswordValid = await bcrypt.compare(passwordInputByUser, passwordHash);
    return isPasswordValid;
};
userSchema.pre('save', async function (next) {
    const user = this;
    try {
        if (user.isModified('password')) {
            user.password = await bcrypt.hash(user.password, 10);
        }
        if (this.isNew) {
        this.username = this.firstName.toLowerCase().replace(/\s/g, '');
        let uniqueHandleFound = false;
        
        while (!uniqueHandleFound) {
            // Generate a random 4-digit number as a string
            const randomDiscriminator = Math.floor(1000 + Math.random() * 9000).toString();
            
            // Check if a user with this username + discriminator already exists
            const existingUser = await mongoose.model('User').findOne({
                username: this.username,
                discriminator: randomDiscriminator
            });
            
            // If no user is found, this handle is unique
            if (!existingUser) {
                this.discriminator = randomDiscriminator;
                uniqueHandleFound = true;
            }
            // If a user IS found, the loop will run again to get a new number
        }
    }
    
        next();
    } catch (error) {
        next(error);
    }
});
module.exports = mongoose.model('User', userSchema)

