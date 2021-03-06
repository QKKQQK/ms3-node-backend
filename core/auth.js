function authMiddleware(datastore, errorResponse, secret, jwt, CONFIG) {
    'use strict';

    const SignInForm = require('./sign-in-form');

    const TOKEN_EXPIRY = CONFIG.TOKEN_CONFIG.DEFAULT_EXPIRY;
    const ENTITY_KEY = CONFIG.ENTITY_KEYS.TOKEN_BLACKLIST;

    return {
        validateForm: validateForm,
        authEmployee: authEmployee,
        checkAuth: checkAuth,
        checkInactiveToken: checkInactiveToken,
        deactivateToken: deactivateToken,
        passwordChangeDeactivateToken: passwordChangeDeactivateToken,
        generateAuthToken: generateAuthToken
    };

    function validateForm(req, res, next) {
        let form = new SignInForm(req.body);
        if (form.isValid()) {
            next();
        } else {
            res.status(400).json({message: 'Malformed Request'});
        }
    }

    function authEmployee(req, res, next) {
        try {
            const user = res.locals.userData;
            const userId = res.locals.userKey.id;

            const token = jwt.sign({
                data: {
                    id: userId,
                    email: user.email,
                    type: user.role
                }
            }, secret.token_secret, {expiresIn: TOKEN_EXPIRY});

            res.status(200).json({
                token: token,
                user: {
                    id: userId,
                    email: user.email,
                    phone: user.phone
                }
            });
        } catch (error) {

            errorResponse.send(res, 500, 'Internal Server Error', error);
        }
    }

    function checkAuth(req, res, next) {
        const token = req.get('token');

        try {
            res.locals.token = token;
            res.locals.decoded = decodeToken(token);

            /* Got to check if account still exists & active */
            let ACCOUNT_ENTITY_KEY;
            switch (res.locals.decoded.data.type) {
                case CONFIG.ROLES.USER: {
                    ACCOUNT_ENTITY_KEY = CONFIG.ENTITY_KEYS.USERS;
                    break;
                }
                case CONFIG.ROLES.EMPLOYEE:
                case CONFIG.ROLES.SUPER_ADMIN: {
                    ACCOUNT_ENTITY_KEY = CONFIG.ENTITY_KEYS.EMPLOYEES;
                }
            }

            const query = datastore.createQuery(ACCOUNT_ENTITY_KEY)
                .filter('email', '=', res.locals.decoded.data.email)
                .filter('active', '=', true);

            datastore.runQuery(query)
                .then((response) => {
                    const entities = response[0];
                    if (entities.length === 0) {
                        errorResponse.send(res, 401, 'Invalid Token');
                    } else {
                        res.locals.tokenUser = entities[0];
                        next();
                    }
                })
                .catch((error) => {
                    errorResponse.send(res, 401, 'Invalid Token', error);
                });

        } catch (error) {

            errorResponse.send(res, 401, 'Invalid Token', error);
        }
    }

    function decodeToken(token) {
        const decoded = jwt.verify(token, secret.token_secret);
        if (decoded.data.id === undefined || decoded.data.email === undefined || decoded.data.type === undefined) {

            throw new Error('Missing JWT Payload Property');
        } else {

            return decoded;
        }
    }

    function checkInactiveToken(req, res, next) {
        const query = datastore.createQuery(ENTITY_KEY).filter('token', '=', res.locals.token);

        datastore.runQuery(query, function (error, entities) {
            if (error) {

                errorResponse.send(res, 500, 'Internal Server Error', error);
            } else if (entities.length === 0) {

                res.locals.tokenKey = datastore.key([ENTITY_KEY]);
                res.locals.tokenData = {
                    token: res.locals.token,
                    exp: res.locals.decoded.exp
                };

                next();
            } else {

                errorResponse.send(res, 204, undefined, 'Token Already Blacklisted');
            }
        });
    }

    function deactivateToken(req, res) {
        datastore.save({
            key: res.locals.tokenKey,
            data: res.locals.tokenData
        })
            .then(() => {
                res.status(204).send();
            })
            .catch((error) => {
                console.error(error);
                res.status(204).send();
            });
    }

    function passwordChangeDeactivateToken(req, res, next) {
        datastore.save({
            key: res.locals.tokenKey,
            data: res.locals.tokenData
        })
            .then(() => {
                next();
            })
            .catch((error) => {
                errorResponse.send(res, 500, 'Internal Server Error', error);
            });
    }

    function generateAuthToken(req, res, next) {
        try {
            var auth_token = jwt.sign({
                data: {
                    id : res.locals.userKey.id || res.locals.userKey.name,
                    email : res.locals.userData.email,
                    type : 'user'
                }
            }, secret.token_secret, { expiresIn: '14d' });
            res.locals.auth_token = auth_token;
            next();
        } catch (err) {
            console.error(err);
            res.status(500);
            res.json({ message: "Internal Server Error" });
        }
    }
}

module.exports = authMiddleware;
