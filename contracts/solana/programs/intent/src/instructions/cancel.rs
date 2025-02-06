use anchor_lang::prelude::*;

use crate::{
    connection,
    error::*,
    event, helpers,
    state::*,
    types::{
        order_cancel::Cancel,
        order_fill::OrderFill,
        order_message::{MessageType, OrderMessage},
        swap_order::SwapOrder,
    },
};

pub fn cancel_order<'info>(ctx: Context<'_, '_, '_, 'info, CancelCtx<'info>>) -> Result<()> {
    let order = &ctx.accounts.order_account.order;
    let config = &mut ctx.accounts.config;

    let cancel = Cancel::new(order.encode());

    if order.src_nid() == order.dst_nid() {
        let order_finished = ctx
            .accounts
            .order_finished
            .as_mut()
            .ok_or(IntentError::OrderFinishedAccountIsMissing)?;

        resolve_cancel(
            config.network_id.clone(),
            cancel,
            order,
            config,
            order_finished,
            ctx.bumps.order_finished.unwrap(),
        )?;
        return Ok(());
    }

    if ctx.accounts.order_finished.is_some() {
        return Err(IntentError::OrderFinishedAccountMustNotBeSpecified.into());
    }

    let order_msg = OrderMessage::new(MessageType::CANCEL, cancel.encode());
    connection::send_message(config, order.dst_nid(), order_msg.encode())
}

pub fn resolve_cancel<'info>(
    src_network: String,
    cancel: Cancel,
    order: &SwapOrder,
    config: &mut Account<'info, Config>,
    order_finished: &mut Account<'info, OrderFinished>,
    order_finished_bump: u8,
) -> Result<()> {
    if src_network != order.src_nid() {
        return Err(IntentError::InvalidNetwork.into());
    }

    if order_finished.finished {
        return Ok(());
    }
    order_finished.new(order_finished_bump);

    let fill = OrderFill::new(order.id(), cancel.order_bytes(), order.creator());
    let order_msg = OrderMessage::new(MessageType::FILL, fill.encode());

    connection::send_message(config, order.src_nid(), order_msg.encode())?;

    emit!(event::OrderCancelled {
        id: order.id(),
        srcNID: order.src_nid(),
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(order: SwapOrder)]
pub struct CancelCtx<'info> {
    #[account(
        mut,
        constraint = signer.key().to_string() == order_account.order.creator() @IntentError::CreatorMustBeSigner
    )]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,

    #[account(mut)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [
            &signer.key().to_bytes(),
            order.dst_nid().as_bytes(),
            &order.amount().to_be_bytes(),
            &order.to_amount().to_be_bytes()
        ],
        bump = order_account.bump
    )]
    pub order_account: Account<'info, OrderAccount>,

    #[account(
        init_if_needed,
        space = OrderFinished::SIZE,
        payer = signer,
        seeds = [&order.get_hash()],
        bump
      )]
    pub order_finished: Option<Account<'info, OrderFinished>>,
}

#[derive(Accounts)]
#[instruction(src_network: String, cancel: Cancel)]
pub struct ResolveCancelCtx<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,

    #[account(
        owner = crate::id()
    )]
    pub intent: Signer<'info>,

    #[account(mut)]
    pub config: Account<'info, Config>,

    #[account(
        init_if_needed,
        space = OrderFinished::SIZE,
        payer = signer,
        seeds = [&helpers::hash_data(&cancel.order_bytes())],
        bump
      )]
    pub order_finished: Account<'info, OrderFinished>,
}
