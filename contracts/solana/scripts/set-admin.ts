import { PublicKey } from "@solana/web3.js";

import { TxnHelpers } from "./utils/transaction";
import { connection, wallet, intentProgram } from "./setup";
import { IntentPda } from "./setup";

let args = process.argv.slice(2);
if (args.length != 1) throw new Error("Invalid arguments");

const adminKey = new PublicKey(args[0]);

let txnHelpers = new TxnHelpers(connection, wallet.payer);

const setAdmin = async () => {
  return await intentProgram.methods
    .setAdmin(adminKey)
    .accountsStrict({
      admin: wallet.publicKey,
      config: IntentPda.config().pda,
    })
    .signers([wallet.payer])
    .rpc();
};

setAdmin()
  .then(async (sig) => {
    await txnHelpers.logParsedTx(sig);
  })
  .catch((err) => {
    console.log("Error while setting admin: ", err);
  });
