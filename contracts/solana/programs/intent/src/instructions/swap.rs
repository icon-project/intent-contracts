use std::str::FromStr;

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*, error::IntentError, event, helpers, state::*, types::swap_order::SwapOrder,
};

pub fn swap_order(ctx: Context<SwapCtx>, order: SwapOrder) -> Result<()> {
    let mut order = order;

    order.set_emitter(crate::id().to_string());
    order.set_src_nid(ctx.accounts.config.network_id.clone());
    order.set_id(ctx.accounts.config.increment_deposit_id());

    ctx.accounts
        .order_account
        .new(&order, ctx.bumps.order_account);

    // Escrows amount from user
    if order.token() == NATIVE_ADDRESS {
        if ctx.accounts.token_vault_account.is_some() {
            return Err(IntentError::VaultTokenAccountMustNotBeSpecified.into());
        }

        let native_vault_account = ctx
            .accounts
            .native_vault_account
            .as_ref()
            .ok_or(IntentError::NativeVaultAccountIsMissing)?;

        helpers::transfer_sol(
            &ctx.accounts.signer,
            &native_vault_account.to_account_info(),
            order.amount() as u64,
            &ctx.accounts.system_program,
        )?;
    } else {
        let user_token_account = ctx
            .accounts
            .signer_token_account
            .as_ref()
            .ok_or(IntentError::SignerTokenAccountIsMissing)?;

        let token_vault_account = ctx
            .accounts
            .token_vault_account
            .as_ref()
            .ok_or(IntentError::TokenVaultAccountIsMissing)?;

        helpers::transfer_spl_token(
            user_token_account.to_account_info(),
            token_vault_account.to_account_info(),
            ctx.accounts.signer.to_account_info(),
            order.amount() as u64,
            ctx.accounts.token_program.to_account_info(),
        )?;
    }

    emit!(event::SwapIntent {
        id: order.id(),
        emitter: order.emitter(),
        srcNID: order.src_nid(),
        dstNID: order.dst_nid(),
        creator: order.creator(),
        destinationAddress: order.dst_address(),
        token: order.token(),
        amount: order.amount(),
        toToken: order.to_token(),
        toAmount: order.to_amount(),
        data: order.data(),
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(order: SwapOrder)]
pub struct SwapCtx<'info> {
    #[account(
        mut,
        constraint = signer.key().to_string() == order.creator() @IntentError::CreatorMustBeSigner
    )]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,

    #[account(mut)]
    pub config: Box<Account<'info, Config>>,

    #[account(
        init,
        payer = signer,
        space = OrderAccount::SIZE,
        seeds = [
            &signer.key().to_bytes(),
            order.dst_nid().as_bytes(),
            &order.amount().to_be_bytes(),
            &order.to_amount().to_be_bytes()
        ],
        bump
    )]
    pub order_account: Box<Account<'info, OrderAccount>>,

    #[account(
        mut,
        seeds = [VaultNative::SEED_PREFIX.as_bytes()],
        bump
    )]
    pub native_vault_account: Option<Box<Account<'info, VaultNative>>>,

    #[account(
        init_if_needed,
        payer = signer,
        token::mint = mint,
        token::authority = config,
        seeds = [VAULT_TOKEN_SEED_PREFIX.as_bytes(), &Pubkey::from_str(&order.token()).unwrap().to_bytes()],
        bump
    )]
    pub token_vault_account: Option<Box<Account<'info, TokenAccount>>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = signer
    )]
    pub signer_token_account: Option<Box<Account<'info, TokenAccount>>>,

    pub mint: Option<Box<Account<'info, Mint>>>,

    pub token_program: Program<'info, Token>,
}
