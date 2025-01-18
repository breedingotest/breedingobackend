import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Types
interface OrderRequest {
    amount: number;
    currency?: string;
}

interface PaymentVerificationRequest {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

interface RazorpayOrder {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy' });
});

// Create order endpoint
app.post('/api/create-order', async (req: Request<{}, {}, OrderRequest>, res: Response) => {
    try {
        const { amount, currency = 'INR' } = req.body;
        
        // Validate amount
        if (!amount || amount < 1) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount. Amount must be greater than 0'
            });
        }

        const options = {
            amount: amount * 100, // amount in paise
            currency,
            receipt: `order_rcpt_${Date.now()}`,
            payment_capture: 1 // Auto capture payment
        };

        const order = await razorpay.orders.create(options);
        
        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create order',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Verify payment endpoint
app.post('/api/verify-payment', async (req: Request<{}, {}, PaymentVerificationRequest>, res: Response) => {
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
});

// Handle 404
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// Start server if not running in Vercel
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export for Vercel
export default app;
