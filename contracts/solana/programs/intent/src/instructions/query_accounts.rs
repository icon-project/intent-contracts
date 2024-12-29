use std::str::FromStr;

use anchor_lang::{prelude::*, solana_program::system_program};
use anchor_spl::{
    associated_token::{get_associated_token_address, AssociatedToken},
    token::Token,
};

use crate::{
    constants::*, misc::*, order_cancel::*, order_message::*, state::*, OrderFill, SwapOrder,
};

pub fn query_swap_accounts(
    ctx: Context<QueryAccountCtx>,
    swap_order: SwapOrder,
    page: u8,
    limit: u8,
) -> Result<QueryAccountsPaginateResponse> {
    let config = &ctx.accounts.config;

    let signer = Pubkey::from_str(&swap_order.creator()).unwrap();
    let (order_pda, _) = Pubkey::find_program_address(
        &[
            &signer.to_bytes(),
            swap_order.dst_nid().as_bytes(),
            &swap_order.amount().to_be_bytes(),
            &swap_order.to_amount().to_be_bytes(),
        ],
        &crate::id(),
    );
    let (vault_native_pda, _) =
        Pubkey::find_program_address(&[VaultNative::SEED_PREFIX.as_bytes()], &crate::id());

    let mut account_metas = vec![
        AccountMetadata::new_readonly(system_program::id(), false),
        AccountMetadata::new(config.key(), false),
        AccountMetadata::new(order_pda, false),
    ];

    if swap_order.token() == NATIVE_ADDRESS {
        account_metas.push(AccountMetadata::new(vault_native_pda, false));

        account_metas.push(AccountMetadata::new_readonly(crate::id(), false));
        account_metas.push(AccountMetadata::new_readonly(crate::id(), false));
        account_metas.push(AccountMetadata::new_readonly(crate::id(), false));
    } else {
        let token_mint_address = Pubkey::from_str(&swap_order.token()).unwrap();
        let signer_token = get_associated_token_address(&signer, &token_mint_address);

        let (vault_token_pda, _) = Pubkey::find_program_address(
            &[
                VAULT_TOKEN_SEED_PREFIX.as_bytes(),
                &token_mint_address.to_bytes(),
            ],
            &crate::id(),
        );

        // Vault native account (null)
        account_metas.push(AccountMetadata::new_readonly(crate::id(), false));

        // Vault token account
        account_metas.push(AccountMetadata::new(vault_token_pda, false));

        // Signer token account
        account_metas.push(AccountMetadata::new(signer_token, false));

        // Token mint
        account_metas.push(AccountMetadata::new(token_mint_address, false));
    }

    // Token program
    account_metas.push(AccountMetadata::new_readonly(Token::id(), false));

    Ok(QueryAccountsPaginateResponse::new(
        account_metas,
        page,
        limit,
    ))
}

