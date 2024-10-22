import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { Wallet } from '@ethersproject/wallet';
import {SwapOrder} from "./swap-order"
import fs from 'fs';
import { PERMIT2_ADDRESS, PermitTransferFrom, SignatureTransfer, Witness } from '@uniswap/permit2-sdk';
import { _TypedDataEncoder } from '@ethersproject/hash'
import { MaxUint256, Interface} from 'ethers';

const arbNID = "nid"
const suiNID = "SUI"

const intentContract = "0xDc4c9866b930a4dBe159263F47B229dcE404F355";
const token = "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E"
const perm2 = PERMIT2_ADDRESS
const amount = BigInt(10)

const toAddress = "SUI"
const toToken = "SUI"
const toAmount = BigInt(10)

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



class EVMIntents {
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
        await erc20.approve(perm2, MaxUint256);
    }

    toDeadline(expiration: number): number {
        return Math.floor((Date.now() + expiration) / 1000)
    }

    public async orderPERMIT2(swapOrder: SwapOrder) {
        const deadline = this.toDeadline(100000000)
        // Not correct way to manage nonce?
        const permit: PermitTransferFrom = {
            permitted: {
                token: token,
                amount: swapOrder.amount

            },
            spender: intentContract,
            nonce: await this.wallet.getTransactionCount(),
            deadline: deadline
        };

        const witness: Witness = {
            witnessTypeName: 'SwapOrder',
            witnessType: { SwapOrder: swapOrder.PERMIT2_STRUCT },
            witness: swapOrder.toStruct(),
        }
        const { domain, types, values } = SignatureTransfer.getPermitData(permit, perm2, 421614, witness)
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
            value = swapOrder.amount
        } else {
            // approve token
        }
        await this.intents.fill(swapOrder.toData(), repayAddress {value:value})
    }

    async getOrder(txHash: string) {
        const receipt = await this.provider.getTransactionReceipt(txHash)
        const iface = new Interface(this.abi);
        receipt.logs.forEach((log) => {
            if (log.address.toLowerCase() === intentContract.toLowerCase()) {
                // Decode the log
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
    }
}


const getProvider = () => {
    const providerUrl = "https://sepolia-rollup.arbitrum.io/rpc";
    return new JsonRpcProvider(providerUrl);
};




