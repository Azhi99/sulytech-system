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
            amountPayIQD: req.body.amountPayIQD,
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
            totalPrice: req.body.stockType == 'p' ? req.body.totalPrice : req.body.totalPrice * -1,
            totalPay: req.body.stockType == 'p' ? (req.body.amountPay <= 0 && req.body.amountPayIQD > 0 ? (req.body.amountPayIQD / req.body.dollarPrice) : req.body.amountPay + (req.body.amountPayIQD / req.body.dollarPrice)) : 0,
            totalPayIQD: req.body.amountPayIQD,
            transactionType: req.body.paymentType,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        });
        await db('tbl_box_transaction').insert({
            shelfID: 1,
            sourceID: purchaseID,
            amount: req.body.stockType == 'p' ? req.body.amountPay * -1 : req.body.amountPay,
            amountIQD: req.body.stockType == 'p' ? req.body.amountPayIQD * -1 : req.body.amountPayIQD,
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
                qty: req.body.stockType == 'p' ? item.qty : item.qty * -1,
                itemPrice: 0,
                costPrice: item.costPrice 
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
    try {
        const [pIitemID] = await db('tbl_purchase_items').insert({
            purchaseID: req.body.purchaseID,
            itemID: req.body.itemID,
            costPrice: req.body.costPrice,
            qty: req.body.qty
        });
    
        await db('tbl_stock').insert({
            sourceID: req.body.purchaseID,
            sourceType: req.body.stockType,
            itemID: req.body.itemID,
            qty: req.body.qty,
            itemPrice: 0,
            costPrice: req.body.costPrice
        });

        await db('tbl_purchases').where('purchaseID', req.body.purchaseID).update({
            totalPrice: req.body.totalPrice,
            userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        });

        await db('tbl_transactions').where('sourceID', req.body.purchaseID).andWhere('sourceType', req.body.stockType).update({
            totalPrice: req.body.totalPrice,
            totalPay: req.body.amountPay <= 0 && req.body.amountPayIQD > 0 ? req.body.amountPayIQD /  req.body.dollarPrice : req.body.amountPay,
            totalPayIQD: req.body.amountPayIQD 
        });

        res.status(200).send({
            pIitemID,
            itemID: req.body.itemID
        });

    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }

});

router.patch('/updatePurchase', async (req, res) => {
    try {
        await db('tbl_purchases').where('purchaseID', req.body.purchaseID).update({
            referenceNo: req.body.referenceNo,
            supplierID: req.body.supplierID,
            amountPay: req.body.amountPay,
            amountPayIQD: req.body.amountPayIQD,
            PurchaseStatus: req.body.PurchaseStatus,
            note: req.body.note
        });
        await db('tbl_transactions').where('sourceID', req.body.purchaseID).andWhere('sourceType', req.body.stockType).update({
            totalPrice: req.body.stockType == 'p' ? req.body.totalPrice : req.body.totalPrice * -1,
            totalPay: req.body.stockType == 'p' ? (req.body.amountPay <= 0 && req.body.amountPayIQD > 0 ? (req.body.amountPayIQD / req.body.dollarPrice) : req.body.amountPay + (req.body.amountPayIQD / req.body.dollarPrice)) : 0,
            totalPayIQD: req.body.amountPayIQD
        });
        await db('tbl_box_transaction').where('sourceID', req.body.purchaseID).andWhere('type', req.body.stockType).update({
            amount: req.body.amountPay,
            amountIQD: req.body.amountPayIQD
        });
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }
});

router.patch('/updateCostPrice', async (req, res) => {
    try {
        await db('tbl_purchase_items').where('pItemID', req.body.pItemID).update({
            costPrice: req.body.costPrice
        });

        await db('tbl_stock').where('sourceID', req.body.purchaseID).andWhere('sourceType', req.body.stockType).andWhere('itemID', req.body.itemID).update({
            costPrice: req.body.costPrice
        });
        
        await db('tbl_purchases').where('purchaseID', req.body.purchaseID).update({
            totalPrice: req.body.totalPrice,
            userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        });

        await db('tbl_transactions').where('sourceID', req.body.purchaseID).andWhere('sourceType', req.body.stockType).update({
            totalPrice: req.body.stockType == 'p' ? req.body.totalPrice : req.body.totalPrice * -1
        });

    } catch (error) {
        res.status(200).send(error);
    }
});

