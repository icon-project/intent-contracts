import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";

import { Intent } from "../../contracts/solana/target/types/intent";
import intentIdl from "../../contracts/solana/target/idl/intent.json";
import { SwapOrder } from "./swap-order";

export class SolanaIntents {
  wallet: anchor.Wallet;
  connection: Connection;
  provider: anchor.AnchorProvider;
  intentProgram: anchor.Program<Intent>;
  intentPDA: IntentPDA;

  constructor(rpcUrl: string, keypair: Keypair) {
    this.connection = new Connection(rpcUrl, "confirmed");
    this.wallet = new anchor.Wallet(keypair);

    this.provider = new anchor.AnchorProvider(this.connection, this.wallet);
    anchor.setProvider(this.provider);

    this.intentProgram = new anchor.Program(
      intentIdl as anchor.Idl,
      this.provider
    ) as unknown as anchor.Program<Intent>;
    this.intentPDA = new IntentPDA(this.intentProgram.programId);
  }

  async fillOrder(swap: SwapOrder, solverAddress: string) {
    const swapOrder = {
      id: new anchor.BN(swap.id),
      emitter: swap.emitter,
      srcNid: swap.srcNID,
      dstNid: swap.dstNID,
      creator: swap.creator,
      destinationAddress: swap.destinationAddress,
      token: swap.token,
      amount: new anchor.BN(swap.amount),
      toToken: swap.toToken,
      toAmount: new anchor.BN(swap.toAmount),
      data: Buffer.from(swap.data),
    };

    const accounts = (
      await this.getFillAccounts(
        swapOrder,
        this.wallet.publicKey,
        solverAddress
      )
    ).accounts;

    return await this.intentProgram.methods
      .fill(swapOrder, solverAddress.toString())
      .accountsStrict({
        signer: this.wallet.publicKey,
        systemProgram: accounts[0].pubkey,
        config: accounts[1].pubkey,
        feeHandler: accounts[2].pubkey,
        destinationAddress: accounts[3].pubkey,
        orderFinished: accounts[4].pubkey,
        feeHandlerTokenAccount: accounts[5].pubkey,
        destinationTokenAccount: accounts[6].pubkey,
        signerTokenAccount: accounts[7].pubkey,
        mint: accounts[8].pubkey,
        tokenProgram: accounts[9].pubkey,
        associatedTokenProgram: accounts[10].pubkey,
      })
      .remainingAccounts(accounts.slice(11))
      .signers([this.wallet.payer])
      .rpc({
        commitment: "confirmed",
      });
  }

  async swap(swap: SwapOrder) {
    const swapOrder = {
      id: new anchor.BN(swap.id),
      emitter: swap.emitter,
      srcNid: swap.srcNID,
      dstNid: swap.dstNID,
      creator: swap.creator,
      destinationAddress: swap.destinationAddress,
      token: swap.token,
      amount: new anchor.BN(swap.amount),
      toToken: swap.toToken,
      toAmount: new anchor.BN(swap.toAmount),
      data: Buffer.from(swap.data),
    };

    const accounts = (await this.getSwapAccounts(swapOrder)).accounts;

    return await this.intentProgram.methods
      .swap(swapOrder)
      .accountsStrict({
        signer: this.wallet.publicKey,
        systemProgram: accounts[0].pubkey,
        config: accounts[1].pubkey,
        orderAccount: accounts[2].pubkey,
        vaultNativeAccount: accounts[3].pubkey,
        vaultTokenAccount: accounts[4].pubkey,
        signerTokenAccount: accounts[5].pubkey,
        mint: accounts[6].pubkey,
        tokenProgram: accounts[7].pubkey,
      })
      .signers([this.wallet.payer])
      .rpc({
        commitment: "confirmed",
      });
  }

  async getOrder(swap: SwapOrder) {
    return (
      await this.intentProgram.account.orderAccount.fetch(
        this.intentPDA.order(
          this.wallet.publicKey,
          swap.dstNID,
          Number(swap.amount),
          Number(swap.toAmount)
        ).pda
      )
    ).order;
  }

  async getConfig() {
    return await this.intentProgram.account.config.fetch(
      this.intentPDA.config().pda
    );
  }

  async airdrop(to: PublicKey, lamports: number) {
    let aridropTx = await this.connection.requestAirdrop(to, lamports);
    await this.connection.confirmTransaction(aridropTx, "confirmed");
  }

