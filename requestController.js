const Request = require('../models/Request'); // Ensure this path matches your Request/Order model

exports.cancelRequest = async (req, res) => {
    try {
        const { requestId } = req.params;

        // Find the delivery request by ID
        const request = await Request.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Validation: Ensures the request can only be cancelled if the status is still Pending
        if (request.status !== 'Pending') {
            return res.status(400).json({ message: 'Request cannot be cancelled. It may have already been accepted.' });
        }

        // Updates the status to Cancelled
        request.status = 'Cancelled';
        await request.save();

        // Handle Response
        res.status(200).json({ message: 'Request cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling request:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};