pub fn query_recv_message_accounts(
    ctx: Context<QueryAccountCtx>,
    src_network: String,
    conn_sn: u128,
    msg: Vec<u8>,
    page: u8,
    limit: u8,
) -> Result<QueryAccountsPaginateResponse> {
    let config = &ctx.accounts.config;

    let (receipt_pda, _) = Pubkey::find_program_address(
        &[
            Receipt::SEED_PREFIX.as_bytes(),
            src_network.as_bytes(),
            &conn_sn.to_be_bytes(),
        ],
        &crate::id(),
    );

    let mut account_metas = vec![
        AccountMetadata::new_readonly(system_program::id(), false),
        AccountMetadata::new_readonly(config.key(), false),
        AccountMetadata::new(receipt_pda, false),
        AccountMetadata::new(config.key(), false),
    ];

    let order_msg = OrderMessage::try_from(&msg).unwrap();
    match order_msg.message_type() {
        MessageType::FILL => {
            let fill = OrderFill::try_from(&order_msg.message()).unwrap();
            let order = SwapOrder::try_from(&fill.order_bytes()).unwrap();

            let order_creator = Pubkey::from_str(&order.creator()).unwrap();
            let solver = Pubkey::from_str(&fill.solver()).unwrap();

            let (order_pda, _) = Pubkey::find_program_address(
                &[
                    &order_creator.to_bytes(),
                    order.dst_nid().as_bytes(),
                    &order.amount().to_be_bytes(),
                    &order.to_amount().to_be_bytes(),
                ],
                &crate::id(),
            );

            // Order account
            account_metas.push(AccountMetadata::new(order_pda, false));

            // Order creator
            account_metas.push(AccountMetadata::new(order_creator, false));

            // Solver account
            account_metas.push(AccountMetadata::new(solver, false));

            if order.token() == NATIVE_ADDRESS {
                let (vault_native_pda, _) = Pubkey::find_program_address(
                    &[VaultNative::SEED_PREFIX.as_bytes()],
                    &crate::id(),
                );

                account_metas.push(AccountMetadata::new(crate::id(), false));

                // Vault native account
                account_metas.push(AccountMetadata::new(vault_native_pda, false));

                account_metas.push(AccountMetadata::new(crate::id(), false));
                account_metas.push(AccountMetadata::new(crate::id(), false));
            } else {
                let token_mint_address = Pubkey::from_str(&order.token()).unwrap();

                let (vault_token_pda, _) = Pubkey::find_program_address(
                    &[
                        VAULT_TOKEN_SEED_PREFIX.as_bytes(),
                        &token_mint_address.to_bytes(),
                    ],
                    &crate::id(),
                );

                let solver_token_account =
                    get_associated_token_address(&solver, &token_mint_address);

                // Solver token account
                account_metas.push(AccountMetadata::new(solver_token_account, false));

                // Vault native account (null)
                account_metas.push(AccountMetadata::new(crate::id(), false));

                // Vault token account
                account_metas.push(AccountMetadata::new(vault_token_pda, false));

                // Mint account
                account_metas.push(AccountMetadata::new(token_mint_address, false));
            }

            // Token program
            account_metas.push(AccountMetadata::new(Token::id(), false));

            // Associated token program
            account_metas.push(AccountMetadata::new(AssociatedToken::id(), false));
        }
        MessageType::CANCEL => {
            let cancel = Cancel::try_from(&order_msg.message()).unwrap();
            let order = SwapOrder::try_from(&cancel.order_bytes()).unwrap();

            let (order_finished_pda, _) =
                Pubkey::find_program_address(&[&order.get_hash()], &crate::id());

            // Order finished account
            account_metas.push(AccountMetadata::new(order_finished_pda, false));

            account_metas.push(AccountMetadata::new(crate::id(), false));
        }
    }

    Ok(QueryAccountsPaginateResponse::new(
        account_metas,
        page,
        limit,
    ))
}

