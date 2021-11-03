const db = require('../DB/dbConfig.js')
const express = require('express')
const router = express.Router()

// Dollar routes
router.get('/getDollarPrice', async (req, res) => {
    const [{dollarPrice}] = await db('tbl_dollar').where('dollarId', 1).select(['dollarPrice']);
    res.status(200).send({
        dollarPrice
    });
});

router.patch('/updateDollar', async (req, res) => {
    try {
        await db('tbl_dollar').update({
            dollarPrice: req.body.dollarPrice || 0
        });
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error);
    }
});

// categories routers
router.post('/addCategory', async(req,res) => {
   try {
    const [categoryID] = await db('tbl_categories').insert({
        categoryName : req.body.categoryName
    })
     res.status(201).send({
         categoryID
     })
   } catch (error) {
       res.status(500).send(error)
   } 
})

router.patch('/updateCategory/:categoryID', async(req,res) => {
    try {
       await db('tbl_categories').where('categoryID',req.params.categoryID).update({
            categoryName : req.body.categoryName
        })
        res.status(200).send()
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deleteCategory/:categoryID', async(req,res) => {
    try {
        await db('tbl_categories').where('categoryID',req.params.categoryID).del()
         res.status(200).send()
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getCategories', async(req,res) => {
    try {
        const getCategories = await db('tbl_categories').select('*')
         res.status(200).send(getCategories)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getLimitedCategories/:offset', async(req,res) => {
    try {
        const getCategories = await db('tbl_categories').select('*').orderBy('categoryID', 'desc').offset(req.params.offset).limit(6)
        res.status(200).send(getCategories)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/numberOfCategories', async (req, res) => {
    const [{numberOfCategories}] = await db('tbl_categories').count('* as numberOfCategories');
    res.status(200).send({
        numberOfCategories
    })
});

// brands routers

router.post('/addBrand', async(req,res) => {
    try {
        const [brandID] = await db('tbl_brands').insert({
            brandName: req.body.brandName
        })
         res.status(201).send({
             brandID
         })
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/updateBrand/:brandID', async(req,res) => {
    try {
        await db('tbl_brands').where('brandID',req.params.brandID).update({
            brandName: req.body.brandName
        })
         res.status(200).send()
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deleteBrand/:brandID', async(req,res) => {
    try {
        await db('tbl_brands').where('brandID',req.params.brandID).del()
         res.status(200).send()
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getBrands', async(req,res) => {
    try {
        const getBrands = await db('tbl_brands').select('*')
         res.status(200).send(getBrands)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getLimitedBrands/:offset', async(req,res) => {
    try {
        const getBrands = await db('tbl_brands').select('*').orderBy('brandID', 'desc').offset(req.params.offset).limit(6)
        res.status(200).send(getBrands)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/numberOfBrands', async (req, res) => {
    const [{numberOfBrands}] = await db('tbl_brands').count('* as numberOfBrands');
    res.status(200).send({
        numberOfBrands
    });
});

// shelfs Routers

router.post('/addShelf', async(req,res) => {
    try {
       const [shelfID] =  await db('tbl_shelfs').insert({
            shelfName: req.body.shelfName
        })
         res.status(201).send({
             shelfID
         })
    } catch (error) {
        res.status(500).send()
    }
})

router.patch('/updateShelf/:shelfID', async(req,res) => {
    try {
        await db('tbl_shelfs').where('shelfID',req.params.shelfID).update({
            shelfName: req.body.shelfName
        })
         res.status(200).send()
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deleteShelf/:shelfID', async(req,res) => {
    try {
        await db('tbl_shelfs').where('shelfID',req.params.shelfID).del()
         res.status(200).send()
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getShelfs', async(req,res) => {
    try {
        const getShelfs = await db('tbl_shelfs').select('*')
         res.status(200).send(getShelfs)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getOwner', async(req,res) => {
    try {
        const getShelfs = await db('tbl_shelfs').select('*')
         res.status(200).send(getShelfs)
    } catch (error) {
        res.status(500).send(error)
    }
})

// units Routers

router.post('/addUnit', async(req,res) => {
    try {
       const [unitID] = await db('tbl_units').insert({
            unitName: req.body.unitName,
            shortName: req.body.shortName
        })
         res.status(201).send({
            unitID
         })
    } catch (error) {
        res.status(500).send()
    }
})

router.patch('/updateUnit/:unitID', async(req,res) => {
    try {
        await db('tbl_units').where('unitID',req.params.unitID).update({
            unitName: req.body.unitName,
            shortName: req.body.shortName
        })
         res.status(200).send()
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deleteUnit/:unitID', async(req,res) => {
    try {
        await db('tbl_units').where('unitID',req.params.unitID).del()
         res.status(200).send()
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/getUnits', async(req,res) => {
    try {
        const getUnits = await db('tbl_units').select('*')
         res.status(200).send(getUnits)
    } catch (error) {
        res.status(500).send(error)
    }
})

module.exports = router