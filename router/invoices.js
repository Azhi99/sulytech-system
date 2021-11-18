const db = require('../DB/dbConfig.js')
const express = require('express')
const jwt = require('jsonwebtoken');
require('dotenv').config();
const keySender = require('node-key-sender');
const router = express.Router()

router.post('/addInvoice', async(req,res) => {
    try {
        // const [item] = await db('tbl_items').where('itemCode', req.body.search).orWhere('itemName', req.body.search).andWhere('deleteStatus', '1').select();
        const [item] = await db.select(
            'tbl_items.itemID as itemID',
            'tbl_items.itemName as itemName',
            'tbl_items.perUnit as perUnit',
            'tbl_items.itemPriceRetail as itemPriceRetail',
            'tbl_items.itemPriceWhole as itemPriceWhole',
            'tbl_items.costPrice as costPrice',
            'tbl_items.shelfID as shelfID',
            'tbl_shelfs.shelfName as shelfName',
            'tbl_items.unitID as unitID',
            'tbl_units.unitName as unitName'
        ).from('tbl_items')
         .join('tbl_shelfs', 'tbl_items.shelfID', '=', 'tbl_shelfs.shelfID')
         .join('tbl_units', 'tbl_items.unitID', '=', 'tbl_units.unitID')
         .whereRaw(`LOWER(tbl_items.itemCode)='${req.body.search.toLowerCase()}'`)
         .orWhereRaw(`LOWER(tbl_items.itemName)='${req.body.search.toLowerCase()}'`)
        //  .where('tbl_items.itemCode', req.body.search)
        //  .orWhere('tbl_items.itemName', req.body.search)
         .andWhere('tbl_items.deleteStatus', '1');
        if(!item) {
            return res.status(500).send({
                message: 'هیچ کاڵایەک نەدۆزرایەوە'
            });
        }
        // const [[{expiryDate}]] = await db.raw(`
        //     select expiryDate from tbl_stock where itemID = ${item.itemID} group by itemID, expiryDate HAVING sum(qty) > 0 ORDER BY expiryDate asc limit 1
        // `);
        if(!req.body.invoiceID) {
            const [addInvoice] = await db('tbl_invoices').insert({
                customerID: req.body.customerID || 1,
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
                totalPrice: req.body.totalPrice || 0,
                totalPay: req.body.totalPay || 0, 
                discount: req.body.discount || 0,
                dollarPrice: req.body.dollarPrice || 0,
                stockType: req.body.stockType || 's',
                sellStatus: '0',
                invoiceType: req.body.invoiceType || 'c',
                userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
            })

            const [invdID] = await db('tbl_invoice_item').insert({
                invoiceID: addInvoice,
                itemID: item.itemID,
                qty: req.body.wholeSell ? item.perUnit : 1,
                productPrice: req.body.wholeSell ? item.itemPriceWhole : item.itemPriceRetail,
                costPrice: item.costPrice,
                shelfID: item.shelfID,
                unitID: item.unitID
            })

            return res.status(201).send({
                invoiceID: addInvoice,
                invdID,
                itemID: item.itemID,
                itemName: item.itemName,
                qty: req.body.wholeSell ? item.perUnit : 1,
                productPrice: req.body.wholeSell ? item.itemPriceWhole : item.itemPriceRetail,
                shelfName: item.shelfName,
                unitName: item.unitName,
                message: 'Invoice Created'
            })
        } else {
           const [itemID] = await db('tbl_invoice_item').where('invoiceID', req.body.invoiceID).andWhere('itemID', item.itemID).select(['itemID as itemID'])
           const qty = req.body.wholeSell ? item.perUnit : 1;
            if(!itemID) {
                const [invdID] = await db('tbl_invoice_item').insert({
                    invoiceID: req.body.invoiceID,
                    itemID: item.itemID,
                    qty,
                    productPrice: req.body.wholeSell ? item.itemPriceWhole : item.itemPriceRetail,
                    costPrice: item.costPrice,
                    shelfID: item.shelfID,
                    unitID: item.unitID
                })
                if(req.body.sellStatus == 1) {
                    await db('tbl_stock').insert({
                        sourceID: req.body.invoiceID,
                        sourceType: req.body.stockType,
                        itemID: item.itemID,
                        qty: req.body.stockType == 's' ? qty * (-1) : qty,
                        itemPirce: req.body.wholeSell ? item.itemPriceWhole : item.itemPriceRetail,
                        costPrice: item.costPrice
                    });
                }
                return res.status(200).send({
                    invdID,
                    itemID: item.itemID,
                    itemName: item.itemName,
                    qty,
                    productPrice: req.body.wholeSell ? item.itemPriceWhole : item.itemPriceRetail,
                    shelfName: item.shelfName,
                    unitName: item.unitName,
                    message: 'Item Added'
                });
            } else {
                await db('tbl_invoice_item').where('invoiceID', req.body.invoiceID).andWhere('itemID', item.itemID).update({
                    qty: db.raw('qty + ' + Number(qty))
                })
                if(req.body.sellStatus == 1) {
                    await db('tbl_stock').where('sourceID', req.body.invoiceID).andWhere('sourceType', req.body.stockType).andWhere('itemID', item.itemID).update({
                        qty: req.body.stockType == 's' ? db.raw('qty - ' + Number(qty)) : db.raw('qty + ' + Number(qty)),
                    });
                }
                res.status(200).send({
                    itemID: item.itemID,
                    qty,
                    message: 'Item Updated'
                });
            }
        }
    } catch (error) {
        console.log(error);
        res.status(500).send(error)
    }
})

