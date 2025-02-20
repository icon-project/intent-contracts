#![allow(non_snake_case)]

use anchor_lang::prelude::*;

/// Emitted when a new swap intent is created
#[event]
pub struct SwapIntent {
    // The ID of the swap order
    pub id: u128,
    // Address of emitter contract
    pub emitter: String,
    // The source network ID
    pub srcNID: String,
    // The destination network ID
    pub dstNID: String,
    // The address of the creator of the swap order
    pub creator: String,
    // The address where the swapped tokens will be sent
    pub destinationAddress: String,
    // The address of the token being swapped
    pub token: String,
    // The amount of token being swapped
    pub amount: u128,
    // The token to be received after the swap
    pub toToken: String,
    // The amount of tokens to be receive after the swap
    pub toAmount: u128,
    // Additional arbitrary data for the swap
    pub data: Vec<u8>,
}

// Emitted when a swap order is filled
#[event]
pub struct OrderFilled {
    // The ID of the order being filled
    pub id: u128,
    // The source network ID of the swap order
    pub srcNID: String,
}

// Emitted when a swap order is cancelled
#[event]
pub struct OrderCancelled {
    // The ID of the order being cancelled
    pub id: u128,
    // The source network ID where the order was created
    pub srcNID: String,
}

// Emitted when a swap order is completed
#[event]
pub struct OrderClosed {
    // The ID of the order
    pub id: u128,
}

/// Emitted when a cross-chain message is sent
#[event]
pub struct SendMessage {
    // The ID of the target network
    pub targetNetwork: String,
    // The connection sequence number
    pub sn: u128,
    // The rlp encoded message being sent to other chain
    pub msg: Vec<u8>,
}
