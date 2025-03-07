import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { SwapOrder } from './swap-order';

export class SuiIntents {
    client: SuiClient;
    keypair: Ed25519Keypair;
    packageId: string;
    storageId: string;

    constructor(packageId: string, storageId: string, net: 'mainnet' | 'testnet' | 'devnet' | 'localnet', keypair: Ed25519Keypair) {
        const rpcUrl = getFullnodeUrl(net);
        this.keypair = keypair;
        this.client = new SuiClient({ url: rpcUrl });
        this.packageId = packageId;
        this.storageId = storageId;
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
            coin = tx.splitCoins(tx.gas, [swapOrder.amount.valueOf()])[0];
        } else {
            coin = await this.getCoin(tx, swapOrder.token, swapOrder.amount.valueOf());
        }

        tx.moveCall({
            target: `${this.packageId}::main::swap`,
            arguments: [
                tx.object(this.storageId),
                tx.pure.string(swapOrder.dstNID),
                tx.object(coin),
                tx.pure.string(swapOrder.toToken),
                tx.pure.string(swapOrder.destinationAddress),
                tx.pure.u128(swapOrder.toAmount.valueOf()),
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
            coin = tx.splitCoins(tx.gas, [swapOrder.toAmount.valueOf()])[0];
        } else {
            coin = await this.getCoin(tx, swapOrder.toToken, swapOrder.toAmount.valueOf());
        }
        // tx.setGasBudget(100000000)

        tx.moveCall({
            target: `${this.packageId}::main::fill`,
            arguments: [
                tx.object(this.storageId),
                tx.pure.u128(swapOrder.id.valueOf()),
                tx.pure.string(swapOrder.emitter),
                tx.pure.string(swapOrder.srcNID),
                tx.pure.string(swapOrder.dstNID),
                tx.pure.string(swapOrder.creator),
                tx.pure.string(swapOrder.destinationAddress),
                tx.pure.string(swapOrder.token),
                tx.pure.u128(swapOrder.amount.valueOf()),
                tx.pure.string(swapOrder.toToken),
                tx.pure.u128(swapOrder.toAmount.valueOf()),
                tx.pure.vector('vector<u8>', [].slice.call(swapOrder.data)),
                tx.object(coin),
                tx.pure.string(repayAddress),
            ],
            typeArguments: [swapOrder.toToken, swapOrder.toToken],
        });

        const result = await this.client.signAndExecuteTransaction({ signer: this.keypair, transaction: tx });

        return result;
    }

    async getBalance(token: string , address: string ): Promise<BigInt> {
        const coins = await this.client.getCoins({
            owner: address,
            coinType: token,
        });

        var sum = BigInt(0);
        for (const coin of coins.data) {
            sum += BigInt(coin.balance);
        }

        return sum
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

