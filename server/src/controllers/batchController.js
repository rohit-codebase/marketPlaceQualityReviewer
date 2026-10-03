const batchService = require('../services/batchService');

async function startBatch(req, res, next) {
  try {
    const { listingIds } = req.body;
    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return res.status(400).json({ success: false, error: 'listingIds must be a non-empty array' });
    }
    if (listingIds.length > 20) {
      return res.status(400).json({ success: false, error: 'Batch size is limited to 20 listings' });
    }
    const result = await batchService.startBatch(listingIds);
    res.status(202).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getBatchStatus(req, res, next) {
  try {
    const batch = await batchService.getBatchStatus(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    res.json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

module.exports = { startBatch, getBatchStatus };
