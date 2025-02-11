use anchor_lang::prelude::*;

use super::{order_cancel::Cancel, order_fill::OrderFill, swap_order::SwapOrder};

pub const RESOLVE_FILL_IX: &str = "resolve_fill";
pub const RESOLVE_CANCEL_IX: &str = "resolve_cancel";

pub const QUERY_SWAP_ACCOUNTS_IX: &str = "query_swap_accounts";
pub const QUERY_FILL_ACCOUNTS_IX: &str = "query_fill_accounts";
pub const QUERY_CANCEL_ACCOUNTS_IX: &str = "query_cancel_accounts";
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

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct QueryAccountsPaginateResponse {
    pub accounts: Vec<AccountMetadata>,
    pub total_accounts: u8,
    pub limit: u8,
    pub page: u8,
    pub has_next_page: bool,
}

impl QueryAccountsPaginateResponse {
    pub fn new(accounts: Vec<AccountMetadata>, page: u8, limit: u8) -> Self {
        let offset = ((page - 1) * limit) as usize;
        let total = accounts.len();

        let to_index = if offset + limit as usize > total {
            total
        } else {
            offset + limit as usize
        };

        let accounts = accounts[offset..to_index].to_vec();
        let total_accounts = total as u8;
        let has_next_page = total > to_index;

        QueryAccountsPaginateResponse {
            accounts,
            total_accounts,
            limit,
            page,
            has_next_page,
        }
    }
}
