const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config()
const db = require('./DB/dbConfig'); 

const app = express()

app.use(express.static('dist'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

const checkAuth = require('./checkAuth.js');

const essentialRouter = require('./router/essential.js')
const userRouter = require('./router/users.js')
const itemRouter = require('./router/items.js')
const expenseRouter = require('./router/expenses.js')
const supplierRouter = require('./router/suppliers.js')
const customerRouter = require('./router/customers.js')
const purchaseRouter = require('./router/purchases.js')
// const purchaseRouter = require('./router/purchases.js')
const invoiceRouter = require('./router/invoices.js')
const generalReport = require('./router/generalReport.js')
const ownerRouter = require('./router/oweners.js')
const boxRouter = require('./router/boxTransaction.js')

app.use('/essential', checkAuth, essentialRouter)
app.use('/user', userRouter)
app.use('/item', itemRouter)
app.use('/expense', checkAuth, expenseRouter)
app.use('/supplier', checkAuth, supplierRouter)
app.use('/customer', checkAuth, customerRouter)
app.use('/purchase', checkAuth, purchaseRouter)
app.use('/invoice', invoiceRouter)
app.use('/generalReport', checkAuth, generalReport)
app.use('/owner', checkAuth, ownerRouter)
app.use('/box', boxRouter)

app.post('/login', async (req, res) => {
    const [user] = await db('tbl_users').where('userName', req.body.userName).select();
    if(user) {
        bcrypt.compare(req.body.password, user.userPassword, async (err, result) => {
            if(result) {
                if(user.activeStatus == 1) {
                    const userPermissions = await db('tbl_sub_role').where('roleID', user.roleID).select(['subRoleName']);
                    const token = jwt.sign({
                        userID: user.userID,
                        userName: user.userName,
                        fullName: user.fullName,
                        permissions: userPermissions.map(({subRoleName}) => subRoleName)
                    }, process.env.KEY, { expiresIn: '12h' });
                    return res.status(200).send({ token });
                } else {
                    return res.status(500).send({
                        message: 'ئەم هەژمارە ناچالاک کراوە'
                    });
                }
            } else {
                return res.status(500).send({
                    message: 'وشەی نهێنی هەڵەیە'
                });
            }
        });
    } else {
        return res.status(500).send({
            message: 'ناوی بەکارهێنەر هەڵەیە'
        });
    }
});

app.post('/verifyToken', (req, res) => {
    try {
        const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY);
        return res.status(200).send(decoded);
    } catch (error) {
        return res.sendStatus(500);
    }
});

// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: 'azhi.jabar99@gmail.com',
//         pass: process.env.SECRET
//     }
// });

// setInterval(async () => {
//     await mysqldump({
//         connection: {
//           host: process.env.HOST,
//           user: process.env.USER,
//           password: process.env.PASS,
//           database: process.env.DB,
//         },
//         dumpToFile: './darin_game.sql'
//       });
//       transporter.sendMail({
//         from: 'azhi.jabar99@gmail.com',
//         to: 'azhijabar.aj@gmail.com',
//         attachments: [
//             { filename: 'darin_game.sql', path: './darin_game.sql' }
//         ]
//       }, function(err, data) {
//         if(err) {
//             console.log(err);
//         } 
//       });
// }, 24 * 60 * 60 * 1000)

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(process.env.PORT, () => {
    console.log(`Server started on port ${process.env.PORT}`);
})