router.patch('/updateInvoice/:invoiceID', async(req,res)=> {
    try {
        await db('tbl_invoices').where('invoiceID', req.params.invoiceID).update({
            totalPrice: req.body.totalPrice || 0,
            totalPay: req.body.totalPay || 0,
            totalPayIQD: req.body.totalPayIQD || 0,
            discount: req.body.discount || 0,
            userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })
        if(req.body.customerID != 1) {
            await db('tbl_transactions').where('sourceID', req.params.invoiceID).andWhere('sourceType', 's').andWhere('accountID', req.body.customerID)
            .update({
                totalPrice: req.body.stockType == 's' ? req.body.totalPrice * (-1) : req.body.totalPrice,
                totalPayIQD: req.body.totalPayIQD,
                totalPay: req.body.totalPay <= 0 && req.body.totalPayIQD > 0 ? req.body.totalPayIQD / req.body.dollarPrice : req.body.totalPay,
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
            })  
        }

        //to tbl_box_transactions
        if(req.body.stockType == 's') {
            await db('tbl_box_transaction').where('sourceID', req.params.invoiceID).andWhere('type', 's').update({
                amount: req.body.totalPay,
                amountIQD: req.body.totalPayIQD,
            })
        } else {
            await db('tbl_box_transaction').where('sourceID', req.params.invoiceID).andWhere('type', 's').update({
                amount: -1 * req.body.totalPay,
                amountIQD: -1 * req.body.totalPayIQD,
            })
        }

        res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/enterKey', (req, res) => {
    setTimeout(async () => {
        await keySender.sendKey("enter");
        res.sendStatus(200);
    }, 400)
});

router.patch('/increaseItem/:invdID/:invoiceID', async (req, res) => {
    try {
        await db('tbl_invoice_item').where('invdID', req.params.invdID).update({
            qty: db.raw('qty + 1')
        });
        if(req.body.sellStatus == 1) {
            await db('tbl_stock')
                 .where('sourceID', req.params.invoiceID)
                 .andWhere('sourceType', req.body.stockType)
                 .andWhere('itemID', req.body.itemID)
                 .update({
                    qty: db.raw('qty + 1')
                })
            await db('tbl_invoices').where('invoiceID', req.params.invoiceID).update({
                totalPrice: req.body.totalPrice
            });
            await db('tbl_transactions').where('sourceID', req.params.invoiceID).andWhere('sourceType', 's').update({
                totalPrice: req.body.stockType == 's' ? (req.body.totalPrice * (-1)) : req.body.totalPrice
            })
        }
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error);
    }
});

