const db = require('../DB/dbConfig.js')
const express = require('express')
const jwt = require('jsonwebtoken');
require('dotenv').config();
const router = express.Router()

//type of Expense Router

router.post('/addType', async(req,res) => {
    try {
        const [typeExpenseID] = await db('tbl_type_expense').insert({
            typeName: req.body.typeName
        })
        res.status(201).send({
            typeExpenseID
        })
    } catch (error) {
        if(error.errno == 1062) {
            return res.status(500).send({
                message: 'This Type already exist'
            });
        }
    }
})

router.patch('/updateType/:typeExpenseID', async(req,res) => {
    try {
        await db('tbl_type_expense').where('typeExpenseID', req.params.typeExpenseID).update({
            typeName: req.body.typeName
        })
        res.sendStatus(200);
    } catch (error) {
        if(error.errno == 1062) {
            return res.status(500).send({
                message: 'This Type already exist'
            });
        }
    }
})

router.get('/limitedType/:offset', async(req,res) => {
    try {
        const allType = await db('tbl_type_expense').select('*').orderBy('typeExpenseID', 'desc').offset(req.params.offset).limit(10);
        res.status(200).send(allType)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/allType', async(req,res) => {
    try {
        const allType = await db('tbl_type_expense').select('*').orderBy('typeExpenseID', 'desc');
        res.status(200).send(allType)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/countTypes', async (req, res) => {
    const [{numberOfTypes}] = await db('tbl_type_expense').count('* as numberOfTypes');
    res.status(200).send({
        numberOfTypes
    });
});

//expenses Router 

router.post('/addExpense', async(req,res) => {
    try {
        const [expenseID] = await db('tbl_expenses').insert({
            typeExpenseID: req.body.typeExpenseID,
            shelfID: req.body.shelfID,
            priceExpenseIQD: req.body.priceExpenseIQD || 0,
            priceExpense$: req.body.priceExpense$ || 0,
            dollarPrice: req.body.dollarPrice || 0,
            note: req.body.note,
            userIDCreated: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
            userIDUpdated: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })

        if(req.body.priceExpenseIQD > 0 && req.body.priceExpense$ > 0) {
            const priceIQD = req.body.priceExpenseIQD / req.body.dollarPrice
            await db('tbl_box_transaction').insert({
                shelfID: req.body.shelfID,
                sourceID: expenseID,
                amount: -1 * (req.body.priceExpense$ + priceIQD),
                type: 'exp',
                note: req.body.note ? req.body.note : 'خەرجی',
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
            })
        } else if(req.body.priceExpenseIQD <= 0 && req.body.priceExpense$ > 0) {
            await db('tbl_box_transaction').insert({
                shelfID: req.body.shelfID,
                sourceID: expenseID,
                amount: -1 * req.body.priceExpense$,
                type: 'exp',
                note: req.body.note ? req.body.note : 'خەرجی',
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
            })
        } else {
            const priceIQD = req.body.priceExpenseIQD / req.body.dollarPrice

            await db('tbl_box_transaction').insert({
                shelfID: req.body.shelfID,
                sourceID: expenseID,
                amount: -1 * priceIQD,
                type: 'exp',
                note: req.body.note ? req.body.note : 'خەرجی',
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
            })
        }
        
        res.status(201).send({
        expenseID
        })
    } catch (error) {
        console.log(error);
        res.status(500).send(error)
    }
})

router.patch('/updateExpense/:expenseID', async(req,res) => {
    try {
        await db('tbl_expenses').where('expenseID', req.params.expenseID).update({
            typeExpenseID: req.body.typeExpenseID,
            shelfID: req.body.shelfID,
            priceExpenseIQD: req.body.priceExpenseIQD || 0,
            priceExpense$: req.body.priceExpense$ || 0,
            dollarPrice: req.body.dollarPrice || 0,
            note: req.body.note || null,
            updaetAt: new Date(),
            userIDUpdated: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })

        if(req.body.priceExpenseIQD > 0 && req.body.priceExpense$ > 0) {
            const priceIQD = req.body.priceExpenseIQD / req.body.dollarPrice
            await db('tbl_box_transaction').where('sourceID', req.params.expenseID).andWhere('type', 'exp').update({
                shelfID: req.body.shelfID,
                amount: -1 * (req.body.priceExpense$ + priceIQD),
                note: req.body.note,
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
            })
        } else if(req.body.priceExpenseIQD <= 0 && req.body.priceExpense$ > 0) {
            await db('tbl_box_transaction').where('sourceID', req.params.expenseID).andWhere('type', 'exp').update({
                shelfID: req.body.shelfID,
                amount: -1 * req.body.priceExpense$,
                note: req.body.note,
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
            })
        } else {
            const priceIQD = req.body.priceExpenseIQD / req.body.dollarPrice
            await db('tbl_box_transaction').where('sourceID', req.params.expenseID).andWhere('type', 'exp').update({
                shelfID: req.body.shelfID,
                amount: -1 * priceIQD,
                note: req.body.note,
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
            })
        }
         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deleteExpense/:expenseID', async(req,res) => {
    try {
        await db('tbl_expenses').where('expenseID', req.params.expenseID).del()
         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/todayExpense', async(req,res) => {
    try {
        const [todayExpense] = await db.raw(`SELECT
        tbl_expenses.expenseID,
        tbl_type_expense.typeName,
        tbl_expenses.typeExpenseID,
        tbl_shelfs.shelfID,
        tbl_shelfs.shelfName,
        tbl_expenses.priceExpenseIQD,
        tbl_expenses.priceExpense$,
        tbl_expenses.dollarPrice,
        tbl_expenses.note,
        tbl_expenses.createAt,
        tbl_users.userName
      FROM tbl_expenses
        INNER JOIN tbl_users
          ON tbl_expenses.userIDCreated = tbl_users.userID
        INNER JOIN tbl_type_expense
          ON tbl_expenses.typeExpenseID = tbl_type_expense.typeExpenseID
        INNER JOIN tbl_shelfs 
           ON tbl_expenses.shelfID = tbl_shelfs.shelfID
          where date(tbl_expenses.createAt) like "${new Date().toISOString().split('T')[0]}%"
          order by tbl_expenses.expenseID desc`)
           res.status(200).send(todayExpense)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/todayTotalExpense', async(req,res) => {
    try {
        const [[{total}]] = await db.raw(`SELECT
        IFNULL(SUM(priceExpenseIQD), 0) as total
      FROM tbl_expenses
          WHERE date(createAt) like "${new Date().toISOString().split('T')[0]}%"
          `)
           res.status(200).send({
               total
           })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/countToday', async (req, res) => {
    const [[{numberOfExpenses}]] = await db.raw(`select count(*) as numberOfExpenses from tbl_expenses where tbl_expenses.createAt like "${new Date().toISOString().split('T')[0]}%"`);
    res.status(200).send({
        numberOfExpenses
    });
});

router.get('/oneDateExpense/:from', async(req,res) => {
    try {
        const [oneDateExpense] = await db.raw(`SELECT
        tbl_expenses.expenseID,
        tbl_type_expense.typeName,
        tbl_shelfs.shelfName,
        tbl_expenses.priceExpenseIQD,
        tbl_expenses.priceExpense$,
        tbl_expenses.dollarPrice,
        tbl_expenses.note,
        tbl_expenses.createAt,
        tbl_users.userName
      FROM tbl_expenses
        INNER JOIN tbl_users
          ON tbl_expenses.userIDCreated = tbl_users.userID
        INNER JOIN tbl_type_expense
          ON tbl_expenses.typeExpenseID = tbl_type_expense.typeExpenseID
          INNER JOIN tbl_shelfs 
           ON tbl_expenses.shelfID = tbl_shelfs.shelfID
          where  date(tbl_expenses.createAt) = "${req.params.from}" `)
            res.status(200).send(oneDateExpense)
        } catch (error) {
            res.status(500).send(error)
    }
})

router.get('/betweenDateExpense/:from/:to', async(req,res) => {
    try {
        const [totalExpense] = await db.raw(`SELECT
        tbl_expenses.expenseID,
        tbl_type_expense.typeName,
        tbl_shelfs.shelfName,
        tbl_expenses.priceExpenseIQD,
        tbl_expenses.priceExpense$,
        tbl_expenses.dollarPrice,
        tbl_expenses.note,
        tbl_expenses.createAt,
        tbl_users.userName
      FROM tbl_expenses
        INNER JOIN tbl_users
          ON tbl_expenses.userIDCreated = tbl_users.userID
        INNER JOIN tbl_type_expense
          ON tbl_expenses.typeExpenseID = tbl_type_expense.typeExpenseID
          INNER JOIN tbl_shelfs 
           ON tbl_expenses.shelfID = tbl_shelfs.shelfID
          where  date(tbl_expenses.createAt) BETWEEN "${req.params.from}" AND "${req.params.to}" 
          order by 1 asc`)

          const [[totalPrice]] = await db.raw(`select sum(tbl_expenses.priceExpenseIQD) as totalIQD, sum(tbl_expenses.priceExpense$) as total$ from tbl_expenses where  date(tbl_expenses.createAt) BETWEEN "${req.params.from}" AND "${req.params.to}"`)
            res.status(200).send({
                totalExpense,
                totalPrice
            })
        } catch (error) {
            res.status(500).send(error)
    }
})


module.exports = router