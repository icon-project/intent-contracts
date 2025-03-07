import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { Wallet } from '@ethersproject/wallet';
import fs from 'fs';
import { PERMIT2_ADDRESS, PermitTransferFrom, SignatureTransfer, Witness } from '@uniswap/permit2-sdk';
import { _TypedDataEncoder } from '@ethersproject/hash'
import { MaxUint256, Interface} from 'ethers';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';


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

  const assetManagerAbi = [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "token",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "to",
              "type": "string"
            },
            {
              "internalType": "bytes",
              "name": "data",
              "type": "bytes"
            }
          ],
          "name": "deposit",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        },

        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "depositNative",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "to",
              "type": "string"
            },
            {
              "internalType": "bytes",
              "name": "data",
              "type": "bytes"
            }
          ],
          "name": "depositNative",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "to",
              "type": "string"
            }
          ],
          "name": "depositNative",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        }
  ];


export class EVMAssetManager{
    address: string;
    provider: JsonRpcProvider;
    assetManager: Contract;
    wallet!: Wallet;
    // this.address = address;
// 0x78b7CD9308287DEb724527d8703c889e2d6C3708
    constructor(address: string, provider: JsonRpcProvider, wallet: Wallet) {
        this.address = address;
        this.provider = provider;
        this.wallet = wallet.connect(this.provider);

        this.assetManager = new Contract(this.address, assetManagerAbi, this.wallet);
    }


    async approve(token: string, amount: number) {
        const erc20 = new Contract(token, erc20Abi, this.wallet);
        await erc20.approve(this.assetManager.address, amount);
    }

    toDeadline(expiration: number): number {
        return Math.floor((Date.now() + expiration) / 1000)
    }

    public async bridgeUSDCToSUI(usdcAddress:string, amount: number, suiAddress:string) {
        const data = {"method": "_swap", "params": {
            "path": [],
            "receiver": "sui/"+suiAddress
        }}
        const _data = new TextEncoder().encode(JSON.stringify(data));
        this.assetManager.deposit(usdcAddress, amount, "0x1.icon/cx21e94c08c03daee80c25d8ee3ea22a20786ec231", _data, {value: 60000000000000})
    };
}


export class SuiAssetManager {
    client: SuiClient;
    keypair: Ed25519Keypair;

    constructor(keypair: Ed25519Keypair) {
        const rpcUrl = getFullnodeUrl("mainnet");
        this.keypair = keypair;
        this.client = new SuiClient({ url: rpcUrl });
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

    async bridgeUSDCToSUI(usdcAddress:string, amount: number, nid:string, evmAddress:string): Promise<any> {
        const tx = new Transaction();
        let coin: any;

        coin = await this.getCoin(tx, usdcAddress, BigInt(amount));
        const data = {"method": "_swap", "params": {
            "path": [],
            "receiver": nid + "/" + evmAddress
        }}
        const _data = new TextEncoder().encode(JSON.stringify(data));

        tx.moveCall({
            target: `0xd5aa24a346fd89468d13f00f57162df8a498ec11c197df2bc4257ad74fa977b1::asset_manager::deposit`,
            arguments: [
                tx.object("0x25c200a947fd16903d9daea8e4c4b96468cf08d002394b7f1933b636e0a0d500"),
                tx.object("0xe9ae3e2d32cdf659ad5db4219b1086cc0b375da5c4f8859c872148895a2eace2"),
                tx.object("0x1bbf52529d14124738fac0abc1386670b7927b6d68cab7f9bd998a0c0b274042"),
                tx.pure.string("0x1.icon/cx21e94c08c03daee80c25d8ee3ea22a20786ec231"),
                tx.pure.u128(evmAddress),
                tx.pure.vector('vector<u8>', [].slice.call(_data)),

            ],
            typeArguments: [usdcAddress],
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
}

