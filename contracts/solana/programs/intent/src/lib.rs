use anchor_lang::prelude::*;

pub mod connection;
pub mod constants;
pub mod error;
pub mod event;
pub mod helpers;
pub mod instructions;
pub mod state;
pub mod types;

use error::IntentError;
use instructions::*;
use types::*;

declare_id!("4nTmHeE5qdFuKoqeakERkMn3iFFV2X76zkvdDA26LPCG");

#[program]
pub mod intent {
    use super::*;

    pub fn initialize(
        ctx: Context<InitializeCtx>,
        network_id: String,
        fee_handler: Pubkey,
    ) -> Result<()> {
        instructions::initialize(ctx, fee_handler, network_id)
    }

    pub fn set_admin(ctx: Context<SetAdminCtx>, account: Pubkey) -> Result<()> {
        instructions::set_admin(ctx, account)
    }

    pub fn set_protocol_fee(ctx: Context<SetFeeCtx>, fee: u64) -> Result<()> {
        instructions::set_protocol_fee(ctx, fee)
    }

    pub fn set_fee_handler(ctx: Context<SetFeeHandlerCtx>, fee_handler: Pubkey) -> Result<()> {
        instructions::set_fee_handler(ctx, fee_handler)
    }

    pub fn swap(ctx: Context<SwapCtx>, order: SwapOrder) -> Result<()> {
        instructions::swap_order(ctx, order)
    }

    pub fn fill<'info>(
        ctx: Context<'_, '_, '_, 'info, FillCtx<'info>>,
        order: SwapOrder,
        solver_address: String,
    ) -> Result<()> {
        instructions::order_fill(ctx, order, solver_address)
    }

    #[allow(unused_variables)]
    pub fn cancel<'info>(
        ctx: Context<'_, '_, '_, 'info, CancelCtx<'info>>,
        order: SwapOrder,
    ) -> Result<()> {
        instructions::cancel_order(ctx)
    }

    #[allow(unused_variables)]
    pub fn recv_message<'info>(
        ctx: Context<'_, '_, '_, 'info, RecvMessageCtx<'info>>,
        src_network: String,
        conn_sn: u128,
        msg: Vec<u8>,
    ) -> Result<()> {
        instructions::recv_message(ctx, src_network, msg)
    }

    #[allow(unused_variables)]
    pub fn resolve_fill(
        ctx: Context<ResolveFillCtx>,
        src_network: String,
        fill: OrderFill,
        order: SwapOrder,
    ) -> Result<()> {
        instructions::resolve_fill(ctx, src_network, fill)
    }

    pub fn resolve_cancel<'info>(
        ctx: Context<ResolveCancelCtx>,
        src_network: String,
        cancel: types::order_cancel::Cancel,
        order: SwapOrder,
    ) -> Result<()> {
        instructions::resolve_cancel(
            src_network,
            cancel,
            &order,
            &mut ctx.accounts.config,
            &mut ctx.accounts.order_finished,
            ctx.bumps.order_finished,
        )
    }

    pub fn query_recv_message_accounts(
        ctx: Context<QueryAccountCtx>,
        src_network: String,
        conn_sn: u128,
        msg: Vec<u8>,
        page: u8,
        limit: u8,
    ) -> Result<QueryAccountsPaginateResponse> {
        instructions::query_recv_message_accounts(ctx, src_network, conn_sn, msg, page, limit)
    }
}
