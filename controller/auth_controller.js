var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var secret = require('../secret/secret.json')
var jwt = require('jsonwebtoken');
var crypto = require('crypto');

const Datastore = require('@google-cloud/datastore');
const datastore = Datastore();

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.use(function timeLog (req, res, next) {
  console.log('In Auth Controller @ Time: ', Date.now());
  next();
});

router.route('/')

		.post(function(req, res, next){
			if (req.body.email === undefined || req.body.password === undefined){ 
				res.status(400);
				res.json({ message: "Malformed Request" });
			} else {
				next();
			}
		}, function(req, res, next) {
			try {
				const query = datastore.createQuery('User_V1').filter('email', '=', req.body.email);
				datastore.runQuery(query, function(err, entities) {
					if (err) {
						console.error(err);
						res.status(500);
						res.json({ message: "Internal Server Error" });
					} else {
						try {
	                    	var password_hash = crypto.createHmac('sha256', secret.password_secret)
								.update(req.body.password)
								.digest('hex');
							if (entities.length == 0) {
				                res.status(401);
				                res.json({ message: "Invalid Email/Password Combo" });
				            } else {
				                var user_data = entities[0];
				                var user_key = entities[0][datastore.KEY];
				                if (user_data.active === false){
				                    res.status(403);
				                    res.json({ message: "Inactive account" });
				                } else if (user_data.password_hash !== password_hash){
				                    res.status(401);
				                    res.json({ message: "Invalid Email/Password Combo" });
				                } else {
				                	res.locals.id = user_key.id;
				                	delete user_data["password_hash"];
									delete user_data["stripe_id"];
									res.locals.user_data = user_data;
				                    next();	
				                }
				            }
						} catch (err){
							console.error(err);
							res.status(500);
							res.json({ message: "Internal Server Error" });
						}
					}
				});
			} catch (err){
				console.error("Create Query Error");
				res.status(500);
				res.json({ message: "Internal Server Error" });
			}
		}, function(req, res){
			try {
				var token = jwt.sign({
					data: {
						id : res.locals.id,
						email : res.locals.user_data.email,
						type : 'user'
					}
				}, secret.token_secret, { expiresIn: '14d' });

				res.status(200);
				res.json({
					token: token,
					data: res.locals.user_data
				});
			} catch (err) {
				console.error(err);
				res.status(500);
				res.json({ message: "Internal Server Error" });
			}
		})

		.delete(function(req, res, next){
				try {
					var token = req.get('token')
					var decoded = jwt.verify(token, secret.token_secret);
					res.locals.token = token;
					res.locals.decoded = decoded;
					next();
				} catch (err) {
					console.error("Invalid Token");
					res.status(204).send();
				}
		}, function(req, res){
				try {
					const query = datastore.createQuery('Token_Blacklist_V1').filter('token', '=', res.locals.token);
					datastore.runQuery(query, function(err, entities) {
						if (err) {
							console.error("Run Query Error");
						} else {
							if (entities.length == 0) {
				                var key = datastore.key(['Token_Blacklist_V1']);
								var data = {
									token : res.locals.token,
									exp : res.locals.decoded.exp
								};
								datastore.save({
									key: key,
									data: data
								}, function(err) {
									if (err) {
										console.error(err);
									} else{
										console.log("Token blacklisted");
									}
								});
			                } else {
			                	console.error("Token already blacklisted");
		                    }
						}
					});
				} catch (err) {
					console.error("Create Query Error");
				}
				res.status(204).send();
		});


module.exports = router;