  async logParsedTx(txSignature: string) {
    await this.sleep(2);
    console.log(
      await this.connection.getParsedTransaction(txSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      })
    );
  }

  async getBalance(address: PublicKey) {
    return await this.connection.getBalance(address);
  }

  async sleep(seconds: number) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  async getSwapAccounts(order: any) {
    return await this.intentProgram.methods
      .querySwapAccounts(order, 1, 30)
      .accountsStrict({
        config: this.intentPDA.config().pda,
      })
      .view({ commitment: "confirmed" });
  }

  async getFillAccounts(order: any, signer: PublicKey, solverAddress: string) {
    return await this.intentProgram.methods
      .queryFillAccounts(order, signer, solverAddress, 1, 30)
      .accountsStrict({
        config: this.intentPDA.config().pda,
      })
      .view({ commitment: "confirmed" });
  }

  async getCancelAccounts(order: any) {
    return await this.intentProgram.methods
      .queryCancelAccounts(order, 1, 30)
      .accountsStrict({
        config: this.intentPDA.config().pda,
      })
      .view({ commitment: "confirmed" });
  }

  async getRecvMessageAccounts(
    srcNetwork: string,
    connSn: number,
    msg: Buffer
  ) {
    return await this.intentProgram.methods
      .queryRecvMessageAccounts(srcNetwork, new anchor.BN(connSn), msg, 1, 30)
      .accountsStrict({
        config: this.intentPDA.config().pda,
      })
      .view({ commitment: "confirmed" });
  }

  async getSwapIx(swap: any) {
    const accounts = (await this.getSwapAccounts(swap)).accounts;

    return await this.intentProgram.methods
      .swap(swap)
      .accountsStrict({
        signer: new PublicKey(swap.creator),
        systemProgram: accounts[0].pubkey,
        config: accounts[1].pubkey,
        orderAccount: accounts[2].pubkey,
        vaultNativeAccount: accounts[3].pubkey,
        vaultTokenAccount: accounts[4].pubkey,
        signerTokenAccount: accounts[5].pubkey,
        mint: accounts[6].pubkey,
        tokenProgram: accounts[7].pubkey,
      })
      .instruction();
  }

  async getFillIx(swap: any, solverKey: PublicKey, solverAddress: string) {
    const accounts = (
      await this.getFillAccounts(swap, solverKey, solverAddress)
    ).accounts;

    return await this.intentProgram.methods
      .fill(swap, solverAddress.toString())
      .accountsStrict({
        signer: solverKey,
        systemProgram: accounts[0].pubkey,
        config: accounts[1].pubkey,
        feeHandler: accounts[2].pubkey,
        destinationAddress: accounts[3].pubkey,
        orderFinished: accounts[4].pubkey,
        feeHandlerTokenAccount: accounts[5].pubkey,
        destinationTokenAccount: accounts[6].pubkey,
        signerTokenAccount: accounts[7].pubkey,
        mint: accounts[8].pubkey,
        tokenProgram: accounts[9].pubkey,
        associatedTokenProgram: accounts[10].pubkey,
      })
      .remainingAccounts(accounts.slice(11))
      .instruction();
  }

  async getCancelIx(swap: any) {
    const accounts = (await this.getCancelAccounts(swap)).accounts;

    return await this.intentProgram.methods
      .cancel(swap)
      .accountsStrict({
        signer: new PublicKey(swap.creator),
        systemProgram: accounts[0].pubkey,
        config: accounts[1].pubkey,
        orderAccount: accounts[2].pubkey,
        orderFinished: accounts[3].pubkey,
      })
      .instruction();
  }

  async getRecvMessageIx(
    srcNetwork: string,
    connSn: number,
    message: Buffer,
    signer: PublicKey
  ) {
    const accounts = (
      await this.getRecvMessageAccounts(srcNetwork, connSn, message)
    ).accounts;

    return await this.intentProgram.methods
      .recvMessage(srcNetwork, new anchor.BN(connSn), message)
      .accountsStrict({
        signer: signer,
        systemProgram: accounts[0].pubkey,
        config: accounts[1].pubkey,
        receipt: accounts[2].pubkey,
      })
      .remainingAccounts(accounts.slice(3))
      .instruction();
  }
}

export class IntentPDA {
  programId: PublicKey;

  constructor(programId: PublicKey) {
    this.programId = programId;
  }

  config() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      this.programId
    );

    return { bump, pda };
  }

  order(creator: PublicKey, dstNID: string, amount: number, toAmount: number) {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [
        creator.toBuffer(),
        Buffer.from(dstNID),
        uint128ToArray(amount),
        uint128ToArray(toAmount),
      ],
      this.programId
    );

    return { bump, pda };
  }

  vaultToken(mint: PublicKey) {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_token"), mint.toBuffer()],
      this.programId
    );

    return { bump, pda };
  }

  vaultNative() {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_native")],
      this.programId
    );

    return { bump, pda };
  }

  receipt(srcNID: string, connSn: number) {
    let [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("receipt"), Buffer.from(srcNID), uint128ToArray(connSn)],
      this.programId
    );

    return { bump, pda };
  }
}

const uint128ToArray = (num: any) => {
  if (typeof num === "string" || typeof num === "number") {
    num = BigInt(num);
  } else if (!(num instanceof BigInt)) {
    throw new Error("Input must be a BigInt or convertible to a BigInt.");
  }

  let buffer = new ArrayBuffer(16);
  let view = new DataView(buffer);

  view.setBigUint64(0, num >> BigInt(64), false);
  view.setBigUint64(8, num & BigInt("0xFFFFFFFFFFFFFFFF"), false);

  return new Uint8Array(buffer);
};
