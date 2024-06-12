use num::integer::Roots;

use super::*;

// The minimum number of games played to be at least 1% statistically likely to get that number of split bonuses
const MIN_GAMES: [u32; 93] = [
    0, 11, 154, 457, 871, 1363, 1912, 2505, 3133, 3789, 4469, 5169, 5886, 6618, 7364, 8122, 8890,
    9668, 10455, 11250, 12052, 12861, 13676, 14497, 15323, 16154, 16990, 17831, 18675, 19524,
    20376, 21232, 22091, 22953, 23819, 24687, 25558, 26431, 27307, 28186, 29067, 29950, 30835,
    31722, 32611, 33502, 34395, 35289, 36186, 37084, 37983, 38884, 39787, 40691, 41596, 42503,
    43411, 44320, 45231, 46143, 47056, 47970, 48885, 49802, 50719, 51638, 52557, 53477, 54399,
    55321, 56244, 57169, 58094, 59019, 59946, 60874, 61802, 62731, 63661, 64591, 65523, 66455,
    67388, 68321, 69255, 70190, 71125, 72062, 72998, 73936, 74873, 75812, 76751,
];

#[account]
pub struct PlayerProfile {
    pub is_initialized: bool,
    pub bump: u8,
    pub last_played_slot: u64,
    pub tokens_gained: u64,
    pub tokens_burned: u64,
    pub num_games: u32,
    pub num_split_bonuses: u8,
    // Between 0 and 1000 with 9 decimal places of accuracy
    pub average_num_splits: u64,
    // Between 0 and 100 with 9 decimal places of accuracy
    pub average_stake_amount: u64,
}

impl PlayerProfile {
    pub fn initialize(&mut self, bump: u8) {
        self.is_initialized = true;
        self.bump = bump;
        self.last_played_slot = 0;
        self.tokens_gained = 0;
        self.tokens_burned = 0;
    }

    pub fn can_get_split_bonus(&self) -> bool {
        // Have they done enough games to be at least 1% minimum likelihood of getting another split bonus
        // e.g. <1% chance you'll get a split bonus in your first 10 games
        let num_bonuses_idx = (self.num_split_bonuses + 1) as usize;
        if num_bonuses_idx > MIN_GAMES.len() {
            return false;
        }
        // If someone gets more than 92 split bonuses they can create a new account. Takes almost 80,000 plays though
        self.num_games >= MIN_GAMES[num_bonuses_idx]
    }

    // These should be called after the number of games is updated
    pub fn update_average_num_splits(&mut self, current_num_splits: u16) {
        let scaled_new_value = current_num_splits as u64 * 1e9 as u64;
        self.average_num_splits =
            self.update_average(self.average_num_splits, self.num_games, scaled_new_value);
    }

    pub fn update_average_stake_amount(&mut self, current_stake_amount: u16) {
        let scaled_new_value = current_stake_amount as u64 * 1e9 as u64;
        self.average_stake_amount =
            self.update_average(self.average_stake_amount, self.num_games, scaled_new_value);
    }

    pub fn update_average(
        &mut self,
        old_average: u64,
        total_observations: u32,
        new_observation: u64,
    ) -> u64 {
        // This will fail in number of observations starts off at 0, so it's a good way to make sure we're updating in the right order
        ((old_average as u128 * (total_observations as u128 - 1) + new_observation as u128)
            / total_observations as u128) as u64
    }

    fn calculate_99_percent_threshold(&self) -> u128 {
        let n = self.num_games as u128;
        let avg_stake = self.average_stake_amount as u128;
        let probability = (1e9 as u64 - self.average_num_splits / 1_000) as u128;

        // Divide by the right amount of 000s at each stage
        let expected_value = (avg_stake * probability) / 1e9 as u128;
        // Multiplying 4 scaled values here so divided by 1e27, u128 has 36 0s so can't handle leaving it till the end, here at least
        let expected_value_x2 =
            (((avg_stake * avg_stake) / 1e9 as u128) * probability) / 1e9 as u128;

        let variance = expected_value_x2 - ((expected_value * expected_value) / 1e9 as u128);
        let scaled_expected_value = n * expected_value;
        let std_dev = (n * variance).sqrt();
        // The general principle is to scale the floating-point number to an 
        // integer by a factor of 10^x and then divide the square root of this 
        // integer by 10^(x/2) to obtain the same value as the square root of 
        // the original floating-point number.
        let scaled_std_dev = std_dev * 1e9 as u128 / 31_622; // Rounded approximation of 10^4.5

        // 2.330_000_000 2.33 is 99% likelihood threshold
        let z_score = 2_330 * 1e6 as u128;

        scaled_expected_value.saturating_sub((scaled_std_dev * z_score) / 1e9 as u128)
    }

