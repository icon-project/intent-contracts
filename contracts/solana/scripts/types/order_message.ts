import * as rlp from "rlp";

export enum MessageType {
  FILL = 1,
  CANCEL = 2,
}

export class OrderMessage {
  messageType: MessageType;
  message: Uint8Array;

  constructor(messageType: MessageType, message: Uint8Array) {
    this.messageType = messageType;
    this.message = message;
  }

  encode() {
    let rlpInput: rlp.Input = [this.messageType, this.message];
    return rlp.encode(rlpInput);
  }

  decode(data: Uint8Array) {
    return rlp.decode(data);
  }
}
