var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var secret = require('../secret.json')

const Datastore = require('@google-cloud/datastore');
const datastore = Datastore();

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// called everytime user_controller is called
router.use(function timeLog (req, res, next) {
  console.log('In Activate Controller @ Time: ', Date.now());
  next();
});

router.route('/:token')
	
	.get(function(req, res){
		console.log(req.params.token);
	});