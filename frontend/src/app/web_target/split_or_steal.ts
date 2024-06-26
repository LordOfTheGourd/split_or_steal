export type SplitOrSteal = {
  "version": "0.1.0",
  "name": "split_or_steal",
  "instructions": [
    {
      "name": "initializeVault",
      "accounts": [
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "creatorTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "gameVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "gameVaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "tokenAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "playGame",
      "accounts": [
        {
          "name": "player",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "playerProfile",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "playerTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "gameVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "gameVaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "slotHashes",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "instructions",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "choice",
          "type": {
            "defined": "Choice"
          }
        },
        {
          "name": "stakeAmount",
          "type": "u16"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "gameVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "tokenBump",
            "type": "u8"
          },
          {
            "name": "initialTokens",
            "type": "u64"
          },
          {
            "name": "mintRemaining",
            "type": "u64"
          },
          {
            "name": "burnedAmount",
            "type": "u64"
          },
          {
            "name": "participationFlags",
            "type": {
              "array": [
                "u8",
                1000
              ]
            }
          },
          {
            "name": "currentIndex",
            "type": "u16"
          },
          {
            "name": "numZeroStakes",
            "type": "u32"
          },
          {
            "name": "numHundredStakes",
            "type": "u32"
          },
          {
            "name": "numSplits",
            "type": "u16"
          },
          {
            "name": "numSteals",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "playerProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isInitialized",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "lastPlayedSlot",
            "type": "u64"
          },
          {
            "name": "tokensGained",
            "type": "u64"
          },
          {
            "name": "tokensBurned",
            "type": "u64"
          },
          {
            "name": "numGames",
            "type": "u32"
          },
          {
            "name": "numSplitBonuses",
            "type": "u8"
          },
          {
            "name": "averageNumSplits",
            "type": "u64"
          },
          {
            "name": "averageStakeAmount",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Choice",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Split"
          },
          {
            "name": "Steal"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InsufficientTokens",
      "msg": "Not enough tokens for requested stake"
    },
    {
      "code": 6001,
      "name": "InvalidInitialTokens",
      "msg": "The initial tokens amount must be exactly 1,000,000,000."
    },
    {
      "code": 6002,
      "name": "InvalidMintSupply",
      "msg": "The mint supply must be exactly 1,000,000,000."
    },
    {
      "code": 6003,
      "name": "InvalidMintDecimals",
      "msg": "The mint decimals must be exactly 9."
    },
    {
      "code": 6004,
      "name": "MintAuthorityNotRevoked",
      "msg": "The mint authority has not been revoked."
    },
    {
      "code": 6005,
      "name": "FreezeAuthorityNotRevoked",
      "msg": "The freeze authority has not been revoked."
    },
    {
      "code": 6006,
      "name": "SlotHashNotFound",
      "msg": "The slot hash couldn't be found. This should never happen"
    },
    {
      "code": 6007,
      "name": "StakeAmountTooHigh",
      "msg": "Can only stake between 0 and 100"
    },
    {
      "code": 6008,
      "name": "InvalidComputeBudgetProgramId",
      "msg": "Only other program allowed is Compute Budget"
    },
    {
      "code": 6009,
      "name": "UnexpectedInstruction",
      "msg": "No instructions after the play_game instruction are allowed"
    },
    {
      "code": 6010,
      "name": "InvalidActiveProgram",
      "msg": "Invalid active program."
    },
    {
      "code": 6011,
      "name": "MintOver",
      "msg": "Mint finished. All 1,000,000,000 tokens transfered out of the account"
    },
    {
      "code": 6012,
      "name": "PlayedAgainTooSoon",
      "msg": "Submitting transaction too close together, only allowed once per 3 slots"
    }
  ]
};

export const IDL: SplitOrSteal = {
  "version": "0.1.0",
  "name": "split_or_steal",
  "instructions": [
    {
      "name": "initializeVault",
      "accounts": [
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "creatorTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "gameVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "gameVaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "tokenAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "playGame",
      "accounts": [
        {
          "name": "player",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "playerProfile",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "playerTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "gameVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "gameVaultTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "slotHashes",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "instructions",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "choice",
          "type": {
            "defined": "Choice"
          }
        },
        {
          "name": "stakeAmount",
          "type": "u16"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "gameVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "tokenBump",
            "type": "u8"
          },
          {
            "name": "initialTokens",
            "type": "u64"
          },
          {
            "name": "mintRemaining",
            "type": "u64"
          },
          {
            "name": "burnedAmount",
            "type": "u64"
          },
          {
            "name": "participationFlags",
            "type": {
              "array": [
                "u8",
                1000
              ]
            }
          },
          {
            "name": "currentIndex",
            "type": "u16"
          },
          {
            "name": "numZeroStakes",
            "type": "u32"
          },
          {
            "name": "numHundredStakes",
            "type": "u32"
          },
          {
            "name": "numSplits",
            "type": "u16"
          },
          {
            "name": "numSteals",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "playerProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isInitialized",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "lastPlayedSlot",
            "type": "u64"
          },
          {
            "name": "tokensGained",
            "type": "u64"
          },
          {
            "name": "tokensBurned",
            "type": "u64"
          },
          {
            "name": "numGames",
            "type": "u32"
          },
          {
            "name": "numSplitBonuses",
            "type": "u8"
          },
          {
            "name": "averageNumSplits",
            "type": "u64"
          },
          {
            "name": "averageStakeAmount",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Choice",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Split"
          },
          {
            "name": "Steal"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InsufficientTokens",
      "msg": "Not enough tokens for requested stake"
    },
    {
      "code": 6001,
      "name": "InvalidInitialTokens",
      "msg": "The initial tokens amount must be exactly 1,000,000,000."
    },
    {
      "code": 6002,
      "name": "InvalidMintSupply",
      "msg": "The mint supply must be exactly 1,000,000,000."
    },
    {
      "code": 6003,
      "name": "InvalidMintDecimals",
      "msg": "The mint decimals must be exactly 9."
    },
    {
      "code": 6004,
      "name": "MintAuthorityNotRevoked",
      "msg": "The mint authority has not been revoked."
    },
    {
      "code": 6005,
      "name": "FreezeAuthorityNotRevoked",
      "msg": "The freeze authority has not been revoked."
    },
    {
      "code": 6006,
      "name": "SlotHashNotFound",
      "msg": "The slot hash couldn't be found. This should never happen"
    },
    {
      "code": 6007,
      "name": "StakeAmountTooHigh",
      "msg": "Can only stake between 0 and 100"
    },
    {
      "code": 6008,
      "name": "InvalidComputeBudgetProgramId",
      "msg": "Only other program allowed is Compute Budget"
    },
    {
      "code": 6009,
      "name": "UnexpectedInstruction",
      "msg": "No instructions after the play_game instruction are allowed"
    },
    {
      "code": 6010,
      "name": "InvalidActiveProgram",
      "msg": "Invalid active program."
    },
    {
      "code": 6011,
      "name": "MintOver",
      "msg": "Mint finished. All 1,000,000,000 tokens transfered out of the account"
    },
    {
      "code": 6012,
      "name": "PlayedAgainTooSoon",
      "msg": "Submitting transaction too close together, only allowed once per 3 slots"
    }
  ]
};
