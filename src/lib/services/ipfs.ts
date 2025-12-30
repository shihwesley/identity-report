import { logger } from '../logger';

export interface StorageProvider {
    upload(data: Blob, name: string): Promise<string>;
    getGatewayUrl(cid: string): string;
}

export class PinataService implements StorageProvider {
    private apiKey: string;
    private apiSecret: string | undefined;
    private jwt: string | undefined;

    constructor(config: { apiKey?: string; apiSecret?: string; jwt?: string }) {
        this.apiKey = config.apiKey || '';
        this.apiSecret = config.apiSecret || '';
        this.jwt = config.jwt || '';

        if (!this.jwt && (!this.apiKey || !this.apiSecret)) {
            logger.warn('PinataService initialized without credentials. Uploads will fail.');
        }
    }

    /**
     * Upload a file/blob to Pinata IPFS
     */
    async upload(data: Blob, name: string): Promise<string> {
        const formData = new FormData();
        formData.append('file', data, name);

        const metadata = JSON.stringify({
            name: name,
            keyvalues: {
                app: 'profile-vault',
                timestamp: Date.now()
            }
        });
        formData.append('pinataMetadata', metadata);

        const options = JSON.stringify({
            cidVersion: 1
        });
        formData.append('pinataOptions', options);

        const headers: Record<string, string> = {};

        if (this.jwt) {
            headers['Authorization'] = `Bearer ${this.jwt}`;
        } else {
            headers['pinata_api_key'] = this.apiKey;
            headers['pinata_secret_api_key'] = this.apiSecret!;
        }

        try {
            const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                method: 'POST',
                headers: headers,
                body: formData
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(`Pinata upload failed: ${error.error || res.statusText}`);
            }

            const json = await res.json();
            logger.info('IPFS upload successful', { name, cid: json.IpfsHash });
            return json.IpfsHash;
        } catch (error) {
            logger.error('IPFS upload error', { name, error: (error as Error).message });
            throw error;
        }
    }

    getGatewayUrl(cid: string): string {
        return `https://gateway.pinata.cloud/ipfs/${cid}`;
    }
}
