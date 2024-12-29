import * as rlp from "rlp";
import * as anchor from "@coral-xyz/anchor";

export class SwapOrder {
  id: number;
  emitter: string;
  srcNID: string;
  dstNID: string;
  creator: string;
  destinationAddress: string;
  token: string;
  amount: number;
  toToken: string;
  toAmount: number;
  data: Buffer;

  constructor(
    id: number,
    emitter: string,
    srcNID: string,
    dstNID: string,
    creator: string,
    destinationAddress: string,
    token: string,
    amount: number,
    toToken: string,
    toAmount: number,
    data: Buffer
  ) {
    this.id = id;
    this.emitter = emitter;
    this.srcNID = srcNID;
    this.dstNID = dstNID;
    this.creator = creator;
    this.destinationAddress = destinationAddress;
    this.token = token;
    this.amount = amount;
    this.toToken = toToken;
    this.toAmount = toAmount;
    this.data = data;
  }

  static from(swap: any): SwapOrder {
    return new SwapOrder(
      swap.id.toNumber(),
      swap.emitter,
      swap.srcNid,
      swap.dstNid,
      swap.creator,
      swap.destinationAddress,
      swap.token,
      swap.amount.toNumber(),
      swap.toToken,
      swap.toAmount.toNumber(),
      swap.data
    );
  }

  encode() {
    let rlpInput: rlp.Input = [
      this.id,
      this.emitter,
      this.srcNID,
      this.dstNID,
      this.creator,
      this.destinationAddress,
      this.token,
      this.amount,
      this.toToken,
      this.toAmount,
      this.data,
    ];
    return rlp.encode(rlpInput);
  }

  decode(data: Buffer) {
    return rlp.decode(data);
  }
}
