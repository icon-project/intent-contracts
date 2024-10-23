import { Ed25519Keypair } from "@mysten/sui/dist/cjs/keypairs/ed25519";
import { SuiIntents } from './sui-intents';
import { EVMIntents } from './evm-intents';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { Wallet } from '@ethersproject/wallet';
import fs from 'fs';
import { SwapOrder } from "./swap-order";
import { assert } from "console";

const getProvider = () => {
    const providerUrl = "https://sepolia-rollup.arbitrum.io/rpc";
    return new JsonRpcProvider(providerUrl);
};


const arbNID = "0xaa37dc.arbitrum"
const suiNID = "sui"
const SUIToken = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
const ethToken = "0x0000000000000000000000000000000000000000"
const intentContract = "0x1d70D0B9c6b0508E7Bd2B379735CFF035749f187";

const packageId = "0x2604cc95ad0b2a3e4b2e9e5df8d7a59b8a20ccb4fda58cc6fd7d06777e283a6f"
const storageId = "0x490f1dbd44fd9bb1bd8fe8438bd8cb062acad8d81915fefc042f5484de7a7edc"

const keystore = fs.readFileSync('/home/andell/ICON/intent-contracts/contracts/evm/.keystores/balanced_testnet_eth', 'utf8');
const password = '9re$u{}V-W';
const evmWallet = Wallet.fromEncryptedJsonSync(keystore, password);
const evm = new EVMIntents(intentContract, getProvider(), evmWallet);
const evmAddress = evmWallet.address

const keypair = Ed25519Keypair.fromSecretKey("suiprivkey1qrdjntsdyuygqjsx3varvvx2hz6xkuk86zu2y255s0zw97uavl82xjul9z6");
const sui = new SuiIntents(packageId, storageId, "testnet", keypair)
const suiAddress = keypair.getPublicKey().toSuiAddress()

const evmToSUI =  async () => {
    const initialBalance  = await evm.getBalance(ethToken, evmAddress);
    const order = new SwapOrder(
        BigInt(0),
        packageId,
        arbNID,
        suiNID,
        evmAddress,
        suiAddress,
        ethToken,
        BigInt(100),
        SUIToken,
        BigInt(200),
        new Uint8Array()
    )
    const tx = await evm.orderETHNative(order);
    const postOrderBalance  = await evm.getBalance(ethToken, evmAddress);
    const createdOrder = await evm.getOrder(tx);
    console.log(initialBalance)
    console.log(postOrderBalance)
    const expectedAmount = Number(initialBalance) - Number(order.amount);
    assert(postOrderBalance == BigInt(expectedAmount))

    // order is set by contract
    order.id = createdOrder.id
    assert(createdOrder.equals(order))

    const initialFillBalance = sui.getBalance(SUIToken, suiAddress)
    // const initialFillBalanceFeehandler = sui.getBalance(SUIToken, suiAddress)
    await sui.fillOrder(createdOrder, evmAddress);
    const postFillBalance = sui.getBalance(SUIToken, suiAddress)
    await new Promise(r => setTimeout(r, 20000));

    console.log(initialFillBalance)
    console.log(postFillBalance)
    console.log(await evm.getBalance(ethToken, evmAddress))
};

evmToSUI();

const SUIToEVM =  async () => {
    const order = new SwapOrder(
        BigInt(0),
        packageId,
        'arb',
        'sui',
        evmAddress,
        suiAddress,
        ethToken,
        BigInt(100),
        '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
        BigInt(200),
        new Uint8Array()
    )
    const tx = await sui.createOrder(order);
    const createdOrder = await evm.getOrder(tx);
    // assert

    sui.fillOrder(createdOrder, evmAddress);
    // checkpayout

    //verify original funds released

};


