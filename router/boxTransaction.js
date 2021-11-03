const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../DB/dbConfig');
const router = express.Router();

router.post('/addTransaction', async (req, res) => {
    const [btID] = await db('tbl_box_transaction').insert({
        shelfID: req.body.shelfID,
        sourceID: req.body.sourceID,
        amount: req.body.type == 'in' ? req.body.amount : req.body.amount * -1,
        type: req.body.type,
        note: req.body.note || null,
        userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
    });
    res.status(200).send({
        btID
    });
});

router.patch('/updateTransaction/:btID', async (req, res) => {
    try {
        await db('tbl_box_transaction').where('btID', req.params.btID).update({
            shelfID: req.body.shelfID,
            sourceID: req.body.sourceID,
            amount: req.body.type == 'in' ? req.body.amount : req.body.amount * -1,
            type: req.body.type,
            note: req.body.note || null
        });
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error);
    }
});

router.delete('/deleteTransaction/:btID', async (req, res) => {
    try {
        await db('tbl_box_transaction').where('btID', req.params.btID).delete();
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error);
    }
});

router.get('/getAll/:from/:to', async (req, res) => {
    const [transactions] = await db.raw(`SELECT
        tbl_box_transaction.btID as btID,
        tbl_box_transaction.shelfID as shelfID,
        tbl_shelfs.shelfName as shelfName,
        tbl_box_transaction.sourceID as sourceID,
        tbl_box_transaction.amount as amount,
        tbl_box_transaction.type as type,
        tbl_box_transaction.note as note,
        tbl_box_transaction.createAt as createAt,
        tbl_users.userName as user
            FROM tbl_box_transaction
                JOIN tbl_shelfs ON (tbl_box_transaction.shelfID = tbl_shelfs.shelfID)
                JOIN tbl_users ON (tbl_box_transaction.userID = tbl_users.userID)
            WHERE DATE(tbl_box_transaction.createAt) BETWEEN '${new Date(req.params.from).toISOString().split('T')[0]}' AND '${new Date(req.params.to).toISOString().split('T')[0]}'
    `);
    res.status(200).send(transactions);
});

module.exports = router;