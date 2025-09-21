require('dotenv').config();

// -------------------------------------------------------------



const express = require('express');

const cookieParser = require('cookie-parser');

const cors = require('cors');

const ConnectDb = require('./config/database.js');



const authRouter = require('./routes/auth.js');

const profileRouter = require('./routes/profile.js');

const leadRouter = require('./routes/lead.js');

const userLeadRouter = require('./routes/userLead.js');

const collaborationRouter = require('./routes/collaboration.js');

const GamilRouter = require('./routes/gmailRoutes.js');

const Trackingrouter = require('./routes/emailTrackingRoutes.js');



const app = express();



app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

app.use(express.json());

app.use(cookieParser());



app.use('/', authRouter);

app.use('/', profileRouter);

app.use('/', leadRouter);

app.use('/', userLeadRouter);

app.use('/', collaborationRouter);

app.use('/', GamilRouter);

app.use('/', Trackingrouter);



ConnectDb().then(() => {

    console.log('Database connected successfully.');

   

    // --- THE CHANGE IS HERE ---

    // We only need the status checker job now. The followUpJob has been removed.

    require('./jobs/emailStatusChecker.js');

    // -------------------------



    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {

      console.log(`Server is running on port ${PORT}`);

    });

}).catch((err) => {

    console.error('Database connection failed:', err);

});