router.patch('/decreaseItem/:invoiceID/:invdID', async (req, res) => {
    try {
        await db('tbl_invoice_item').where('invdID', req.params.invdID).update({
            qty: db.raw('qty - 1')
        });
        if(req.body.sellStatus == 1) {
            await db('tbl_stock')
                 .where('sourceID', req.params.invoiceID)
                 .andWhere('sourceType', req.body.stockType)
                 .andWhere('itemID', req.body.itemID)
                 .update({
                    qty: db.raw('qty - 1')
                })
            await db('tbl_invoices').where('invoiceID', req.params.invoiceID).update({
                totalPrice: req.body.totalPrice
            });
            await db('tbl_transactions').where('sourceID', req.params.invoiceID).andWhere('sourceType', 's').update({
                totalPrice: req.body.stockType == 's' ? (req.body.totalPrice * (-1)) : req.body.totalPrice
            })
        }
        return res.status(200).send({
            message: 'Item Decreased'
        });
    } catch (error) {
        return res.status(500).send(error);
    }
});

router.patch('/changePricetoWhole/:invdID', async (req, res) => {
    try {
        await db('tbl_invoice_item').where('invdID', req.params.invdID).update({
            productPrice: req.body.itemPriceWhole
        });
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error);
    }
});

router.patch('/changeQty/:invdID/:invoiceID', async (req, res) => {
    try {
        await db('tbl_invoice_item').where('invdID', req.params.invdID).update({
            qty: req.body.qty
        });
        if(req.body.sellStatus == 1) {
            await db('tbl_stock')
                 .where('sourceID', req.params.invoiceID)
                 .andWhere('sourceType', req.body.stockType)
                 .andWhere('itemID', req.body.itemID)
                 .update({
                    qty: req.body.stockType == 's' ? (req.body.qty * (-1)) : (req.body.qty)
                })

            await db('tbl_invoices').where('invoiceID', req.params.invoiceID).update({
                totalPrice: req.body.totalPrice
            });
            await db('tbl_transactions').where('sourceID', req.params.invoiceID).andWhere('sourceType', req.body.stockType).update({
                totalPrice: req.body.stockType == 's' ? (req.body.totalPrice * (-1)) : req.body.totalPrice
            })
        }
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error);
    }
});

router.patch('/changeProductPrice/:invdID/:invoiceID', async (req, res) => {
    try {
        await db('tbl_invoice_item').where('invdID', req.params.invdID).update({
            productPrice: req.body.productPrice
        });
        if(req.body.sellStatus == 1) {
            await db('tbl_stock')
                .where('sourceID', req.params.invoiceID)
                .andWhere('sourceType', req.body.stockType)
                .andWhere('itemID', req.body.itemID)
                .update({
                    itemPrice: req.body.productPrice
                });
            await db('tbl_transactions').where('sourceID', req.params.invoiceID).andWhere('sourceType', req.body.stockType).update({
                totalPrice: req.body.stockType == 's' ? (req.body.totalPrice * (-1)) : req.body.totalPrice
            })
        }
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error);
    }
});


router.patch('/updateTotal/:invoiceID/:stockType', async (req, res) => {
    try {
        await db('tbl_invoices').where('invoiceID', req.params.invoiceID).update({
            totalPrice: req.body.totalPrice
        });
        await db('tbl_transactions').where('sourceID', req.params.invoiceID).andWhere('sourceType', req.params.stockType).update({
            totalPrice: req.params.stockType == 's' ? (req.body.totalPrice * (-1)) : req.body.totalPrice,
            // totalPay: req.body.totalPay
        });
    } catch (error) {
        res.status(500).send(error);
    }
})

