import Trip from '../models/Trip.js'; // Ensure this path matches your Request/Order model

export const cancelRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const clientId = req.client?._id; // Get authenticated client ID

        if (!clientId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Find the delivery request by ID and ensure it belongs to the client
        const request = await Trip.findOne({ _id: requestId, clientId });

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Validation: Ensures the request can only be cancelled if the status is still Pending
        if (request.status !== 'pending' && request.status !== 'awaiting_payment') {
            return res.status(400).json({ message: 'Request cannot be cancelled. It may have already been accepted.' });
        }

        // Updates the status to Cancelled
        request.status = 'cancelled';
        await request.save();

        // Handle Response
        res.status(200).json({ message: 'Request cancelled successfully', request });
    } catch (error) {
        console.error('Error cancelling request:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};