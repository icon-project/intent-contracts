import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { SwapOrder } from './swap-order';

class SuiIntents {
    client: SuiClient;
    keypair: Ed25519Keypair;
    packageId: string;

    constructor(packageId: string, net: 'mainnet' | 'testnet' | 'devnet' | 'localnet', keypair: Ed25519Keypair) {
        const rpcUrl = getFullnodeUrl(net);
        this.keypair = keypair;
        this.client = new SuiClient({ url: rpcUrl });
        this.packageId = packageId; // Sui package ID for the deployed Move contract
    }

    private async getCoin(tx: Transaction, coin: string, amount: bigint) {
        const coins = await this.client.getCoins({
            owner: this.keypair.getPublicKey().toSuiAddress(),
            coinType: coin,
        });

        let objects: string[] = [];
        let totalAmount = BigInt(0);

        for (const coin of coins.data) {
            totalAmount += BigInt(coin.balance);
            objects.push(coin.coinObjectId);

            if (totalAmount >= amount) {
                break;
            }
        }

        if (objects.length > 1) {
            tx.mergeCoins(objects[0], objects.slice(1));
        }

        if (totalAmount === amount) {
            return objects[0];
        }

        return tx.splitCoins(objects[0], [amount]);
    }

    async createOrder(swapOrder: SwapOrder): Promise<any> {
        const tx = new Transaction();
        let coin: any;

        if (swapOrder.token === "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI") {
            coin = tx.splitCoins(tx.gas, [swapOrder.amount])[0];
        } else {
            coin = await this.getCoin(tx, swapOrder.token, swapOrder.amount);
        }

        tx.moveCall({
            target: `${this.packageId}::main::swap`,
            arguments: [
                tx.object("0x20499b147e56a123670f538c77afc2a20029643f28ce6b074183c8bfcf091d22"),
                tx.pure.string(swapOrder.dstNID),
                tx.object(coin),
                tx.pure.string(swapOrder.toToken),
                tx.pure.string(swapOrder.destinationAddress),
                tx.pure.u128(swapOrder.toAmount),
                tx.pure.vector('vector<u8>', [].slice.call(swapOrder.data)),
            ],
            typeArguments: [swapOrder.token],
        });

        const result = await this.client.signAndExecuteTransaction({ signer: this.keypair, transaction: tx });
        return result;
    }

    async fillOrder(swapOrder: SwapOrder, repayAddress: string): Promise<any> {
        const tx = new Transaction();
        let coin: any;

        if (swapOrder.toToken === "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI") {
            coin = tx.splitCoins(tx.gas, [swapOrder.toAmount])[0];
        } else {
            coin = await this.getCoin(tx, swapOrder.toToken, swapOrder.toAmount);
        }

        tx.moveCall({
            target: `${this.packageId}::main::fill`,
            arguments: [
                tx.object("0x20499b147e56a123670f538c77afc2a20029643f28ce6b074183c8bfcf091d22"),
                tx.pure.u128(swapOrder.id),
                tx.pure.string(swapOrder.emitter),
                tx.pure.string(swapOrder.srcNID),
                tx.pure.string(swapOrder.dstNID),
                tx.pure.string(swapOrder.creator),
                tx.pure.string(swapOrder.destinationAddress),
                tx.pure.string(swapOrder.token),
                tx.pure.u128(swapOrder.amount),
                tx.pure.string(swapOrder.toToken),
                tx.pure.u128(swapOrder.toAmount),
                tx.pure.vector('vector<u8>', []),
                tx.object(coin),
                tx.pure.string(repayAddress),
            ],
            typeArguments: [swapOrder.toToken, swapOrder.toToken],
        });

        const result = await this.client.signAndExecuteTransaction({ signer: this.keypair, transaction: tx });
        return result;
    }

    async getOrder(txHash: string): Promise<SwapOrder> {
        const transaction = await this.client.waitForTransaction({
            digest: txHash,
            options: {
                showEffects: false,
                showEvents: true,
            },
        });

        const order: any = transaction.events?.at(0)?.parsedJson;
        console.log(order)
        return new SwapOrder(
            BigInt(order.id),
            order.emitter,
            order.src_nid,
            order.dst_nid,
            order.creator,
            order.destination_address,
            order.token,
            BigInt(order.amount),
            order.to_token,
            BigInt(order.to_amount),
            order.data,
        );
    }
}


const packageId = "0x75ff8b82c302ab4d9358059b5a7bf423e2c3fa901e00dd6adeea9e27da0b6506"


const keypair = Ed25519Keypair.fromSecretKey("suiprivkey1qrdjntsdyuygqjsx3varvvx2hz6xkuk86zu2y255s0zw97uavl82xjul9z6");
console.log(keypair.getSecretKey())
console.log(keypair.getPublicKey().toSuiAddress())
const sui = new SuiIntents(packageId, "testnet", keypair)

const order = new SwapOrder(
    BigInt(3),
    packageId,
    'arb',
    'sui',
    keypair.getPublicKey().toSuiAddress(),
    '0x29a0918bee7a7e37d1a7d0613efc3f4455883ea217046f7db91d53e69c204589',
    '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
    BigInt(10),
    '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
    BigInt(100000),
    new Uint8Array()
)

// sui.createOrder(order)
// sui.getOrder("5UTzxFAoWJD53jh5kGuzJW1HEhdGs5ffqkxWEY9D7THx")
sui.fillOrder(order, "as")

