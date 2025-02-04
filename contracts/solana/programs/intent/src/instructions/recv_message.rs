use anchor_lang::{
    prelude::*,
    solana_program::{instruction::Instruction, program::invoke_signed},
};

use crate::{
    connection,
    error::IntentError,
    helpers,
    misc::*,
    state::*,
    types::{
        order_cancel::Cancel,
        order_fill::OrderFill,
        order_message::{MessageType, OrderMessage},
        swap_order::SwapOrder,
    },
};

pub fn recv_message<'info>(
    ctx: Context<'_, '_, '_, 'info, RecvMessageCtx<'info>>,
    src_network: String,
    msg: Vec<u8>,
) -> Result<()> {
    connection::recv_message(&mut ctx.accounts.receipt, ctx.bumps.receipt)?;

    let order_msg = OrderMessage::try_from(&msg)?;
    match order_msg.message_type() {
        MessageType::FILL => {
            let fill = OrderFill::try_from(&order_msg.message())?;
            let order = SwapOrder::try_from(&fill.order_bytes())?;
            invoke_resolve(
                src_network.clone(),
                Resolve::Fill(fill),
                order,
                &ctx.accounts.signer,
                &ctx.accounts.system_program,
                ctx.remaining_accounts,
                &ctx.accounts.config.to_account_info(),
                &[&[Config::SEED_PREFIX.as_bytes(), &[ctx.accounts.config.bump]]],
            )
        }
        MessageType::CANCEL => {
            let cancel = Cancel::try_from(&order_msg.message())?;
            let order = SwapOrder::try_from(&cancel.order_bytes())?;
            invoke_resolve(
                src_network.clone(),
                Resolve::Cancel(cancel),
                order,
                &ctx.accounts.signer,
                &ctx.accounts.system_program,
                ctx.remaining_accounts,
                &ctx.accounts.config.to_account_info(),
                &[&[Config::SEED_PREFIX.as_bytes(), &[ctx.accounts.config.bump]]],
            )
        }
    }
}

pub fn invoke_resolve<'info>(
    src_network: String,
    resolve: Resolve,
    order: SwapOrder,
    signer: &Signer<'info>,
    system_program: &Program<'info, System>,
    remaining_accounts: &[AccountInfo<'info>],
    program_signer: &AccountInfo<'info>,
    signers_seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = vec![];
    let mut ix_name = RESOLVE_FILL_IX;
    
    match resolve {
        Resolve::Fill(fill) => {
            let args = ResolveFillArgs {
                src_network: src_network.clone(),
                fill,
                order,
            };
            args.serialize(&mut data)?;
        },
        Resolve::Cancel(cancel) => {
            let args = ResolveCancelArgs {
                src_network: src_network.clone(),
                cancel,
                order,
            };
            args.serialize(&mut data)?;
            ix_name = RESOLVE_CANCEL_IX;
        },
    }

    let ix_data = helpers::get_instruction_data(ix_name, data);

    let mut account_metas: Vec<AccountMeta> = vec![
        AccountMeta::new(signer.key(), true),
        AccountMeta::new_readonly(system_program.key(), false),
        AccountMeta::new_readonly(program_signer.key(), true),
    ];
    let mut account_infos: Vec<AccountInfo<'info>> = vec![
        system_program.to_account_info(),
        signer.to_account_info(),
        program_signer.to_account_info(),
    ];

    for account in remaining_accounts {
        if account.is_writable {
            account_metas.push(AccountMeta::new(account.key(), account.is_signer))
        } else {
            account_metas.push(AccountMeta::new_readonly(account.key(), account.is_signer))
        }
        account_infos.push(account.to_account_info());
    }

    let ix = Instruction {
        program_id: crate::id(),
        accounts: account_metas,
        data: ix_data,
    };

    invoke_signed(&ix, &account_infos, signers_seeds)?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(src_network: String, conn_sn: u128)]
pub struct RecvMessageCtx<'info> {
    #[account(
        mut,
        address = config.admin @IntentError::OnlyRelayer
    )]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,

    pub config: Account<'info, Config>,

    #[account(
        init_if_needed,
        payer = signer,
        space = Receipt::SIZE,
        seeds = [Receipt::SEED_PREFIX.as_bytes(), src_network.as_bytes(), &conn_sn.to_be_bytes()],
        bump
    )]
    pub receipt: Account<'info, Receipt>,
}
