use super::*;

const BUFFER_SIZE_U16: u16 = 1_000;
const BUFFER_SIZE_USIZE: usize = 1_000;
const BUFFER_SIZE_U128: u128 = 1_000;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Choice {
    Split = 0,
    Steal = 1,
}

#[account]
pub struct GameVault {
    pub creator: Pubkey,
    pub bump: u8,
    pub token_bump: u8,
    pub initial_tokens: u64,
    pub mint_remaining: u64,
    pub burned_amount: u64,
    pub participation_flags: [u8; BUFFER_SIZE_USIZE], // Use u8 to store enum discriminants
    pub current_index: u16,
    pub num_zero_stakes: u32,
    pub num_hundred_stakes: u32,
    pub num_splits: u16,
    pub num_steals: u16,
}

impl GameVault {
    pub const SCALING_FACTOR: u128 = 1_000_000_000;

    pub fn initialize(&mut self, creator: Pubkey, initial_tokens: u64, bump: u8, token_bump: u8) {
        *self = GameVault {
            creator,
            bump,
            token_bump,
            initial_tokens,
            mint_remaining: initial_tokens,
            burned_amount: 0,
            participation_flags: [Choice::Split as u8; BUFFER_SIZE_USIZE], // All splits initially
            current_index: 0,
            num_splits: BUFFER_SIZE_U16,
            num_zero_stakes: 0,
            num_hundred_stakes: 0,
            num_steals: 0,
        };
    }

    pub fn add_entry(&mut self, entry: Choice) {
        let current_entry = self.get_current_entry();
        match current_entry {
            Choice::Split => self.num_splits -= 1,
            Choice::Steal => self.num_steals -= 1,
        }

        match entry {
            Choice::Split => self.num_splits += 1,
            Choice::Steal => self.num_steals += 1,
        }

        self.participation_flags[self.current_index as usize] = entry as u8;
        self.current_index = (self.current_index + 1) % BUFFER_SIZE_U16;
    }

    // Just here for tests really
    pub fn get_current_entry(&self) -> Choice {
        match self.participation_flags[self.current_index as usize] {
            0 => Choice::Split,
            1 => Choice::Steal,
            _ => panic!("Invalid entry in ring buffer"), // Shouldn't happen
        }
    }

    pub fn get_entry_at(&self, index: u16) -> Choice {
        match self.participation_flags[index as usize] {
            0 => Choice::Split,
            1 => Choice::Steal,
            _ => panic!("Invalid entry in ring buffer"), // Shouldn't happen
        }
    }

    pub fn calculate_split_value(&self, stake_amount: u64) -> u64 {
        if self.num_splits == 0 {
            return 0;
        } else if self.num_splits + self.num_steals != BUFFER_SIZE_U16 {
            panic!("shouldn't happen")
        }
        let stake_amount_u128 = stake_amount as u128;

        let prob_split_scaled = (self.num_splits as u128 * Self::SCALING_FACTOR) / BUFFER_SIZE_U128;
        let one_minus_prob_split_scaled = Self::SCALING_FACTOR - prob_split_scaled;

        let stake_amount_scaled = stake_amount_u128 * Self::SCALING_FACTOR;
        let scaled_one = u128::pow(10, DEFAULT_DECIMALS.into()) * Self::SCALING_FACTOR; // One token is 9 decimals * the scaling factor
        let one_minus_prob_split_times_stake = one_minus_prob_split_scaled * stake_amount_u128;

        let numerator = stake_amount_scaled + scaled_one + one_minus_prob_split_times_stake;
        let denominator = prob_split_scaled * 2;

        (numerator / denominator).try_into().unwrap()
    }

    pub fn calculate_steal_value(&self, stake_amount: u64) -> u64 {
        let split_value = self.calculate_split_value(stake_amount);
        2 * split_value
    }

