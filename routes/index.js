const express = require('express');

module.exports = function createApiRouters(deps) {
  const router = express.Router();

  router.use(require('./health')(deps));
  router.use(require('./auth')(deps));
  router.use(require('./departments')(deps));
  router.use(require('./staff')(deps));
  router.use(require('./admin')(deps));
  router.use(require('./notifications')(deps));
  router.use(require('./queue')(deps));
  router.use(require('./shifts')(deps));
  router.use(require('./oncall')(deps));
  router.use(require('./analytics')(deps));
  router.use(require('./settings')(deps));
  router.use(require('./users')(deps));

  return router;
};
