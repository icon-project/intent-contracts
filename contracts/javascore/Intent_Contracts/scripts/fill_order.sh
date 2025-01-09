#!/bin/bash

# Environment variables
export ICON_XCALL_WALLET=$PWD/.keystores/icon_wallet.json
export ICON_RPC_URL="https://lisbon.net.solidwallet.io/api/v3/"
export ICON_CHAIN_ID=2
export PASSWORD="Hanawallet7@"
export ICON_COMMON_ARGS="--uri ${ICON_RPC_URL} --nid ${ICON_CHAIN_ID} --step_limit 100000000000 --key_store ${ICON_XCALL_WALLET} --key_password ${PASSWORD}"

# Contract and transaction parameters
CONTRACT_ADDRESS="cxe85b637445ccb084c3d363c9faa6d06556de08f6"
SOLVER_ADDRESS="0x2.icon/hx2510636000161b66745abe841730ad60e4ec8cdc"

# Swap order data parameters - keep as hex strings
ID="0x4"
EMITTER="0x2.icon/cxe85b637445ccb084c3d363c9faa6d06556de08f6"
SRC_NID="0x2.icon"
DST_NID="sui-test"
CREATOR="0x2.icon/cx08f520cde908c2c3f6200348dd77027473ab81a5"
# DEST_ADDRESS="sui-test/0xe65f125538ff216c12106adfa9004813bba39b5fd58f45f453fb1a866e89c800"
DEST_ADDRESS="0x2.icon/hx2510636000161b66745abe841730ad60e4ec8cdc"
SWAP_TOKEN="0x2.icon/cx08f520cde908c2c3f6200348dd77027473ab81a5"
AMOUNT="1000000000000000000" # 1000000000000000000 in hex
# TO_TOKEN="sui-test/0x2::SUI::sui"
TO_TOKEN="0x2.icon/cx08f520cde908c2c3f6200348dd77027473ab81a5"
TO_AMOUNT="1000000000000000000" # 1000000000000000000 in hex
DATA="hello1"

# Function to generate properly formatted swap order data
generate_swap_order_data() {
    cat << EOF | jq -c .
{
    "id": "${ID}",
    "emitter": "${EMITTER}",
    "srcNID": "${SRC_NID}",
    "dstNID": "${DST_NID}",
    "creator": "${CREATOR}",
    "destinationAddress": "${DEST_ADDRESS}",
    "token": "${SWAP_TOKEN}",
    "amount": "${AMOUNT}",
    "toToken": "${TO_TOKEN}",
    "toAmount": "${TO_AMOUNT}",
    "data": "${DATA}"
}
EOF
}

# Function to call the fill method
call_fill_function() {
    # Generate swap order data
    local swap_order_data=$(generate_swap_order_data)
    
    # Save the swap_order_data to a file for debugging
    echo "${swap_order_data}" > swap_order_data.json
    
    echo "Calling fill function with data:"
    echo "${swap_order_data}"

    # Create the JSON payload
    local json_payload=$(cat <<EOF
{
    "swapOrderData": ${swap_order_data},
    "solverAddress": "${SOLVER_ADDRESS}"
}
EOF
)

    # Save the JSON payload to a file for debugging
    echo "${json_payload}" > json_payload.json

    # Execute the transaction
    local DEPLOY_OUTPUT
    DEPLOY_OUTPUT=$(goloop rpc sendtx call \
        --to "${CONTRACT_ADDRESS}" \
        --method "fill" \
        --params "${json_payload}" \
        ${ICON_COMMON_ARGS})

    local EXIT_CODE=$?
    
    if [ $EXIT_CODE -ne 0 ]; then
        echo "Error: Fill function call failed with exit code $EXIT_CODE"
        echo "Error output: ${DEPLOY_OUTPUT}"
        exit 1
    fi

    # Extract and display transaction hash
    local TX_HASH
    TX_HASH=$(echo "${DEPLOY_OUTPUT}" | grep -oP '(0x[a-fA-F0-9]+)')
    
    if [ -n "$TX_HASH" ]; then
        echo "Fill function called successfully!"
        echo "Transaction hash: ${TX_HASH}"
        echo "Monitor transaction at: ${ICON_RPC_URL}/transaction/${TX_HASH}"
    else
        echo "Warning: Transaction submitted but couldn't extract hash"
        echo "Full response: ${DEPLOY_OUTPUT}"
    fi
}

# Add logging function
log_transaction_attempt() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] Attempting transaction..."
    echo "Contract Address: $CONTRACT_ADDRESS"
    echo "Solver Address: $SOLVER_ADDRESS"
}

# Main execution
main() {
    log_transaction_attempt
    call_fill_function
}

# Execute main function
main
