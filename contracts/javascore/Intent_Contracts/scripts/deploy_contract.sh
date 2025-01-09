#!/bin/bash

export ICON_XCALL_WALLET=$PWD/.keystores/icon_wallet.json
# export ICON_XCALL_WALLET=$PWD/.keystores/icon_wallet2.json
export ICON_RPC_URL="https://lisbon.net.solidwallet.io/api/v3/"
export ICON_CHAIN_ID=2
export PASSWORD="Hanawallet7@"
export CONTRACT_ADDRESS="cxe85b637445ccb084c3d363c9faa6d06556de08f6"
export ICON_COMMON_ARGS="--uri ${ICON_RPC_URL} --nid ${ICON_CHAIN_ID} --to ${CONTRACT_ADDRESS} --step_limit 100000000000 --key_store ${ICON_XCALL_WALLET} --key_password ${PASSWORD}"

function deploy_cluster_connection() {
    JAR_PATH="./app/build/libs/intent1.jar-optimized.jar"
    CONTENT_TYPE="application/java"
    NETWORK_ID="0x2.icon"
    PROTOCOL_FEE=1
    FEE_HANDLER="hx2510636000161b66745abe841730ad60e4ec8cdc"
    RELAYER="hx2510636000161b66745abe841730ad60e4ec8cdc"

    DEPLOY_OUTPUT=$(goloop rpc sendtx deploy "${JAR_PATH}" \
        --content_type "${CONTENT_TYPE}" \
        ${ICON_COMMON_ARGS} \
        --param _nid="${NETWORK_ID}" \
        --param _protocolFee="${PROTOCOL_FEE}" \
        --param _feeHandler="${FEE_HANDLER}" \
        --param _relayer="${RELAYER}")

    TX_HASH="${DEPLOY_OUTPUT}"

    if [[ $? -ne 0 ]]; then
        echo "Error: Contract deployment failed."
        echo "${DEPLOY_OUTPUT}"
        exit 1
    fi

    echo "Deployment successful! Transaction hash: ${TX_HASH}"
}

deploy_cluster_connection

#contract address : cxf66d35d094020bcb048512f4e08573ca5f392ee0 