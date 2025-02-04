use std::str::FromStr;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{
    connection,
    constants::*,
    error::*,
    event,
    helpers::*,
    recv_message::*,
    state::*,
    types::{
        order_fill::OrderFill,
        order_message::{MessageType, OrderMessage},
        swap_order::SwapOrder,
        misc::Resolve,
    },
};

pub fn order_fill<'info>(
    ctx: Context<'_, '_, '_, 'info, FillCtx<'info>>,
    order: SwapOrder,
    solver_address: String,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let order_fnished = &mut ctx.accounts.order_finished;

    if order.dst_address() != ctx.accounts.destination_address.key().to_string() {
        return Err(IntentError::InvalidDestinationAccount.into());
    }

    if order_fnished.finished {
        return Err(IntentError::OrderAlreadyFilled.into());
    }
    order_fnished.new(ctx.bumps.order_finished);

    let fee = (order.to_amount() as u64 * config.protocol_fee) / 10_000;
    let to_amount = order.to_amount() as u64 - fee;

    if order.to_token() == NATIVE_ADDRESS {
        transfer_sol(
            &ctx.accounts.signer,
            &ctx.accounts.destination_address,
            to_amount,
            &ctx.accounts.system_program,
        )?;
        transfer_sol(
            &ctx.accounts.signer,
            &ctx.accounts.fee_handler,
            fee,
            &ctx.accounts.system_program,
        )?;
    } else {
        let signer_token_account = ctx
            .accounts
            .signer_token_account
            .as_ref()
            .ok_or(IntentError::SignerTokenAccountIsMissing)?;

        let destination_token_account = ctx
            .accounts
            .destination_token_account
            .as_ref()
            .ok_or(IntentError::CreatorTokenAccountIsMissing)?;

        let fee_handler_token_account = ctx
            .accounts
            .fee_handler_token_account
            .as_ref()
            .ok_or(IntentError::FeeHandlerTokenAccountIsMissing)?;

        transfer_spl_token(
            signer_token_account.to_account_info(),
            destination_token_account.to_account_info(),
            ctx.accounts.signer.to_account_info(),
            to_amount,
            ctx.accounts.token_program.to_account_info(),
        )?;
        transfer_spl_token(
            signer_token_account.to_account_info(),
            fee_handler_token_account.to_account_info(),
            ctx.accounts.signer.to_account_info(),
            fee,
            ctx.accounts.token_program.to_account_info(),
        )?;
    }

    let fill = OrderFill::new(order.id(), order.encode(), solver_address);

    if order.src_nid() == order.dst_nid() {
        invoke_resolve(
            config.network_id.clone(),
            Resolve::Fill(fill),
            order,
            &ctx.accounts.signer,
            &ctx.accounts.system_program,
            ctx.remaining_accounts,
            &config.to_account_info(),
            &[&[Config::SEED_PREFIX.as_bytes(), &[ctx.accounts.config.bump]]],
        )?;
        return Ok(());
    }

    let order_msg = OrderMessage::new(MessageType::FILL, fill.encode());
    connection::send_message(config, order.dst_nid(), order_msg.encode())?;

    event::OrderFilled {
        id: order.id(),
        srcNID: order.src_nid(),
    };

    Ok(())
}

pub fn resolve_fill(
    ctx: Context<ResolveFillCtx>,
    src_network: String,
    fill: OrderFill,
) -> Result<()> {
    let order = &mut ctx.accounts.order_account.order;

    if order.get_hash() != hash_data(&fill.order_bytes()) {
        return Err(IntentError::OrderMismatched.into());
    }

    if src_network != order.dst_nid() {
        return Err(IntentError::InvalidNetwork.into());
    }

    if order.token() == NATIVE_ADDRESS {
        let vault_native_account = ctx
            .accounts
            .vault_native_account
            .as_mut()
            .ok_or(IntentError::VaultNativeAccountIsMissing)?;

        transfer_sol_signed(
            &vault_native_account.to_account_info(),
            &ctx.accounts.solver.to_account_info(),
            order.amount() as u64,
        )?;
    } else {
        let vault_token_account = ctx
            .accounts
            .vault_token_account
            .as_ref()
            .ok_or(IntentError::VaultTokenAccountIsMissing)?;

        let solver_token_account = ctx
            .accounts
            .solver_token_account
            .as_ref()
            .ok_or(IntentError::SolverTokenAccountIsMissing)?;

        transfer_spl_token_signed(
            vault_token_account.to_account_info(),
            solver_token_account.to_account_info(),
            ctx.accounts.config.to_account_info(),
            order.amount() as u64,
            ctx.accounts.token_program.to_account_info(),
            &ctx.accounts.config,
        )?;
    }

    event::OrderClosed { id: order.id() };

    Ok(())
}

