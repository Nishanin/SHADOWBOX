const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'shadowbox-backend'
  });
});

module.exports = router;
