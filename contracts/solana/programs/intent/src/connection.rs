use anchor_lang::prelude::*;

use crate::{
    error::IntentError,
    event,
    state::{Config, Receipt},
};

pub fn send_message<'info>(
    config: &mut Account<'info, Config>,
    to: String,
    msg: Vec<u8>,
) -> Result<()> {
    let conn_sn = config.increment_conn_sn();

    emit!(event::Message {
        targetNetwork: to,
        sn: conn_sn,
        msg,
    });

    Ok(())
}

pub fn recv_message<'info>(receipt: &mut Account<'info, Receipt>, receipt_bump: u8) -> Result<()> {
    if receipt.received {
        return Err(IntentError::DuplicateMessage.into());
    }

    receipt.new(receipt_bump);

    Ok(())
}
