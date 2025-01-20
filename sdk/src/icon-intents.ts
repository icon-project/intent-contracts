import IconService, { SignedTransaction } from 'icon-sdk-js';
import { SwapOrder } from './swap-order';
import { TokenFallbackData } from './token-fallback-data';

const { IconBuilder, IconConverter, IconAmount } = IconService;
const { CallBuilder, CallTransactionBuilder } = IconBuilder;

export class IconIntents {
    private iconService: IconService;
    private address: string;
    private wallet: any; // Replace with proper Icon wallet type

    constructor(address: string, iconService: IconService, wallet: any) {
        this.address = address;
        this.iconService = iconService;
        this.wallet = wallet;
    }

    async submitOrder(swapOrder: SwapOrder): Promise<any> {
        const fallbackData = TokenFallbackData.forSwap(swapOrder.toICONBytes());
        var value = 0;
        if (swapOrder.token === "cx3975b43d260fb8ec802cef6e60c2f4d07486f11d") {
            value = Number(swapOrder.amount);
        }

        const transaction = new CallTransactionBuilder()
            .from(this.wallet.getAddress())
            .to(swapOrder.token)
            .method("transfer")
            .stepLimit(IconConverter.toBigNumber("2000000"))
            .params({
                _to: this.address,
                _value: IconConverter.toHex(Number(swapOrder.amount)),
                _data: fallbackData.toHex()
            })
            .nid("1")
            .nonce(IconConverter.toBigNumber("1"))
            .version(IconConverter.toBigNumber("3"))
            .timestamp(new Date().getTime() * 1000)
            .value(value)
            .build();
        const signedTransaction =  new SignedTransaction(transaction, this.wallet);
        return await this.iconService.sendTransaction(signedTransaction).execute();
    }

    async fillOrder(swapOrder: SwapOrder, solverAddress: string): Promise<any> {
        const fallbackData = TokenFallbackData.forFill(swapOrder.toICONBytes(), solverAddress);

        var value = 0;
        if (swapOrder.toToken === "cx3975b43d260fb8ec802cef6e60c2f4d07486f11d") {
            value = Number(swapOrder.toAmount);
        }
        console.log("here")
        const transaction = new CallTransactionBuilder()
            .from(this.wallet.getAddress())
            .to(swapOrder.toToken)
            .method("transfer")
            .params({
                _to: this.address,
                _value: IconConverter.toHex(Number(swapOrder.toAmount)),
                _data: fallbackData.toHex()
            })
            .value(value)
            .nid("1")
            .nonce(IconConverter.toBigNumber("1"))
            .version(IconConverter.toBigNumber("3"))
            .timestamp(new Date().getTime() * 1000)
            .stepLimit(IconConverter.toBigNumber("20000000"))
            .build();

        const signedTransaction =  new SignedTransaction(transaction, this.wallet);
        return await this.iconService.sendTransaction(signedTransaction).execute();;
    }

    async cancelOrder(orderId: bigint): Promise<any> {
        const transaction = new CallTransactionBuilder()
            .from(this.wallet.getAddress())
            .to(this.address)
            .method("cancel")
            .params({
                id: IconConverter.toHex(Number(orderId))
            })
            .nid("1")
            .nonce(IconConverter.toBigNumber("1"))
            .version(IconConverter.toBigNumber("3"))
            .timestamp(new Date().getTime() * 1000)
            .build();

        const signedTransaction =  new SignedTransaction(transaction, this.wallet);
        return await this.iconService.sendTransaction(signedTransaction).execute();
    }

    async getBalance(token: string, address: string): Promise<bigint> {
        const call = new CallBuilder()
            .to(token)
            .method("balanceOf")
            .params({ _owner: address })
            .build();

        const result = await this.iconService.call(call).execute();
        return BigInt(result);
    }

    async getOrder(txHash: string): Promise<SwapOrder> {
        interface EventLog {
            indexed: string[];
            data: string[];
        }
        
        interface TransactionReceipt {
            eventLogs: EventLog[];
        }
        
        let attempt = 0;
        let maxRetries = 10;
        while (attempt < maxRetries) {
            try {
                const receipt = await this.iconService.getTransactionResult(txHash).execute() as TransactionReceipt;
                for (const eventLog of receipt.eventLogs) {
                    if (eventLog.indexed[0] === 'SwapIntent(int,str,str,str,str,str,str,int,str,int,bytes)') {
                        return new SwapOrder(
                            BigInt(eventLog.indexed[1]),  // id
                            eventLog.indexed[2],          // emitter
                            eventLog.indexed[3],          // srcNID
                            eventLog.data[0],          // dstNID
                            eventLog.data[1],          // creator
                            eventLog.data[2],          // destinationAddress
                            eventLog.data[3],          // token
                            BigInt(eventLog.data[4]),  // amount
                            eventLog.data[5],          // toToken
                            BigInt(eventLog.data[6]),  // toAmount
                            Buffer.from(eventLog.data[7], 'hex') // data
                        );
                    }
                }
            } catch (error) {
                attempt++;
                if (attempt >= maxRetries) {
                    throw new Error(`Failed to resolve ${txHash}: ${error}`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
            }
        }

        throw new Error("No order found in transaction");
    }
}

// Example usage:
/*
const iconService = new IconService(new HttpProvider('https://ctz.solidwallet.io/api/v3'));
const wallet = ...; // Initialize wallet
const intents = new IconIntents(contractAddress, iconService, wallet);

// Submit order
const order = new SwapOrder(...);
const tx = await intents.submitOrder(order);
const result = await iconService.sendTransaction(tx).execute();

// Fill order
const fillTx = await intents.fillOrder(order, solverAddress);
const fillResult = await iconService.sendTransaction(fillTx).execute();
*/ 