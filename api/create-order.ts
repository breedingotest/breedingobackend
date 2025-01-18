import { VercelRequest, VercelResponse } from '@vercel/node';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

interface OrderRequest {
    amount: number;
    currency?: string;
    receipt?: string;
    notes?: {
        userEmail?: string;
        userName?: string;
        userPhone?: string;
    };
}

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
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed' 
        });
    }

    try {
        console.log('Received order creation request:', req.body);
        
        const { amount, currency = 'INR', receipt, notes } = req.body as OrderRequest;
        
        // Validate amount
        if (!amount || amount < 1) {
            console.error('Invalid amount:', amount);
            return res.status(400).json({
                success: false,
                error: 'Invalid amount. Amount must be greater than 0'
            });
        }

        const options = {
            amount: amount * 100, // Convert to paise
            currency,
            receipt: receipt || `order_rcpt_${Date.now()}`,
            notes: {
                ...notes,
                created_at: new Date().toISOString()
            },
            payment_capture: 1 // Auto capture payment
        };

        console.log('Creating order with options:', options);

        const order = await razorpay.orders.create(options);
        
        console.log('Order created:', order);

        // Return both order details and key_id for the frontend
        res.json({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
                receipt: order.receipt,
                status: order.status
            },
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create order',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
}
