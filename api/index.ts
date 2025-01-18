import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.status(200).json({
        status: 'healthy',
        message: 'Breedingo Razorpay API is running',
        endpoints: {
            createOrder: '/api/create-order',
            verifyPayment: '/api/verify-payment'
        }
    });
}
