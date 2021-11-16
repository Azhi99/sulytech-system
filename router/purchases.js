const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../DB/dbConfig');
const router = express.Router();

router.post('/addPurchase', async (req, res) => {
    try {
        const [purchaseID] = await db('tbl_purchases').insert({
            supplierID: req.body.supplierID,
            referenceNo: req.body.referenceNo,
            dollarPrice: req.body.dollarPrice,
            totalPrice: req.body.totalPrice,
            amountPay: req.body.amountPay,
            PurchaseStatus: req.body.PurchaseStatus,
            paymentType: req.body.paymentType,
            debtStatus: '0',
            stockType: req.body.stockType,
            note: req.body.note || null,
            userIDCreated: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
            userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        });
        await db('tbl_transactions').insert({
            sourceID: purchaseID,
            sourceType: req.body.stockType,
            accountID: req.body.supplierID,
            accountType: 's',
            accountName: req.body.supplierName,
            totalPrice: req.body.totalPrice,
            totalPay: req.body.amountPay,
            transactionType: req.body.paymentType,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        });
        await db('tbl_box_transaction').insert({
            shelfID: 1,
            sourceID: purchaseID,
            amount: req.body.stockType == 'p' ? req.body.amountPay * -1 : req.body.amountPay,
            type: req.body.stockType,
            note: `کڕینی کاڵا لە بە ژمارە وەصڵی ${req.body.referenceNo}`,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        });
        for(item of req.body.purchaseItems) {
            await db('tbl_purchase_items').insert({
                purchaseID,
                itemID: item.itemID,
                costPrice: item.costPrice,
                qty: item.qty,
                discount: 0,
                costAfterDisc: item.costPrice
            });
            await db('tbl_stock').insert({
                sourceID: purchaseID,
                sourceType: req.body.stockType,
                itemID: item.itemID,
                qty: item.qty,
                itemPrice: 0,
                costPrice: item.costPrice  // What if stock type is return purchase
            });
        }
        res.status(200).send({
            purchaseID
        });
    } catch (error) {
        res.status(500).send(error);
    }
});

router.post('/addItem', async (req, res) => {

});

module.exports = router;