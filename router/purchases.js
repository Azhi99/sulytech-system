const db = require('../DB/dbConfig.js')
const express = require('express')
const { restart } = require('nodemon')
const router = express.Router()

router.post('/addPurchase', async(req,res) => {
    try {
        const [addPurchase] = await db('tbl_purchases').insert({
            supplierID: req.body.supplierID,
            referenceNo: req.body.referenceNo,
            dollarPrice: req.body.dollarPrice || 0,
            totalPrice: req.body.totalPrice  || 0,
            shipingCost: req.body.shipingCost || 0,
            discount: req.body.discount || 0,
            PurchaseStatus: req.body.PurchaseStatus || 'recived', //recived , ordered ,pending
            paymentType: req.body.paymentType || 'd', // deafult type is debt
            debtStatus: req.body.debtStatus || '0', //if status equal to 1 this mean it's not debt but 0 this mean debt
            stockType: req.body.stockType || 'p', //defult stock payment purchase 
            note: req.body.note,
            createAt: req.body.createAt,
            userIDCreated: 3,
            userIDUpdate: 3
        })

        // update prices of tbl_items
        req.body.purchase.purchaseItems.forEach( async(item) => {
            await db('tbl_items').where('itemID', item.itemID).update({
                costPrice: item.costAfterDisc || 0, // costPrice - discount
                itemPriceRetail: item.itemPriceRetail || 0,
                itemPriceWhole: item.itemPriceWhole || 0
            })

            // insert to tbl_purchase_items
            await db('tbl_purchase_items').insert({
                purchaseID: addPurchase,
                itemID: item.itemID,
                costPrice: item.costPrice || 0,
                qty: item.qty || 0,
                discount: item.discount || 0,
                costAfterDisc: item.costAfterDisc || 0,  // costPrice - discount
                expiryDate: item.expiryDate
            })

            // insert to tbl_stock
            await db('tbl_stock').insert({
                sourceID: addPurchase,
                sourceType: req.body.stockType,
                itemID: item.itemID,
                qty: (req.body.stockType == 'rp' ? -1 * (item.qty) : item.qty),
                costPrice: item.costPrice,
            })
        })
         res.sendStatus(201)
    } catch (error) {
        if(error.errno == 1062) {
         res.status(500).send({message:'cannot duplicate purchase number'})
        }
        }
})

