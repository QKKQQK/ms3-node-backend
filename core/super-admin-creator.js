const secret = require('../secret/secret.json');
const crypto = require('crypto');

const permissions = require('../core/permissions');
const logger = require('./logger');
const Datastore = require('@google-cloud/datastore');
const datastore = Datastore();

module.exports = (function () {
    'use strict';

    const ENTITY_KEY = 'Employee_Dev';
    const FLAG = '--su';

    function run() {
        const flagIndex = process.argv.indexOf(FLAG);
        if (flagSet(flagIndex) && hasArg(flagIndex)) {
            const email = process.argv[flagIndex + 1];
            const password = process.argv[flagIndex + 2];

            createSuperAdmin(email, password);
        }
    }

    function flagSet(index) {

        return index > 0;
    }

    function hasArg(flagIndex) {

        return flagIndex < process.argv.length - 2;
    }

    function createSuperAdmin(email, password) {
        const query = datastore.createQuery(ENTITY_KEY).filter('email', '=', email);
        datastore.runQuery(query, function (error, entities) {
            if (!entities || entities.length === 0) {

                datastore.save({
                    key: datastore.key([ENTITY_KEY]),
                    excludeFromIndexes: ['phone', 'password_hash'],
                    data: {
                        email: email,
                        phone: '',
                        active: true,
                        role: permissions.ROLES.SUPER_ADMIN,
                        password_hash: crypto.createHmac('sha256', secret.password_secret)
                            .update(password)
                            .digest('hex')
                    }
                })
                    .then(() => logger.info(`SuperAdmin ${email} Created`))
                    .catch((error) => logger.info(error));
            } else {
                logger.info(`SuperAdmin ${email} Already Exists`);
            }
        });
    }

    run();
});



