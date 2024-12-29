import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "@ethersproject/wallet";
import { assert } from "console";
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import path from "path";

import { SuiIntents } from "./sui-intents";
import { EVMIntents } from "./evm-intents";
import { SolanaIntents } from "./solana-intents";
import { SwapOrder } from "./swap-order";

const getProvider = () => {
  const providerUrl = "https://sepolia-rollup.arbitrum.io/rpc";
  return new JsonRpcProvider(providerUrl);
};

const arbNID = "0xaa37dc.arbitrum";
const suiNID = "sui";
const SUIToken =
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
const ethToken = "0x0000000000000000000000000000000000000000";
const intentContract = "0x1d70D0B9c6b0508E7Bd2B379735CFF035749f187";

const packageId =
  "0x94de444d3260c2d2e18917545e01b2967dfb63d0b52cab76b2f6eef78a0bdf0e";
const storageId =
  "0x1036c7e8836a51e12ffde11ab578fc968f2f7b84e10bf9056fb85f1547a2eb79";

const keystore = fs.readFileSync(
  path.join(
    __dirname,
    "../..",
    "contracts/evm/.keystores/balanced_testnet_eth"
  ),
  "utf8"
);
const password = "9re$u{}V-W";
const evmWallet = Wallet.fromEncryptedJsonSync(keystore, password);
const evmAddress = evmWallet.address;
const evm = new EVMIntents(intentContract, getProvider(), evmWallet);

const keypair = Ed25519Keypair.fromSecretKey(
  "suiprivkey1qrdjntsdyuygqjsx3varvvx2hz6xkuk86zu2y255s0zw97uavl82xjul9z6"
);
const sui = new SuiIntents(packageId, storageId, "testnet", keypair);
const suiAddress = keypair.getPublicKey().toSuiAddress();

const solanaNID = "solana";
const solanaToken = "11111111111111111111111111111111";
const solanaKeypairFilePath = os.homedir + "/.config/solana/id.json";
const solanaKeypair = anchor.web3.Keypair.fromSecretKey(
  Buffer.from(JSON.parse(fs.readFileSync(solanaKeypairFilePath, "utf-8")))
);
const solana = new SolanaIntents(
  "https://api.devnet.solana.com",
  solanaKeypair
);

const evmToSUI = async () => {
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
    BigInt(10000),
    new Uint8Array()
  );
  const tx = await evm.orderETHNative(order);
  await tx.wait();
  const createdOrder = await evm.getOrder(tx.hash);

  // order is set by contract
  order.id = createdOrder.id;

  assert(createdOrder.equals(order));

  const digest = await sui.fillOrder(createdOrder, evmReceiver);
  await sui.client.waitForTransaction({ digest: digest.digest });
  const fill = await sui.getBalance(SUIToken, suiReceiver);
  console.log("After fill", fill);
  const fee = Number(order.toAmount) / Number(10000);
  assert(Number(fill) == Number(order.toAmount) - fee);

  const start = Date.now();
  while (true) {
    const payout = await evm.getBalance(ethToken, evmReceiver);

    // Check if the payout matches the order amount
    if (payout === order.amount) {
      const duration = (Date.now() - start) / 1000; // Calculate the elapsed time in seconds
      console.log(`payout passed in ${duration} seconds`);
      return; // Exit the function if the assertion passes
    }

    // Wait for a shorter interval before retrying
    await new Promise((r) => setTimeout(r, 1000)); // Retry every 1 second
  }
};

const SUIToEVM = async () => {
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
    BigInt(10000),
    new Uint8Array()
  );
  const tx = await sui.createOrder(order);
  const createdOrder = await sui.getOrder(tx.digest);

  order.id = createdOrder.id;
  assert(createdOrder.equals(order));

  const fillTx = await evm.fillOrder(createdOrder, suiReceiver);
  await fillTx.wait();

  const fill = await evm.getBalance(ethToken, evmReceiver);
  const fee = (Number(order.toAmount) * 10) / 10000;
  console.log(fill);
  assert(Number(fill) == Number(order.toAmount) - fee);
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
    await new Promise((r) => setTimeout(r, 1000)); // Retry every 1 second
  }

  //verify original funds released
};

const evmToSolana = async () => {
  const evmReceiver = Wallet.createRandom().address;
  const solanaReceiver = anchor.web3.Keypair.generate().publicKey;
  const order = new SwapOrder(
    BigInt(0),
    intentContract,
    arbNID,
    solanaNID,
    evmAddress,
    solanaReceiver.toString(),
    ethToken,
    BigInt(1289070000870000),
    solanaToken,
    BigInt(anchor.web3.LAMPORTS_PER_SOL * 100000000),
    new Uint8Array()
  );

  const tx = await evm.orderETHNative(order);
  await tx.wait();
  const createdOrder = await evm.getOrder(tx.hash);

  // order is set by contract
  order.id = createdOrder.id;

  assert(createdOrder.equals(order));

  const configAccount = await solana.getConfig();
  await solana.airdrop(
    configAccount.feeHandler,
    anchor.web3.LAMPORTS_PER_SOL * 2
  );

  const fillTxHash = await solana.fillOrder(order, evmReceiver);
  await solana.logParsedTx(fillTxHash);

  const fill = await solana.getBalance(solanaReceiver);
  console.log("After fill", fill);
  const fee = Number(order.toAmount) / Number(10000);
  assert(Number(fill) == Number(order.toAmount) - fee);

  const start = Date.now();
  while (true) {
    const payout = await evm.getBalance(ethToken, evmReceiver);

    // Check if the payout matches the order amount
    if (payout === order.amount) {
      const duration = (Date.now() - start) / 1000; // Calculate the elapsed time in seconds
      console.log(`payout passed in ${duration} seconds`);
      return; // Exit the function if the assertion passes
    }

    // Wait for a shorter interval before retrying
    await new Promise((r) => setTimeout(r, 1000)); // Retry every 1 second
  }
};

const solanaToEVM = async () => {
  const solanaReceiver = anchor.web3.Keypair.generate().publicKey;
  const evmReceiver = Wallet.createRandom().address;
  const order = new SwapOrder(
    BigInt(0),
    solana.intentProgram.programId.toString(),
    solanaNID,
    arbNID,
    solanaKeypair.publicKey.toString(),
    evmReceiver,
    solanaToken,
    BigInt(anchor.web3.LAMPORTS_PER_SOL * 10000),
    ethToken,
    BigInt(10000),
    new Uint8Array()
  );
  await solana.swap(order);
  const createdOrder = await solana.getOrder(order);
  order.id = BigInt(createdOrder.id.toNumber());

  const fillTx = await evm.fillOrder(order, solanaReceiver.toString());
  await fillTx.wait();

  const fill = await evm.getBalance(ethToken, evmReceiver);
  console.log("After fill", fill);

  const start = Date.now();
  while (true) {
    const payout = await solana.getBalance(solanaReceiver);

    // Check if the payout matches the order amount
    if (payout === Number(order.amount)) {
      const duration = (Date.now() - start) / 1000; // Calculate the elapsed time in seconds
      console.log(`payout passed in ${duration} seconds`);
      return; // Exit the function if the assertion passes
    }

    // Wait for a shorter interval before retrying
    await new Promise((r) => setTimeout(r, 1000)); // Retry every 1 second
  }
};

// evmToSUI();
SUIToEVM();
// evmToSolana();
// solanaToEVM()
