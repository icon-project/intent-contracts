import * as anchor from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { TxnHelpers } from "../scripts/utils/transaction";
import {
  IntentPda,
  intentProgram,
  wallet,
  connection,
  getFillIx,
  getSwapIx,
} from "../scripts/setup";
import { SwapOrder } from "../scripts/types";
import { sleep } from "../scripts/utils";
import { TestContext } from "./setup";

describe("Fill", async () => {
  let srcNid = "solana";
  let dstNid = "icon";
  let mintKey: PublicKey;

  const ctx = new TestContext(srcNid, dstNid);
  const txnHelpers = new TxnHelpers(connection, wallet.payer);

  before(async () => {
    mintKey = await ctx.createMint();
  });

  it("should fill spl token", async () => {
    let signer = Keypair.generate();
    await txnHelpers.airdrop(signer.publicKey, LAMPORTS_PER_SOL * 10);

    let solverAddress = Keypair.generate();
    let destination = Keypair.generate();
    let signerTokenBalance = 1000000000 * 100;
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    const config = await ctx.getConfig();
    const signerTokenAddress = (await ctx.mintToken(signer.publicKey, 100))
      .address;

    // Program expects this token account to be already initialized
    const feeHandlerTokenAccount = await createAssociatedTokenAccount(
      connection,
      signer,
      mintKey,
      config.feeHandler
    );
    // Program initializes this account if not already initialized
    let destinationTokenAccount = await getAssociatedTokenAddress(
      mintKey,
      destination.publicKey
    );
    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: signer.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: mintKey.toString(),
      amount,
      toToken: mintKey.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };
    let swapOrder = SwapOrder.from(swap);

    let fillIx = await getFillIx(
      swap,
      signer.publicKey,
      solverAddress.publicKey.toString()
    );
    const computeUintLimit = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000,
    });
    const computeBudgeLimit = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 0,
    });
    let fillTx = await txnHelpers.buildV0Txn(
      [computeUintLimit, computeBudgeLimit, fillIx],
      [signer]
    );
    await connection.sendTransaction(fillTx);
    await sleep(2);

    // check signer token balance
    let expectedBalance = signerTokenBalance - toAmount.toNumber();
    let signerAccount = await getAccount(connection, signerTokenAddress);
    assert.equal(signerAccount.amount.toString(), expectedBalance.toString());

    // check fee handler balance
    let fee =
      (Number(swapOrder.toAmount) * config.protocolFee.toNumber()) / 10_000;
    let feeHandlerToken = await getAccount(connection, feeHandlerTokenAccount);
    assert.equal(feeHandlerToken.amount.toString(), fee.toString());

    // check order creator (destination address) balance
    let destinationTokenBalance = Number(swapOrder.toAmount) - fee;
    let destinationToken = await getAccount(
      connection,
      destinationTokenAccount
    );
    assert.equal(
      destinationToken.amount.toString(),
      destinationTokenBalance.toString()
    );
  });

  it("should fill native token", async () => {
    let signer = Keypair.generate();
    await txnHelpers.airdrop(signer.publicKey, LAMPORTS_PER_SOL * 10);

    let solverAddress = Keypair.generate();
    let destination = Keypair.generate();
    let signerBalance = 1000000000 * 10;
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    const config = await ctx.getConfig();

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: signer.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: mintKey.toString(),
      amount,
      toToken: SYSTEM_PROGRAM_ID.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };
    let swapOrder = SwapOrder.from(swap);

    let fillIx = await getFillIx(
      swap,
      signer.publicKey,
      solverAddress.publicKey.toString()
    );
    let fillTx = await txnHelpers.buildV0Txn([fillIx], [signer]);
    await connection.sendTransaction(fillTx);
    await sleep(2);

    // check signer SOL balance
    let expectedBalance =
      signerBalance - (amount.toNumber() + ctx.orderFinishedAccountRent + 5000);
    let signerNowBalance = await connection.getBalance(signer.publicKey);
    assert.equal(signerNowBalance.toString(), expectedBalance.toString());

    // check fee handler balance
    let fee =
      (Number(swapOrder.toAmount) * config.protocolFee.toNumber()) / 10_000;
    let feeHandlerBalance = await connection.getBalance(config.feeHandler);
    assert.equal(feeHandlerBalance.toString(), fee.toString());

    // check order creator (destination address) balance
    let destinationExpectedBalance = Number(swapOrder.toAmount) - fee;
    let destinationBalance = await connection.getBalance(destination.publicKey);
    assert.equal(
      destinationBalance.toString(),
      destinationExpectedBalance.toString()
    );
  });

  it("should fill SPL token and resolve", async () => {
    // creator depsoit 11.8 SOL to receive 135k SPL token

    let solver = Keypair.generate();
    let creator = Keypair.generate();
    await txnHelpers.airdrop(solver.publicKey, LAMPORTS_PER_SOL * 20);
    await txnHelpers.airdrop(creator.publicKey, LAMPORTS_PER_SOL * 20);

    let solverAddress = Keypair.generate();
    let destination = Keypair.generate();
    let amount = new anchor.BN(11800000000);
    let toAmount = new anchor.BN(135000000000000);

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid: srcNid,
      creator: creator.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: SYSTEM_PROGRAM_ID.toString(),
      amount,
      toToken: mintKey.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    const swapIx = await getSwapIx(swap);
    const swapTx = await txnHelpers.buildV0Txn([swapIx], [creator]);
    await connection.sendTransaction(swapTx);
    await sleep(2);

    const config = await ctx.getConfig();

    // mint 135k SPL token to solver for paying creator destination address
    const solverTokenAddress = (await ctx.mintToken(solver.publicKey, 135000))
      .address;

    // fee_handler token has to be created before filling the order
    const feeHandlerTokenAddress = (await ctx.mintToken(config.feeHandler, 10))
      .address;
    const feeHandlerBalanceBeforeFill = (
      await getAccount(connection, feeHandlerTokenAddress)
    ).amount;

    swap.id = config.depositId;
    const swapOrder = SwapOrder.from(swap);

    const vaultBalanceBeforeFill = await connection.getBalance(
      IntentPda.vaultNative().pda
    );
    const creatorBalanceBeforeFill = await connection.getBalance(
      creator.publicKey
    );

    const fillIx = await getFillIx(
      swap,
      solver.publicKey,
      solverAddress.publicKey.toString()
    );
    const computeUintLimit = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000,
    });
    const computeBudgeLimit = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 0,
    });
    const fillTx = await txnHelpers.buildV0Txn(
      [computeUintLimit, computeBudgeLimit, fillIx],
      [solver]
    );
    await connection.sendTransaction(fillTx);
    await sleep(2);

    // solver token balance should be zero
    const solverTokenAccount = await getAccount(connection, solverTokenAddress);
    assert.equal(solverTokenAccount.amount.toString(), "0");

    // fee handler should have received swap fees
    const fee = ctx.calculateSwapFee(
      config.protocolFee.toNumber(),
      toAmount.toNumber()
    );
    const feeHandlerBalance = (
      await getAccount(connection, feeHandlerTokenAddress)
    ).amount;
    assert.equal(
      feeHandlerBalance.toString(),
      (BigInt(fee) + feeHandlerBalanceBeforeFill).toString()
    );

    // destination token account should receive to_amount
    const destinationTokenAddress = await getAssociatedTokenAddress(
      mintKey,
      destination.publicKey
    );
    const destinationTokenBalance = (
      await getAccount(connection, destinationTokenAddress)
    ).amount;
    assert.equal(
      destinationTokenBalance.toString(),
      (toAmount.toNumber() - fee).toString()
    );

    // solver_address should receive 11.8 SOL
    let solverBalance = await connection.getBalance(solverAddress.publicKey);
    assert.equal(solverBalance.toString(), swapOrder.amount.toString());

    // native vault account balance should be decreased by 11.8 SOL
    const vaultBalanceAfterFill = await connection.getBalance(
      IntentPda.vaultNative().pda
    );
    assert.equal(
      vaultBalanceAfterFill,
      vaultBalanceBeforeFill - swapOrder.amount
    );

    // order creator should receive order_accont rent after the account is closed
    const creatorBalanceAfterFill = await connection.getBalance(
      creator.publicKey
    );
    assert.equal(
      creatorBalanceAfterFill,
      creatorBalanceBeforeFill + ctx.orderAccountRent
    );
  });

  it("should fill native token and resolve", async () => {
    // creator deposit 5600 SPL token to receive 2.1 SOL

    const toToken = SYSTEM_PROGRAM_ID;
    const toAmount = new anchor.BN(2100000000);
    const token = mintKey;
    const amount = new anchor.BN(5600000000000);

    const solverAddress = Keypair.generate();
    const destination = Keypair.generate();
    const signerBalance = 1000000000 * 10;

    const solver = Keypair.generate();
    const creator = Keypair.generate();
    await txnHelpers.airdrop(solver.publicKey, signerBalance);
    await txnHelpers.airdrop(creator.publicKey, signerBalance);

    // mint token to creator token account which is deposited in token vault account
    await ctx.mintToken(creator.publicKey, amount.toNumber());

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid: srcNid,
      creator: creator.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: token.toString(),
      amount,
      toToken: toToken.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    const swapIx = await getSwapIx(swap);
    const swapTx = await txnHelpers.buildV0Txn([swapIx], [creator]);
    await connection.sendTransaction(swapTx);
    await sleep(2);

    const config = await ctx.getConfig();

    swap.id = config.depositId;
    const swapOrder = SwapOrder.from(swap);

    const feeHandlerBalanceBeforeFill = await connection.getBalance(
      config.feeHandler
    );
    const creatorBalanceBeforeFill = await connection.getBalance(
      creator.publicKey
    );
    const vaultTokenBalanceBeforeFill = (await ctx.getVaultTokenAccount())
      .amount;

    const fillIx = await getFillIx(
      swap,
      solver.publicKey,
      solverAddress.publicKey.toString()
    );
    const computeUintLimit = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1000000,
    });
    const computeBudgeLimit = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 0,
    });
    const fillTx = await txnHelpers.buildV0Txn(
      [computeUintLimit, computeBudgeLimit, fillIx],
      [solver]
    );
    await connection.sendTransaction(fillTx);
    await sleep(2);

    // check destination address balance of order creator
    const destinationBalance = await connection.getBalance(
      destination.publicKey
    );
    const swapFee = ctx.calculateSwapFee(
      config.protocolFee.toNumber(),
      swapOrder.toAmount
    );
    assert.equal(destinationBalance, toAmount.toNumber() - swapFee);

    // check fee handler balance
    const feeHandlerBalanceAfterFill = await connection.getBalance(
      config.feeHandler
    );
    assert.equal(
      feeHandlerBalanceAfterFill,
      feeHandlerBalanceBeforeFill + swapFee
    );

    // check solver balance
    const solverTokenAddress = await getAssociatedTokenAddress(
      mintKey,
      solverAddress.publicKey
    );
    const solverTokenAccount = await getAccount(connection, solverTokenAddress);
    assert.equal(solverTokenAccount.amount.toString(), amount.toString());

    // vault token account balance should be decreased after releasing to solver
    const vaultTokenAccountAfterFill = await ctx.getVaultTokenAccount();
    assert.equal(
      vaultTokenAccountAfterFill.amount.toString(),
      (vaultTokenBalanceBeforeFill - BigInt(amount.toNumber())).toString()
    );

    // order creator should get rent fee of order_account
    const creatorBalanceAfterFill = await connection.getBalance(
      creator.publicKey
    );
    assert.equal(
      creatorBalanceAfterFill,
      creatorBalanceBeforeFill + ctx.orderAccountRent
    );
  });

  it("should fail when destination account doesn't match with destination address", async () => {
    const solver = Keypair.generate();
    const creator = Keypair.generate();
    await txnHelpers.airdrop(solver.publicKey, LAMPORTS_PER_SOL * 10);

    let solverAddress = Keypair.generate();
    let destination = Keypair.generate();
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    const config = await ctx.getConfig();

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: creator.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: mintKey.toString(),
      amount,
      toToken: SYSTEM_PROGRAM_ID.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };
    let swapOrder = SwapOrder.from(swap);

    let fillIx = await intentProgram.methods
      .fill(swap, solverAddress.toString())
      .accountsStrict({
        systemProgram: SYSTEM_PROGRAM_ID,
        signer: solver.publicKey,
        config: IntentPda.config().pda,
        feeHandler: config.feeHandler,
        destinationAddress: Keypair.generate().publicKey,
        orderFinished: IntentPda.orderFinished(swapOrder).pda,
        feeHandlerTokenAccount: null,
        destinationTokenAccount: null,
        signerTokenAccount: null,
        mint: null,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();
    let tx = await txnHelpers.buildV0Txn([fillIx], [solver]);

    try {
      await connection.sendTransaction(tx);
    } catch (err) {
      expect(err.message).to.includes("Destination account is not valid");
    }
  });

  it("should fail when we fill already filled order", async () => {
    const solver = Keypair.generate();
    const creator = Keypair.generate();
    await txnHelpers.airdrop(solver.publicKey, LAMPORTS_PER_SOL * 10);

    let solverAddress = Keypair.generate();
    let destination = Keypair.generate();
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: creator.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: mintKey.toString(),
      amount,
      toToken: SYSTEM_PROGRAM_ID.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };

    const fillIx = await getFillIx(
      swap,
      solver.publicKey,
      solverAddress.publicKey.toString()
    );
    let tx = await txnHelpers.buildV0Txn([fillIx], [solver]);
    await connection.sendTransaction(tx);
    await sleep(2);

    try {
      const newSolver = Keypair.generate();
      await txnHelpers.airdrop(newSolver.publicKey, LAMPORTS_PER_SOL * 10);

      const newFillIx = await getFillIx(
        swap,
        newSolver.publicKey,
        newSolver.publicKey.toString()
      );
      let tx = await txnHelpers.buildV0Txn([newFillIx], [newSolver]);
      await connection.sendTransaction(tx);
    } catch (err) {
      expect(err.message).to.includes("Order has been already filled");
    }
  });

  it("should fail when fee handler account is not valid", async () => {
    const solver = Keypair.generate();
    const creator = Keypair.generate();
    await txnHelpers.airdrop(solver.publicKey, LAMPORTS_PER_SOL * 10);

    let solverAddress = Keypair.generate();
    let destination = Keypair.generate();
    let amount = new anchor.BN(1000000000);
    let toAmount = new anchor.BN(1000000000);

    let swap = {
      id: new anchor.BN(1),
      emitter: intentProgram.programId.toString(),
      srcNid,
      dstNid,
      creator: creator.publicKey.toString(),
      destinationAddress: destination.publicKey.toString(),
      token: mintKey.toString(),
      amount,
      toToken: SYSTEM_PROGRAM_ID.toString(),
      toAmount,
      data: Buffer.from(new Uint8Array()),
    };
    let swapOrder = SwapOrder.from(swap);

    let fillIx = await intentProgram.methods
      .fill(swap, solverAddress.toString())
      .accountsStrict({
        systemProgram: SYSTEM_PROGRAM_ID,
        signer: solver.publicKey,
        config: IntentPda.config().pda,
        feeHandler: Keypair.generate().publicKey,
        destinationAddress: destination.publicKey,
        orderFinished: IntentPda.orderFinished(swapOrder).pda,
        feeHandlerTokenAccount: null,
        destinationTokenAccount: null,
        signerTokenAccount: null,
        mint: null,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();
    let tx = await txnHelpers.buildV0Txn([fillIx], [solver]);

    try {
      await connection.sendTransaction(tx);
    } catch (err) {
      expect(err.message).to.includes("Fee handler account is not valid");
    }
  });
});
