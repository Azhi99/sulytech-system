const db = require('../DB/dbConfig.js')
const express = require('express')
const jwt = require('jsonwebtoken');
require('dotenv').config();
const router = express.Router()

router.post('/addSupplier', async(req,res) => {
    try {
       const [supplierID] = await db('tbl_suppliers').insert({
            supplierName: req.body.supplierName,
            phone: req.body.phone,
            address: req.body.address,
            previousBalance: req.body.previousBalance || 0,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
        })
        await db('tbl_transactions').insert({
            sourceID: supplierID,
            sourceType: 'pds',
            accountID: supplierID,
            accountType: 's',
            accountName: req.body.supplierName,
            totalPrice: req.body.previousBalance,
            transactionType: 'd',
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        });
         res.status(201).send({
             supplierID
         })
    } catch (error) {
        console.log(error);
        if(error.errno == 1062) {
            return res.status(500).send({
                message: 'This supplier already exist'
            });
        }
    }
})

router.patch('/updateSupplier/:supplierID', async(req,res) => {
    try {
        await db('tbl_suppliers').where('supplierID', req.params.supplierID).update({
            supplierName: req.body.supplierName,
            phone: req.body.phone,
            address: req.body.address,
            previousBalance: req.body.previousBalance || 0,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID,
        })
        await db('tbl_transactions').where('sourceID', req.params.supplierID).andWhere('sourceType', 'pds').update({
            totalPrice: req.body.previousBalance
        });
    } catch (error) {
        if(error.errno == 1062) {
            res.status(500).send({
                message: 'This supplier already exist'
            })
        }
    }
})

// instead of delete
router.patch('/deactive/:supplierID', async(req,res) => {
    try {
        await db('tbl_suppliers').where('supplierID', req.params.supplierID).update({
            activeStatus: '0'
        })
         res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/allSuppliers', async(req,res) => {
    try {
        const [allSuppliers] = await db.raw(`SELECT
        tbl_suppliers.supplierID,
        tbl_suppliers.supplierName,
        tbl_suppliers.phone,
        tbl_suppliers.address,
        tbl_suppliers.previousBalance,
        tbl_suppliers.createAt,
        tbl_suppliers.activeStatus,
        IF((view_total_remain_debt_supplier.totalRemainSupplier - IFNULL(view_total_remain_debt_customer.totalRemainCustomer, 0)) >= 0,(view_total_remain_debt_supplier.totalRemainSupplier - IFNULL(view_total_remain_debt_customer.totalRemainCustomer, 0)), 0) AS totalRemain
      FROM tbl_suppliers
        LEFT OUTER JOIN view_total_remain_debt_customer
          ON tbl_suppliers.supplierName = view_total_remain_debt_customer.customerName
        LEFT OUTER JOIN view_total_remain_debt_supplier
          ON tbl_suppliers.supplierName = view_total_remain_debt_supplier.supplierName
      WHERE tbl_suppliers.activeStatus = '1'
      GROUP BY tbl_suppliers.supplierID`)
         res.status(200).send(allSuppliers)
    } catch (error) {
        res.status(500).send(error)
    }
})

// return debt 
// refernce NO is optional
router.post('/addReturnDebt', async(req,res) => {
    try {
        const [rdID] = await db('tbl_return_debt').insert({
            supplierID: req.body.supplierID,
            // shelfID: req.body.shelfID,
            amountReturn: req.body.amountReturn || 0,
            referenceNO: req.body.referenceNO,
            discount: req.body.discount,
            dollarPrice: req.body.dollarPrice,
            purchaseNumbers: req.body.purchaseNumbers.length ? req.body.purchaseNumbers.join(',') : null,
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })

        // await db('tbl_box_transaction').insert({
        //     shelfID: req.body.shelfID,
        //     sourceID: rdID,
        //     amount: req.body.amountReturn * -1,
        //     type: 'rdp',
        //     note: req.body.note + ' ' + req.body.supplierName ,
        //     userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        // })
        
        if(req.body.purchaseNumbers.length) {
            await db('tbl_purchases').whereIn('purchaseID', req.body.purchaseNumbers).update({
                debtStatus: '1',
                updateAt: new Date(),
                userIDUpdate: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
            });
        }

        await db('tbl_transactions').insert({
            sourceID: rdID,
            sourceType: 'rdp',
            accountID: req.body.supplierID,
            accountType: 's',
            accountName: req.body.supplierName,
            totalPrice: (-1) * (req.body.amountReturn - req.body.discount),
            transactionType: 'rd',
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })

        res.status(201).send({
            rdID
        });
    } catch (error) {
        res.status(500).send(error)
        console.log(error);
    }
})

router.patch('/updateReturnDebt/:rdID', async(req,res) => {
    try {
        await db('tbl_return_debt').where('rdID', req.params.rdID).update({
            // shelfID: req.body.shelfID,
            amountReturn: req.body.amountReturn || 0,
            referenceNO: req.body.referenceNO || null,
            discount: req.body.discount,
            dollarPrice: req.body.dollarPrice,
        })

        // await db('tbl_box_transaction').where('sourceID', req.params.rdID).andWhere('type', 'rdp').update({
        //     amount: req.body.amountReturn * -1,
        //     userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        // })

        if(req.body.purchaseNumbers.length) {
            const [{oldPurchases}] = await db('tbl_return_debt').where('rdID', req.params.rdID).select(['purchaseNumbers as oldPurchases']);
            const newPurchases = oldPurchases + ',' + req.body.purchaseNumbers.join(',');
            await db('tbl_return_debt').where('rdID', req.params.rdID).update({
                purchaseNumbers: newPurchases
            });
            await db('tbl_purchases').whereIn('purchaseID', req.body.purchaseNumbers).update({
                debtStatus: '1'
            });
            return res.status(200).send({
                newPurchases
            });
        }

        await db('tbl_transactions').where('sourceID', rdID).andWhere('sourceType', 'rdp').andWhere('accountID', req.body.supplierID)
        .insert({
            totalPrice: (-1) * (req.body.amountReturn - req.body.discount),
            userID: (jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY)).userID
        })

        return res.sendStatus(200);
        
    } catch (error) {
        res.status(200).send(error);
    }
})

