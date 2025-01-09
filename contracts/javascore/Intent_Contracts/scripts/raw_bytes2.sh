#!/bin/bash

export MESSAGE_TYPE=0x1 
export FILL_ID=0x1     
export SOLVER="0x2.icon/hx2510636000161b66745abe841730ad60e4ec8cdc"

export SWAP_ID=0x1
export EMITTER="0x2.icon/cxe85b637445ccb084c3d363c9faa6d06556de08f6"
export SRC_NID="0x2.icon"
export DST_NID="sui-test"
export CREATOR="0x2.icon/cx08f520cde908c2c3f6200348dd77027473ab81a5"
export DEST_ADDRESS="sui-test/0xe65f125538ff216c12106adfa9004813bba39b5fd58f45f453fb1a866e89c800"
export SWAP_TOKEN="0x2.icon/cx08f520cde908c2c3f6200348dd77027473ab81a5"
export AMOUNT=1000000000000000000
export TO_TOKEN="sui-test/0x2::SUI::sui"
export TO_AMOUNT=1000000000000000000
export DATA="hello1"

generate_swap_order() {
    node -e "
        const rlp = require('rlp');
        
        const amount = BigInt('$AMOUNT');
        const toAmount = BigInt('$TO_AMOUNT');
        
        const amountHex = amount.toString(16).padStart(64, '0');
        const toAmountHex = toAmount.toString(16).padStart(64, '0');
        
        const swapOrder = [
            Buffer.from([parseInt('$SWAP_ID')]), 
            Buffer.from('$EMITTER'),
            Buffer.from('$SRC_NID'),
            Buffer.from('$DST_NID'),
            Buffer.from('$CREATOR'),
            Buffer.from('$DEST_ADDRESS'),
            Buffer.from('$SWAP_TOKEN'),
            Buffer.from(amountHex, 'hex'),
            Buffer.from('$TO_TOKEN'),
            Buffer.from(toAmountHex, 'hex'),
            Buffer.from('$DATA')
        ];

        const encodedSwapOrder = rlp.encode(swapOrder);
        console.log(Buffer.from(encodedSwapOrder).toString('hex'));
    "
}

generate_order_fill() {
    local swap_order_hex="$1" 
    node -e "
        const rlp = require('rlp');

        const fillId = BigInt('$FILL_ID');
        const fillIdHex = fillId.toString(16).padStart(64, '0');

        const orderFill = [
            Buffer.from(fillIdHex, 'hex'),            // ID as a 32-byte hex
            Buffer.from('$swap_order_hex', 'hex'),   // Order bytes as RLP-encoded hex
            Buffer.from('$SOLVER', 'utf-8')          // Solver address as UTF-8
        ];

        const encodedOrderFill = rlp.encode(orderFill);
        console.log(Buffer.from(encodedOrderFill).toString('hex'));
    "
}

generate_order_message() {
    local order_fill_hex="$1"
    node -e "
        const rlp = require('rlp');

        const messageType = BigInt('$MESSAGE_TYPE');
        const messageTypeHex = messageType.toString(16).padStart(64, '0');

        const orderMessage = [
            Buffer.from(messageTypeHex, 'hex'),        // Message type as 32-byte hex
            Buffer.from('$order_fill_hex', 'hex')     // OrderFill byte array as message
        ];

        const encodedOrderMessage = rlp.encode(orderMessage);
        console.log(Buffer.from(encodedOrderMessage).toString('hex'));
    "
}

main() {
    swap_order_hex=$(generate_swap_order)

    order_fill_hex=$(generate_order_fill "$swap_order_hex")

    encoded_order_message=$(generate_order_message "$order_fill_hex")

    echo "$encoded_order_message"
}

main