router.delete('/deleteItem/:invoiceID/:invdID/:stockType/:itemID', async(req,res) => {
    try {
        await db('tbl_invoice_item').where('invdID', req.params.invdID).del()
        const [{noOfItem}] = await db('tbl_invoice_item').where('invoiceID', req.params.invoiceID).count('* as noOfItem')
        await db('tbl_stock')
            .where('sourceID', req.params.invoiceID)
            .andWhere('sourceType', req.params.stockType)
            .andWhere('itemID', req.params.itemID).del()
        if(noOfItem > 0) {
            res.status(200).send({
                message: 'Item Deleted'
            });
        } else {
            await db('tbl_invoices').where('invoiceID', req.params.invoiceID).del()
            await db('tbl_transactions').where('sourceID', req.params.invoiceID).andWhere('sourceType', req.params.stockType).delete();
            res.status(200).send({
                message: 'Invoice Deleted'
            });
        }
    } catch (error) {
        
    }
})

router.patch('/sellInvoice/:invoiceID', async(req,res) => {
    try {
        await db('tbl_invoices').where('invoiceID', req.params.invoiceID).update({
            customerID: req.body.customerID || 1,
            totalPrice: req.body.totalPrice || 0,
            totalPay: req.body.totalPay <= 0 && req.body.totalPayIQD > 0 ? req.body.totalPayIQD / req.body.dollarPrice : req.body.totalPay || 0, 
            discount: req.body.discount || 0,
            stockType: req.body.stockType || 's',
            sellStatus: '1',
            invoiceType: req.body.invoiceType || 'c',
            userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })
    
        var items = null;
        var itemToBox = null
        if(req.body.stockType == 's') {
            items = await db.select(
                db.raw(`${req.params.invoiceID} as sourceID`),
                db.raw(`'${req.body.stockType}' as sourceType`),
                db.raw(`itemID as itemID`),
                db.raw(`(qty * -1) as qty`),
                db.raw(`productPrice as itemPrice`),
                db.raw(`costPrice as costPrice`)
            ).from('tbl_invoice_item')
             .where('invoiceID', req.params.invoiceID);

             itemToBox = await db.select(
                db.raw('shelfID as shelfID'),
                db.raw(`${req.params.invoiceID} as sourceID`),
                db.raw('sum(qty * productPrice) as amount'),
                db.raw(`'${req.body.stockType}' as type`),
                db.raw(`${(jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID} as userID`),
                db.raw(`'${req.body.note2 + ' ' + req.body.customerName + ' ' + req.body.noteInvoice + ' ' + req.params.invoiceID}' as note`)
             ).from('tbl_invoice_item').where('invoiceID', req.params.invoiceID)
             .groupBy('shelfID')
        } else {
            items = await db.select(
                db.raw(`${req.params.invoiceID} as sourceID`),
                db.raw(`'${req.body.stockType}' as sourceType`),
                db.raw(`itemID as itemID`),
                db.raw(`qty as qty`),
                db.raw(`productPrice as itemPrice`),
                db.raw(`costPrice as costPrice`),
                db.raw(`expiryDate as expiryDate`)
            ).from('tbl_invoice_item')
             .where('invoiceID', req.params.invoiceID);
             
             itemToBox = await db.select(
                db.raw('shelfID as shelfID'),
                db.raw(`${req.params.invoiceID} as sourceID`),
                db.raw('sum(qty * productPrice) * -1  as amount'),
                db.raw(`'${req.body.stockType}' as type`),
                db.raw(`${(jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID} as userID`),
                db.raw(`'${req.body.note3 + ' ' + req.body.customerName}' as note`)
             ).from('tbl_invoice_item').where('invoiceID', req.params.invoiceID)
             .groupBy('shelfID')
        }
        await db('tbl_stock').insert(items);
         
        if(req.body.stockType == 's') {
            await db('tbl_box_transaction').insert({
                shelfID: 1,
                sourceID: req.params.invoiceID,
                amount: req.body.totalPay,
                amountIQD: req.body.totalPayIQD,
                type: req.body.stockType,
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
                note: req.body.note2 + ' ' + req.body.customerName + ' ' + req.body.noteInvoice + ' ' + req.params.invoiceID
            })
        } else {
            await db('tbl_box_transaction').insert({
                shelfID: 1,
                sourceID: req.params.invoiceID,
                amount: -1 * req.body.totalPay,
                amountIQD: -1 * req.body.totalPayIQD,
                type: req.body.stockType,
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
                note: req.body.note3 + ' ' + req.body.customerName
            })
        }
             
        if(req.body.customerID != 1) {
            await db('tbl_transactions').insert({
                sourceID: req.params.invoiceID,
                sourceType: req.body.stockType,
                accountID: req.body.customerID,
                accountType: 'c',
                accountName: req.body.customerName,
                totalPrice: req.body.stockType == 's' ? req.body.totalPrice * (-1) : req.body.totalPrice,
                totalPay: req.body.stockType == 's' ?  req.body.totalPay <= 0 && req.body.totalPayIQD > 0 ? req.body.totalPayIQD / req.body.dollarPrice : req.body.totalPay : 0,
                totalPayIQD: req.body.totalPayIQD,
                transactionType: req.body.invoiceType,
                userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
            })
        }
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.status(500).send(error);
        
    }
})

