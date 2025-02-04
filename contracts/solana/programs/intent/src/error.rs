use anchor_lang::prelude::error_code;

#[error_code]
pub enum IntentError {
    #[msg("Only Admin")]
    OnlyAdmin,

    #[msg("Only Relayer")]
    OnlyRelayer,

    #[msg("Only fee handler")]
    OnlyFeeHandler,

    #[msg("Invalid network")]
    InvalidNetwork,

    #[msg("Order mismatched")]
    OrderMismatched,

    #[msg("Rlp decode failed")]
    DecodeFailed,

    #[msg("Destination account is not valid")]
    InvalidDestinationAccount,

    #[msg("Solver account is not valid")]
    InvalidSolverAccount,

    #[msg("Fee handler account is not valid")]
    InvalidFeeHandler,

    #[msg("Invalid pubkey")]
    InvalidPubkey,

    #[msg("Signer must be a swap creator")]
    CreatorMustBeSigner,

    #[msg("Order has been already filled")]
    OrderAlreadyFilled,

    #[msg("Duplicate message")]
    DuplicateMessage,

    #[msg("Config account is missing")]
    ConfigAccountIsMissing,

    #[msg("Mint account mismatch")]
    MintAccountMismatch,

    #[msg("Order finished account is missing")]
    OrderFinishedAccountIsMissing,

    #[msg("Order account is missing")]
    OrderAccountIsMissing,

    #[msg("Native vault account is missing")]
    NativeVaultAccountIsMissing,

    #[msg("Token vault account is missing")]
    TokenVaultAccountIsMissing,

    #[msg("Signer token account is missing")]
    SignerTokenAccountIsMissing,

    #[msg("Solver token account is missing")]
    SolverTokenAccountIsMissing,

    #[msg("Creator token account is missing")]
    CreatorTokenAccountIsMissing,

    #[msg("Fee handler token account is missing")]
    FeeHandlerTokenAccountIsMissing,

    #[msg("Order finished account must not be specified")]
    OrderFinishedAccountMustNotBeSpecified,

    #[msg("Vault token account must not be specified")]
    VaultTokenAccountMustNotBeSpecified,

    #[msg("Config account must not be specified")]
    ConfigAccountMustNotBeSpecified,
}
