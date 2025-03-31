use anchor_lang::prelude::*;

use super::{order_cancel::Cancel, order_fill::OrderFill, swap_order::SwapOrder};

pub const RESOLVE_FILL_IX: &str = "resolve_fill";
pub const RESOLVE_CANCEL_IX: &str = "resolve_cancel";

pub const QUERY_RECV_MESSAGE_ACCOUNTS_IX: &str = "query_recv_message_accounts";

#[derive(Debug, Clone)]
pub enum Resolve {
    Fill(OrderFill),
    Cancel(Cancel)
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ResolveFillArgs {
    pub src_network: String,
    pub fill: OrderFill,
    pub order: SwapOrder,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ResolveCancelArgs {
    pub src_network: String,
    pub cancel: Cancel,
    pub order: SwapOrder,
}

#[derive(Debug, Default, PartialEq, Eq, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AccountMetadata {
    pub pubkey: Pubkey,
    pub is_writable: bool,
    pub is_signer: bool,
}

impl AccountMetadata {
    pub fn new(pubkey: Pubkey, is_signer: bool) -> Self {
        Self {
            pubkey,
            is_signer,
            is_writable: true,
        }
    }

    pub fn new_readonly(pubkey: Pubkey, is_signer: bool) -> Self {
        Self {
            pubkey,
            is_signer,
            is_writable: false,
        }
    }
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct QueryAccountsResponse {
    pub accounts: Vec<AccountMetadata>,
}

