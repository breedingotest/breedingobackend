import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Set content type to JSON with proper formatting
    res.setHeader('Content-Type', 'application/json');

    const response = {
        status: 'healthy',
        message: 'Breedingo Razorpay API is running',
        version: '1.0.0',
        documentation: {
            description: 'Razorpay payment integration API',
            endpoints: {
                createOrder: {
                    path: '/api/create-order',
                    method: 'POST',
                    description: 'Create a new Razorpay order',
                    body: {
                        amount: 'number (required) - Amount in INR',
                        currency: 'string (optional) - Currency code, defaults to INR'
                    }
                },
                verifyPayment: {
                    path: '/api/verify-payment',
                    method: 'POST',
                    description: 'Verify a Razorpay payment',
                    body: {
                        razorpay_order_id: 'string (required)',
                        razorpay_payment_id: 'string (required)',
                        razorpay_signature: 'string (required)'
                    }
                }
            }
        },
        timestamp: new Date().toISOString()
    };

    // Send response with 2-space indentation for pretty printing
    res.status(200).send(JSON.stringify(response, null, 2));
}
