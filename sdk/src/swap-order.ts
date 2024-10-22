import { BigNumberish } from "ethers";

// Define the SwapOrder structure as a TypeScript interface
interface SwapOrderInterface {
    id: BigNumberish;                         // uint256 -> bigint (to handle large numbers)
    emitter: string;                    // string -> string
    srcNID: string;                     // string -> string
    dstNID: string;                     // string -> string
    creator: string;                    // string -> string
    destinationAddress: string;         // string -> string
    token: string;                      // string -> string
    amount: bigint;                     // uint256 -> bigint
    toToken: string;                    // string -> string
    toAmount: bigint;                   // uint256 -> bigint
    data: Uint8Array;                   // bytes -> Uint8Array for raw byte data
}

export class SwapOrder implements SwapOrderInterface {
    id: BigNumberish;
    emitter: string;
    srcNID: string;
    dstNID: string;
    creator: string;
    destinationAddress: string;
    token: string;
    amount: bigint;
    toToken: string;
    toAmount: bigint;
    data: Uint8Array;

    public PERMIT2_STRUCT = [
        { name: 'id', type: 'uint256' },
        { name: 'emitter', type: 'string' },
        { name: 'srcNID', type: 'string' },
        { name: 'dstNID', type: 'string' },
        { name: 'creator', type: 'string' },
        { name: 'destinationAddress', type: 'string' },
        { name: 'token', type: 'string' },
        { name: 'amount', type: 'uint256' },
        { name: 'toToken', type: 'string' },
        { name: 'toAmount', type: 'uint256' },
        { name: 'data', type: 'bytes' }
    ];

    constructor(
        id: bigint,
        emitter: string,
        srcNID: string,
        dstNID: string,
        creator: string,
        destinationAddress: string,
        token: string,
        amount: bigint,
        toToken: string,
        toAmount: bigint,
        data: Uint8Array
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

    public toData(): any[] {
        return [
            this.id,                      // uint256 -> bigint
            this.emitter,                 // string
            this.srcNID,                  // string
            this.dstNID,                  // string
            this.creator,                 // string
            this.destinationAddress,      // string
            this.token,                   // string
            this.amount,                  // uint256 -> bigint
            this.toToken,                 // string
            this.toAmount,                // uint256 -> bigint
            this.data                     // bytes -> Uint8Array
        ];
    }

    public toStruct(): any {
        return  {
            id: this.id,
            emitter: this.emitter,
            srcNID: this.srcNID,
            dstNID: this.dstNID,
            creator: this.creator,
            destinationAddress: this.destinationAddress,
            token: this.token,
            amount: this.amount,
            toToken: this.toToken,
            toAmount: this.toAmount,
            data: this.data,
        };
    }

}