router.get('/searchInvoice/:invoiceID', async (req, res) => {
    const [invoice] = await db.select(
        'tbl_invoices.invoiceID',
        'tbl_customers.customerID',
        'tbl_customers.customerName',
        'tbl_invoices.totalPrice',
        'tbl_invoices.discount',
        'tbl_invoices.stockType',
        'tbl_invoices.invoiceType',
        'tbl_invoices.sellStatus',
        'tbl_invoices.totalPay',
        'tbl_invoices.dollarPrice',
        'tbl_users.fullName',
    ).from('tbl_invoices')
     .join('tbl_customers', 'tbl_customers.customerID', '=', 'tbl_invoices.customerID')
     .join('tbl_users', 'tbl_users.userID', '=', 'tbl_invoices.userIDUpdate')
     .where('tbl_invoices.invoiceID', req.params.invoiceID);
    if(!invoice){
        return res.status(500).send({
            message: 'هیچ وەصڵێک نەدۆزرایەوە'
        });
    }
    const invoiceItems = await db.select(
        'tbl_invoice_item.invdID as invdID',
        'tbl_invoice_item.itemID as itemID',
        'tbl_items.itemName as itemName',
        'tbl_invoice_item.qty as qty',
        'tbl_invoice_item.productPrice as productPrice',
        'tbl_shelfs.shelfName as shelfName',
        'tbl_units.unitName as unitName'
    ).from('tbl_invoice_item')
     .join('tbl_items', 'tbl_items.itemID', '=', 'tbl_invoice_item.itemID')
     .join('tbl_shelfs', 'tbl_invoice_item.shelfID', '=', 'tbl_shelfs.shelfID')
     .join('tbl_units', 'tbl_invoice_item.unitID', '=', 'tbl_units.unitID')
     .where('tbl_invoice_item.invoiceID', req.params.invoiceID);

    return res.status(200).send({
        invoice,
        invoiceItems
    });
});

router.get('/getUnsoldedInvoices/:userID', async (req, res) => {
    const unsoldedInvoices = await db('tbl_invoices').where('userIDUpdate', req.params.userID).andWhere('sellStatus', '0').select(['invoiceID']).orderBy('invoiceID', 'asc');
    const invoiceNumbers = unsoldedInvoices.map(({invoiceID}) => invoiceID);
    res.status(200).send(invoiceNumbers);
});

//invoice report

router.get('/todaySold', async (req, res) => {
    const [todaySold] = await db.raw(`
        select 
            tbl_invoices.invoiceID,
            tbl_customers.customerName,
            tbl_invoices.totalPrice,
            tbl_invoices.invoiceType,
            tbl_invoices.discount
        from tbl_invoices join tbl_customers on (tbl_invoices.customerID = tbl_customers.customerID)
        where tbl_invoices.sellStatus = '1' and tbl_invoices.stockType = 's' and date(tbl_invoices.createAt) = '${new Date().toISOString().split('T')[0]}' 
    `);

    res.status(200).send(todaySold);
});

