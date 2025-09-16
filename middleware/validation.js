const { validationResult } = require('express-validator');

// Wrap express-validator rules and return a terminal error handler.
module.exports = function validate(rules) {
  return [
    ...(rules || []),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: errors.array().map(e => ({ field: e.param, message: e.msg }))
        });
      }
      next();
    }
  ];
};

