import * as rlp from "rlp";

export class OrderFill {
  id: number;
  orderBytes: Uint8Array;
  solver: string;

  constructor(id: number, orderBytes: Uint8Array, solver: string) {
    this.id = id;
    this.orderBytes = orderBytes;
    this.solver = solver;
  }

  encode() {
    let rlpInput: rlp.Input = [this.id, this.orderBytes, this.solver];
    return rlp.encode(rlpInput);
  }

  decode(data: Uint8Array) {
    return rlp.decode(data);
  }
}