#[derive(Accounts)]
#[instruction(order: SwapOrder)]
pub struct FillCtx<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,

    #[account(mut)]
    pub config: Box<Account<'info, Config>>,

    /// CHECK: The account which receives the protocol fee for each order being filled.
    /// This account is validated against `config.fee_handler`.
    #[account(
        mut,
        address = config.fee_handler @ IntentError::InvalidFeeHandler
    )]
    pub fee_handler: AccountInfo<'info>,

    /// CHECK: The destination address where order creator wants to receive the intent
    /// order. This account is validated in instruction.
    #[account(mut)]
    pub destination_address: AccountInfo<'info>,

    #[account(
        init_if_needed,
        space = OrderFinished::SIZE,
        payer = signer,
        seeds = [&order.get_hash()],
        bump
    )]
    pub order_finished: Box<Account<'info, OrderFinished>>,

    /// The associated token account of fee handler of the intent program
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = fee_handler
    )]
    pub fee_handler_token_account: Option<Box<Account<'info, TokenAccount>>>,

    /// The assocaited token account derived from `destination_address`.
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = destination_address
    )]
    pub destination_token_account: Option<Box<Account<'info, TokenAccount>>>,

    /// The token account of the signer
    #[account(
        mut,
        token::mint = mint,
        token::authority = signer
    )]
    pub signer_token_account: Option<Box<Account<'info, TokenAccount>>>,

    #[account(
        constraint = mint.key().to_string() == order.to_token() @IntentError::MintAccountMismatch
    )]
    pub mint: Option<Box<Account<'info, Mint>>>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(src_network: String, fill: OrderFill, order: SwapOrder)]
pub struct ResolveFillCtx<'info> {
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
        mut,
        seeds = [
            &order_creator.key().to_bytes(),
            order.dst_nid().as_bytes(),
            &order.amount().to_be_bytes(),
            &order.to_amount().to_be_bytes()
        ],
        bump = order_account.bump,
        close = order_creator
    )]
    pub order_account: Account<'info, OrderAccount>,

    /// CHECK: The order creator account validated against `order_account.order.creator`
    #[account(
        mut,
        constraint = order_creator.key().to_string() == order.creator()
    )]
    pub order_creator: AccountInfo<'info>,

    /// CHECK: The account of the solver to receive fund intent locked amount in source chain
    /// This account is validated against `fill.solver`.
    #[account(
        mut,
        constraint = solver.key().to_string() == fill.solver() @IntentError::InvalidSolverAccount
    )]
    pub solver: AccountInfo<'info>,

    /// The solver token account
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = solver
      )]
    pub solver_token_account: Option<Account<'info, TokenAccount>>,

    /// Vault native account
    #[account(
        mut,
        seeds = [VaultNative::SEED_PREFIX.as_bytes()],
        bump = vault_native_account.bump
      )]
    pub vault_native_account: Option<Account<'info, VaultNative>>,

    /// Vault token account
    #[account(
        mut,
        token::mint = mint,
        token::authority = config,
        seeds = [VAULT_TOKEN_SEED_PREFIX.as_bytes(), &Pubkey::from_str(&order.token()).unwrap().to_bytes()],
        bump
      )]
    pub vault_token_account: Option<Account<'info, TokenAccount>>,

    #[account(
        constraint = mint.key().to_string() == order_account.order.token() @IntentError::MintAccountMismatch
    )]
    pub mint: Option<Account<'info, Mint>>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}