    pub fn calculate_split_bonus(&self, stake_amount: u64, split_value: u64) -> u64 {
        if self.num_splits == 0 {
            return 0;
        } else if self.num_splits + self.num_steals != BUFFER_SIZE_U16 {
            panic!("shouldn't happen")
        }
        let stake_amount_u128 = stake_amount as u128;
        let split_value_u128 = split_value as u128;

        let num_splits = self.num_splits as u128;
        let num_steals = self.num_steals as u128;

        // Calculate expected payoffs directly
        let expected_steal_payoff =
            num_splits * (2 * split_value_u128) - num_steals * stake_amount_u128;
        let expected_split_payoff = num_splits * split_value_u128 - num_steals * stake_amount_u128;

        let split_bonus_u128 = expected_steal_payoff - expected_split_payoff;
        split_bonus_u128.try_into().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer() {
        let mut vault = GameVault {
            creator: Pubkey::default(),
            bump: 0,
            token_bump: 0,
            mint_remaining: 1_000_000_000,
            participation_flags: [Choice::Split as u8; 1000],
            current_index: 0,
            num_splits: 1_000,
            num_steals: 0,
            initial_tokens: 0,
            num_zero_stakes: 0,
            num_hundred_stakes: 0,
            burned_amount: 0,
        };

        vault.add_entry(Choice::Steal); // Add steal
        assert_eq!(vault.get_current_entry(), Choice::Split); // Current entry is still split because index has moved
        assert_eq!(vault.get_entry_at(0), Choice::Steal); // First entry is steal
        assert_eq!(vault.current_index, 1);

        for i in 1..1000 {
            vault.add_entry(Choice::Steal); // Add steal to fill the buffer
            assert_eq!(vault.get_entry_at(i), Choice::Steal);
        }

        // Adding one more should wrap around to the start
        vault.add_entry(Choice::Split); // Add split
        assert_eq!(vault.get_entry_at(0), Choice::Split);
        assert_eq!(vault.current_index, 1);
    }

    // fn calculate_split_value_float(num_splits: u16, stake_amount: u64) -> f64 {
    //     let prob_split = num_splits as f64 / 1000.0;
    //     let cost_to_play = stake_amount as f64 / 1_000_000_000.0;
    //     (cost_to_play + 1.0 + (1.0 - prob_split) * cost_to_play) / (prob_split * 2.0)
    // }

    fn calculate_split_value_float(num_splits: u16, stake_amount: u64) -> f64 {
        let prob_split = num_splits as f64 / 1000.0;
        println!("Probability split: {}", prob_split);

        let cost_to_play = stake_amount as f64 / 1_000_000_000.0;
        println!("Cost to play: {}", cost_to_play);

        let one_minus_prob_split = 1.0 - prob_split;
        println!("One minus probability split: {}", one_minus_prob_split);

        let one_minus_prob_split_times_cost = one_minus_prob_split * cost_to_play;
        println!(
            "One minus prob split times cost to play: {}",
            one_minus_prob_split_times_cost
        );

        let numerator = cost_to_play + 1.0 + one_minus_prob_split_times_cost;
        println!("Numerator: {}", numerator);

        let denominator = prob_split * 2.0;
        println!("Denominator: {}", denominator);

        let split_value = numerator / denominator;
        println!("Split value: {}", split_value);

        split_value
    }

    fn calculate_steal_value_float(num_splits: u16, stake_amount: u64) -> f64 {
        2.0 * calculate_split_value_float(num_splits, stake_amount)
    }

    #[test]
    fn test_split_value_comparison() {
        const TOLERANCE: u64 = 1; // Define the acceptable difference

        for num_splits in 1..=1000 {
            for stake_amount_base in 1..=100 {
                let game_vault = GameVault {
                    creator: Pubkey::default(),
                    bump: 0,
                    token_bump: 0,
                    mint_remaining: 0,
                    participation_flags: [0; 1000],
                    current_index: 0,
                    num_splits,
                    num_steals: BUFFER_SIZE_U16 - num_splits,
                    initial_tokens: 0,
                    num_zero_stakes: 0,
                    num_hundred_stakes: 0,
                    burned_amount: 0,
                };

                let stake_amount: u64 = stake_amount_base * u64::pow(10, DEFAULT_DECIMALS.into()); // 1 to 100 tokens with 9 decimal places

                // Calculate using integer method
                let split_value_int = game_vault.calculate_split_value(stake_amount);

                // Calculate using float method
                let split_value_float =
                    calculate_split_value_float(game_vault.num_splits, stake_amount);
                let split_value_float_scaled = (split_value_float * 1_000_000_000.0).round() as u64;

                // Print values for debugging
                println!(
                    "num_splits: {}, stake_amount: {}, split_value_int: {}, split_value_float_scaled: {}",
                    num_splits, stake_amount, split_value_int, split_value_float_scaled
                );

                // Assert that the values are close enough
                assert!(
                    (split_value_int as i64 - split_value_float_scaled as i64).abs() <= TOLERANCE as i64,
                    "Values do not match for num_splits = {} and stake_amount = {}: int = {}, float_scaled = {}",
                    num_splits,
                    stake_amount,
                    split_value_int,
                    split_value_float_scaled
                );
            }
        }
    }

    #[test]
    fn test_steal_value_comparison() {
        const TOLERANCE: u64 = 2; // Define the acceptable difference

        for num_splits in 1..=1000 {
            for stake_amount_base in 1..=100 {
                let game_vault = GameVault {
                    creator: Pubkey::default(),
                    bump: 0,
                    token_bump: 0,
                    mint_remaining: 0,
                    participation_flags: [0; 1000],
                    current_index: 0,
                    num_splits,
                    num_steals: BUFFER_SIZE_U16 - num_splits,
                    num_zero_stakes: 0,
                    num_hundred_stakes: 0,
                    initial_tokens: 0,
                    burned_amount: 0,
                };

                let stake_amount: u64 = stake_amount_base * 1_000_000_000; // 1 to 100 tokens with 9 decimal places

                // Calculate using integer method
                let steal_value_int = game_vault.calculate_steal_value(stake_amount);

                // Calculate using float method
                let steal_value_float =
                    calculate_steal_value_float(game_vault.num_splits, stake_amount);
                let steal_value_float_scaled = (steal_value_float * 1_000_000_000.0).round() as u64;

                // Print values for debugging
                println!(
                    "num_splits: {}, stake_amount: {}, steal_value_int: {}, steal_value_float_scaled: {}",
                    num_splits, stake_amount, steal_value_int, steal_value_float_scaled
                );

                // Assert that the values are close enough
                assert!(
                    (steal_value_int as i64 - steal_value_float_scaled as i64).abs() <= TOLERANCE as i64,
                    "Values do not match for num_splits = {} and stake_amount = {}: int = {}, float_scaled = {}",
                    num_splits,
                    stake_amount,
                    steal_value_int,
                    steal_value_float_scaled
                );
            }
        }
    }

    fn calculate_split_bonus_float(
        num_splits: u16,
        stake_amount: u64,
        split_value: u64,
        const_split_bonus_prob: f64,
    ) -> f64 {
        let prob_split = num_splits as f64 / 1000.0;
        let split_bonus_prob = const_split_bonus_prob / prob_split;
        let cost_to_play = stake_amount as f64 / 1_000_000_000.0;
        let split_value_float = split_value as f64 / 1_000_000_000.0;

        let payoff_steal_split = 2.0 * split_value_float;
        let payoff_steal_steal = -cost_to_play;
        let payoff_split_split = split_value_float;
        let payoff_split_steal = -cost_to_play;

        ((prob_split * payoff_steal_split + (1.0 - prob_split) * payoff_steal_steal)
            - (prob_split * payoff_split_split + (1.0 - prob_split) * payoff_split_steal))
            / (split_bonus_prob * prob_split)
    }

    #[test]
    fn test_split_bonus_comparison() {
        const TOLERANCE: u64 = 1; // Define the acceptable difference
        let const_split_bonus_prob: f64 = 0.001; // Example split bonus probability

        for num_splits in 1..=1000 {
            for stake_amount_base in 1..=100 {
                let game_vault = GameVault {
                    creator: Pubkey::default(),
                    bump: 0,
                    token_bump: 0,
                    mint_remaining: 0,
                    participation_flags: [0; 1000],
                    current_index: 0,
                    num_splits,
                    num_steals: 1000 - num_splits,
                    num_zero_stakes: 0,
                    num_hundred_stakes: 0,
                    initial_tokens: 0,
                    burned_amount: 0,
                };

                let stake_amount: u64 = stake_amount_base * 1_000_000_000; // 1 to 100 tokens with 9 decimal places

                // Calculate split value using integer method
                let split_value_int = game_vault.calculate_split_value(stake_amount);

                // Calculate split bonus using integer method
                let split_bonus_int =
                    game_vault.calculate_split_bonus(stake_amount, split_value_int);

                // Calculate split bonus using float method
                let split_bonus_float = calculate_split_bonus_float(
                    num_splits,
                    stake_amount,
                    split_value_int,
                    const_split_bonus_prob,
                );
                let split_bonus_float_scaled = (split_bonus_float * 1_000_000_000.0).round() as u64;

                // Print values for debugging
                println!(
                    "num_splits: {}, stake_amount: {}, split_value_int: {}, split_bonus_int: {}, split_bonus_float_scaled: {}",
                    num_splits, stake_amount, split_value_int, split_bonus_int, split_bonus_float_scaled
                );

                // Assert that the values are close enough
                assert!(
                    (split_bonus_int as i64 - split_bonus_float_scaled as i64).abs() <= TOLERANCE as i64,
                    "Values do not match for num_splits = {} and stake_amount = {}: int = {}, float_scaled = {}",
                    num_splits,
                    stake_amount,
                    split_bonus_int,
                    split_bonus_float_scaled
                );
            }
        }
    }
}
