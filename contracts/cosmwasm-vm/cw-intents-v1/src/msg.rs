use cosmwasm_schema::{cw_serde, QueryResponses};

#[cw_serde]
pub struct InstantiateMsg {
    pub fee_handler: String,
    pub nid: String,
    pub fee: u8,
    pub relayer: String,
}

#[cw_serde]
pub enum ExecuteMsg {
    Swap {
        dst_nid: String,
        token: String,
        amount: u128,
        to_token: String,
        destination_address: String,
        min_receive: u128,
        data: Vec<u8>,
    },
    Fill {
        id: u128,
        emitter: String,
        src_nid: String,
        dst_nid: String,
        creator: String,
        destination_address: String,
        token: String,
        amount: u128,
        to_token: String,
        to_amount: u128,
        data: Vec<u8>,
        solver_address: String,
    },
    Cancel {
        order_id: u128
    },
    RecvMessage {
        src_network: String,
        conn_sn: u128,
        msg: Vec<u8>,
    },
}

#[cw_serde]
#[derive(QueryResponses)]
/// This is a Rust enum representing different types of queries that can be made to the contract. Each
/// variant of the enum corresponds to a specific query and has a return type specified using the
/// `#[returns]` attribute.
pub enum QueryMsg {
    #[returns(u64)]
    GetOrder { id: u128 },

    #[returns(u64)]
    GetDepositId {},
    #[returns(String)]
    GetFeeHandler {},
}
