const db = require('../DB/dbConfig.js')
const express = require('express')
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const router = express.Router()

const fileStorage = multer.diskStorage({
    destination: './Images/Items',
    filename: (req, file, cb) => {
        cb(null, new Date().getTime() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: fileStorage,
    fileFilter: (req, file, cb) => {
        if(['image/png', 'image/jpg', 'image/jpeg'].includes(file.mimetype)){
            cb(null, true);
        } else {
            cb(null, false);
            cb(new Error('Invalid file type'));
        }
    }
}).single('itemImage');

router.post('/addItem', async(req,res) => {
    try {
        upload(req, res, async (err) => {
            if(!err) {
                const [itemID] = await db('tbl_items').insert({
                    itemCode: req.body.itemCode,
                    itemName: req.body.itemName,
                    categoryID: req.body.categoryID || null,
                    brandID: req.body.brandID || null,
                    shelfID: req.body.shelfID || null,
                    unitID: req.body.unitID,
                    perUnit: (req.body.perUnit < 1 ? 1 : req.body.perUnit),
                    costPrice: req.body.costPrice,
                    itemPriceRetail: req.body.itemPriceRetail,
                    itemPriceWhole: req.body.itemPriceWhole,
                    stockAlert: req.body.stockAlert,
                    image: (req.file ? req.file.filename : null),
                    hideInStock: req.body.hideInStock || 1,
                    showButton: req.body.showButton || 0,
                    note: req.body.note || null,
                    userIDCreated: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
                    userIDUpdated: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
                })
                return res.status(200).send({
                    itemID,
                    image: (req.file ? req.file.filename : null)
                });
            } 
            return res.status(500).send({
                message: 'Invalid file type'
            })
        })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/updateItem/:itemID', async(req,res) => {
    try {
        await db('tbl_items').where('itemID', req.params.itemID).update({
            itemCode: req.body.itemCode,
            itemName: req.body.itemName,
            categoryID: req.body.categoryID,
            brandID: req.body.brandID,
            shelfID: req.body.shelfID,
            unitID: req.body.unitID,
            perUnit: (req.body.perUnit < 1 ? 1 : req.body.perUnit),
            costPrice: req.body.costPrice,
            itemPriceRetail: req.body.itemPriceRetail,
            itemPriceWhole: req.body.itemPriceWhole,
            stockAlert: req.body.stockAlert,
            hideInStock: req.body.hideInStock || '1',
            showButton: req.body.showButton || '0',
            note: req.body.note,
            updateAt: new Date(),
            userIDUpdated: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })
        res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/updateImage/:itemID', (req, res) => {
    upload(req, res, async (err) => {
        if(!err && req.file) {
            const [{oldImage}] = await db('tbl_items').where('itemID', req.params.itemID).select(['image as oldImage']);
            await db('tbl_items').where('itemID', req.params.itemID).update({
                image: req.file.filename
            });
            if(oldImage) {
                fs.unlinkSync('./Images/Items/' + oldImage);
            }
            return res.status(200).send({
                image: req.file.filename
            });
        }
        return res.status(500).send({
            message: 'Invalid file type'
        });
    })
});

router.delete('/deleteItem/:itemID', async(req,res) => {
    try {
        await db('tbl_items').where('itemID', req.params.itemID).update({
            deleteStatus: '0'
        })
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deleteImage/:itemID', async (req, res) => {
    const [{image}] = await db('tbl_items').where('itemID', req.params.itemID).select(['image']);
    fs.unlinkSync('./Images/Items/' + image);
    res.sendStatus(200);
})

router.get('/allItems', async (req, res) => {
    const items = await db.select(
        'tbl_items.itemID',
        'tbl_items.itemCode',
        'tbl_items.itemName',
        'tbl_items.categoryID',
        'tbl_categories.categoryName',
        'tbl_items.brandID',
        'tbl_brands.brandName',
        'tbl_items.shelfID',
        'tbl_shelfs.shelfName',
        'tbl_items.unitID',
        'tbl_items.perUnit',
        'tbl_items.costPrice',
        'tbl_items.itemPriceRetail',
        'tbl_items.itemPriceWhole',
        'tbl_items.stockAlert',
        'tbl_items.image',
        'tbl_items.hideInStock',
        'tbl_items.showButton',
        'tbl_items.note',
        db.raw('IFNULL(SUM(tbl_stock.qty), 0) AS totalInStock')
    ).from('tbl_items')
     .leftJoin('tbl_categories', 'tbl_items.categoryID', '=', 'tbl_categories.categoryID')
     .leftJoin('tbl_shelfs', 'tbl_items.shelfID', '=', 'tbl_shelfs.shelfID')
     .leftJoin('tbl_brands', 'tbl_items.brandID', '=', 'tbl_brands.brandID')
     .leftJoin('tbl_stock', 'tbl_items.itemID', '=', 'tbl_stock.itemID')
     .where('tbl_items.deleteStatus', '1')
     .groupBy('tbl_items.itemID')
     .orderBy('tbl_items.itemID', 'desc')
    res.status(200).send(items);
});

router.get('/countAllItems', async (req, res) => {
    const [{numberOfItems}] = await db('tbl_items').where('deleteStatus', '1').count('* as numberOfItems');
    const [[{numberOfAllQtyItems}]] = await db.raw(`SELECT SUM(tbl_stock.qty) AS numberOfAllQtyItems FROM tbl_stock`)
    const [[{inToStock}]] = await db.raw(`SELECT IFNULL(SUM(tbl_stock.qty),0) AS inToStock FROM tbl_stock WHERE sourceType IN ('p','rs') and date(createAt) = "${new Date().toISOString().split('T')[0]}"`)
    const [[{outFromStock}]] = await db.raw(`SELECT IFNULL(SUM(tbl_stock.qty),0) AS outFromStock FROM tbl_stock WHERE sourceType IN ('s','rp','d') and date(createAt) = "${new Date().toISOString().split('T')[0]}"`)
    res.status(200).send({
        numberOfItems,
        numberOfAllQtyItems,
        inToStock,
        outFromStock
    });
});

router.get('/image/:name', (req, res) => {
    res.sendFile(path.join(__dirname, '../Images/Items/' + req.params.name));
});

router.get('/getItemByCode/:itemCode', async (req, res) => {
    const [item] = await db('tbl_items').where('itemCode', req.params.itemCode).select();
    res.status(200).send(item || null);
});

router.get('/getItemInfo', (req, res) => {
    db.raw(`SELECT * FROM tbl_items WHERE LOWER(itemCode) = '${req.query.search.toLowerCase()}' OR LOWER(itemName) = '${req.query.search.toLowerCase()}'`).then(([[data]]) => {
        res.status(200).send(data);
    });
});

router.get('/getItem', (req, res) => {
    db.raw(`select 
        itemID,
        itemCode,
        itemName,
        costPrice,
        itemPriceRetail,
        itemPriceWhole,
        perUnit
        from tbl_items 
            where LOWER(itemCode) like "${req.query.search.toLowerCase()}%" or LOWER(itemName) like "${req.query.search.toLowerCase()}%"
    `).then(([data]) => {
        res.status(200).send(data)
    }) 
})

router.get('/getButtonItems/:categoryID', async (req, res) => {
    const items = await db('tbl_items').where('categoryID', req.params.categoryID).andWhere('deleteStatus', '1').andWhere('showButton', '1').select([
        'itemID',
        'itemCode',
        'itemName',
        'costPrice',
        'itemPriceRetail',
        'itemPriceWhole',
        'perUnit',
        'image'
    ]);
    res.status(200).send(items);
});

router.get('/getUnitInfo/:itemID', async (req, res) => {
    const [item] = await db.select(
        'tbl_items.perUnit as perUnit',
        'tbl_items.itemPriceWhole as itemPriceWhole',
        'tbl_items.itemPriceRetail as itemPriceRetail',
    ).from('tbl_items')
     .where('tbl_items.itemID', req.params.itemID);
    res.status(200).send(item);
});

router.get('/getItemForShowInvoice/:search/:wholeSell', async (req, res) => {
    const [item] = await db.select(
        'tbl_items.itemID as itemID',
        'tbl_items.itemName as itemName',
        'tbl_items.itemCode as itemCode',
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
     .where('tbl_items.itemCode', req.params.search)
     .orWhere('tbl_items.itemName', req.params.search)
     .andWhere('tbl_items.deleteStatus', '1');
    if(!item) {
        return res.status(500).send({
            message: 'هیچ کاڵایەک نەدۆزرایەوە'
        });
    }
    return res.status(200).send({
        itemName: item.itemName,
        itemCode: item.itemCode,
        productPrice: req.params.wholeSell == "true" ? item.itemPriceWhole : item.itemPriceRetail,
        shelfName: item.shelfName,
        unitName: item.unitName,
        qty: req.params.wholeSell ? item.perUnit : 1
    });
});

// Disposal Route

router.post('/addDisposal', async(req,res) => {
    try {
       const  [disposalID] = await db('tbl_disposals').insert({
            itemID: req.body.itemID,
            costPrice: req.body.costPrice || 0,
            qty: req.body.qty || 0,
            expiryDate: null,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })

        // send to stock

        await db('tbl_stock').insert({
            sourceID: disposalID,
            sourceType: 'd',
            itemID: req.body.itemID,
            qty:  -1 * (req.body.qty),
            costPrice: req.body.costPrice,
            expiryDate: null
        })
         res.status(201).send({
            disposalID,
         })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/updateDisposal/:disposalID', async(req,res) => {
    try {
       const updateDisposal = await db('tbl_disposals').where('disposalID', req.params.disposalID).update({
            itemID: req.body.itemID,
            costPrice: req.body.costPrice || 0,
            qty: req.body.qty || 0,
            expiryDate: null,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })

        // update to stock
        await db('tbl_stock')
        .where('sourceID', req.params.disposalID)
        .andWhere('sourceType', 'd')
        .andWhere('itemID', req.body.itemID)
        .update({
            itemID: req.body.itemID,
            qty:  -1 * (req.body.qty),
            costPrice: req.body.costPrice,
            expiryDate: null,
            updateAt: new Date()
        })
         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deleteDisposal/:disposalID/:itemID', async(req,res) => {
    try {
        await db('tbl_disposals').where('disposalID', req.params.disposalID).del()

            //delete to stock
            await db('tbl_stock').where('sourceID', req.params.disposalID)
            .andWhere('sourceType','d')
            .andWhere('itemID', req.params.itemID).del()
         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/disposalToday', async(req,res) => {
    try {
        const [disposalToday] = await db.raw(`SELECT
        tbl_disposals.disposalID,
        tbl_items.itemID,
        tbl_items.itemCode,
        tbl_items.itemName,
        tbl_disposals.costPrice,
        tbl_disposals.qty,
        tbl_disposals.createAt,
        tbl_disposals.expiryDate,
        tbl_users.userName
      FROM tbl_items
        INNER JOIN tbl_users
          ON tbl_items.userIDCreated = tbl_users.userID
        INNER JOIN tbl_disposals
          ON tbl_disposals.userID = tbl_users.userID
          AND tbl_disposals.itemID = tbl_items.itemID
          where date(tbl_disposals.createAt) = "${new Date().toISOString().split('T')[0]}"`)
           res.status(200).send(disposalToday)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/oneDateDisposal/:from', async(req,res) => {
    try {
        const [oneDateDisposal] = await db.raw(`SELECT
        tbl_disposals.disposalID,
        tbl_items.itemID,
        tbl_items.itemCode,
        tbl_items.itemName,
        tbl_disposals.costPrice,
        tbl_disposals.qty,
        tbl_disposals.createAt,
        tbl_disposals.expiryDate,
        tbl_users.userName
      FROM tbl_items
        INNER JOIN tbl_users
          ON tbl_items.userIDCreated = tbl_users.userID
        INNER JOIN tbl_disposals
          ON tbl_disposals.userID = tbl_users.userID
          AND tbl_disposals.itemID = tbl_items.itemID
          where date(tbl_disposals.createAt) = "${req.params.from}" `)
           res.status(200).send(oneDateDisposal)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/betweenDateDisposal/:from/:to', async(req,res) => {
    try {
        const [betweenDateDisposal] = await db.raw(`SELECT
        tbl_disposals.disposalID,
        tbl_items.itemID,
        tbl_items.itemCode,
        tbl_items.itemName,
        tbl_disposals.costPrice,
        tbl_disposals.qty,
        tbl_disposals.expiryDate,
        tbl_disposals.createAt,
        tbl_users.userName
      FROM tbl_items
        INNER JOIN tbl_users
          ON tbl_items.userIDCreated = tbl_users.userID
        INNER JOIN tbl_disposals
          ON tbl_disposals.userID = tbl_users.userID
          AND tbl_disposals.itemID = tbl_items.itemID
          where date(tbl_disposals.createAt) between "${req.params.from}" and "${req.params.to}"`)
           res.status(200).send(betweenDateDisposal)
    } catch (error) {
        res.status(500).send(error)
    }
})

//stock and reports of items

router.get('/inStock', async(req,res) => {
    try {
        const [inStock] = await db.raw(`SELECT
        tbl_items.itemID AS itemID,
        tbl_items.itemCode AS itemCode,
        tbl_items.itemName AS itemName,
        tbl_items.unitID AS unitID,
        tbl_items.shelfID AS shelfID,
        tbl_items.brandID AS brandID,
        tbl_items.categoryID AS categoryID,
        IFNULL(SUM(tbl_stock.qty), 0) AS totalInStock,
        IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 'p' THEN tbl_stock.qty END), 0) AS purchased,
        IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 'rp' THEN tbl_stock.qty END), 0) * (-1) AS returnPurchase,
        IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 's' THEN tbl_stock.qty END), 0) * (-1) AS sold,
        IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 'rs' THEN tbl_stock.qty END), 0) AS returnSold,
        IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 'd' THEN tbl_stock.qty END), 0) * (-1) AS disposal,
        tbl_units.unitName
      FROM tbl_items
        LEFT OUTER JOIN tbl_stock
          ON tbl_stock.itemID = tbl_items.itemID
        LEFT OUTER JOIN tbl_units
          ON tbl_items.unitID = tbl_units.unitID
      WHERE tbl_items.deleteStatus = '1' and tbl_items.hideInStock = '1'
      GROUP BY tbl_items.itemID,
               tbl_units.unitName`)

      res.status(200).send(inStock)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/lackInStock', async(req,res) => {
    try {
        const [inStock] = await db.raw(`SELECT
        tbl_items.itemID AS itemID,
        tbl_items.itemCode AS itemCode,
        tbl_items.itemName AS itemName,
        tbl_items.shelfID AS shelfID,
        IFNULL(SUM(tbl_stock.qty), 0) AS totalInStock
      FROM tbl_items
        LEFT JOIN tbl_stock
          ON tbl_stock.itemID = tbl_items.itemID
          WHERE tbl_items.deleteStatus = '1'  
      GROUP BY tbl_items.itemID, tbl_items.stockAlert
      HAVING IFNULL(SUM(tbl_stock.qty), 0) <= tbl_items.stockAlert
      ORDER BY 4 DESC`)

      res.status(200).send(inStock)
    } catch (error) {
        console.log(error);
        res.status(500).send(error)
    }
})

router.get('/inStockDeatil/:itemID', async(req,res) => {
    try {
        const [inStockDetail] = await db.raw(`SELECT
        tbl_items.itemID AS itemID,
        tbl_items.itemName AS itemName,
        SUM(tbl_stock.qty) AS totalInStock,
        tbl_stock.expiryDate,
        SUM(tbl_stock.qty) / tbl_items.perUnit AS totalInStockPerUnit,
        IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 'p' THEN tbl_stock.qty END), 0) AS purchased,
        IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 'rp' THEN tbl_stock.qty END), 0) * -1 AS returnPurchase,
        IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 's' THEN tbl_stock.qty END), 0) * -1 AS sold,
        IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 'rs' THEN tbl_stock.qty END), 0) AS returnSold,
        IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 'd' THEN tbl_stock.qty END), 0) * -1 AS disposal
      FROM tbl_stock
        INNER JOIN tbl_items
          ON tbl_stock.itemID = tbl_items.itemID
          where tbl_items.itemID = ${req.params.itemID}
      GROUP BY tbl_items.itemID,
               tbl_stock.expiryDate`)

        res.status(200).send(inStockDetail)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/moveFromToInStock', async(req,res) => {
    try {
        const [[{inToStock}]] = await db.raw(`SELECT IFNULL(SUM(tbl_stock.qty),0) AS inToStock FROM tbl_stock WHERE sourceType IN ('p','rs')`)
        const [[{outFromStock}]] = await db.raw(`SELECT IFNULL(SUM(tbl_stock.qty),0) * -1 AS outFromStock FROM tbl_stock WHERE sourceType IN ('s','rp') `)
        const [[{disposal}]] = await db.raw(`SELECT IFNULL(SUM(tbl_stock.qty),0) * -1 AS disposal FROM tbl_stock WHERE sourceType IN ('d') `)
        const [topSale] = await db.raw(`SELECT
                tbl_items.itemName,
                SUM(tbl_stock.qty) * -1 AS topSale
            FROM tbl_stock
                INNER JOIN tbl_items
                ON tbl_stock.itemID = tbl_items.itemID
            WHERE tbl_stock.sourceType = 's'
                AND
                MONTH(tbl_stock.createAt) = ${new Date().getMonth() + 1}
            GROUP BY tbl_items.itemID
                ORDER BY 2 DESC
            LIMIT 5`)
        const [notSale] = await db.raw(`SELECT
                                    tbl_items.itemID,
                                    tbl_items.itemName,
                                    IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 's' THEN tbl_stock.qty END), 0)*-1 AS notSale
                                FROM tbl_stock
                                    RIGHT OUTER JOIN tbl_items
                                    ON tbl_stock.itemID = tbl_items.itemID
                                GROUP BY tbl_items.itemID
                                HAVING IFNULL(SUM(CASE WHEN tbl_stock.sourceType = 's' THEN tbl_stock.qty END), 0) * (-1) BETWEEN 0 AND 10
                                    ORDER BY 3 ASC`)
        res.status(200).send({
            inToStock,
            outFromStock,
            disposal,
            topSale,
            notSale
        })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/moneyInStock', async(req,res) => {
    try {
        const [moneyInStock] = await db.raw(`SELECT 
        tbl_items.itemID,
        tbl_items.itemCode,
        tbl_items.itemName,
        tbl_items.costPrice,
        IFNULL(SUM(tbl_stock.qty), 0) AS totalInStock
        from tbl_items
            LEFT OUTER JOIN tbl_stock
            ON tbl_stock.itemID = tbl_items.itemID
            GROUP BY tbl_items.itemID`)
        

      res.status(200).send({
          moneyInStock
      })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getItemForPurchase/:itemCode', async(req,res) => {
    try {
        const [getItemForPurchase] = await db('tbl_items').where('itemCode', req.params.itemCode).select([
            'itemID',
            'itemCode',
            'itemName',
            'costPrice',
            'itemPriceRetail'
        ])

        res.status(200).send({
            getItemForPurchase
        })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getProfitByItem/:from/:to', async(req,res) => {
    try {
        const [getProfitByItem] = await db.raw(`SELECT
        tbl_items.itemID,
        tbl_items.itemCode,
        tbl_items.itemName,
        (-1) * SUM(tbl_stock.qty) AS totalQtySale,
        (-1) * SUM(tbl_stock.qty * (tbl_stock.itemPrice - tbl_stock.costPrice)) AS profitByItem,
        SUM(IF(tbl_stock.itemPrice - tbl_stock.costPrice <= 0, tbl_stock.qty * (tbl_stock.itemPrice - tbl_stock.costPrice), 0)) AS totalLoss,
        tbl_categories.categoryName,
        tbl_brands.brandName,
        tbl_shelfs.shelfName
      FROM tbl_items
        INNER JOIN tbl_stock
          ON tbl_items.itemID = tbl_stock.itemID
        LEFT OUTER JOIN tbl_categories
          ON tbl_items.categoryID = tbl_categories.categoryID
        LEFT OUTER JOIN tbl_brands
          ON tbl_items.brandID = tbl_brands.brandID
          LEFT OUTER JOIN tbl_shelfs
          ON tbl_items.shelfID = tbl_shelfs.shelfID
      WHERE tbl_stock.sourceType IN ('s', 'rs', 'd') AND DATE(tbl_stock.createAt) BETWEEN '${new Date(req.params.from).toISOString().split('T')[0]}' AND '${new Date(req.params.to).toISOString().split('T')[0]}'
      GROUP BY tbl_items.itemID`)

      res.status(200).send({
          getProfitByItem
      })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getSoldedItems/:from/:to', async (req, res) => {
    const [items] = await db.raw(`
        SELECT 
            tbl_items.itemName as itemName, 
            tbl_items.shelfID as shelfID, 
            tbl_invoice_item.qty as qty, 
            tbl_invoice_item.productPrice as productPrice,
            tbl_invoices.invoiceID as invoiceID
        FROM tbl_invoice_item
            JOIN tbl_items ON (tbl_items.itemID = tbl_invoice_item.itemID)
            JOIN tbl_invoices ON (tbl_invoices.invoiceID = tbl_invoice_item.invoiceID)
        WHERE tbl_invoices.stockType = 's' AND DATE(tbl_invoices.createAt) BETWEEN '${new Date(req.params.from).toISOString().split('T')[0]}' AND '${new Date(req.params.to).toISOString().split('T')[0]}'
            AND tbl_invoices.sellStatus = '1'
    `);

    const [itemsWithTotal] = await db.raw(`
        SELECT 
            tbl_items.itemName as itemName,
            tbl_items.shelfID as shelfID,
            SUM(tbl_invoice_item.qty) as qty, 
            SUM(tbl_invoice_item.productPrice * tbl_invoice_item.qty) as total
        FROM tbl_invoice_item 
            JOIN tbl_items ON (tbl_items.itemID = tbl_invoice_item.itemID) 
            JOIN tbl_invoices ON (tbl_invoices.invoiceID = tbl_invoice_item.invoiceID) 
        WHERE tbl_invoices.stockType = 's' AND DATE(tbl_invoices.createAt) BETWEEN '${new Date(req.params.from).toISOString().split('T')[0]}' AND '${new Date(req.params.to).toISOString().split('T')[0]}'
            AND tbl_invoices.sellStatus = '1'
        GROUP BY tbl_invoice_item.itemID
    `);

    res.status(200).send({
        items,
        itemsWithTotal
    });
});

module.exports = router