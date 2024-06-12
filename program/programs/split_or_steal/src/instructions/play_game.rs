use super::*;

const COMPUTE_BUDGET_PROGRAM_ID: Pubkey = pubkey!("ComputeBudget111111111111111111111111111111");
const NUM_SLOTS_COOLDOWN: u64 = 3;

#[derive(Accounts)]
pub struct PlayGame<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        init_if_needed,
        payer = player,
        seeds = [player.key().as_ref()],
        bump,
        space = 8 + std::mem::size_of::<PlayerProfile>()
    )]
    pub player_profile: Box<Account<'info, PlayerProfile>>,
    #[account(
        init_if_needed,
        payer = player,
        associated_token::authority = player,
        associated_token::mint = mint
    )]
    pub player_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [b"lord of the gourd"],
        bump = game_vault.bump
    )]
    pub game_vault: Box<Account<'info, GameVault>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = game_vault,
        seeds = [game_vault.key().as_ref()],
        bump = game_vault.token_bump
    )]
    pub game_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub creator: SystemAccount<'info>,
    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,
    /// CHECK: slot hashes too big to deserialize normally
    #[account(address = slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,
    /// CHECK: InstructionsSysvar account
    #[account(address = sysvar_instructions::ID)]
    pub instructions: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl PlayGame<'_> {
    pub fn handle(ctx: Context<Self>, choice: Choice, stake_amount: u16) -> Result<()> {
        let PlayGame {
            player,
            player_profile,
            player_token_account,
            game_vault,
            game_vault_token_account,
            creator,
            mint,
            slot_hashes,
            instructions,
            system_program,
            ..
        } = ctx.accounts;

        require_gt!(game_vault.mint_remaining, 0, SplitOrStealError::MintOver);

        // Check that this is the only play_game instruction and only compute budget otherwise
        // Either it's the first and only instruction or the first couple of instructions are compute budget program
        Self::check_top_level_instruction(&instructions.to_account_info(), ctx.program_id)?;

        // Initialize player profile if not already initialized
        if !player_profile.is_initialized {
            let cpi_accounts = system_program::Transfer {
                from: player.to_account_info(),
                to: creator.to_account_info(),
            };
            let cpi_context = CpiContext::new(system_program.to_account_info(), cpi_accounts);
            // Make the account more expensive to create to discourage sybilling
            system_program::transfer(cpi_context, 6_000_000)?;
            player_profile.initialize(ctx.bumps.player_profile);
        }

        // Check they passed in a value between 0 and 100
        require_gte!(100, stake_amount, SplitOrStealError::StakeAmountTooHigh);
        let converted_stake_amount: u64 = stake_amount as u64 * u64::pow(10, 9);
        // Check if player has enough tokens
        require_gte!(
            player_token_account.amount,
            converted_stake_amount,
            SplitOrStealError::InsufficientTokens
        );
        // Only play once per 8 slots / 3 seconds-ish
        let current_slot = Clock::get()?.slot;
        require_gte!(
            current_slot,
            player_profile.last_played_slot + NUM_SLOTS_COOLDOWN,
            SplitOrStealError::PlayedAgainTooSoon
        );
        player_profile.last_played_slot = current_slot;

        // It was too annoying to get zero copy working with array sizes 1,000 and 101.
        // These are the main ones we care about anyway.
        if stake_amount == 0 {
            game_vault.num_zero_stakes = game_vault.num_zero_stakes.saturating_add(1);
        } else if stake_amount == 100 {
            game_vault.num_hundred_stakes = game_vault.num_hundred_stakes.saturating_add(1);
        }

        // Initialize PRNG using blockhash, player pubkey, and remaining supply
        // Get the current slot
        let clock = Clock::get()?;
        let timestamp = clock.unix_timestamp;

        let slot_hashes_data = slot_hashes.try_borrow_data()?;
        let mut previous_slot_hash = [0u8; 32];
        // This is not the previous slot hash lol
        previous_slot_hash.copy_from_slice(&slot_hashes_data[16..48]);
        let seed_array: [u8; 32] = hashv(&[
            &timestamp.to_le_bytes(),
            &previous_slot_hash,
            player.key().as_ref(),
            &game_vault.mint_remaining.to_le_bytes(),
        ])
        .to_bytes();
        let seed_u64 = u64::from_le_bytes(seed_array[..8].try_into().unwrap());

        // Initialize the pseudo-random number generator
        let mut rng = ChaCha8Rng::seed_from_u64(seed_u64);
        let random_index: u16 = rng.gen_range(0..1000);

        // Calculate return based on player and opponent choices
        let opponent_choice = game_vault.get_entry_at(random_index);

        let passes_burn_rate_check = player_profile.passes_burn_rate_check();
        // If the opponent stole, then no matter what the player chose they lose
        if opponent_choice == Choice::Steal || !passes_burn_rate_check {
            if opponent_choice != Choice::Steal && !passes_burn_rate_check {
                msg!("Failed burn rate check")
            }
            if converted_stake_amount != 0 {
                // Burn the stake amount from the player's token account
                let cpi_accounts = Burn {
                    mint: mint.to_account_info(),
                    from: player_token_account.to_account_info(),
                    authority: player.to_account_info(),
                };
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
                token::burn(cpi_ctx, converted_stake_amount)?;
            }

            //Log the result
            Self::log_game_result(
                converted_stake_amount,
                choice,
                opponent_choice,
                0,
                game_vault.mint_remaining,
            );

            // update burn amount on game vault and player profile
            game_vault.burned_amount += converted_stake_amount;
            player_profile.num_games += 1;
            player_profile.tokens_burned += converted_stake_amount;
            player_profile.update_average_num_splits(game_vault.num_splits);
            player_profile.update_average_stake_amount(stake_amount);

            // Update the game vault's participation flags
            // Do this last to not bias the average number of splits
            game_vault.add_entry(choice);

            return Ok(());
        }

        // Logic continues if opponent didn't choose Steal
        let transfer_amount = match choice {
            Choice::Split => {
                // Calculate the split value
                let mut split_value = game_vault.calculate_split_value(converted_stake_amount);
                let can_get_split_bonus = player_profile.can_get_split_bonus();
                if can_get_split_bonus {
                    // Check if they got the split bonus
                    // The split bonus check should happen with 1/num_splits probability,
                    // this results in a constant 1/1000 split bonus prob whenever choosing split
                    let split_bonus_check: u16 = rng.gen_range(0..game_vault.num_splits);
                    let got_split_bonus = split_bonus_check == 0;
                    if got_split_bonus {
                        let split_bonus =
                            game_vault.calculate_split_bonus(converted_stake_amount, split_value);
                        msg!(
                            "Got the split bonus! Split Bonus: {}, Regular Split Value: {}",
                            split_bonus,
                            split_value
                        );
                        split_value += split_bonus;
                        player_profile.num_split_bonuses += 1;
                    }
                } else if player_profile.num_games > 11 {
                    msg!("Player currently too lucky to get a split bonus")
                }
                split_value.min(game_vault.mint_remaining)
            }
            Choice::Steal => {
                // Calculate the steal value
                let steal_value = game_vault.calculate_steal_value(converted_stake_amount);
                steal_value.min(game_vault.mint_remaining)
            }
        };

        let seeds = &[b"lord of the gourd".as_ref(), &[game_vault.bump]];
        let signer = &[&seeds[..]];

        // Transfer tokens to the player
        let cpi_accounts = Transfer {
            from: game_vault_token_account.to_account_info(),
            to: player_token_account.to_account_info(),
            authority: game_vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, transfer_amount)?;

        // Log the result
        Self::log_game_result(
            converted_stake_amount,
            choice,
            opponent_choice,
            transfer_amount,
            game_vault.mint_remaining,
        );
        // Update the game vault's mint remaining and player's tokens gained
        game_vault.mint_remaining -= transfer_amount;
        player_profile.num_games += 1;
        player_profile.tokens_gained += transfer_amount;
        player_profile.update_average_num_splits(game_vault.num_splits);
        player_profile.update_average_stake_amount(stake_amount);

        // Add entry has to happen after calc value so it doesn't mess with internal values
        // Has to happen last so it doesn't bias the average number of splits
        game_vault.add_entry(choice);
        Ok(())
    }

    fn check_top_level_instruction(
        instructions_sysvar: &AccountInfo,
        program_id: &Pubkey,
    ) -> Result<()> {
        // Load the current instruction index
        let current_index = load_current_index_checked(instructions_sysvar)?;

        // Ensure the current instruction is for the active program
        let current_instruction =
            load_instruction_at_checked(current_index as usize, instructions_sysvar)?;
        require_keys_eq!(
            current_instruction.program_id,
            *program_id,
            SplitOrStealError::InvalidActiveProgram
        );

        // If it's not the first, ensure all previous instructions are compute budget program
        for i in 0..current_index {
            let instruction = load_instruction_at_checked(i as usize, instructions_sysvar)?;
            require_keys_eq!(
                instruction.program_id,
                COMPUTE_BUDGET_PROGRAM_ID,
                SplitOrStealError::InvalidComputeBudgetProgramId
            );
        }

        // Ensure there are no instructions after the current instruction
        let next_instruction =
            load_instruction_at_checked((current_index + 1) as usize, instructions_sysvar);
        require!(
            next_instruction.is_err(),
            SplitOrStealError::UnexpectedInstruction
        );

        Ok(())
    }

    fn log_game_result(
        stake_amount: u64,
        player_choice: Choice,
        opponent_choice: Choice,
        outcome_amount: u64,
        mint_remaining: u64,
    ) {
        let player_choice_str = match player_choice {
            Choice::Split => "Split",
            Choice::Steal => "Steal",
        };

        let opponent_choice_str = match opponent_choice {
            Choice::Split => "Split",
            Choice::Steal => "Steal",
        };

        let outcome_amount_str = if opponent_choice == Choice::Steal {
            if stake_amount > 0 {
                format!("-{}", stake_amount)
            } else {
                format!("{}", stake_amount)
            }
        } else {
            outcome_amount.to_string()
        };

        msg!(
            "Results: Stake Amount: {}, Player Choice: {}, Opponent Choice: {}, Outcome Amount: {}, Mint Remaining {}",
            stake_amount,
            player_choice_str,
            opponent_choice_str,
            outcome_amount_str,
            mint_remaining
        );
    }
}
