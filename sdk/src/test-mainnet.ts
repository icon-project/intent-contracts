import { SuiIntents } from './sui-intents';
import { EVMIntents } from './evm-intents';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import fs from 'fs';
import { SwapOrder } from "./swap-order";
import { EVMAssetManager } from "./xcall-bridge";
import { assert } from "console";

const getProvider = () => {
    const providerUrl = "https://arb1.arbitrum.io/rpc";
    return new JsonRpcProvider(providerUrl);
};

const arbNID = "0xa4b1.arbitrum"
const suiNID = "sui"
const SUIToken = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
const ethToken = "0x0000000000000000000000000000000000000000"
const intentContract = "0x53E0095C57673fC16fA3FA2414bAD3200844Ec17";

const packageId = "0xbf8044a8f498b43e48ad9ad8a7d23027a45255903e8b4765dda38da2d1b89600"
const storageId = "0x78e96d7acd208baba0c37c1fd5d193088fa8f5ea45d18fa4c32eb3721307529d"

const keystore = fs.readFileSync('/home/andell/ICON/intent-contracts/contracts/evm/.keystores/balanced_testnet_eth', 'utf8');
const password = '9re$u{}V-W';
const evmWallet = Wallet.fromEncryptedJsonSync(keystore, password);
const evmAddress = evmWallet.address
const evm = new EVMIntents(intentContract, getProvider(), evmWallet);
const assetManager = new EVMAssetManager("0x78b7CD9308287DEb724527d8703c889e2d6C3708", getProvider(), evmWallet);

const keypair = Ed25519Keypair.fromSecretKey("suiprivkey1qrdjntsdyuygqjsx3varvvx2hz6xkuk86zu2y255s0zw97uavl82xjul9z6");
const sui = new SuiIntents(packageId, storageId, "mainnet", keypair)
const suiAddress = keypair.getPublicKey().toSuiAddress()

const evmToSUI =  async () => {
    const evmReceiver = Wallet.createRandom().address;
    const suiReceiver = Ed25519Keypair.generate().getPublicKey().toSuiAddress();
    const order = new SwapOrder(
        BigInt(0),
        intentContract,
        arbNID,
        suiNID,
        evmAddress,
        suiReceiver,
        ethToken,
        BigInt(100),
        SUIToken,
        BigInt(101),
        new Uint8Array()
    )
    const tx = await evm.orderETHNative(order);
    await tx.wait()
    const createdOrder = await evm.getOrder(tx.hash);

    // order is set by contract
    order.id = createdOrder.id

    assert(createdOrder.equals(order))

    const digest = await sui.fillOrder(createdOrder, evmReceiver);
    await sui.client.waitForTransaction({digest: digest.digest})
    const  fill = await sui.getBalance(SUIToken, suiReceiver)
    console.log("After fill", fill)
    const fee = Number(order.toAmount)/Number(10000)
    assert(Number(fill) == Number(order.toAmount) - fee)

    const start = Date.now();
    while (true) {
        const payout = await evm.getBalance(ethToken, evmReceiver);

        // Check if the payout matches the order amount
        if (payout === order.amount) {

            const duration = Math.floor((Date.now() - start) / 1000); // Calculate the elapsed time in seconds
            console.log(`payout passed in ${duration} seconds`);
            return; // Exit the function if the assertion passes
        }

        // Wait for a shorter interval before retrying
        await new Promise(r => setTimeout(r, 1000)); // Retry every 1 second
    }
};


const SUIToEVM =  async () => {
    const evmReceiver = Wallet.createRandom().address;
    const suiReceiver = Ed25519Keypair.generate().getPublicKey().toSuiAddress();
    const order = new SwapOrder(
        BigInt(0),
        storageId,
        suiNID,
        arbNID,
        suiAddress,
        evmReceiver,
        SUIToken,
        BigInt(100),
        ethToken,
        BigInt(101),
        new Uint8Array()
    )
    const tx = await sui.createOrder(order);
    const createdOrder = await sui.getOrder(tx.digest);

    order.id = createdOrder.id
    assert(createdOrder.equals(order))

    const fillTx = await evm.fillOrder(createdOrder, suiReceiver);
    await fillTx.wait()

    const fill  = await evm.getBalance(ethToken, evmReceiver);
    const fee = Math.floor((Number(order.toAmount)*10)/10000)
    console.log(fill)
    assert(Number(fill) == Number(order.toAmount) - fee)
    const start = Date.now();
    while (true) {
        const payout = await sui.getBalance(SUIToken, suiReceiver);

        // Check if the payout matches the order amount
        if (payout === order.amount) {

            const duration = (Date.now() - start) / 1000; // Calculate the elapsed time in seconds
            console.log(`payout passed in ${duration} seconds`);
            return; // Exit the function if the assertion passes
        }

        // Wait for a shorter interval before retrying
        await new Promise(r => setTimeout(r, 1000)); // Retry every 1 second
    }

    //verify original funds released

};
// evmToSUI();
// SUIToEVM();
const approve = async () => {
  await assetManager.approve("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 1000);
 };
 const send = async () => {
    await  assetManager.bridgeUSDCToSUI("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 1, "0xc940f195be990bbf4171fb2ede315f4149e8e95f039a0a5be4a84cb5e1b5d873");
};

send()

