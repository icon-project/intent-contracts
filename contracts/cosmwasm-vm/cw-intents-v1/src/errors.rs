use super::*;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),
    #[error("Unauthorized")]
    Unauthorized {},
    #[error("DecodeError {error}")]
    DecodeError { error: String },
    #[error("RollBackMessageMismatch {sequence}")]
    RollBackMismatch { sequence: u64 },
    #[error("InsufficientFunds")]
    InsufficientFunds,
    #[error("OrderAlreadyComplete")]
    OrderAlreadyComplete,

    #[error("PayoutGreaterThanRemaining")]
    PayoutGreaterThanRemaining,
    #[error("InvalidFillOrder")]
    InvalidFillOrder,
    #[error("InvalidCancellation")]
    InvalidCancellation,
    #[error("InvalidMessageType")]
    InvalidMessageType,
    #[error("MessageAlreadyReceived")]
    MessageAlreadyReceived,
}
