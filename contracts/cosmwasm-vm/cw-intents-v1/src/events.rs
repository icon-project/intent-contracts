use cosmwasm_std::Event;

use crate::{OrderFill, SwapOrder};

pub fn create_swap_order_event(order: &SwapOrder) -> Event {
    Event::new("SwapOrder")
        .add_attribute("id", order.id.to_string())
        .add_attribute("amount", order.amount.to_string())
        .add_attribute("creator", order.creator.to_string())
        .add_attribute("data", hex::encode(&order.data))
        .add_attribute("destination_address", order.destination_address.to_string())
        .add_attribute("dst_nid", order.dst_nid.to_string())
        .add_attribute("emitter", order.emitter.to_string())
        .add_attribute("min_receive", order.min_receive.to_string())
        .add_attribute("src_nid", order.src_nid.to_string())
        .add_attribute("to_token", order.to_token.to_string())
        .add_attribute("token", order.token.to_string())
}

pub fn create_order_fill_event(
    fill: &OrderFill,
    remaining_amount: u128,
    fee: u128,
    fill_amount: u128,
) -> Event {
    Event::new("OrderFill")
        .add_attribute("id", fill.id.to_string())
        .add_attribute("payout", fill.amount.to_string())
        .add_attribute("solver_address", fill.solver_address.to_string())
        .add_attribute("order_bytes", hex::encode(&fill.order_bytes))
        .add_attribute("closed", fill.closed.to_string())
        .add_attribute("remaining_amount", remaining_amount.to_string())
        .add_attribute("fee", fee.to_string())
        .add_attribute("fill_amount", fill_amount.to_string())
}

pub fn create_send_message_event(nid: String, conn_sn: u128, msg: Vec<u8>) -> Event {
    Event::new("SendMessage")
        .add_attribute("sn", conn_sn.to_string())
        .add_attribute("to", nid.to_string())
        .add_attribute("msg", hex::encode(msg))
}