router.get('/getTodayInvoices', async(req,res) => {
    try {
        const [getTodayInvoices] = await db.raw(`SELECT
                    tbl_invoices.invoiceID,
                    tbl_invoices.customerID,
                    tbl_customers.customerName,
                    tbl_invoices.userIDUpdate,
                    tbl_users.userName,
                    tbl_invoices.totalPrice,
                    tbl_invoices.totalPay,
                    tbl_invoices.discount,
                    tbl_invoices.stockType,
                    tbl_invoices.invoiceType,
                    tbl_invoices.createAt
                FROM tbl_invoices
                    INNER JOIN tbl_users
                    ON tbl_invoices.userID = tbl_users.userID
                    INNER JOIN tbl_customers
                    ON tbl_invoices.customerID = tbl_customers.customerID
                    AND tbl_customers.userID = tbl_users.userID
                    ORDER BY invoiceID DESC`)
        
        const [[{totalCash}]] = await db.raw(`SELECT
                SUM(totalPrice) AS totalCash
            FROM tbl_invoices
            WHERE date(createAt) = '${new Date().toISOString().split('T')[0]}'
        `);
        const [[{totalDebt}]] = await db.raw(`SELECT
                SUM(totalPrice - totalPay) AS totalDebt
            FROM tbl_invoices
            WHERE date(createAt) = '${new Date().toISOString().split('T')[0]}'
        `);

        res.status(200).send({
            getTodayInvoices,
            totalCash,
            totalDebt
        })            
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getAllInvoices/:from/:to', async(req,res) => {
    try {
        const [allInvoices] = await db.raw(`SELECT
            tbl_invoices.invoiceID,
            tbl_invoices.customerID,
            tbl_customers.customerName,
            tbl_invoices.userIDUpdate,
            tbl_users.userName,
            tbl_invoices.totalPrice,
            tbl_invoices.totalPay,
            tbl_invoices.discount,
            tbl_invoices.stockType,
            tbl_invoices.invoiceType,
            tbl_invoices.createAt
        FROM tbl_invoices
            INNER JOIN tbl_users
            ON tbl_invoices.userID = tbl_users.userID
            INNER JOIN tbl_customers
            ON tbl_invoices.customerID = tbl_customers.customerID
        WHERE DATE(tbl_invoices.createAt) BETWEEN '${new Date(req.params.from).toISOString().split('T')[0]}' AND '${new Date(req.params.to).toISOString().split('T')[0]}'
            ORDER BY invoiceID DESC`)
        res.status(200).send(allInvoices)            
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getSaleByOwner', async(req,res) => {
    try {
        const [getSaleByOwner] = await db.raw(`SELECT
        tbl_items.itemID AS itemID,
        tbl_items.itemCode AS itemCode,
        tbl_items.itemName AS itemName,
        tbl_shelfs.shelfName,
        tbl_shelfs.shelfID,
        IFNULL(SUM(tbl_stock.qty), 0) * -1 AS sold,
        IFNULL(SUM(tbl_stock.qty) * itemPrice, 0) * -1 AS totalPriceSold,
        date(tbl_stock.createAt) AS createAt,
        tbl_stock.sourceType as sourceType
      FROM tbl_items
        INNER JOIN tbl_shelfs
          ON tbl_items.shelfID = tbl_shelfs.shelfID
        INNER JOIN tbl_stock
          ON tbl_stock.itemID = tbl_items.itemID
          WHERE sourceType IN('s','rs') 
      GROUP BY tbl_items.itemID,
               date(tbl_stock.createAt),
               tbl_stock.itemPrice
               order by tbl_stock.sourceID desc`)
        res.status(200).send({
            getSaleByOwner
        })
    } catch (error) {
        res.status(500).send(error)
    }
})


module.exports = router