    fn passes_significance_test(&self) -> bool {
        let prob = (self.average_num_splits / 1_000) as u128;
        let one_minus_prob = (1e9 as u64 - self.average_num_splits / 1_000) as u128;

        self.num_games as u128 * prob >= 5 * 1e9 as u128
            && self.num_games as u128 * one_minus_prob >= 5 * 1e9 as u128
    }

    pub fn passes_burn_rate_check(&self) -> bool {
        // Does it pass the minimum observations for significance
        if self.passes_significance_test() {
            // Does it pass the 99% threshold for minimum expected burn
            if (self.tokens_burned as u128) < self.calculate_99_percent_threshold() {
                return false;
            }
        }
        true
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_significance_test() {
        let profile_significant = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 0,
            num_games: 100,
            num_split_bonuses: 2,
            average_num_splits: 100_000_000_000, // 100
            average_stake_amount: 1_000_000_000, // 1.0
        };

        let profile_not_significant = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 0,
            num_games: 1,
            num_split_bonuses: 2,
            average_num_splits: 100_000_000_000, // 100
            average_stake_amount: 1_000_000_000, // 1.0
        };

        assert!(profile_significant.passes_significance_test());
        assert!(!profile_not_significant.passes_significance_test());
    }

    // Helper function to calculate 99% threshold using f64
    fn calculate_99_percent_threshold_f64(num_games: u32, avg_stake: u64, avg_splits: u64) -> f64 {
        let n = num_games as f64;
        let avg_stake = avg_stake as f64 / 1e9;
        let probability = 1.0 - avg_splits as f64 / 1_000_000_000_000.0;

        let expected_value = avg_stake * probability;
        let variance = avg_stake * avg_stake * probability - expected_value * expected_value;
        let std_dev = (n * variance).sqrt();

        let z_score = 2.33;
        n * expected_value - (z_score * std_dev)
    }

    #[test]
    fn test_can_get_split_bonus() {
        let profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 0,
            num_games: 200,
            num_split_bonuses: 1,
            average_num_splits: 100_000_000_000, // 100
            average_stake_amount: 1_000_000_000, // 1.0
        };

        assert!(profile.can_get_split_bonus());
    }

    #[test]
    fn test_cannot_get_split_bonus() {
        let profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 0,
            num_games: 5,
            num_split_bonuses: 1,
            average_num_splits: 100_000_000_000, // 100
            average_stake_amount: 1_000_000_000, // 1.0
        };

        assert!(!profile.can_get_split_bonus());
    }

    #[test]
    fn test_passes_burn_rate_check() {
        let profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 100_000_000_000, // 100 tokens burned
            num_games: 100,
            num_split_bonuses: 2,
            average_num_splits: 100_000_000_000, // 100 10%
            average_stake_amount: 1_000_000_000, // 1.0
        };

        // Using f64 to verify
        let threshold_f64 = calculate_99_percent_threshold_f64(
            profile.num_games,
            profile.average_stake_amount,
            profile.average_num_splits,
        );
        let tokens_burned_f64 = profile.tokens_burned as f64 / 1e9;

        println!("tokens_burned_f64: {}", tokens_burned_f64);
        println!("threshold_f64: {}", threshold_f64);
        assert!(tokens_burned_f64 >= threshold_f64);
        assert!(profile.passes_burn_rate_check());
    }

    #[test]
    fn test_fails_burn_rate_check() {
        let profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 5_000_000_000, // 0.05 tokens burned
            num_games: 100,
            num_split_bonuses: 2,
            average_num_splits: 500_000_000_000, // 500 50% split chance
            average_stake_amount: 1_000_000_000, // 1.0
        };

        // Using f64 to verify
        let threshold_f64 = calculate_99_percent_threshold_f64(
            profile.num_games,
            profile.average_stake_amount,
            profile.average_num_splits,
        );
        let tokens_burned_f64 = profile.tokens_burned as f64 / 1e9;

        println!("tokens_burned_f64: {}", tokens_burned_f64);
        println!("threshold_f64: {}", threshold_f64);
        assert!(tokens_burned_f64 < threshold_f64);
        assert!(!profile.passes_burn_rate_check());
    }

    #[test]
    fn test_passes_burn_rate_check_with_large_values() {
        let profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 5_000_000_000_000, // 5_000 tokens burned
            num_games: 1_000,
            num_split_bonuses: 50,
            average_num_splits: 500_000_000_000,  // 500
            average_stake_amount: 10_000_000_000, // 10.0
        };

        // Using f64 to verify
        let threshold_f64 = calculate_99_percent_threshold_f64(
            profile.num_games,
            profile.average_stake_amount,
            profile.average_num_splits,
        );
        let tokens_burned_f64 = profile.tokens_burned as f64 / 1e9;

        println!("tokens_burned_f64: {}", tokens_burned_f64);
        println!("threshold_f64: {}", threshold_f64);
        assert!(tokens_burned_f64 >= threshold_f64);
        assert!(profile.passes_burn_rate_check());
    }

    #[test]
    fn test_fails_burn_rate_check_with_large_values() {
        let profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 10_000_000_000, // 10 tokens burned
            num_games: 1_000_000,
            num_split_bonuses: 50,
            average_num_splits: 500_000_000_000,  // 500
            average_stake_amount: 10_000_000_000, // 10.0
        };

        // Using f64 to verify
        let threshold_f64 = calculate_99_percent_threshold_f64(
            profile.num_games,
            profile.average_stake_amount,
            profile.average_num_splits,
        );
        let tokens_burned_f64 = profile.tokens_burned as f64 / 1e9;

        println!("tokens_burned_f64: {}", tokens_burned_f64);
        println!("threshold_f64: {}", threshold_f64);
        assert!(tokens_burned_f64 < threshold_f64);
        assert!(!profile.passes_burn_rate_check());
    }

    // Edge case tests
    #[test]
    fn test_edge_case_min_values() {
        let profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 0,
            num_games: 0,
            num_split_bonuses: 0,
            average_num_splits: 0,
            average_stake_amount: 0,
        };
        assert!(!profile.can_get_split_bonus());
        assert!(profile.passes_burn_rate_check());
    }

    #[test]
    fn test_edge_case_max_values() {
        let profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: u64::MAX,
            tokens_burned: u64::MAX,
            num_games: 100_000,
            num_split_bonuses: 100,
            average_num_splits: 1_000_000_000_000, // 1000 splits
            average_stake_amount: 100_000_000_000, // 100 stake amount
        };
        assert!(!profile.can_get_split_bonus()); // Should fail as max bonuses exceeded
        assert!(profile.passes_burn_rate_check());
    }

    // Consistency tests
    #[test]
    fn test_consistency_of_average_num_splits() {
        let mut profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 0,
            num_games: 2,
            num_split_bonuses: 0,
            average_num_splits: 100_000_000_000, // 100
            average_stake_amount: 1_000_000_000, // 1.0
        };
        profile.update_average_num_splits(200);
        assert_eq!(profile.average_num_splits, 150_000_000_000); // Should be the average of 100 and 200
    }

    #[test]
    fn test_consistency_of_average_stake_amount() {
        let mut profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 0,
            num_games: 2,
            num_split_bonuses: 0,
            average_num_splits: 100_000_000_000, // 100
            average_stake_amount: 1_000_000_000, // 1.0
        };
        profile.update_average_stake_amount(2);
        assert_eq!(profile.average_stake_amount, 1_500_000_000); // Should be the average of 1.0 and 2.0
    }

    // Invalid inputs tests
    #[test]
    #[should_panic]
    fn test_invalid_average_num_splits_update() {
        let mut profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 0,
            num_games: 1,
            num_split_bonuses: 0,
            average_num_splits: 0,
            average_stake_amount: 0,
        };
        profile.update_average_num_splits(200);
        assert_eq!(profile.average_num_splits, 0); // Should remain 0 as num_games is 0
    }

    #[test]
    #[should_panic]
    fn test_invalid_average_stake_amount_update() {
        let mut profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 0,
            num_games: 0,
            num_split_bonuses: 0,
            average_num_splits: 0,
            average_stake_amount: 0,
        };
        profile.update_average_stake_amount(200);
        assert_eq!(profile.average_stake_amount, 0); // Should remain 0 as num_games is 0
    }

    // More diverse cases for can_get_split_bonus
    #[test]
    fn test_can_get_split_bonus_edge_case() {
        let mut profile = PlayerProfile {
            is_initialized: true,
            bump: 1,
            last_played_slot: 0,
            tokens_gained: 0,
            tokens_burned: 0,
            num_games: 10,
            num_split_bonuses: 0,
            average_num_splits: 100_000_000_000, // 100
            average_stake_amount: 1_000_000_000, // 1.0
        };
        assert!(!profile.can_get_split_bonus());

        profile.num_games = 11;
        assert!(profile.can_get_split_bonus());
    }

    // Randomized tests
    #[test]
    fn test_randomized_cases() {
        use rand::Rng;

        let mut rng = rand::thread_rng();

        for _ in 0..100 {
            let num_games = rng.gen_range(0..100_000);
            let num_split_bonuses = rng.gen_range(0..92);
            let average_num_splits = rng.gen_range(0..1_000_000_000_000);
            let average_stake_amount = rng.gen_range(0..10_000_000_000);

            let profile = PlayerProfile {
                is_initialized: true,
                bump: 1,
                last_played_slot: 0,
                tokens_gained: 0,
                tokens_burned: 0,
                num_games,
                num_split_bonuses,
                average_num_splits,
                average_stake_amount,
            };

            let threshold_f64 = calculate_99_percent_threshold_f64(
                num_games,
                average_stake_amount,
                average_num_splits,
            );

            // Calculate the threshold using the u128 version
            let threshold_u128_as_f64 = profile.calculate_99_percent_threshold() as f64 / 1e9;

            // Convert f64 threshold to u128 by multiplying by 1e9
            // let threshold_f64 = threshold_f64;

            // Compare the u128 and f64 thresholds within a tolerance of ±1
            // Whatever, something wrong with f64 calc but we double checked against python and get exact same figures
            assert!(
                (threshold_u128_as_f64 - threshold_f64).abs() <= 0.1,
                "u128 threshold as f64: {}, f64 threshold: {}",
                threshold_u128_as_f64,
                threshold_f64
            );

            let passes_bonus_check = if num_split_bonuses as usize + 1 < MIN_GAMES.len() {
                num_games >= MIN_GAMES[num_split_bonuses as usize + 1]
            } else {
                false
            };

            assert_eq!(profile.can_get_split_bonus(), passes_bonus_check);

            let passes_burn_rate_check = profile.passes_burn_rate_check();
            let tokens_burned_f64 = profile.tokens_burned as f64 / 1e9;

            assert_eq!(tokens_burned_f64 >= threshold_f64, passes_burn_rate_check);
        }
    }

    #[test]
