import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { Wallet } from '@ethersproject/wallet';
import {SwapOrder} from "./swap-order"
import fs from 'fs';
import { PERMIT2_ADDRESS, PermitTransferFrom, SignatureTransfer, Witness } from '@uniswap/permit2-sdk';
import { _TypedDataEncoder } from '@ethersproject/hash'
import { MaxUint256, Interface} from 'ethers';

const erc20Abi = [
    {
      "constant": false,
      "inputs": [
        {
          "name": "spender",
          "type": "address"
        },
        {
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];



export class EVMIntents{
    address: string;
    provider: JsonRpcProvider;
    intents: Contract;
    abi: any;
    wallet!: Wallet;

    constructor(address: string, provider: JsonRpcProvider, wallet: Wallet) {
        this.address = address;
        this.provider = provider;
        this.abi = JSON.parse(fs.readFileSync('/home/andell/ICON/intent-contracts/contracts/evm/out/Intents.sol/Intents.json', 'utf8'))['abi'];
        this.wallet = wallet.connect(this.provider);

        this.intents = new Contract(this.address, this.abi, wallet);
    }


    async approve(token: string) {
        const erc20 = new Contract(token, erc20Abi, this.wallet);
        await erc20.approve(PERMIT2_ADDRESS, MaxUint256);
    }

    toDeadline(expiration: number): number {
        return Math.floor((Date.now() + expiration) / 1000)
    }

    public async orderPERMIT2(swapOrder: SwapOrder) {
        const deadline = this.toDeadline(100000000)
        // Not correct way to manage nonce?
        const permit: PermitTransferFrom = {
            permitted: {
                token: swapOrder.token,
                amount: swapOrder.amount.valueOf()

            },
            spender: swapOrder.emitter,
            nonce: await this.wallet.getTransactionCount(),
            deadline: deadline
        };

        const witness: Witness = {
            witnessTypeName: 'SwapOrder',
            witnessType: { SwapOrder: swapOrder.PERMIT2_STRUCT },
            witness: swapOrder.toStruct(),
        }
        const { domain, types, values } = SignatureTransfer.getPermitData(permit, PERMIT2_ADDRESS, 421614, witness)
        const signature = await this.wallet._signTypedData(domain, types, values);
        return [signature, permit]
    }

    async orderETHNative(swapOrder: SwapOrder ): Promise<any> {
        return await this.intents.swap(swapOrder.toData(), {value:swapOrder.amount})
    }

    async submitPermit2Order(swapOrder: SwapOrder, signature: string, permit: PermitTransferFrom ): Promise<any> {
        await this.intents.swapPermit2(swapOrder.toData(), signature, permit)
    }

    async fill(swapOrder: SwapOrder, repayAddress: string ): Promise<any> {
        var value = BigInt(0);
        if (swapOrder.toToken == "0x0000000000000000000000000000"){
            value = swapOrder.amount.valueOf()
        } else {
            // approve token
        }
        await this.intents.fill(swapOrder.toData(), repayAddress, {value:value})
    }

    async getBalance(token: string , address: string ): Promise<BigInt> {
        if (token == "0x0000000000000000000000000000000000000000") {
            return (await this.provider.getBalance(token)).toBigInt()
        }

        // TODO
        return BigInt(0)
    }

    async getOrder(txHash: string) : Promise<SwapOrder> {
        const receipt = await this.provider.getTransactionReceipt(txHash)
        const iface = new Interface(this.abi);
        receipt.logs.forEach((log) => {
            if (log.address.toLowerCase() === this.intents.address.toLowerCase()) {
                try {
                    const decodedLog = iface.parseLog(log);
                    if (decodedLog?.name == "SwapIntent") {
                        const data = decodedLog.args;
                        return new SwapOrder(
                            BigInt(data[0]),
                            data[1],
                            data[2],
                            data[3],
                            data[4],
                            data[5],
                            data[6],
                            BigInt(data[7]),
                            data[8],
                            BigInt(data[9]),
                            Uint8Array.from(Buffer.from(data[10], 'hex'))
                        )
                    }
                } catch (error) {
                    console.error("Failed to decode log:", error);
                }
            }
        });
        throw "no order found"
    }
}



// ~/.cargo/bin/forge  create --constructor-args "0xaa37dc.arbitrum" 10 0xEAbEb33723E2Df17De55906ddE1393C544204a8e 0x35D1B13C0DE523207c2106DE2e704E16EB1516b3 0x000000000022D473030F116dDEE9F6B43aC78BA3   --rpc-url https://sepolia-rollup.arbitrum.io/rpc/ --keystore .keystores/balanced_testnet_eth  contracts/Intents/Intents.sol:Intents
// ~/.cargo/bin/forge verify-contract 0xDf01D1CD6675271c0F894049773AEA1E8b77607D contracts/Intents/Intents.sol:Intents --verifier-url 'https://api-sepolia.arbiscan.io/api' --etherscan-api-key "ZP4SRGNIXX7PRT8IMT1IQEPV86EX5326Q5" --num-of-optimizations 200 --compiler-version 0.8.21 --constructor-args $(~/.cargo/bin/cast abi-encode "constructor(string,uint16,address,address,address)" "nid" 10 0xEAbEb33723E2Df17De55906ddE1393C544204a8e 0xEAbEb33723E2Df17De55906ddE1393C544204a8e 0x000000000022D473030F116dDEE9F6B43aC78BA3)
// ~/.cargo/bin/forge  create --constructor-args 0x0000000000000000000000000000000000000000d3af2663da51c10215000000   --rpc-url https://sepolia-rollup.arbitrum.io/rpc/ --keystore ../../contracts/evm/.keystores/balanced_testnet_eth  src/Permit2.sol:Permit2