router.patch('/updatePurchase/:purchaseID', async(req,res) => {
    try {
        await db('tbl_purchases').where('purchaseID', req.params.purchaseID).update({
            supplierID: req.body.supplierID,
            referenceNo: req.body.referenceNo,
            dollarPrice: req.body.dollarPrice || 0,
            totalPrice: req.body.totalPrice  || 0,
            shipingCost: req.body.shipingCost || 0,
            discount: req.body.discount || 0,
            PurchaseStatus: req.body.PurchaseStatus || 'recived', //recived , ordered ,pending
            paymentType: req.body.paymentType || 'd', // deafult type is debt
            debtStatus: req.body.debtStatus || '0', //if status equal to 1 this mean it's not debt but 0 this mean debt
            stockType: req.body.stockType || 'p', //defult stock payment purchase 
            note: req.body.note,
            updateAt: req.body.updateAt,
            userIDUpdate: 3
        })
         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

//set offset or limit
router.get('/allPurchases', async(req,res) => {
    try {
        const [allPurchases] = await db.raw(`SELECT
        tbl_purchases.purchaseID,
        tbl_purchases.supplierID,
        tbl_suppliers.supplierName,
        tbl_purchases.referenceNo,
        tbl_purchases.dollarPrice,
        tbl_purchases.totalPrice,
        tbl_purchases.shipingCost,
        tbl_purchases.discount,
        tbl_purchases.PurchaseStatus,
        tbl_purchases.paymentType,
        tbl_purchases.debtStatus,
        tbl_purchases.stockType,
        tbl_purchases.note,
        tbl_purchases.createAt,
        tbl_users.userName
      FROM tbl_purchases
        INNER JOIN tbl_users
          ON tbl_purchases.userIDCreated = tbl_users.userID
        INNER JOIN tbl_suppliers
          ON tbl_suppliers.userID = tbl_users.userID
          AND tbl_purchases.supplierID = tbl_suppliers.supplierID`)
            res.status(200).send(allPurchases)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/todayPurchases', async(req,res) => {
    try {
        const [todayPurchases] = await db.raw(`SELECT
        tbl_purchases.purchaseID,
        tbl_purchases.supplierID,
        tbl_suppliers.supplierName,
        tbl_purchases.referenceNo,
        tbl_purchases.dollarPrice,
        tbl_purchases.totalPrice,
        tbl_purchases.shipingCost,
        tbl_purchases.discount,
        tbl_purchases.PurchaseStatus,
        tbl_purchases.paymentType,
        tbl_purchases.debtStatus,
        tbl_purchases.stockType,
        tbl_purchases.note,
        tbl_purchases.createAt,
        tbl_users.userName
      FROM tbl_purchases
        INNER JOIN tbl_users
          ON tbl_purchases.userIDCreated = tbl_users.userID
        INNER JOIN tbl_suppliers
          ON tbl_suppliers.userID = tbl_users.userID
          AND tbl_purchases.supplierID = tbl_suppliers.supplierID
          where date(tbl_purchases.createAt) = "${new Date().toISOString().split('T')[0]}"`)
           res.status(200).send(todayPurchases)
    } catch (error) {
        res.status(500).send(error)
    }
})

// get Purchase with purchase Items 
router.get('singlePurchase/:purchaseID', async(req,res) => {
    try {
        const [getSinglePurchase] = await db.raw(`SELECT
        tbl_purchases.purchaseID,
        tbl_purchases.supplierID,
        tbl_suppliers.supplierName,
        tbl_purchases.referenceNo,
        tbl_purchases.dollarPrice,
        tbl_purchases.totalPrice,
        tbl_purchases.shipingCost,
        tbl_purchases.discount,
        tbl_purchases.PurchaseStatus,
        tbl_purchases.paymentType,
        tbl_purchases.debtStatus,
        tbl_purchases.stockType,
        tbl_purchases.note,
        tbl_purchases.createAt,
        tbl_users.userName
      FROM tbl_purchases
        INNER JOIN tbl_users
          ON tbl_purchases.userIDCreated = tbl_users.userID
        INNER JOIN tbl_suppliers
          ON tbl_suppliers.userID = tbl_users.userID
          AND tbl_purchases.supplierID = tbl_suppliers.supplierID
          where purchaseID = ${req.params.purchaseID}`)

        const [getSinglePurchaseItem] = await db.raw(`SELECT
        tbl_purchase_items.pItemID,
        tbl_purchase_items.purchaseID,
        tbl_purchase_items.itemID,
        tbl_items.itemName,
        tbl_purchase_items.costPrice,
        tbl_purchase_items.qty,
        tbl_purchase_items.discount,
        tbl_purchase_items.costAfterDisc,
        tbl_purchase_items.expiryDate
      FROM tbl_purchase_items
        INNER JOIN tbl_items
          ON tbl_purchase_items.itemID = tbl_items.itemID
          where purchaseID = ${req.params.purchaseID}`) 
          
          res.status(200).send({
              getSinglePurchase,
              getSinglePurchaseItem
          })
    } catch (error) {
        
    }
})


// Purchase Item Router

router.post('/addPurchaseItem', async(req,res) => {
    try {
        await db('tbl_purchase_item').insert({
            purchaseID: req.body.purchaseID,
            itemID: req.body.itemID,
            costPrice: req.body.costPrice || 0,
            qty: req.body.qty || 0,
            discount: req.body.discount || 0,
            costAfterDisc: req.body.costAfterDisc || 0,
            expiryDate: req.body.expiryDate
        })

        //update prices of tbl_item
        await db('tbl_items').where('itemID', req.body.itemID).update({
            costPrice: req.body.costPrice || 0,
            itemPriceRetail: req.body.itemPriceRetail || 0,
            itemPriceWhole: req.body.itemPriceWhole || 0
        })

        //insert to stock
        await db('tbl_stock').insert({
            sourceID: req.body.purchaseID,
            sourceType: req.body.stockType,
            itemID: req.body.itemID,
            qty: (req.body.stockType == 'rp' ? -1 * (req.body.qty) : req.body.qty),
            costPrice: req.body.costPrice,
        })
         res.sendStatus(201)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/updatePurchaseItem/:pItemID/:purchaseID/:itemID/:stockType', async(req,res) => {
    try {
        await db('tbl_purchase_item').where('pItemID', req.params.pItemID).update({
            itemID: req.body.itemID,
            costPrice: req.body.costPrice || 0,
            qty: req.body.qty || 0,
            discount: req.body.discount || 0,
            costAfterDisc: req.body.costAfterDisc || 0,
            expiryDate: req.body.expiryDate
        })

        //update prices of item
        await db('tbl_items').where('itemID', req.body.itemID).update({
            costPrice: req.body.costPrice || 0,
            itemPriceRetail: req.body.itemPriceRetail || 0,
            itemPriceWhole: req.body.itemPriceWhole || 0
        })

        //update stock
        await db('tbl_stock').where('sourceID',req.params.purchaseID)
        .andWhere('sourceType',req.params.stockType)
        .andWhere('itemID', req.params.itemID)
        .update({
            sourceID: req.body.purchaseID,
            sourceType: req.body.stockType,
            itemID: req.body.itemID,
            qty: (req.body.stockType == 'rp' ? -1 * (req.body.qty) : req.body.qty),
            costPrice: req.body.costPrice,
        })

         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deletePurchaseItem/:pItemID/:purchaseID/:itemID/:stockType', async(req,res) => {
    try {
        await db('tbl_purchase_item').where('pItemID', req.params.pItemID).del()

        //delete in stock
        await db('tbl_stock').where('sourceID', req.params.purchaseID)
        .andWhere('sourceType', req.params.stockType)
        .andWhere('itemID', req.params.itemID).del()

         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

module.exports = router