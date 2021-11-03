const db = require('../DB/dbConfig.js')
const express = require('express')
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const checkAuth = require('../checkAuth.js');

const router = express.Router()
//roles Router

router.post('/addRole', checkAuth, async(req,res) => {
    try {
       const [addRole] =  await db('tbl_roles').insert({
        roleName: req.body.roleName
       })

       for(var subRole of req.body.subRoles){
        await db('tbl_sub_role').insert({
            roleID: addRole,
            subRoleName: subRole
        })
       }
       res.status(201).send({
        roleID: addRole
       })
    } catch (error) {
        if(error.errno == 1062) {
            return res.status(500).send({
                message: 'This Role already exist'
            });
        }
    }
})

router.patch('/updateRole/:roleID', checkAuth, async(req,res) => {
    try {
        await db('tbl_roles').where('roleID', req.params.roleID).update({ roleName: req.body.roleName });
        await db('tbl_sub_role').where('roleID', req.params.roleID).delete();
        for(var subRole of req.body.subRoles){
            await db('tbl_sub_role').insert({
                roleID: req.params.roleID,
                subRoleName: subRole
            })
        }
        res.sendStatus(200);
    } catch (error) {
        console.log(error);
        res.status(500).send(error)
    }
})

router.delete('/deleteRole/:roleID', checkAuth, async (req, res) => {
    await db('tbl_sub_role').where('roleID', req.params.roleID).delete();
    await db('tbl_roles').where('roleID', req.params.roleID).delete();
    res.sendStatus(200);
});

router.patch('/updateSubRole/:subRoleID', async(req,res) => {
    try {
        await db('tbl_sub_role').where('subRoleID', req.params.subRoleID).update({
            subRoleName: req.body.subRoleName
        })
         res.status(200).send()
    } catch (error) {
        res.status(500).send(error)
    }
})

router.delete('/deleteSubRole/:subRoleID', checkAuth, async(req,res) => {
    try {
        await db('tbl_sub_role').where('subRoleID', req.params.subRoleID).delete()
         res.status(200).send()
    } catch (error) {
        
    }
})

router.get('/allRole',  checkAuth, async (req, res) => {
    const roles = await db('tbl_roles').select().orderBy('roleID', 'desc');
    res.status(200).send(roles);
});

router.get('/subRoles/:roleID',  checkAuth, async (req, res) => {
    const subRoles = await db('tbl_sub_role').where('roleID', req.params.roleID).select('subRoleName');
    const arr = subRoles.map(({subRoleName}) => subRoleName);
    res.status(200).send(arr);
});

//users Router

const fileStorage = multer.diskStorage({
    destination: './Images/Users',
    filename: (req, file, cb) => {
        cb(null, new Date().getTime() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: fileStorage,
    fileFilter: (req, file, cb) => {
        if(['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(null, false);
            cb(new Error('Invalid file type'));
        }
    }
}).single('userImage');

router.post('/addUser', checkAuth, (req,res) => {
    try {
        upload(req, res, async (err) => {
            if(!err) {
                const [userID] = await db('tbl_users').insert({
                    fullName: req.body.fullName,
                    userName: req.body.userName,
                    userPassword: bcrypt.hashSync(req.body.userPassword, 12),
                    email: req.body.email || null,
                    image: req.file ? req.file.filename : null,
                    roleID: req.body.roleID,
                    activeStatus: '1'
                })
                return res.status(201).send({
                    userID,
                    image: req.file ? req.file.filename : null
                })
            }
            return res.status(500).send({
                message: 'Invalid file type'
            });
        })
    } catch (error) {
        console.log(error);
        if(error.errno == 1062) {
            return res.status(500).send({
                message: 'This username already exist'
            });
        }
    }
})

router.patch('/updateUser/:userID', checkAuth, async(req,res) => {
    try {
        await db('tbl_users').where('userID', req.params.userID).update({
            fullName: req.body.fullName,
            userName: req.body.userName,
            email: req.body.email,
            roleID: req.body.roleID
        })
        res.sendStatus(200)
    } catch (error) {
        if(error.errno == 1062) {
            return res.status(500).send({
                message: 'This username already exist'
            });
        }        
    }
})

router.patch('/updatePassword/:userID', checkAuth, async(req,res) => {
    try {
        await db('tbl_users').where('userID', req.params.userID).update({
            userPassword: bcrypt.hashSync(req.body.userPassword, 12),
        })
        res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/updateImage/:userID', checkAuth, (req, res) => {
    upload(req, res, async (err) => {
        if(!err && req.file) {
            const [{oldImage}] = await db('tbl_users').where('userID', req.params.userID).select(['image as oldImage']);
            await db('tbl_users').where('userID', req.params.userID).update({
                image: req.file.filename
            });
            if(oldImage) {
                fs.unlinkSync('./Images/Users/' + oldImage);
            }
            res.status(200).send({
                image: req.file.filename
            });
        }
    })
})

router.delete('/deleteImage/:userID', checkAuth, async (req, res) => {
    try {
        const [{image}] = await db('tbl_users').where('userID', req.params.userID).select(['image']);
        await db('tbl_users').where('userID', req.params.userID).update({ image: null });
        fs.unlinkSync('./Images/Users/' + image);
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/deactiveUser/:userID', checkAuth, async(req,res) => {
    try {
        const [{noOfActives}] = await db('tbl_users').where('activeStatus', '1').count('* as noOfActives');
        if(noOfActives == 1) {
            return res.sendStatus(500);
        }
        await db('tbl_users').where('userID', req.params.userID).update({
            activeStatus: '0'
        })
        return res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.patch('/activeUser/:userID', checkAuth, async(req,res) => {
    try {
        await db('tbl_users').where('userID', req.params.userID).update({
            activeStatus: '1'
        })
        res.sendStatus(200)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/allUser', async(req,res) => {
    try {
        const [allUser] = await db.raw(`SELECT
        tbl_users.userID,
        tbl_users.fullName,
        tbl_users.userName,
        tbl_users.email,
        tbl_roles.roleName,
        tbl_users.roleID,
        tbl_users.image,
        tbl_users.activeStatus
      FROM tbl_users
        INNER JOIN tbl_roles
          ON tbl_users.roleID = tbl_roles.roleID
        WHERE tbl_users.activeStatus = '1'`)
           res.status(200).send(allUser)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/countAllUsers', checkAuth, async (req, res) => {
    const [{numberOfUsers}] = await db('tbl_users').where('activeStatus', '1').count('* as numberOfUsers');
    res.status(200).send({
        numberOfUsers
    });
});

router.get('/getSingleUser/:userID', checkAuth, async(req,res) => {
    try {
        const [getSingleUser] = await db.raw(`SELECT
        tbl_users.userID,
        tbl_users.fullName,
        tbl_users.userName,
        tbl_roles.roleName,
        tbl_users.email,
        tbl_users.activeStatus,
        tbl_users.createAt
      FROM tbl_users
        INNER JOIN tbl_roles
          ON tbl_users.roleID = tbl_roles.roleID
          where tbl_users.userID = ${req.params.userID}`) 
            res.status(200).send(getSingleUser)
    } catch (error) {
        res.status(500).send(error)
    }
})

router.get('/image/:name', (req, res) => {
    res.sendFile(path.join(__dirname, '../Images/Users/' + req.params.name));
});

module.exports = router