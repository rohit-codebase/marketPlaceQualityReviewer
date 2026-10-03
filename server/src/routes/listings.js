const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/listingController');

router.get('/dashboard', ctrl.getDashboard);
router.post('/', ctrl.createListing);
router.get('/', ctrl.getListings);
router.get('/:id', ctrl.getListingById);
router.put('/:id', ctrl.updateListing);

module.exports = router;