router.patch('/updateQty', async (req, res) => {
    try {
        await db('tbl_purchase_items').where('pItemID', req.body.pItemID).update({
            qty: req.body.qty
        });

        await db('tbl_stock').where('sourceID', req.body.purchaseID).andWhere('sourceType', req.body.stockType).andWhere('itemID', req.body.itemID).update({
            qty: req.body.qty
        });
        
        await db('tbl_purchases').where('purchaseID', req.body.purchaseID).update({
            totalPrice: req.body.totalPrice,
            userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        });

        await db('tbl_transactions').where('sourceID', req.body.purchaseID).andWhere('sourceType', req.body.stockType).update({
            totalPrice: req.body.stockType == 'p' ? req.body.totalPrice : req.body.totalPrice * -1
        });

    } catch (error) {
        res.status(200).send(error);
    }
});

router.delete('/deleteItem/:pItemID/:purchaseID/:itemID/:sourceType/:totalPrice', async (req, res) => {
    try {
        await db('tbl_stock').where('sourceID', req.params.purchaseID).andWhere('sourceType', req.params.sourceType).andWhere('itemID', req.params.itemID).delete();
        await db('tbl_transactions').where('sourceID', req.params.purchaseID).andWhere('sourceType', req.params.sourceType).update({
            totalPrice: req.params.sourceType == 'p' ? req.params.totalPrice : req.params.totalPrice * -1
        });
        await db('tbl_purchases').where('purchaseID', req.params.purchaseID).update({
            totalPrice: req.params.totalPrice
        });
        res.sendStatus(200);
    } catch (error) {
        res.status(200).send(error);
    }
});

router.get('/getPurchases/:from/:to', async (req, res) => {
    const [purchases] = await db.raw(`SELECT
        tbl_purchases.purchaseID as purchaseID,
        tbl_purchases.supplierID as supplierID,
        tbl_suppliers.supplierName as supplierName,
        tbl_purchases.referenceNo as referenceNo,
        tbl_purchases.dollarPrice as dollarPrice,
        tbl_purchases.totalPrice as totalPrice,
        tbl_purchases.amountPay as amountPay,
        tbl_purchases.amountPayIQD as amountPayIQD,
        tbl_purchases.PurchaseStatus as PurchaseStatus,
        tbl_purchases.paymentType as paymentType,
        tbl_purchases.stockType as stockType,
        tbl_purchases.note as note,
        tbl_purchases.createAt as createAt,
        tbl_users.fullName as user
            FROM tbl_purchases
                JOIN tbl_suppliers ON (tbl_purchases.supplierID = tbl_suppliers.supplierID)
                JOIN tbl_users ON (tbl_purchases.userIDCreated = tbl_users.userID)
            WHERE DATE(tbl_purchases.createAt) BETWEEN '${new Date(req.params.from).toISOString().split('T')[0]}' AND '${new Date(req.params.to).toISOString().split('T')[0]}'
    `);

    res.status(200).send(purchases);
});

router.get('/getPurchaseItems/:purchaseID', async (req, res) => {
    const [items] = await db.raw(`SELECT
        tbl_purchase_items.pItemID as pItemID,
        tbl_purchase_items.itemID as itemID,
        tbl_items.itemCode as itemCode,
        tbl_items.itemName as itemName,
        tbl_purchase_items.costPrice as costPrice,
        tbl_purchase_items.qty as qty
            FROM tbl_purchase_items
                JOIN tbl_items ON (tbl_purchase_items.itemID  = tbl_items.itemID)
            WHERE tbl_purchase_items.purchaseID = ?
    `, [req.params.purchaseID]);

    res.status(200).send(items);
});

module.exports = router;