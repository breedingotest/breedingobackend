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
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Create signature verification string
        const signatureString = `${razorpay_order_id}|${razorpay_payment_id}`;
        
        // Generate HMAC SHA256 signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(signatureString)
            .digest('hex');

        // Verify signature using constant-time comparison
        const isValid = crypto.timingSafeEqual(
            Buffer.from(generatedSignature),
            Buffer.from(razorpay_signature)
        );

        if (!isValid) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid signature'
            });
        }

        // Fetch payment details from Razorpay
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        
        // Verify payment status
        if (paymentDetails.status !== 'captured') {
            return res.status(400).json({
                success: false,
                error: 'Payment not captured',
                status: paymentDetails.status
            });
        }

        res.json({
            success: true,
            payment: {
                id: paymentDetails.id,
                order_id: paymentDetails.order_id,
                amount: paymentDetails.amount,
                status: paymentDetails.status
            }
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Payment verification failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
