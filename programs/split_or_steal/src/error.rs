use super::*;

#[error_code]
pub enum SplitOrStealError {
    #[msg("Not enough tokens for requested stake")]
    InsufficientTokens,
    #[msg("The initial tokens amount must be exactly 1,000,000,000.")]
    InvalidInitialTokens,
    #[msg("The mint supply must be exactly 1,000,000,000.")]
    InvalidMintSupply,
    #[msg("The mint decimals must be exactly 9.")]
    InvalidMintDecimals,
    #[msg("The mint authority has not been revoked.")]
    MintAuthorityNotRevoked,
    #[msg("The freeze authority has not been revoked.")]
    FreezeAuthorityNotRevoked,
    #[msg("The slot hash couldn't be found. This should never happen")]
    SlotHashNotFound,
    #[msg("Can only stake between 0 and 100")]
    StakeAmountTooHigh,
    #[msg("Only other program allowed is Compute Budget")]
    InvalidComputeBudgetProgramId,
    #[msg("No instructions after the play_game instruction are allowed")]
    UnexpectedInstruction,
    #[msg("Invalid active program.")]
    InvalidActiveProgram,
    #[msg("Mint finished. All 1,000,000,000 tokens transfered out of the account")]
    MintOver,
    #[msg("Submitting transaction too close together, only allowed once per 3 slots")]
    PlayedAgainTooSoon,
}
