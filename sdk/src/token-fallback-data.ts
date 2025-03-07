import { encode as rlpEncode } from 'rlp';

export class TokenFallbackData {
    swapOrderData: Uint8Array;
    type: string;
    solver: string | null;

    constructor(
        swapOrderData: Uint8Array,
        type: string,
        solver: string | null = null
    ) {
        this.swapOrderData = swapOrderData;
        this.type = type;
        this.solver = solver;
    }

    /**
     * Converts the TokenFallbackData to RLP encoded bytes for ICON compatibility
     * Matches the Java contract's RLP encoding format
     */
    public toICONBytes(): Uint8Array {
        // Create array of values in the same order as Java contract
        const values = [
            this.swapOrderData,              // byte[] -> Uint8Array
            Buffer.from(this.type),          // string -> bytes
            this.solver ? Buffer.from(this.solver) : Buffer.from([]) // Address -> bytes or empty for null
        ];

        // RLP encode the array
        return new Uint8Array(rlpEncode(values));
    }

    /**
     * Converts the TokenFallbackData to a hex string with '0x' prefix
     */
    public toHex(): string {
        const bytes = this.toICONBytes();
        return '0x' + Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Creates a TokenFallbackData instance for a swap operation
     */
    public static forSwap(swapOrderData: Uint8Array): TokenFallbackData {
        return new TokenFallbackData(swapOrderData, "swap", null);
    }

    /**
     * Creates a TokenFallbackData instance for a fill operation
     */
    public static forFill(swapOrderData: Uint8Array, solver: string): TokenFallbackData {
        return new TokenFallbackData(swapOrderData, "fill", solver);
    }
} 