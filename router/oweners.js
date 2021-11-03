const db = require('../DB/dbConfig.js')
const express = require('express')
const jwt = require('jsonwebtoken');
require('dotenv').config();
const router = express.Router()

router.post('/addAmount', async(req,res) => {
    try {
      const mbID = await db('tbl_money_box').insert({
            shelfID: req.body.shelfID,
            shelfID2: req.body.shelfID2,
            amount: req.body.amount,
            createAt: req.body.createAt,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })

        res.status(200).send({
            mbID
        })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/updateAmount/:mbID', async(req,res) => {
    try {
        await db('tbl_money_box').where('mbID', req.params.mbID).update({
            shelfID: req.body.shelfID,
            shelfID2: req.body.shelfID,
            amount: req.body.amount,
            createAt: req.body.createAt,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })

        res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deleteAmount/:mbID', async(req,res) => {
    try {
        await db('tbl_money_box').where('mbID', req.params.mbID).del()

        res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getAmountOwner/:fromDate/:toDate', async(req,res) => {
    try {
        const [getAmountOwner] = await db.raw(`SELECT
        tbl_money_box.mbID,
        tbl_money_box.shelfID,
        (SELECT
            tbl_shelfs.shelfName
          FROM tbl_shelfs
          WHERE tbl_shelfs.shelfID = tbl_money_box.shelfID) AS shelfName,
        tbl_money_box.shelfID2,
        (SELECT
            tbl_shelfs.shelfName
          FROM tbl_shelfs
          WHERE tbl_shelfs.shelfID = tbl_money_box.shelfID2) AS shelfName2,
        tbl_money_box.amount,
        tbl_money_box.createAt,
        tbl_users.userName
      FROM tbl_money_box
        INNER JOIN tbl_users
          ON tbl_money_box.userID = tbl_users.userID
          where (date(tbl_money_box.createAt) between "${req.params.fromDate}" and "${req.params.toDate}")`)

          res.status(200).send({
              getAmountOwner
          })
    } catch (error) {
        res.status(500).send(error)
    }
})


module.exports = router