import { VercelRequest, VercelResponse } from '@vercel/node';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

interface RazorpayWebhookResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    error?: any;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const response = req.body as RazorpayWebhookResponse;
        console.log('Received payment verification request:', response);

        // Check if there's an error in the response
        if (response.error) {
            console.error('Error in payment response:', response.error);
            return res.status(400).json({
                success: false,
                error: 'Payment failed',
                details: response.error
            });
        }

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = response;

        // Validate required fields with detailed errors
        if (!razorpay_order_id) {
            console.error('Missing order ID in response');
            return res.status(400).json({
                success: false,
                error: 'Missing order ID',
                received: response
            });
        }

        if (!razorpay_payment_id) {
            console.error('Missing payment ID in response');
            return res.status(400).json({
                success: false,
                error: 'Missing payment ID',
                received: response
            });
        }

        if (!razorpay_signature) {
            console.error('Missing signature in response');
            return res.status(400).json({
                success: false,
                error: 'Missing signature',
                received: response
            });
        }

        // Fetch order details first to verify amount
        console.log('Fetching order details for:', razorpay_order_id);
        const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
        console.log('Order details:', orderDetails);

        // Create signature verification string
        const signatureString = `${razorpay_order_id}|${razorpay_payment_id}`;
        console.log('Signature string:', signatureString);

        // Generate HMAC SHA256 signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(signatureString)
            .digest('hex');

        console.log('Generated signature:', generatedSignature);
        console.log('Received signature:', razorpay_signature);

        // Verify signature using constant-time comparison
        const isValid = crypto.timingSafeEqual(
            Buffer.from(generatedSignature),
            Buffer.from(razorpay_signature)
        );

        if (!isValid) {
            console.error('Signature verification failed');
            return res.status(400).json({ 
                success: false,
                error: 'Invalid signature',
                debug: {
                    orderDetails: {
                        id: orderDetails.id,
                        amount: orderDetails.amount,
                        status: orderDetails.status
                    },
                    signatureString,
                    generatedSignature,
                    receivedSignature: razorpay_signature
                }
            });
        }

        // Fetch payment details from Razorpay
        console.log('Fetching payment details for:', razorpay_payment_id);
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        console.log('Payment details:', paymentDetails);

        // Verify payment status and amount
        if (paymentDetails.status !== 'captured') {
            console.error('Payment not captured:', paymentDetails.status);
            return res.status(400).json({
                success: false,
                error: 'Payment not captured',
                status: paymentDetails.status,
                details: {
                    orderId: orderDetails.id,
                    orderAmount: orderDetails.amount,
                    paymentId: paymentDetails.id,
                    paymentAmount: paymentDetails.amount,
                    paymentStatus: paymentDetails.status
                }
            });
        }

        // Verify payment amount matches order amount
        if (paymentDetails.amount !== orderDetails.amount) {
            console.error('Payment amount mismatch:', {
                orderAmount: orderDetails.amount,
                paymentAmount: paymentDetails.amount
            });
            return res.status(400).json({
                success: false,
                error: 'Payment amount mismatch',
                details: {
                    orderAmount: orderDetails.amount,
                    paymentAmount: paymentDetails.amount
                }
            });
        }

        // All verifications passed, send success response
        res.json({
            success: true,
            order: {
                id: orderDetails.id,
                amount: orderDetails.amount,
                currency: orderDetails.currency,
                receipt: orderDetails.receipt
            },
            payment: {
                id: paymentDetails.id,
                amount: paymentDetails.amount,
                currency: paymentDetails.currency,
                status: paymentDetails.status,
                method: paymentDetails.method,
                created_at: new Date(paymentDetails.created_at * 1000).toISOString(),
                captured: true
            }
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Payment verification failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
}
