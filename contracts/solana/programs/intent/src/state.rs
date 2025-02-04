use anchor_lang::prelude::*;

use crate::{constants::*, error::*, types::swap_order::SwapOrder};

#[account(zero_copy)]
pub struct RandomStruct {
    id: u128,
}

#[account]
pub struct VaultNative {
    pub bump: u8,
}

impl VaultNative {
    pub const SEED_PREFIX: &'static str = "vault_native";

    pub const SIZE: usize = ACCOUNT_DISCRIMINATOR_SIZE + 1;

    pub fn new(&mut self, bump: u8) {
        self.bump = bump;
    }
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub fee_handler: Pubkey,
    pub network_id: String,
    pub protocol_fee: u64,
    pub deposit_id: u128,
    pub conn_sn: u128,
    pub bump: u8,
}

impl Config {
    pub const SEED_PREFIX: &'static str = "config";

    pub const SIZE: usize = ACCOUNT_DISCRIMINATOR_SIZE + 32 + 32 + 32 + 8 + 16 + 16 + 16 + 1;

    pub fn new(&mut self, admin: Pubkey, fee_handler: Pubkey, network_id: String, bump: u8) {
        self.admin = admin;
        self.bump = bump;
        self.fee_handler = fee_handler;
        self.network_id = network_id;
        self.protocol_fee = 0;
        self.deposit_id = 0;
        self.conn_sn = 0;
    }

    pub fn ensure_admin(&self, signer: Pubkey) -> Result<()> {
        if self.admin != signer {
            return Err(IntentError::OnlyAdmin.into());
        }
        Ok(())
    }

    pub fn ensure_fee_handler(&self, signer: Pubkey) -> Result<()> {
        if self.fee_handler != signer {
            return Err(IntentError::OnlyAdmin.into());
        }
        Ok(())
    }

    pub fn set_admin(&mut self, account: Pubkey) {
        self.admin = account
    }

    pub fn set_fee_handler(&mut self, fee_handler: Pubkey) {
        self.fee_handler = fee_handler
    }

    pub fn set_protocol_fee(&mut self, fee: u64) {
        self.protocol_fee = fee
    }

    pub fn increment_deposit_id(&mut self) -> u128 {
        self.deposit_id += 1;
        self.deposit_id
    }

    pub fn increment_conn_sn(&mut self) -> u128 {
        self.conn_sn += 1;
        self.conn_sn
    }
}

#[account]
pub struct OrderAccount {
    pub order: SwapOrder,
    pub bump: u8,
}

impl OrderAccount {
    pub const SIZE: usize = ACCOUNT_DISCRIMINATOR_SIZE + 400 + 1;

    pub fn new(&mut self, order: &SwapOrder, bump: u8) {
        self.order = order.to_owned();
        self.bump = bump
    }
}

#[account]
pub struct OrderFinished {
    pub finished: bool,
    pub bump: u8,
}

impl OrderFinished {
    pub const SIZE: usize = ACCOUNT_DISCRIMINATOR_SIZE + 1 + 1;

    pub fn new(&mut self, bump: u8) {
        self.finished = true;
        self.bump = bump
    }
}

#[account]
pub struct Receipt {
    pub received: bool,
    pub bump: u8,
}

impl Receipt {
    pub const SEED_PREFIX: &'static str = "receipt";

    pub const SIZE: usize = ACCOUNT_DISCRIMINATOR_SIZE + 1 + 1;

    pub fn new(&mut self, bump: u8) {
        self.received = true;
        self.bump = bump
    }
}
