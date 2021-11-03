const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports =  function(req, res, next) {
    try {
        const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.KEY);
        next();
    } catch (error) {
        res.status(401).send({
            message: 'Unauthorized'
        });
    }
}