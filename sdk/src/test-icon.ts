import { SuiIntents } from './sui-intents';
import { IconIntents } from './icon-intents';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import IconService from 'icon-sdk-js';
import fs from 'fs';
import { SwapOrder } from "./swap-order";
import { assert } from "console";

const getIconService = () => {
    const provider = new IconService.HttpProvider('https://ctz.solidwallet.io/api/v3');
    return new IconService(provider);
};

const iconNID = "0x1.icon"
const suiNID = "sui"
const SUIToken = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
const icxToken = "cx3975b43d260fb8ec802cef6e60c2f4d07486f11d"
const intentContract = "cx55f6ac86d82a14022c338c8c0033eeceeeab382d";

const packageId = "0x60e1374475a5ed016e264c1c3a59ee9c1a42726f93b100ee22cad053f293b6f5"
const storageId = "0x78e96d7acd208baba0c37c1fd5d193088fa8f5ea45d18fa4c32eb3721307529d"

// Load ICON wallet (adjust according to your wallet setup)
const iconWallet = IconService.IconWallet.loadPrivateKey("8b4082ac7dcf1bbe9340990cb27c2382d713b24f4a56e6feb6d1ac494cbdcf61");
const iconAddress = iconWallet.getAddress()
console.log(iconAddress)
const icon = new IconIntents(intentContract, getIconService(), iconWallet);

const keypair = Ed25519Keypair.fromSecretKey("suiprivkey1qrdjntsdyuygqjsx3varvvx2hz6xkuk86zu2y255s0zw97uavl82xjul9z6");
const sui = new SuiIntents(packageId, storageId, "mainnet", keypair)
const suiAddress = keypair.getPublicKey().toSuiAddress()

const iconToSUI = async () => {
    const iconReceiver = IconService.IconWallet.create().getAddress();
    const suiReceiver = Ed25519Keypair.generate().getPublicKey().toSuiAddress();
    const order = new SwapOrder(
        BigInt(0),
        intentContract,
        iconNID,
        suiNID,
        iconAddress,
        suiReceiver,
        icxToken,
        BigInt(10),
        SUIToken,
        BigInt(11),
        new Uint8Array()
    )
    const tx = await icon.submitOrder(order);
    const createdOrder = await icon.getOrder(tx);

    // order is set by contract
    order.id = createdOrder.id

    assert(createdOrder.equals(order))

    const digest = await sui.fillOrder(createdOrder, iconReceiver);
    await sui.client.waitForTransaction({digest: digest.digest})
    const fill = await sui.getBalance(SUIToken, suiReceiver)
    console.log("After fill", fill)
    const fee = Number(order.toAmount)/Number(10000)
    assert(Number(fill) == Number(order.toAmount) - fee)

    const start = Date.now();
    while (true) {
        const payout = await icon.getBalance(icxToken, iconReceiver);

        // Check if the payout matches the order amount
        if (payout === order.amount) {
            const duration = Math.floor((Date.now() - start) / 1000);
            console.log(`payout passed in ${duration} seconds`);
            return;
        }

        // Wait for a shorter interval before retrying
        await new Promise(r => setTimeout(r, 1000));
    }
};

const SUIToICON = async () => {
    const iconReceiver = IconService.IconWallet.create().getAddress();
    const suiReceiver = Ed25519Keypair.generate().getPublicKey().toSuiAddress();
    const order = new SwapOrder(
        BigInt(0),
        storageId,
        suiNID,
        iconNID,
        suiAddress,
        iconReceiver,
        SUIToken,
        BigInt(100),
        icxToken,
        BigInt(101),
        new Uint8Array()
    )

    const tx = await sui.createOrder(order);
    const createdOrder = await sui.getOrder(tx.digest);
    order.id = createdOrder.id
    assert(createdOrder.equals(order))
    const fillTx = await icon.fillOrder(createdOrder, suiReceiver);
    // await fillTx.wait()
    console.log(fillTx);
    const fill = await icon.getBalance(icxToken, iconReceiver);
    const fee = Math.floor((Number(order.toAmount)*10)/10000)
    console.log(fill)
    assert(Number(fill) == Number(order.toAmount) - fee)
    
    const start = Date.now();
    while (true) {
        const payout = await sui.getBalance(SUIToken, suiReceiver);

        // Check if the payout matches the order amount
        if (payout === order.amount) {
            const duration = (Date.now() - start) / 1000;
            console.log(`payout passed in ${duration} seconds`);
            return;
        }

        // Wait for a shorter interval before retrying
        await new Promise(r => setTimeout(r, 1000));
    }
};

// Uncomment to run tests
iconToSUI();
// SUIToICON();