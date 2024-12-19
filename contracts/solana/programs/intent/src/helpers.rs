use anchor_lang::{
    prelude::*,
    solana_program::{hash, keccak, program::invoke, system_instruction},
};
use anchor_spl::token;

use crate::state::Config;

pub fn transfer_sol<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
    system_program: &AccountInfo<'info>,
) -> Result<()> {
    let ix = system_instruction::transfer(&from.key(), &to.key(), amount);
    invoke(
        &ix,
        &[from.to_owned(), to.to_owned(), system_program.to_owned()],
    )?;

    Ok(())
}

pub fn transfer_sol_signed<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    **from.try_borrow_mut_lamports()? -= amount;
    **to.try_borrow_mut_lamports()? += amount;

    Ok(())
}

pub fn transfer_spl_token<'info>(
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    amount: u64,
    token_program: AccountInfo<'info>,
) -> Result<()> {
    let accounts = token::Transfer {
        from,
        to,
        authority,
    };
    token::transfer(CpiContext::new(token_program, accounts), amount)
}

pub fn transfer_spl_token_signed<'info>(
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    amount: u64,
    token_program: AccountInfo<'info>,
    config: &Account<'info, Config>,
) -> Result<()> {
    let accounts = token::Transfer {
        from,
        to,
        authority,
    };

    let seeds = &[Config::SEED_PREFIX.as_bytes(), &[config.bump]];
    let signer_seeds = &[&seeds[..]];
    token::transfer(
        CpiContext::new_with_signer(token_program, accounts, signer_seeds),
        amount,
    )
}

pub fn get_instruction_data(ix_name: &str, data: Vec<u8>) -> Vec<u8> {
    let preimage = format!("{}:{}", "global", ix_name);

    let mut ix_discriminator = [0u8; 8];
    ix_discriminator.copy_from_slice(&hash::hash(preimage.as_bytes()).to_bytes()[..8]);

    let mut ix_data = Vec::new();
    ix_data.extend_from_slice(&ix_discriminator);
    ix_data.extend_from_slice(&data);

    ix_data
}

pub fn hash_data(data: &Vec<u8>) -> Vec<u8> {
    keccak::hash(&data).to_bytes().to_vec()
}