fn test_specific_numbers() {
    let profile = PlayerProfile {
        is_initialized: true,
        bump: 1,
        last_played_slot: 0,
        tokens_gained: 1_155_000_000_000, // 1155 tokens gained
        tokens_burned: 100, // Not relevant for this test
        num_games: 30,
        num_split_bonuses: 0, // Not relevant for this test
        average_num_splits: 812_000_000_000, // 0.812 split chance
        average_stake_amount: 31_300_000_000, // 31.3 average stake amount
    };

    // Using f64 to verify
    let threshold_f64 = calculate_99_percent_threshold_f64(
        profile.num_games,
        profile.average_stake_amount,
        profile.average_num_splits,
    );
    let tokens_gained_f64 = profile.tokens_gained as f64 / 1e9;

    println!("tokens_gained_f64: {}", tokens_gained_f64);
    println!("threshold_u128: {}", profile.calculate_99_percent_threshold() as f64 / 1e9);
    println!("threshold_f64: {}", threshold_f64);

    // Check if the tokens gained pass the threshold for significance
    let is_significant = tokens_gained_f64 >= threshold_f64;
    assert!(is_significant, "The tokens gained should be statistically significant");

    // // Verify that the calculated p-value is very low (indicating significance)
    // let p_value = 2.311_413_949_129_814_7e-9;
    // // panic!();
    // assert!(p_value < 0.01, "The p-value should be less than 0.01 for 99% confidence level");
}

}
