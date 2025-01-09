#!/bin/bash
# [249, 1, 158, 1, 185, 1, 154, 249, 1, 151, 1, 185, 1, 79, 249, 1, 76, 1, 179, 48, 120, 50, 46, 105, 99, 111, 110, 47, 99, 120, 101, 56, 53, 98, 54, 51, 55, 52, 52, 53, 99, 99, 98, 48, 56, 52, 99, 51, 100, 51, 54, 51, 99, 57, 102, 97, 97, 54, 100, 48, 54, 53, 53, 54, 100, 101, 48, 56, 102, 54, 136, 48, 120, 50, 46, 105, 99, 111, 110, 136, 115, 117, 105, 45, 116, 101, 115, 116, 179, 48, 120, 50, 46, 105, 99, 111, 110, 47, 99, 120, 48, 56, 102, 53, 50, 48, 99, 100, 101, 57, 48, 56, 99, 50, 99, 51, 102, 54, 50, 48, 48, 51, 52, 56, 100, 100, 55, 55, 48, 50, 55, 52, 55, 51, 97, 98, 56, 49, 97, 53, 184, 66, 48, 120, 101, 54, 53, 102, 49, 50, 53, 53, 51, 56, 102, 102, 50, 49, 54, 99, 49, 50, 49, 48, 54, 97, 100, 102, 97, 57, 48, 48, 52, 56, 49, 51, 98, 98, 97, 51, 57, 98, 53, 102, 100, 53, 56, 102, 52, 53, 102, 52, 53, 51, 102, 98, 49, 97, 56, 54, 54, 101, 56, 57, 99, 56, 48, 48, 179, 48, 120, 50, 46, 105, 99, 111, 110, 47, 99, 120, 48, 56, 102, 53, 50, 48, 99, 100, 101, 57, 48, 56, 99, 50, 99, 51, 102, 54, 50, 48, 48, 51, 52, 56, 100, 100, 55, 55, 48, 50, 55, 52, 55, 51, 97, 98, 56, 49, 97, 53, 132, 59, 154, 202, 0, 184, 76, 48, 120, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 50, 58, 58, 115, 117, 105, 58, 58, 83, 85, 73, 132, 59, 154, 202, 0, 128, 184, 66, 48, 120, 101, 54, 53, 102, 49, 50, 53, 53, 51, 56, 102, 102, 50, 49, 54, 99, 49, 50, 49, 48, 54, 97, 100, 102, 97, 57, 48, 48, 52, 56, 49, 51, 98, 98, 97, 51, 57, 98, 53, 102, 100, 53, 56, 102, 52, 53, 102, 52, 53, 51, 102, 98, 49, 97, 56, 54, 54, 101, 56, 57, 99, 56, 48, 48]

# Configuration
export ICON_XCALL_WALLET=$PWD/.keystores/icon_wallet.json
export ICON_RPC_URL="https://lisbon.net.solidwallet.io/api/v3/"
export ICON_CHAIN_ID=2
export PASSWORD="Hanawallet7@"
export ICON_COMMON_ARGS="--uri ${ICON_RPC_URL} --nid ${ICON_CHAIN_ID} --step_limit 100000000000 --key_store ${ICON_XCALL_WALLET} --key_password ${PASSWORD}"

CONTRACT_ADDRESS="cxe85b637445ccb084c3d363c9faa6d06556de08f6"

function recv_message() {
    local SRC_NETWORK="sui-test"
    local CONN_SN="1"

    local RAW_BYTES=$(./scripts/raw_bytes2.sh)

    echo "Source Network: ${SRC_NETWORK}"
    echo "Connection SN: ${CONN_SN}"
    echo "Raw Bytes: ${RAW_BYTES}"

    DEPLOY_OUTPUT=$(goloop rpc sendtx call \
        --to "${CONTRACT_ADDRESS}" \
        --method "recvMessage" \
        --param srcNetwork="${SRC_NETWORK}" \
        --param _connSn="${CONN_SN}" \
        --param _msg="${RAW_BYTES}" \
        ${ICON_COMMON_ARGS})

    if [[ $? -ne 0 ]]; then
        echo "Error: recvMessage invocation failed."
        echo "${DEPLOY_OUTPUT}"
        exit 1
    fi

    TX_HASH=$(echo "${DEPLOY_OUTPUT}" | grep -oP '(0x[a-fA-F0-9]+)')

    echo "recvMessage invocation successful! Transaction hash: ${TX_HASH}"
}

recv_message
