import { PublicKey } from '@solana/web3.js';
import { encodeURL } from '@solana/pay';
import BigNumber from 'bignumber.js';

// USDC SPL Token mint address on Solana Devnet (for testing)
const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Test address from user request
const testAddress = '41Jw4SWMio5tfuqLWhe8QDHaUMoAEZnMV1PaBikrpBko';
const amount = 5;

try {
    const recipient = new PublicKey(testAddress);

    const url = encodeURL({
        recipient,
        amount: new BigNumber(amount),
        splToken: USDC_DEVNET_MINT,
        label: 'STAC Test Payment',
        message: `Test payment of ${amount} USDC`,
        memo: `STAC-TEST-${Date.now()}`,
    });

    console.log('✅ Solana Pay Link Generated!\n');
    console.log(`💰 Amount: ${amount} USDC (devnet)`);
    console.log(`📍 Recipient: ${testAddress}\n`);
    console.log(`🔗 Payment Link:`);
    console.log(url.toString());
    console.log('\nYou can use this link in Phantom, Solflare, or any Solana Pay compatible wallet!');

} catch (err) {
    console.error('Error creating payment link:', err);
}
