import * as rlp from "rlp";

export class OrderCancel {
  orderBytes: Uint8Array;

  constructor(orderBytes: Uint8Array) {
    this.orderBytes = orderBytes;
  }

  encode() {
    let rlpInput: rlp.Input = [this.orderBytes];
    return rlp.encode(rlpInput);
  }

  decode(data: Uint8Array) {
    return rlp.decode(data);
  }
}
