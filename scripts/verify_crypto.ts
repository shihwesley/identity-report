
import { createWalletIdentity, signAccessGrant, verifySignature, generateMnemonic } from '../src/lib/vault/identity';
import { AccessGrant } from '../src/lib/types';

async function testCrypto() {
    console.log('🧪 Starting Crypto Verification...');

    // 1. Generate Identity
    const mnemonic = generateMnemonic();
    console.log('1. Generated Mnemonic:', mnemonic);

    const { identity, keys } = await createWalletIdentity(mnemonic);
    console.log('2. Created Identity DID:', identity.did);
    console.log('   Public Key:', identity.publicKey);

    // 2. Create Access Grant
    const grant: Omit<AccessGrant, 'signature'> = {
        id: 'test-grant-1',
        grantee: 'Agent Smith',
        permissions: ['read_memory', 'read_identity'],
        expiresAt: Date.now() + 3600000
    };

    // 3. Sign Grant (Uses Private Key)
    console.log('3. Signing Grant...');
    const signedGrant = await signAccessGrant(grant, keys.privateKey);
    console.log('   Signature:', signedGrant.signature);

    // 4. Verify Grant (Uses Public Key)
    // Reconstruct payload as done in identity.ts
    const payload = JSON.stringify({
        id: signedGrant.id,
        grantee: signedGrant.grantee,
        permissions: signedGrant.permissions.sort(),
        expiresAt: signedGrant.expiresAt
    });

    console.log('4. Verifying Signature...');
    const isValid = await verifySignature(keys.publicKey, payload, signedGrant.signature);

    if (isValid) {
        console.log('✅ SUCCESS: Signature Verified correctly.');
    } else {
        console.error('❌ FAILURE: Signature verification failed.');
        process.exit(1);
    }

    // 5. Test Tampering
    console.log('5. Testing Tampering...');
    const tamperedPayload = payload.replace('read_memory', 'write_memory');
    const isTamperedValid = await verifySignature(keys.publicKey, tamperedPayload, signedGrant.signature);

    if (!isTamperedValid) {
        console.log('✅ SUCCESS: Tampered payload correctly rejected.');
    } else {
        console.error('❌ FAILURE: Tampered payload was accepted!');
        process.exit(1);
    }
}

testCrypto().catch(console.error);
