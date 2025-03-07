import { encode as rlpEncode } from 'rlp';
import { BigNumberish } from "ethers";

// Define the SwapOrder structure as a TypeScript interface
interface SwapOrderInterface {
    id: BigInt;                         // uint256 -> BigInt (to handle large numbers)
    emitter: string;                    // string -> string
    srcNID: string;                     // string -> string
    dstNID: string;                     // string -> string
    creator: string;                    // string -> string
    destinationAddress: string;         // string -> string
    token: string;                      // string -> string
    amount: BigInt;                     // uint256 -> BigInt
    toToken: string;                    // string -> string
    toAmount: BigInt;                   // uint256 -> BigInt
    data: Uint8Array;                   // bytes -> Uint8Array for raw byte data
}

export class SwapOrder implements SwapOrderInterface {
    id: BigInt;
    emitter: string;
    srcNID: string;
    dstNID: string;
    creator: string;
    destinationAddress: string;
    token: string;
    amount: BigInt;
    toToken: string;
    toAmount: BigInt;
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
        id: BigInt,
        emitter: string,
        srcNID: string,
        dstNID: string,
        creator: string,
        destinationAddress: string,
        token: string,
        amount: BigInt,
        toToken: string,
        toAmount: BigInt,
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
            this.id,                      // uint256 -> BigInt
            this.emitter,                 // string
            this.srcNID,                  // string
            this.dstNID,                  // string
            this.creator,                 // string
            this.destinationAddress,      // string
            this.token,                   // string
            this.amount,                  // uint256 -> BigInt
            this.toToken,                 // string
            this.toAmount,                // uint256 -> BigInt
            this.data                     // bytes -> Uint8Array
        ];
    }

    public toStruct(): any {
        return {
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

    public equals(other: SwapOrder): boolean {
        return (
            this.id === other.id &&
            this.emitter === other.emitter &&
            this.srcNID === other.srcNID &&
            this.dstNID === other.dstNID &&
            this.creator === other.creator &&
            this.destinationAddress === other.destinationAddress &&
            this.token === other.token &&
            this.amount === other.amount &&
            this.toToken === other.toToken &&
            this.toAmount === other.toAmount &&
            this.arrayEquals(this.data, other.data)
        );
    }

    private arrayEquals(a: Uint8Array, b: Uint8Array): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    /**
     * Converts the SwapOrder to RLP encoded bytes for ICON compatibility
     * Matches the Java contract's RLP encoding format
     */
    public toICONBytes(): Uint8Array {
        // Convert BigInt values to hex strings without '0x' prefix
        const idHex = this.id.toString(16).padStart(64, '0');
        const amountHex = this.amount.toString(16).padStart(64, '0');
        const toAmountHex = this.toAmount.toString(16).padStart(64, '0');

        // Create array of values in the same order as Java contract
        const values = [
            this.uintToBytes(this.id.valueOf()),          // uint256 -> bytes
            Buffer.from(this.emitter),          // string -> bytes
            Buffer.from(this.srcNID),           // string -> bytes
            Buffer.from(this.dstNID),           // string -> bytes
            Buffer.from(this.creator),          // string -> bytes
            Buffer.from(this.destinationAddress),// string -> bytes
            Buffer.from(this.token),            // string -> bytes
            this.uintToBytes(this.amount.valueOf()),      // uint256 -> bytes
            Buffer.from(this.toToken),          // string -> bytes
            this.uintToBytes(this.toAmount.valueOf()),    // uint256 -> bytes
            Buffer.from(this.data )                         // already bytes
        ];

        // RLP encode the array
        return new Uint8Array(rlpEncode(values));
    }

    public uintToBytes(x: bigint): Uint8Array {
        if (x === BigInt(0)) {
            return new Uint8Array([0]);
        }
        let right = BigInt(0x80);
        for (let i = 1; i < 32; i++) {
            if (x < right) {
                return this.lastBytesOf(x, i);
            }
            right <<= BigInt(8);
        }
        if (x < right) {
            return rlpEncode(x);
        } else {
            const data = rlpEncode(x);
            data[0] = 0;
            return data;
        }
    }
    
    public lastBytesOf(x: bigint, i: number): Uint8Array {
        const buffer = new ArrayBuffer(i);
        const view = new DataView(buffer);
        for (let j = 0; j < i; j++) {
            view.setUint8(j, Number((x >> BigInt(8 * (i - j - 1))) & BigInt(0xff)));
        }
        return new Uint8Array(buffer);
    }

}