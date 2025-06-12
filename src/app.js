require('dotenv').config()
const express = require('express');
const mongoose = require('mongoose');
const ConnectDb = require('./config/database');
const cookieParser = require('cookie-parser');
const app = express();

app.use(express.json());
app.use(cookieParser());
const cors = require('cors');
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true, // Allow sending cookies with requests
}));




const authRouter = require('./routes/auth')
const profileRouter = require('./routes/profile')
const leadRouter = require('./routes/lead');
const userLeadRouter = require('./routes/userLead');
const collaborationRouter = require('./routes/collaboration');


app.use('/',authRouter);
app.use('/',profileRouter);
app.use('/',leadRouter);
app.use('/',userLeadRouter);
app.use('/',collaborationRouter);



ConnectDb().then(()=>{
    console.log('Db connected');
    app.listen(5000,()=>{
        console.log('server connected');
    })
}).catch((err) =>{
    console.error('Db not connected');
})