router.delete('/deletePurchase/:rdID/:purchaseID/:userID', async (req, res) => {
    const [{purchaseNumbers}] = await db('tbl_return_debt').where('rdID', req.params.rdID).select(['purchaseNumbers']);
    const purchases = purchaseNumbers.split(',').filter(obj => obj != req.params.purchaseID);
    await db('tbl_return_debt').where('rdID', req.params.rdID).update({
        purchaseNumbers: purchases.join(',') || null
    });
    await db('tbl_purchases').where('purchaseID', req.params.purchaseID).update({
        debtStatus: '0'
    });
    res.sendStatus(200);
});

router.get('/todayReturnDebt', async (req, res) => {
    try {
        const [todayReturnDebt] = await db.raw(`SELECT
        tbl_return_debt.rdID,
        tbl_suppliers.supplierID,
        tbl_suppliers.supplierName,
        tbl_return_debt.amountReturn,
        tbl_return_debt.referenceNO,
        tbl_return_debt.discount,
        tbl_return_debt.dollarPrice,
        tbl_return_debt.purchaseNumbers,
        tbl_return_debt.createAt,
        tbl_users.userName
      FROM tbl_suppliers
        INNER JOIN tbl_users
          ON tbl_suppliers.userID = tbl_users.userID
        INNER JOIN tbl_return_debt
          ON tbl_return_debt.userID = tbl_users.userID
          AND tbl_return_debt.supplierID = tbl_suppliers.supplierID
          where date(tbl_return_debt.createAt) = "${new Date().toISOString().split('T')[0]}"`)
           res.status(200).send(todayReturnDebt)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getDebtPurchases/:supplierID', async (req, res) => {
    const debtPurchases = await db('tbl_purchases').where('supplierID', req.params.supplierID).andWhere('paymentType', 'd').andWhere('debtStatus', '0').andWhere('stockType', 'p').select(['purchaseID']);
    const purchases = debtPurchases.map(({purchaseID}) => purchaseID);
    res.status(200).send(purchases);
});

router.get('/getDebtsList', async (req, res) => {
    const [debtsList] = await db.raw(`SELECT
    view_total_account_supplier.supplierName AS supplierName,
    view_total_account_supplier.previousBalance + view_total_account_supplier.totalPurchaseDebt - (view_total_account_supplier.totalPay + view_total_account_supplier.totalReturnPurchase + IFNULL(SUM(tbl_return_debt.amountReturn), 0)) AS totalRemainSupplier
  FROM (view_total_account_supplier
    LEFT JOIN tbl_return_debt
      ON (view_total_account_supplier.supplierID = tbl_return_debt.supplierID))
  GROUP BY view_total_account_supplier.supplierID
        ORDER BY view_total_account_supplier.supplierID DESC
    `);
    res.status(200).send(debtsList);
});

router.get('/debtSupToCust', async(req,res) => {
    try {
        const [debtSupToCust] = await db.raw(`SELECT
        view_total_remain_debt_supplier.supplierID,
        view_total_remain_debt_supplier.supplierName,
        view_total_remain_debt_supplier.totalRemainSupplier,
        IFNULL(view_total_remain_debt_customer.totalRemainCustomer, 0) AS totalRemainCustomer,
        IF((view_total_remain_debt_supplier.totalRemainSupplier - IFNULL(view_total_remain_debt_customer.totalRemainCustomer, 0)) >= 0,(view_total_remain_debt_supplier.totalRemainSupplier - IFNULL(view_total_remain_debt_customer.totalRemainCustomer, 0)), 0) AS totalRemain
      FROM view_total_remain_debt_supplier
        LEFT OUTER JOIN view_total_remain_debt_customer
          ON view_total_remain_debt_supplier.supplierName = view_total_remain_debt_customer.customerName
      ORDER BY view_total_remain_debt_supplier.supplierID`)
     res.status(200).send({
         debtSupToCust
     })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/accountStatement/:from/:to/:accountType', async(req,res) => {
    try {
        const [accountStatement] = await db.raw(`SELECT
        tbl_transactions.sourceID,
        tbl_transactions.sourceType,
        tbl_transactions.accountName,
        tbl_transactions.accountType,
        tbl_transactions.totalPrice,
        tbl_transactions.totalPay,
        tbl_transactions.transactionType,
        tbl_transactions.createAt
      FROM tbl_transactions
       where (date(tbl_transactions.createAt) between '${req.params.from}' and '${req.params.to}') 
       and tbl_transactions.accountType = '${req.params.accountType}'
       order by tbl_transactions.createAt`)

       res.status(200).send({
           accountStatement
       })
    } catch (error) {
        res.status(500).send(error)
        
    }
})

router.get('/accountStatementPartner/:from/:to', async(req,res) => {
    try {
        const [accountStatementPartner] = await db.raw(`SELECT
        tbl_transactions.sourceID,
        tbl_transactions.sourceType,
        tbl_transactions.accountName,
        tbl_transactions.accountType,
        tbl_transactions.totalPrice,
        tbl_transactions.totalPay,
        tbl_transactions.transactionType,
        tbl_transactions.createAt
        FROM tbl_suppliers
        INNER JOIN tbl_transactions
            ON tbl_suppliers.supplierName = tbl_transactions.accountName
        INNER JOIN tbl_customers
            ON tbl_customers.customerName = tbl_transactions.accountName
            where (date(tbl_transactions.createAt) between '${req.params.from}' and '${req.params.to}')
            order by tbl_transactions.createAt`)
            
        res.status(200).send({
            accountStatementPartner
        })    
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/allPartnerName', async(req,res) => {
    try {
        const [allPartnerName] = await db.raw(`SELECT
        tbl_transactions.accountName
      FROM tbl_suppliers
        INNER JOIN tbl_transactions
          ON tbl_suppliers.supplierName = tbl_transactions.accountName
        INNER JOIN tbl_customers
          ON tbl_customers.customerName = tbl_transactions.accountName
      GROUP BY tbl_transactions.accountName`)
            
            res.status(200).send(allPartnerName)
    } catch (error) {
        res.status(500).send(error)
    }
})

module.exports = router