pub fn query_fill_accounts(
    ctx: Context<QueryAccountCtx>,
    order: SwapOrder,
    signer: Pubkey,
    solver_address: String,
    page: u8,
    limit: u8,
) -> Result<QueryAccountsPaginateResponse> {
    let config = &ctx.accounts.config;
    let destination_address = Pubkey::from_str(&order.dst_address()).unwrap();

    let (order_finished_pda, _) = Pubkey::find_program_address(&[&order.get_hash()], &crate::id());

    let mut account_metas = vec![
        AccountMetadata::new_readonly(system_program::id(), false),
        AccountMetadata::new(config.key(), false),
        AccountMetadata::new(config.fee_handler, false),
        AccountMetadata::new(destination_address, false),
        AccountMetadata::new(order_finished_pda, false),
    ];

    if order.to_token() == NATIVE_ADDRESS {
        account_metas.push(AccountMetadata::new(crate::id(), false));
        account_metas.push(AccountMetadata::new(crate::id(), false));
        account_metas.push(AccountMetadata::new(crate::id(), false));
        account_metas.push(AccountMetadata::new(crate::id(), false));
    } else {
        let token_mint_address = Pubkey::from_str(&order.to_token()).unwrap();
        let fee_handler_token =
            get_associated_token_address(&config.fee_handler, &token_mint_address);
        let destination_token =
            get_associated_token_address(&destination_address, &token_mint_address);
        let signer_token = get_associated_token_address(&signer, &token_mint_address);

        // Fee handler token account
        account_metas.push(AccountMetadata::new(fee_handler_token, false));

        // Destination token account
        account_metas.push(AccountMetadata::new(destination_token, false));

        // Signer token account
        account_metas.push(AccountMetadata::new(signer_token, false));

        // Mint account
        account_metas.push(AccountMetadata::new(token_mint_address, false));
    }

    // Token program
    account_metas.push(AccountMetadata::new(Token::id(), false));

    // Associated token program
    account_metas.push(AccountMetadata::new(AssociatedToken::id(), false));

    if order.src_nid() == order.dst_nid() {
        let creator = Pubkey::from_str(&order.creator()).unwrap();
        let solver = Pubkey::from_str(&solver_address).unwrap();

        let (order_pda, _) = Pubkey::find_program_address(
            &[
                &creator.to_bytes(),
                order.dst_nid().as_bytes(),
                &order.amount().to_be_bytes(),
                &order.to_amount().to_be_bytes(),
            ],
            &crate::id(),
        );

        // Config account
        account_metas.push(AccountMetadata::new(config.key(), false));

        // Order account
        account_metas.push(AccountMetadata::new(order_pda, false));

        // Order creator account
        account_metas.push(AccountMetadata::new(creator, false));

        // Solver account
        account_metas.push(AccountMetadata::new(solver, false));

        if order.token() == NATIVE_ADDRESS {
            let (vault_native_pda, _) =
                Pubkey::find_program_address(&[VaultNative::SEED_PREFIX.as_bytes()], &crate::id());

            account_metas.push(AccountMetadata::new(crate::id(), false));

            // Vault native account
            account_metas.push(AccountMetadata::new(vault_native_pda, false));

            account_metas.push(AccountMetadata::new(crate::id(), false));
            account_metas.push(AccountMetadata::new(crate::id(), false));
        } else {
            let token_mint_address = Pubkey::from_str(&order.token()).unwrap();
            let solver_token = get_associated_token_address(&solver, &token_mint_address);
            let (vault_token_pda, _) = Pubkey::find_program_address(
                &[
                    VAULT_TOKEN_SEED_PREFIX.as_bytes(),
                    &token_mint_address.to_bytes(),
                ],
                &crate::id(),
            );

            // Solver token account
            account_metas.push(AccountMetadata::new(solver_token, false));

            // Vault native account (null)
            account_metas.push(AccountMetadata::new(crate::id(), false));

            // Vault token account
            account_metas.push(AccountMetadata::new(vault_token_pda, false));

            // Mint account
            account_metas.push(AccountMetadata::new(token_mint_address, false));
        }

        // Token program
        account_metas.push(AccountMetadata::new(Token::id(), false));

        // Associated token program
        account_metas.push(AccountMetadata::new(AssociatedToken::id(), false));
    }

    Ok(QueryAccountsPaginateResponse::new(
        account_metas,
        page,
        limit,
    ))
}

pub fn query_cancel_accounts(
    ctx: Context<QueryAccountCtx>,
    order: SwapOrder,
    page: u8,
    limit: u8,
) -> Result<QueryAccountsPaginateResponse> {
    let config = &ctx.accounts.config;
    let signer = Pubkey::from_str(&order.creator()).unwrap();

    let (order_pda, _) = Pubkey::find_program_address(
        &[
            &signer.to_bytes(),
            order.dst_nid().as_bytes(),
            &order.amount().to_be_bytes(),
            &order.to_amount().to_be_bytes(),
        ],
        &crate::id(),
    );

    let mut account_metas = vec![
        AccountMetadata::new_readonly(system_program::id(), false),
        AccountMetadata::new(config.key(), false),
        AccountMetadata::new(order_pda, false),
    ];

    if order.src_nid() == order.dst_nid() {
        let (order_finished_pda, _) =
            Pubkey::find_program_address(&[&order.get_hash()], &crate::id());

        // Order finished account
        account_metas.push(AccountMetadata::new(order_finished_pda, false));
    } else {
        // null
        account_metas.push(AccountMetadata::new(crate::id(), false));
    }

    Ok(QueryAccountsPaginateResponse::new(
        account_metas,
        page,
        limit,
    ))
}

#[derive(Accounts)]
pub struct QueryAccountCtx<'info> {
    pub config: Account<'info, Config>,
}
